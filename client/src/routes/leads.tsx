import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, DragEvent } from 'react'
import { apiClient } from '@/lib/api'
import { PageLayout } from '@/components/layout/PageLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Plus, GripVertical, Phone, Building2, X, Search, Users, Loader2, Calendar, User, Save, Trash2, Edit2 } from 'lucide-react'
import { useClients, useCreateClient } from '@/lib/queries/clients'

export type LeadStatus = 'NEW' | 'DISCUSSION' | 'QUOTED' | 'FOLLOW_UP' | 'WON' | 'LOST';

export interface Lead {
  id: number;
  name: string;
  phone: string;
  companyName: string | null;
  requirement: string;
  status: LeadStatus;
  value: number | null;
  notes: string | null;
  assignedTo: string | null;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

interface ColumnConfig {
  id: LeadStatus;
  title: string;
  color: string;
  bg: string;
  badge: string;
  dot: string;
}

const KANBAN_COLUMNS: ColumnConfig[] = [
  { id: 'NEW', title: 'New Leads', color: 'border-blue-200', bg: 'bg-blue-50/60', badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-400' },
  { id: 'DISCUSSION', title: 'Discussion', color: 'border-purple-200', bg: 'bg-purple-50/60', badge: 'bg-purple-100 text-purple-700', dot: 'bg-purple-400' },
  { id: 'QUOTED', title: 'Proposal Sent', color: 'border-amber-200', bg: 'bg-amber-50/60', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
  { id: 'FOLLOW_UP', title: 'Follow Up', color: 'border-orange-200', bg: 'bg-orange-50/60', badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-400' },
  { id: 'WON', title: 'Closed Won', color: 'border-emerald-200', bg: 'bg-emerald-50/60', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-400' },
  { id: 'LOST', title: 'Closed Lost', color: 'border-red-200', bg: 'bg-red-50/60', badge: 'bg-red-100 text-red-700', dot: 'bg-red-400' },
];

export const Route = createFileRoute('/leads')({
  component: LeadsKanban
})

function LeadsKanban() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [newLead, setNewLead] = useState({ name: '', phone: '', companyName: '', requirement: '' })
  const [draggedLeadId, setDraggedLeadId] = useState<number | null>(null);
  const [selectedLeadForDetail, setSelectedLeadForDetail] = useState<Lead | null>(null);

  const { data: clients = [] } = useClients()
  const { mutateAsync: createClient, isPending: creatingClient } = useCreateClient()

  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [isAddingClient, setIsAddingClient] = useState(false)
  const [newClientData, setNewClientData] = useState({ name: "", email: "", phone: "", address: "" })

  useEffect(() => {
    if (selectedClientId) {
      const client = clients.find(c => c.id.toString() === selectedClientId)
      if (client) {
        setNewLead(prev => ({
          ...prev,
          name: client.name,
          phone: client.phone || '',
        }))
      }
    } else {
      if (!isAddingClient) {
        setNewLead(prev => ({ ...prev, name: '', phone: '' }))
      }
    }
  }, [selectedClientId, clients, isAddingClient])

  const handleCreateClient = async () => {
    try {
      const created = await createClient({
        name: newClientData.name,
        email: newClientData.email,
        phone: newClientData.phone,
        address: newClientData.address
      })
      setIsAddingClient(false)
      setNewClientData({ name: "", email: "", phone: "", address: "" })
      setSelectedClientId(created.id.toString())
    } catch (err) {
      console.error('Gagal membuat client:', err)
      toast.error('Gagal membuat client')
    }
  }

  const fetchLeads = async () => {
    setIsLoading(true)
    try {
      const response = await apiClient.get<any>('/api/leads')
      setLeads(response.data)
    } catch (error) {
      toast.error('Gagal mengambil data leads')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLeads()
  }, [])

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await apiClient.post('/api/leads', {
        ...newLead,
        status: 'NEW',
        orderIndex: leads.filter(l => l.status === 'NEW').length
      })
      toast.success('Lead baru berhasil ditambahkan!')
      setIsAddModalOpen(false)
      setNewLead({ name: '', phone: '', companyName: '', requirement: '' })
      fetchLeads()
    } catch (error) {
      toast.error('Gagal menambahkan lead')
    }
  }

  const handleDragStart = (e: DragEvent<HTMLDivElement>, leadId: number) => {
    setDraggedLeadId(leadId)
    e.dataTransfer.effectAllowed = 'move'
    if (e.target instanceof HTMLElement) {
      e.target.style.opacity = '0.5'
    }
  }

  const handleDragEnd = (e: DragEvent<HTMLDivElement>) => {
    if (e.target instanceof HTMLElement) {
      e.target.style.opacity = '1'
    }
    setDraggedLeadId(null)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: DragEvent<HTMLDivElement>, targetStatus: LeadStatus) => {
    e.preventDefault()
    if (!draggedLeadId) return

    const lead = leads.find(l => l.id === draggedLeadId)
    if (!lead || lead.status === targetStatus) return

    setLeads(currentLeads =>
      currentLeads.map(l =>
        l.id === draggedLeadId
          ? { ...l, status: targetStatus, updatedAt: new Date().toISOString() }
          : l
      )
    )

    try {
      await apiClient.patch(`/api/leads/${draggedLeadId}`, { status: targetStatus })
      toast.success('Status lead diperbarui')
    } catch (error) {
      toast.error('Gagal memperbarui status lead')
      fetchLeads()
    }
  }

  const formatWhatsAppLink = (phone: string) => {
    let formatted = phone.replace(/[^0-9]/g, '');
    if (formatted.startsWith('0')) formatted = '62' + formatted.slice(1);
    return `https://wa.me/${formatted}`;
  }

  const filteredLeads = searchQuery
    ? leads.filter(l =>
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.phone.includes(searchQuery) ||
      (l.companyName && l.companyName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      l.requirement.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : leads;

  return (
    <PageLayout
      title="CRM Pipeline"
      subtitle="Kelola prospek klien dari WhatsApp agar tidak ada yang terlewat."
      actions={
        <Button onClick={() => setIsAddModalOpen(true)} className="bg-black hover:bg-gray-800 text-white">
          <Plus className="w-4 h-4 mr-2" /> Tambah Lead
        </Button>
      }
    >
      <div className="flex flex-col h-full gap-3">
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Cari lead..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Users className="w-4 h-4" />
            <span className="font-medium">{leads.length} total</span>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 grid-rows-3 lg:grid-rows-2 gap-3 flex-1 min-h-0">
          {KANBAN_COLUMNS.map(column => {
            const columnLeads = filteredLeads.filter(l => l.status === column.id)

            return (
              <div
                key={column.id}
                className={`flex flex-col min-h-0 rounded-lg border ${column.color} bg-white overflow-hidden`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, column.id)}
              >
                <div className={`flex-shrink-0 px-3 py-2 flex items-center justify-between border-b ${column.color} ${column.bg}`}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className={`w-2 h-2 rounded-full ${column.dot} flex-shrink-0`} />
                    <span className="text-sm font-semibold text-slate-700 truncate">{column.title}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold flex-shrink-0 ml-2 ${column.badge}`}>
                    {columnLeads.length}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5 min-h-0">
                  {isLoading ? (
                    <div className="text-center text-xs text-slate-400 py-4">Memuat...</div>
                  ) : columnLeads.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-xs text-slate-400 py-6">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                        <Users className="w-4 h-4 text-slate-300" />
                      </div>
                      Tidak ada lead
                    </div>
                  ) : (
                    columnLeads.map(lead => (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, lead.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => setSelectedLeadForDetail(lead)}
                        className="bg-white p-2.5 rounded-lg border border-slate-200/80 cursor-grab active:cursor-grabbing hover:border-blue-300 hover:shadow-sm transition-all group"
                      >
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <h4 className="font-semibold text-sm text-slate-800 leading-tight truncate">{lead.name}</h4>
                          <GripVertical className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        </div>

                        <a
                          href={formatWhatsAppLink(lead.phone)}
                          target="_blank"
                          rel="noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="flex items-center text-xs text-green-600 hover:text-green-800 mb-1"
                        >
                          <Phone className="w-3 h-3 mr-1 flex-shrink-0" />
                          <span className="truncate">{lead.phone}</span>
                        </a>

                        <div className="space-y-0.5 mb-1.5">
                          {lead.companyName && (
                            <div className="flex items-center text-[11px] text-slate-400">
                              <Building2 className="w-3 h-3 mr-1 flex-shrink-0" />
                              <span className="truncate">{lead.companyName}</span>
                            </div>
                          )}
                          <div className="flex items-center text-[11px] text-slate-300">
                            <span className="truncate">
                              {new Date(lead.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 bg-slate-50 p-1.5 rounded border border-slate-100/50">
                          {lead.requirement}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200 my-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-800">Tambah Lead Baru</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Form is here */}
            {/* The rest is kept exactly as is until the end of form, which I'll keep but I'm matching just the modal part and putting LeadDetailModal next to it */}
            <form onSubmit={handleCreateLead} className="space-y-4">
              <div className="space-y-2">
                <Label>Pilih Client Existing (Opsional)</Label>
                <div className="flex gap-2">
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
                  >
                    <option value="">-- Pilih atau Isi Manual --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id.toString()}>{c.name} {c.phone ? `— ${c.phone}` : ''}</option>
                    ))}
                  </select>
                  <Button type="button" variant="outline" onClick={() => setIsAddingClient(v => !v)}>
                    <Plus className="h-4 w-4 mr-2" /> Client Baru
                  </Button>
                </div>
              </div>

              {isAddingClient && (
                <div className="p-4 border rounded-md bg-slate-50 space-y-3">
                  <h3 className="text-sm font-semibold">Tambah Client Baru</h3>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <Label className="text-xs">Nama</Label>
                      <Input value={newClientData.name} onChange={(e) => setNewClientData({ ...newClientData, name: e.target.value })} className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">Email</Label>
                      <Input type="email" value={newClientData.email} onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })} className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">Phone</Label>
                      <Input value={newClientData.phone} onChange={(e) => setNewClientData({ ...newClientData, phone: e.target.value })} className="h-8 text-sm" />
                    </div>
                    <Button type="button" size="sm" onClick={handleCreateClient} disabled={creatingClient} className="mt-1 w-full bg-slate-800 hover:bg-slate-900 text-white">
                      {creatingClient ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <Plus className="h-3 w-3 mr-2" />}
                      Simpan Client
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Nama Klien <span className="text-red-500">*</span></Label>
                <Input
                  id="name"
                  required
                  value={newLead.name}
                  onChange={e => setNewLead({ ...newLead, name: e.target.value })}
                  placeholder="Misal: Bapak Budi"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Nomor WhatsApp <span className="text-red-500">*</span></Label>
                <Input
                  id="phone"
                  required
                  value={newLead.phone}
                  onChange={e => setNewLead({ ...newLead, phone: e.target.value })}
                  placeholder="081234567890"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyName">Nama Perusahaan / Travel (Opsional)</Label>
                <Input
                  id="companyName"
                  value={newLead.companyName}
                  onChange={e => setNewLead({ ...newLead, companyName: e.target.value })}
                  placeholder="PT. Travel Berkah"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="requirement">Kebutuhan / Chat Terakhir <span className="text-red-500">*</span></Label>
                <Textarea
                  id="requirement"
                  required
                  rows={4}
                  value={newLead.requirement}
                  onChange={e => setNewLead({ ...newLead, requirement: e.target.value })}
                  placeholder="Tanya paket LA Umrah bulan depan untuk 40 pax..."
                />
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                  Simpan
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedLeadForDetail && (
        <LeadDetailModal 
          lead={selectedLeadForDetail} 
          onClose={() => setSelectedLeadForDetail(null)} 
          onRefresh={() => {
            fetchLeads();
            setSelectedLeadForDetail(null);
          }} 
        />
      )}
    </PageLayout>
  )
}

function LeadDetailModal({ 
  lead, 
  onClose, 
  onRefresh 
}: { 
  lead: Lead, 
  onClose: () => void, 
  onRefresh: () => void 
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<Partial<Lead>>(lead)

  const handleUpdate = async () => {
    try {
      await apiClient.patch(`/api/leads/${lead.id}`, formData)
      toast.success('Data lead berhasil diperbarui')
      setIsEditing(false)
      onRefresh()
    } catch (error) {
      toast.error('Gagal memperbarui lead')
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus lead ini?')) return
    
    try {
      await apiClient.delete(`/api/leads/${lead.id}`)
      toast.success('Lead berhasil dihapus')
      onClose()
      onRefresh()
    } catch (error) {
      toast.error('Gagal menghapus lead')
    }
  }

  const formatWhatsAppLink = (phone: string) => {
    let formatted = phone.replace(/[^0-9]/g, '');
    if (formatted.startsWith('0')) formatted = '62' + formatted.slice(1);
    return `https://wa.me/${formatted}`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl animate-in zoom-in-95 duration-200 my-8">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-xl font-bold text-slate-800">
            {isEditing ? 'Edit Lead' : 'Detail Lead'}
          </h2>
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <>
                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleDelete}>
                  <Trash2 className="w-4 h-4 mr-1.5" /> Hapus
                </Button>
                <Button size="sm" onClick={() => setIsEditing(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Edit2 className="w-4 h-4 mr-1.5" /> Edit Data
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                  Batal
                </Button>
                <Button size="sm" onClick={handleUpdate} className="bg-green-600 hover:bg-green-700 text-white">
                  <Save className="w-4 h-4 mr-1.5" /> Simpan Perubahan
                </Button>
              </>
            )}
            <button onClick={onClose} className="ml-4 text-slate-400 hover:text-slate-600 p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6">
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
      </div>
    </div>
  )
}
