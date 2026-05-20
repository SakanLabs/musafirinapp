import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api'
import { PageLayout } from '@/components/layout/PageLayout'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Phone, Building2, AlignLeft, Calendar, User, Save, ArrowLeft } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Lead, LeadStatus } from './leads'

export const Route = createFileRoute('/lead-detail/$leadId')({
  component: LeadDetail
})

function LeadDetail() {
  const { leadId } = Route.useParams()
  const router = useRouter()
  const [lead, setLead] = useState<Lead | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<Partial<Lead>>({})

  const fetchLeadDetails = async () => {
    setIsLoading(true)
    try {
      // In a real app we'd fetch by ID, but since we don't have a GET /leads/:id route, 
      // we'll fetch all and filter for now (or I should update the backend).
      // Wait, let's just fetch all and find it since it's a small dataset, 
      // or we can use the /api/leads endpoint and filter.
      const response = await apiClient.get<any>('/api/leads')
      const foundLead = response.data.find((l: Lead) => l.id === parseInt(leadId))
      
      if (foundLead) {
        setLead(foundLead)
        setFormData(foundLead)
      } else {
        toast.error('Lead tidak ditemukan')
      }
    } catch (error) {
      toast.error('Gagal mengambil data lead')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLeadDetails()
  }, [leadId])

  const handleUpdate = async () => {
    try {
      await apiClient.patch(`/api/leads/${leadId}`, formData)
      toast.success('Data lead berhasil diperbarui')
      setIsEditing(false)
      fetchLeadDetails()
    } catch (error) {
      toast.error('Gagal memperbarui lead')
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus lead ini?')) return
    
    try {
      await apiClient.delete(`/api/leads/${leadId}`)
      toast.success('Lead berhasil dihapus')
      router.navigate({ to: '/leads' })
    } catch (error) {
      toast.error('Gagal menghapus lead')
    }
  }

  if (isLoading) return <PageLayout title="Loading..."><div className="p-8">Memuat data...</div></PageLayout>
  if (!lead) return <PageLayout title="Error"><div className="p-8">Lead tidak ditemukan.</div></PageLayout>

  const formatWhatsAppLink = (phone: string) => {
    let formatted = phone.replace(/[^0-9]/g, '');
    if (formatted.startsWith('0')) formatted = '62' + formatted.slice(1);
    return `https://wa.me/${formatted}`;
  }

  return (
    <PageLayout 
      title={isEditing ? 'Edit Lead' : 'Detail Lead'}
      subtitle={lead.name}
      showBackButton={true}
      actions={
        !isEditing ? (
          <div className="flex space-x-2">
            <Button variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleDelete}>
              Hapus Lead
            </Button>
            <Button onClick={() => setIsEditing(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
              Edit Data
            </Button>
          </div>
        ) : (
          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              Batal
            </Button>
            <Button onClick={handleUpdate} className="bg-green-600 hover:bg-green-700 text-white">
              <Save className="w-4 h-4 mr-2" /> Simpan Perubahan
            </Button>
          </div>
        )
      }
    >
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        {isEditing ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Nama Klien</Label>
                <Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Nomor WhatsApp</Label>
                <Input value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Nama Perusahaan / Travel</Label>
                <Input value={formData.companyName || ''} onChange={e => setFormData({...formData, companyName: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={formData.status || 'NEW'} 
                  onChange={e => setFormData({...formData, status: e.target.value as LeadStatus})}
                >
                  <option value="NEW">New Leads</option>
                  <option value="DISCUSSION">Discussion</option>
                  <option value="QUOTED">Proposal Sent</option>
                  <option value="FOLLOW_UP">Follow Up</option>
                  <option value="WON">Closed Won</option>
                  <option value="LOST">Closed Lost</option>
                </select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Kebutuhan (Requirement)</Label>
              <Textarea 
                rows={4}
                value={formData.requirement || ''} 
                onChange={e => setFormData({...formData, requirement: e.target.value})} 
              />
            </div>
            
            <div className="space-y-2">
              <Label>Catatan Internal (Notes)</Label>
              <Textarea 
                rows={3}
                placeholder="Catatan tambahan untuk tim internal..."
                value={formData.notes || ''} 
                onChange={e => setFormData({...formData, notes: e.target.value})} 
              />
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex items-center space-x-4 pb-6 border-b border-slate-100">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-800">{lead.name}</h2>
                <div className="flex items-center text-slate-500 mt-1 space-x-4">
                  {lead.companyName && (
                    <span className="flex items-center"><Building2 className="w-4 h-4 mr-1" /> {lead.companyName}</span>
                  )}
                  <a href={formatWhatsAppLink(lead.phone)} target="_blank" rel="noreferrer" className="flex items-center text-green-600 hover:underline">
                    <Phone className="w-4 h-4 mr-1" /> {lead.phone}
                  </a>
                </div>
              </div>
              <div className="ml-auto">
                <span className={`px-4 py-2 rounded-full text-sm font-bold 
                  ${lead.status === 'NEW' ? 'bg-blue-100 text-blue-700' : 
                    lead.status === 'WON' ? 'bg-green-100 text-green-700' : 
                    lead.status === 'LOST' ? 'bg-red-100 text-red-700' : 
                    'bg-amber-100 text-amber-700'}`}>
                  {lead.status}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Kebutuhan Klien</h3>
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-slate-700 whitespace-pre-wrap">
                  {lead.requirement}
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Catatan Internal</h3>
                <div className="bg-amber-50 p-4 rounded-lg border border-amber-100 text-amber-800 whitespace-pre-wrap min-h-[100px]">
                  {lead.notes || <span className="italic opacity-50">Belum ada catatan...</span>}
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 flex items-center text-sm text-slate-500 space-x-6">
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-2" />
                Dibuat: {new Date(lead.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute:'2-digit' })}
              </div>
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-2" />
                Terakhir Update: {new Date(lead.updatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute:'2-digit' })}
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  )
}
