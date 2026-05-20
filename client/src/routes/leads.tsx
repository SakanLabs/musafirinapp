import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, DragEvent } from 'react'
import { apiClient } from '@/lib/api'
import { PageLayout } from '@/components/layout/PageLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Plus, GripVertical, Phone, Building2, X, Search, Users } from 'lucide-react'

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
                        onClick={() => window.location.href = `/lead-detail/${lead.id}`}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-800">Tambah Lead Baru</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="space-y-4">
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
    </PageLayout>
  )
}
