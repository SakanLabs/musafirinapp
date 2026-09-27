import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, DragEvent } from 'react'
import { apiClient } from '@/lib/api'
import { PageLayout } from '@/components/layout/PageLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Plus, GripVertical, Phone, Building2, X, Search, Users, Loader2, Calendar, User, Save, Trash2, Edit2, ShieldAlert } from 'lucide-react'
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
  dot: string;
  badge: string;
}

const KANBAN_COLUMNS: ColumnConfig[] = [
  { 
    id: 'NEW', 
    title: 'New Leads', 
    dot: 'bg-[#fb923c]', // Category Orange
    badge: 'bg-[#fff7ed] text-[#c2410c] border-[#ffedd5]' 
  },
  { 
    id: 'DISCUSSION', 
    title: 'In Discussion', 
    dot: 'bg-[#8b5cf6]', // Category Violet
    badge: 'bg-[#f5f3ff] text-[#6d28d9] border-[#ede9fe]' 
  },
  { 
    id: 'QUOTED', 
    title: 'Proposal Sent', 
    dot: 'bg-[#3b82f6]', // Accent Blue
    badge: 'bg-[#eff6ff] text-[#1d4ed8] border-[#dbeafe]' 
  },
  { 
    id: 'FOLLOW_UP', 
    title: 'Follow Up', 
    dot: 'bg-[#ec4899]', // Category Pink
    badge: 'bg-[#fdf2f8] text-[#be185d] border-[#fce7f3]' 
  },
  { 
    id: 'WON', 
    title: 'Closed Won', 
    dot: 'bg-[#10b981]', // Success Emerald
    badge: 'bg-[#ecfdf5] text-[#047857] border-[#d1fae5]' 
  },
  { 
    id: 'LOST', 
    title: 'Closed Lost', 
    dot: 'bg-[#6b7280]', // Muted Gray
    badge: 'bg-[#f9fafb] text-[#374151] border-[#f3f4f6]' 
  },
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
      toast.success('Client baru berhasil dibuat!')
    } catch (err) {
      console.error('Gagal membuat client:', err)
      toast.error('Gagal membuat client')
    }
  }

  const fetchLeads = async () => {
    setIsLoading(true)
    try {
      const response = await apiClient.get<Lead[]>('/api/leads')
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
      subtitle="Track leads, custom proposals, and inquiries smoothly."
      actions={
        <Button 
          onClick={() => setIsAddModalOpen(true)} 
          className="bg-[#111111] hover:bg-[#242424] text-white text-xs font-semibold px-4 h-9 rounded-md transition-all shadow-xs flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> 
          Add Lead
        </Button>
      }
    >
      <div className="flex flex-col h-full gap-4 max-w-[1400px] mx-auto pb-12">
        {/* Kanban Utility Header */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Filter leads..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs border-[#e5e7eb] rounded-md focus-visible:ring-1 focus-visible:ring-[#111111] focus-visible:border-[#111111] bg-white text-slate-800"
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400 font-semibold select-none">
            <Users className="w-4 h-4" />
            <span>{leads.length} leads registered</span>
          </div>
        </div>

        {/* Kanban Board Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 flex-1 min-h-0">
          {KANBAN_COLUMNS.map(column => {
            const columnLeads = filteredLeads.filter(l => l.status === column.id)

            return (
              <div
                key={column.id}
                className="flex flex-col min-h-[450px] rounded-xl border border-[#e5e7eb] bg-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:shadow-xs transition-shadow"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, column.id)}
              >
                {/* Column Title Header */}
                <div className="flex-shrink-0 px-3 py-2.5 flex items-center justify-between border-b border-[#e5e7eb] bg-gray-50/40">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-2 h-2 rounded-full ${column.dot} shrink-0`} />
                    <span className="text-[13px] font-bold text-[#111111] tracking-[-0.03em] truncate">
                      {column.title}
                    </span>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold border shrink-0 ${column.badge}`}>
                    {columnLeads.length}
                  </span>
                </div>

                {/* Card Container Column */}
                <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 min-h-0 bg-white">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                    </div>
                  ) : columnLeads.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-[11px] text-gray-400 py-12 select-none">
                      <div className="w-8 h-8 rounded-full bg-[#f5f5f5] flex items-center justify-center mb-2">
                        <Users className="w-4 h-4 text-gray-300" />
                      </div>
                      <span>No prospects</span>
                    </div>
                  ) : (
                    columnLeads.map(lead => (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, lead.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => setSelectedLeadForDetail(lead)}
                        className="bg-white p-3.5 rounded-lg border border-[#e5e7eb] cursor-grab active:cursor-grabbing hover:border-[#111111] hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)] transition-all duration-150 group relative"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <h4 className="font-bold text-[13px] text-[#111111] tracking-[-0.02em] leading-tight truncate">
                            {lead.name}
                          </h4>
                          <GripVertical className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 cursor-grab" />
                        </div>

                        {/* WhatsApp Contact Badge */}
                        <a
                          href={formatWhatsAppLink(lead.phone)}
                          target="_blank"
                          rel="noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="inline-flex items-center text-[10px] text-[#047857] hover:text-[#065f46] font-semibold bg-[#ecfdf5] border border-[#d1fae5] px-2 py-0.5 rounded-full transition-colors mb-2.5 w-fit"
                        >
                          <Phone className="w-2.5 h-2.5 mr-1 shrink-0" />
                          <span className="truncate">{lead.phone}</span>
                        </a>

                        <div className="space-y-1 mb-2.5">
                          {lead.companyName && (
                            <div className="flex items-center text-[10px] text-gray-400 font-semibold">
                              <Building2 className="w-3 h-3 mr-1 shrink-0 text-gray-300" />
                              <span className="truncate">{lead.companyName}</span>
                            </div>
                          )}
                          <div className="flex items-center text-[9px] font-bold text-gray-400 uppercase tracking-wider select-none">
                            <Calendar className="w-2.5 h-2.5 mr-1 text-gray-300" />
                            <span>
                              {new Date(lead.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                        </div>

                        {/* Text Requirement Card Fragment */}
                        <p className="text-[11px] text-[#4b5563] leading-relaxed line-clamp-2 bg-[#f5f5f5] p-2 rounded-md border border-[#e5e7eb]/40 font-medium">
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

      {/* Add Lead Dialog Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 border border-[#e5e7eb] animate-in zoom-in-95 duration-150 my-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-md font-bold text-[#111111] tracking-[-0.03em]">Add New Prospect Lead</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-[#111111] transition-colors p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleCreateLead} className="space-y-4 text-xs font-medium">
              <div className="space-y-1.5">
                <Label className="text-[#374151] font-semibold text-xs">Pilih Client Existing (Opsional)</Label>
                <div className="flex gap-2">
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-[#e5e7eb] bg-white px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#111111] focus-visible:border-[#111111]"
                  >
                    <option value="">-- Pilih atau Isi Manual --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id.toString()}>{c.name} {c.phone ? `— ${c.phone}` : ''}</option>
                    ))}
                  </select>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsAddingClient(v => !v)}
                    className="text-xs h-9 px-3 border-[#e5e7eb] hover:bg-gray-50 text-[#374151] font-semibold"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Client Baru
                  </Button>
                </div>
              </div>

              {isAddingClient && (
                <div className="p-4 border border-[#e5e7eb] rounded-lg bg-gray-50/50 space-y-3">
                  <h3 className="text-xs font-bold text-[#111111]">Tambah Client Baru</h3>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-gray-500">Nama</Label>
                      <Input value={newClientData.name} onChange={(e) => setNewClientData({ ...newClientData, name: e.target.value })} className="h-8 text-xs border-[#e5e7eb] rounded bg-white" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-gray-500">Email</Label>
                      <Input type="email" value={newClientData.email} onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })} className="h-8 text-xs border-[#e5e7eb] rounded bg-white" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-gray-500">Phone</Label>
                      <Input value={newClientData.phone} onChange={(e) => setNewClientData({ ...newClientData, phone: e.target.value })} className="h-8 text-xs border-[#e5e7eb] rounded bg-white" />
                    </div>
                    <Button 
                      type="button" 
                      onClick={handleCreateClient} 
                      disabled={creatingClient} 
                      className="mt-1 w-full bg-[#111111] hover:bg-[#242424] text-white text-xs h-8 rounded font-semibold"
                    >
                      {creatingClient ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                      Simpan Client
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-[#374151] font-semibold text-xs">Nama Klien <span className="text-red-500">*</span></Label>
                <Input
                  id="name"
                  required
                  value={newLead.name}
                  onChange={e => setNewLead({ ...newLead, name: e.target.value })}
                  placeholder="Bapak Budi"
                  className="h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-[#374151] font-semibold text-xs">Nomor WhatsApp <span className="text-red-500">*</span></Label>
                <Input
                  id="phone"
                  required
                  value={newLead.phone}
                  onChange={e => setNewLead({ ...newLead, phone: e.target.value })}
                  placeholder="081234567890"
                  className="h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="companyName" className="text-[#374151] font-semibold text-xs">Nama Perusahaan / Travel (Opsional)</Label>
                <Input
                  id="companyName"
                  value={newLead.companyName}
                  onChange={e => setNewLead({ ...newLead, companyName: e.target.value })}
                  placeholder="PT. Travel Berkah"
                  className="h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="requirement" className="text-[#374151] font-semibold text-xs">Kebutuhan / Chat Terakhir <span className="text-red-500">*</span></Label>
                <Textarea
                  id="requirement"
                  required
                  rows={4}
                  value={newLead.requirement}
                  onChange={e => setNewLead({ ...newLead, requirement: e.target.value })}
                  placeholder="Tanya paket LA Umrah bulan depan untuk 40 pax..."
                  className="border-[#e5e7eb] rounded-md focus-visible:ring-[#111111]"
                />
              </div>

              <div className="pt-4 flex justify-end space-x-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-xs h-9 border-[#e5e7eb] hover:bg-gray-50 text-[#374151]"
                >
                  Batal
                </Button>
                <Button 
                  type="submit" 
                  className="bg-[#111111] hover:bg-[#242424] text-white text-xs h-9 font-semibold px-4 rounded-md transition-all shadow-xs"
                >
                  Simpan Lead
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Dialog Modal */}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl border border-[#e5e7eb] animate-in zoom-in-95 duration-150 my-8 overflow-hidden">
        {/* Modal Toolbar Header */}
        <div className="flex items-center justify-between border-b border-[#e5e7eb] px-6 py-4 bg-gray-50/20">
          <h2 className="text-md font-bold text-[#111111] tracking-[-0.03em]">
            {isEditing ? 'Edit Lead Specifications' : 'Lead Specifications'}
          </h2>
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50 text-xs font-semibold h-8 rounded-md" 
                  onClick={handleDelete}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Hapus Lead
                </Button>
                <Button 
                  size="sm" 
                  onClick={() => setIsEditing(true)} 
                  className="bg-[#111111] hover:bg-[#242424] text-white text-xs font-semibold h-8 rounded-md"
                >
                  <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit Data
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsEditing(false)}
                  className="text-xs h-8 border-[#e5e7eb] text-gray-600"
                >
                  Batal
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleUpdate} 
                  className="bg-[#111111] hover:bg-[#242424] text-white text-xs font-semibold h-8 rounded-md"
                >
                  <Save className="w-3.5 h-3.5 mr-1" /> Simpan
                </Button>
              </>
            )}
            <button onClick={onClose} className="ml-4 text-gray-400 hover:text-[#111111] p-1 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body content */}
        <div className="p-6">
          {isEditing ? (
            <div className="space-y-6 text-xs font-medium">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <Label className="text-[#374151] font-semibold text-xs">Nama Klien</Label>
                  <Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111]" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[#374151] font-semibold text-xs">Nomor WhatsApp</Label>
                  <Input value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} className="h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111]" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[#374151] font-semibold text-xs">Nama Perusahaan / Travel</Label>
                  <Input value={formData.companyName || ''} onChange={e => setFormData({...formData, companyName: e.target.value})} className="h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111]" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[#374151] font-semibold text-xs">Status</Label>
                  <select 
                    className="flex h-9 w-full rounded-md border border-[#e5e7eb] bg-white px-3 py-1 text-xs focus-visible:ring-[#111111]"
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
              
              <div className="space-y-1.5">
                <Label className="text-[#374151] font-semibold text-xs">Kebutuhan (Requirement)</Label>
                <Textarea 
                  rows={4}
                  value={formData.requirement || ''} 
                  onChange={e => setFormData({...formData, requirement: e.target.value})} 
                  className="border-[#e5e7eb] rounded-md focus-visible:ring-[#111111]"
                />
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-[#374151] font-semibold text-xs">Catatan Internal (Notes)</Label>
                <Textarea 
                  rows={3}
                  placeholder="Catatan tambahan untuk tim internal..."
                  value={formData.notes || ''} 
                  onChange={e => setFormData({...formData, notes: e.target.value})} 
                  className="border-[#e5e7eb] rounded-md focus-visible:ring-[#111111]"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Top Summary Block */}
              <div className="flex flex-col md:flex-row md:items-center space-x-0 md:space-x-4 pb-6 border-b border-[#e5e7eb] gap-4">
                <div className="w-14 h-14 bg-gray-50 border border-[#e5e7eb] rounded-full flex items-center justify-center shrink-0">
                  <User className="w-6 h-6 text-[#111111]" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#111111] tracking-[-0.03em]">{lead.name}</h2>
                  <div className="flex flex-wrap items-center text-xs text-gray-500 mt-1 gap-x-4 gap-y-1.5">
                    {lead.companyName && (
                      <span className="flex items-center text-gray-400 font-semibold">
                        <Building2 className="w-3.5 h-3.5 mr-1 text-gray-300" /> 
                        {lead.companyName}
                      </span>
                    )}
                    <a 
                      href={formatWhatsAppLink(lead.phone)} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="inline-flex items-center text-[#047857] hover:underline font-semibold bg-[#ecfdf5] border border-[#d1fae5] px-2 py-0.5 rounded-full"
                    >
                      <Phone className="w-3 h-3 mr-1" /> {lead.phone}
                    </a>
                  </div>
                </div>
                
                {/* Visual Status Indicator Tag */}
                <div className="ml-0 md:ml-auto self-start md:self-center">
                  <span className={`px-4 py-1.5 rounded-full text-xs font-bold border
                    ${lead.status === 'NEW' ? 'bg-[#fff7ed] text-[#c2410c] border-[#ffedd5]' : 
                      lead.status === 'WON' ? 'bg-[#ecfdf5] text-[#047857] border-[#d1fae5]' : 
                      lead.status === 'LOST' ? 'bg-[#f9fafb] text-[#374151] border-[#f3f4f6]' : 
                      'bg-[#eff6ff] text-[#1d4ed8] border-[#dbeafe]'}`}>
                    {lead.status === 'NEW' ? 'New Leads' :
                     lead.status === 'DISCUSSION' ? 'In Discussion' :
                     lead.status === 'QUOTED' ? 'Proposal Sent' :
                     lead.status === 'FOLLOW_UP' ? 'Follow Up' :
                     lead.status === 'WON' ? 'Closed Won' : 'Closed Lost'}
                  </span>
                </div>
              </div>

              {/* Requirement & Notes Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Kebutuhan Klien</h3>
                  <div className="bg-[#f5f5f5] p-4 rounded-xl border border-gray-200/40 text-xs text-[#374151] leading-relaxed whitespace-pre-wrap font-medium">
                    {lead.requirement}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Catatan Internal</h3>
                  <div className="bg-[#fffbeb] p-4 rounded-xl border border-[#fef3c7] text-xs text-[#78350f] leading-relaxed whitespace-pre-wrap min-h-[100px] font-medium">
                    {lead.notes || <span className="italic opacity-40">Belum ada catatan internal...</span>}
                  </div>
                </div>
              </div>

              {/* Bottom dates metadata */}
              <div className="pt-6 border-t border-[#e5e7eb] flex flex-col sm:flex-row items-start sm:items-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider gap-y-2 gap-x-6 select-none">
                <div className="flex items-center">
                  <Calendar className="w-3.5 h-3.5 mr-1.5 text-gray-300" />
                  Created: {new Date(lead.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute:'2-digit' })}
                </div>
                <div className="flex items-center">
                  <Calendar className="w-3.5 h-3.5 mr-1.5 text-gray-300" />
                  Last Updated: {new Date(lead.updatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute:'2-digit' })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
