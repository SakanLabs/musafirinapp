import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api'
import { toast } from 'sonner'

interface AssignMuthowifModalProps {
  isOpen: boolean
  onClose: () => void
  referenceType: 'booking' | 'service_order' | 'custom_la'
  referenceId: number
  startDate: string
  endDate: string
}

export function AssignMuthowifModal({
  isOpen,
  onClose,
  referenceType,
  referenceId,
  startDate,
  endDate
}: AssignMuthowifModalProps) {
  const queryClient = useQueryClient()
  const [selectedMuthowif, setSelectedMuthowif] = useState<string>('')
  const [assignmentType, setAssignmentType] = useState<'full' | 'satuan'>('full')
  const [tourType, setTourType] = useState<string>('City Tour Makkah')
  const [taskDescription, setTaskDescription] = useState('')

  // Fetch only idle muthowifs
  const { data, isLoading } = useQuery<{ muthowifs: any[] }>({
    queryKey: ['muthowifs', 'idle'],
    queryFn: () => apiClient.get('/api/muthowifs?status=idle'),
    enabled: isOpen
  })

  const muthowifs = data?.muthowifs || []

  const assignMutation = useMutation({
    mutationFn: (data: any) => apiClient.post('/api/muthowifs/assign', data),
    onSuccess: () => {
      toast.success('Muthowif berhasil ditugaskan!')
      queryClient.invalidateQueries({ queryKey: ['muthowifs'] })
      queryClient.invalidateQueries({ queryKey: ['booking', referenceId.toString()] })
      onClose()
      setSelectedMuthowif('')
      setTaskDescription('')
    },
    onError: (error: any) => {
      toast.error(`Gagal menugaskan Muthowif: ${error.message}`)
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMuthowif) return

    const finalTaskDescription = assignmentType === 'full' 
      ? `[Full Trip Paket] ${taskDescription}`
      : `[${tourType}] ${taskDescription}`

    assignMutation.mutate({
      muthowifId: parseInt(selectedMuthowif),
      referenceType,
      referenceId,
      startDate,
      endDate,
      taskDescription: finalTaskDescription.trim()
    })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tugaskan Muthowif"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>Pilih Muthowif (Tersedia)</Label>
          <Select value={selectedMuthowif} onValueChange={setSelectedMuthowif} required>
            <SelectTrigger>
              <SelectValue placeholder="Pilih Muthowif yang sedang Idle" />
            </SelectTrigger>
            <SelectContent>
              {isLoading ? (
                <SelectItem value="loading" disabled>Loading...</SelectItem>
              ) : muthowifs.length === 0 ? (
                <SelectItem value="empty" disabled>Tidak ada Muthowif tersedia</SelectItem>
              ) : (
                muthowifs.map(m => (
                  <SelectItem key={m.id} value={m.id.toString()}>
                    {m.name} ({m.residentType} - {m.visaStatus})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Tipe Penugasan</Label>
          <Select value={assignmentType} onValueChange={(v: 'full' | 'satuan') => setAssignmentType(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Pilih Tipe Penugasan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full">Full Trip Paket</SelectItem>
              <SelectItem value="satuan">Satuan (City Tour)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {assignmentType === 'satuan' && (
          <div className="space-y-2">
            <Label>Jenis Tour</Label>
            <Select value={tourType} onValueChange={setTourType}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih Jenis Tour" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="City Tour Makkah">City Tour Makkah</SelectItem>
                <SelectItem value="City Tour Madinah">City Tour Madinah</SelectItem>
                <SelectItem value="City Tour Jeddah">City Tour Jeddah</SelectItem>
                <SelectItem value="Tour Lainnya">Tour Lainnya</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label>Catatan / Instruksi Tugas (Opsional)</Label>
          <Textarea 
            value={taskDescription}
            onChange={(e) => setTaskDescription(e.target.value)}
            placeholder="Tambahkan catatan khusus untuk muthowif ini..."
            rows={3}
          />
        </div>

        <div className="pt-4 flex justify-end space-x-2">
          <Button variant="outline" type="button" onClick={onClose} disabled={assignMutation.isPending}>
            Batal
          </Button>
          <Button type="submit" disabled={assignMutation.isPending || !selectedMuthowif}>
            {assignMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Tugaskan
          </Button>
        </div>
      </form>
    </Modal>
  )
}
