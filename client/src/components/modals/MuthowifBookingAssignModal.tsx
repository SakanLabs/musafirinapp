import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertTriangle, CheckCircle2, Loader2, MapPin, Phone, Search, UserCheck } from 'lucide-react'
import { toast } from 'sonner'
import { formatOperationalDate } from '@/lib/date'
import {
  useAssignMuthowifBooking,
  useMuthowifAssignmentOptions,
  type MuthowifAssignmentOption
} from '@/lib/queries/muthowifBookings'

interface MuthowifBookingAssignModalProps {
  isOpen: boolean
  onClose: () => void
  bookingId: number
  bookingNumber: string
  bookingDateTime: string
  currentMuthowifId: number | null
}

const STATUS_STYLES: Record<MuthowifAssignmentOption['status'], { label: string; className: string }> = {
  idle: { label: 'Tersedia', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  assigned: { label: 'Sedang Bertugas', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  unavailable: { label: 'Tidak Tersedia', className: 'bg-rose-50 text-rose-700 border-rose-200' },
}

const RESIDENT_LABELS: Record<string, string> = {
  mahasiswa: 'Mahasiswa',
  mukimin: 'Mukimin',
}

export function MuthowifBookingAssignModal({
  isOpen,
  onClose,
  bookingId,
  bookingNumber,
  bookingDateTime,
  currentMuthowifId,
}: MuthowifBookingAssignModalProps) {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(currentMuthowifId)
  const { data, isLoading } = useMuthowifAssignmentOptions(bookingId, isOpen)
  const assignMutation = useAssignMuthowifBooking()

  useEffect(() => {
    if (isOpen) {
      setSearch('')
      setSelectedId(currentMuthowifId)
    }
  }, [isOpen, currentMuthowifId])

  // Free muthowifs without same-day conflicts first, then by workload
  const options = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return (data?.options || [])
      .filter((m) =>
        !keyword ||
        m.name.toLowerCase().includes(keyword) ||
        m.phone?.toLowerCase().includes(keyword) ||
        m.residenceLocation?.toLowerCase().includes(keyword)
      )
      .sort((a, b) => {
        const rank = (m: MuthowifAssignmentOption) =>
          (m.id === currentMuthowifId ? -10 : 0) + (m.status === 'unavailable' ? 2 : 0) + (m.conflicts.length > 0 ? 1 : 0)
        return rank(a) - rank(b) || a.upcomingCount - b.upcomingCount || a.name.localeCompare(b.name)
      })
  }, [data, search, currentMuthowifId])

  const selected = options.find((m) => m.id === selectedId) || data?.options.find((m) => m.id === selectedId)

  const handleSave = async () => {
    if (!selectedId) {
      toast.error('Pilih muthowif terlebih dahulu')
      return
    }
    if (selected?.conflicts.length) {
      const list = selected.conflicts.map((c) => c.number).join(', ')
      if (!window.confirm(`${selected.name} sudah bertugas di hari yang sama (${list}). Tetap tugaskan?`)) return
    }
    try {
      await assignMutation.mutateAsync({ id: bookingId, muthowifId: selectedId })
      toast.success(currentMuthowifId ? 'Muthowif berhasil diganti' : 'Muthowif berhasil ditugaskan')
      onClose()
    } catch (error: any) {
      toast.error(error?.message || 'Gagal menugaskan muthowif')
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Penugasan Muthowif" size="lg">
      <div className="space-y-4">
        <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-mono font-semibold text-zinc-800">{bookingNumber}</span>
          <span className="text-zinc-600">
            Jadwal: <strong>{formatOperationalDate(bookingDateTime, 'datetime')} WAS</strong>
          </span>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, nomor HP, atau lokasi tinggal..."
            className="pl-9 h-9 text-sm"
            autoFocus
          />
        </div>

        <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-zinc-500 text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Memuat daftar muthowif...
            </div>
          ) : options.length === 0 ? (
            <div className="text-center py-10 text-sm text-zinc-500">
              {data?.options.length ? 'Tidak ada muthowif yang cocok dengan pencarian.' : 'Belum ada muthowif aktif. Tambahkan dulu di menu Muthowif.'}
            </div>
          ) : (
            options.map((m) => {
              const isSelected = m.id === selectedId
              const isCurrent = m.id === currentMuthowifId
              const status = STATUS_STYLES[m.status] || STATUS_STYLES.idle
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedId(m.id)}
                  className={`w-full text-left rounded-xl border p-3 transition-all ${
                    isSelected ? 'border-zinc-900 ring-1 ring-zinc-900 bg-zinc-50' : 'border-zinc-200 hover:border-zinc-400 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-zinc-900">{m.name}</span>
                        {isCurrent && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-900 text-white">Saat ini</span>
                        )}
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${status.className}`}>{status.label}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap text-[11px] text-zinc-500">
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{m.phone}</span>
                        {m.residenceLocation && (
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{m.residenceLocation}</span>
                        )}
                        <span>{RESIDENT_LABELS[m.residentType] || m.residentType}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {isSelected ? (
                        <CheckCircle2 className="w-5 h-5 text-zinc-900 ml-auto" />
                      ) : (
                        <span className="text-[11px] text-zinc-500">{m.upcomingCount} tugas mendatang</span>
                      )}
                    </div>
                  </div>
                  {m.conflicts.length > 0 && (
                    <div className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                      <span>
                        Bentrok di hari yang sama:{' '}
                        {m.conflicts.map((c) => `${c.number} (${formatOperationalDate(c.dateTime, 'datetime').split(' ').pop()}, ${c.guestName})`).join('; ')}
                      </span>
                    </div>
                  )}
                </button>
              )
            })
          )}
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={assignMutation.isPending} className="h-9 text-xs">
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={assignMutation.isPending || !selectedId || selectedId === currentMuthowifId}
            className="h-9 text-xs bg-zinc-900 hover:bg-zinc-800 text-white"
          >
            {assignMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <UserCheck className="w-3.5 h-3.5 mr-1.5" />}
            {currentMuthowifId ? 'Ganti Muthowif' : 'Tugaskan'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
