import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageLayout } from '@/components/layout/PageLayout'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Plus,
  Users,
  Search,
  X,
  Loader2,
  Save,
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck
} from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/dashboard/muthowifs')({
  component: MuthowifsPage,
})

interface Muthowif {
  id: number
  name: string
  phone: string
  iqamaOrPassportNo: string | null
  visaStatus: 'umrah' | 'ziarah' | 'student' | 'worker' | 'resident'
  residentType: string
  residenceLocation: string | null
  lastEducation: string | null
  status: 'idle' | 'assigned' | 'unavailable'
  notes: string | null
  isActive: boolean
  createdAt: string
}

const VISA_STATUSES = ['umrah', 'ziarah', 'student', 'worker', 'resident']
const RESIDENT_TYPES = ['mahasiswa', 'mukimin']

const STATUS_STYLES: Record<string, string> = {
  idle: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  assigned: 'bg-blue-50 text-blue-700 border-blue-200',
  unavailable: 'bg-zinc-100 text-zinc-500 border-zinc-200',
}

const STATUS_LABELS: Record<string, string> = {
  idle: 'Idle',
  assigned: 'Ditugaskan',
  unavailable: 'Tidak Tersedia',
}

const VISA_LABELS: Record<string, string> = {
  umrah: 'Umrah',
  ziarah: 'Ziarah',
  student: 'Student',
  worker: 'Worker',
  resident: 'Resident',
}

function MuthowifsPage() {
  const queryClient = useQueryClient()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    iqamaOrPassportNo: '',
    visaStatus: 'student',
    residentType: 'mahasiswa',
    residenceLocation: '',
    lastEducation: '',
    notes: ''
  })

  const { data, isLoading, error } = useQuery<{ muthowifs: Muthowif[] }>({
    queryKey: ['muthowifs'],
    queryFn: () => apiClient.get('/api/muthowifs')
  })

  const muthowifs = data?.muthowifs || []

  const filteredMuthowifs = useMemo(() => {
    return muthowifs.filter(m => {
      const matchesSearch =
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.residenceLocation || '').toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === 'All' || m.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [muthowifs, searchQuery, statusFilter])

  const createMutation = useMutation({
    mutationFn: (newMuthowif: typeof formData) => apiClient.post('/api/muthowifs', newMuthowif),
    onSuccess: () => {
      toast.success('Muthowif berhasil ditambahkan')
      queryClient.invalidateQueries({ queryKey: ['muthowifs'] })
      setIsDialogOpen(false)
      setFormData({
        name: '', phone: '', iqamaOrPassportNo: '', visaStatus: 'student',
        residentType: 'mahasiswa', residenceLocation: '', lastEducation: '', notes: ''
      })
    },
    onError: (error: any) => {
      toast.error(`Gagal menambahkan Muthowif: ${error.message}`)
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate(formData)
  }

  // Stats
  const totalCount = muthowifs.length
  const idleCount = muthowifs.filter(m => m.status === 'idle').length
  const assignedCount = muthowifs.filter(m => m.status === 'assigned').length
  const unavailableCount = muthowifs.filter(m => m.status === 'unavailable').length

  const hasFilters = searchQuery || statusFilter !== 'All'

  const clearFilters = () => {
    setSearchQuery('')
    setStatusFilter('All')
  }

  const columns: Column<Muthowif>[] = [
    {
      header: 'Muthowif',
      key: 'name',
      sortable: true,
      render: (row) => (
        <div>
          <Link
            to="/dashboard/muthowifs/$id"
            params={{ id: row.id.toString() }}
            className="text-sm font-semibold text-[#111111] hover:underline underline-offset-2"
          >
            {row.name}
          </Link>
          <p className="text-xs text-zinc-400 mt-0.5">{row.phone}</p>
        </div>
      )
    },
    {
      header: 'Tipe / Visa',
      key: 'visaStatus',
      render: (row) => (
        <div>
          <p className="text-xs font-semibold text-zinc-600 capitalize">{row.residentType}</p>
          <p className="text-xs text-zinc-400 mt-0.5 capitalize">{VISA_LABELS[row.visaStatus] || row.visaStatus}</p>
        </div>
      )
    },
    {
      header: 'Lokasi',
      key: 'residenceLocation',
      render: (row) => (
        <span className="text-sm text-zinc-500">{row.residenceLocation || '—'}</span>
      )
    },
    {
      header: 'Pendidikan',
      key: 'lastEducation',
      render: (row) => (
        <span className="text-sm text-zinc-500">{row.lastEducation || '—'}</span>
      )
    },
    {
      header: 'Status',
      key: 'status',
      sortable: true,
      width: 'w-32',
      render: (row) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS_STYLES[row.status] || STATUS_STYLES.unavailable}`}>
          {STATUS_LABELS[row.status] || row.status}
        </span>
      )
    }
  ]

  const inputCls = "h-10 px-3 border-[#e5e7eb] rounded-lg bg-white text-sm focus-visible:ring-0 focus-visible:border-[#111111] shadow-none transition-colors"
  const selectCls = "w-full h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm text-zinc-700 focus:outline-none focus:border-[#111111] transition-colors"
  const labelCls = "text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 block"

  return (
    <PageLayout
      title="Manajemen Muthowif"
      subtitle="Kelola data tim pendamping, visa, dan ketersediaan mereka"
      actions={
        <Button
          onClick={() => setIsDialogOpen(true)}
          className="bg-[#111111] hover:bg-[#242424] text-white h-9 px-4 rounded-md text-xs font-semibold transition-colors border border-transparent shadow-none"
        >
          <Plus className="h-4 w-4 mr-2" />
          Tambah Muthowif
        </Button>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="border border-[#e5e7eb] rounded-xl bg-white p-5 shadow-none hover:border-[#111111]/30 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Total</h3>
              <p className="text-2xl font-bold text-[#111111] tracking-tight">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : totalCount}
              </p>
            </div>
            <Users className="h-5 w-5 text-zinc-300" />
          </div>
        </div>
        <div className="border border-[#e5e7eb] rounded-xl bg-white p-5 shadow-none hover:border-emerald-200 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Idle</h3>
              <p className="text-2xl font-bold text-emerald-600 tracking-tight">
                {isLoading ? '—' : idleCount}
              </p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-emerald-300" />
          </div>
        </div>
        <div className="border border-[#e5e7eb] rounded-xl bg-white p-5 shadow-none hover:border-blue-200 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Ditugaskan</h3>
              <p className="text-2xl font-bold text-blue-600 tracking-tight">
                {isLoading ? '—' : assignedCount}
              </p>
            </div>
            <UserCheck className="h-5 w-5 text-blue-300" />
          </div>
        </div>
        <div className="border border-[#e5e7eb] rounded-xl bg-white p-5 shadow-none hover:border-[#111111]/30 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Tidak Tersedia</h3>
              <p className="text-2xl font-bold text-zinc-500 tracking-tight">
                {isLoading ? '—' : unavailableCount}
              </p>
            </div>
            <Clock className="h-5 w-5 text-zinc-300" />
          </div>
        </div>
      </div>

      {/* Status quick-filter pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { value: 'All', label: 'Semua' },
          { value: 'idle', label: 'Idle' },
          { value: 'assigned', label: 'Ditugaskan' },
          { value: 'unavailable', label: 'Tidak Tersedia' }
        ].map(opt => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value === statusFilter && opt.value !== 'All' ? 'All' : opt.value)}
            className={`h-7 px-3 rounded-full text-xs font-semibold transition-colors border ${
              statusFilter === opt.value
                ? 'bg-[#111111] text-white border-[#111111]'
                : 'bg-white text-zinc-500 border-[#e5e7eb] hover:border-[#111111]/40'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="border border-[#e5e7eb] rounded-xl bg-white p-4 mb-4 shadow-none">
        <div className="flex flex-col md:flex-row gap-3 items-end">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
            <Input
              placeholder="Cari nama, telepon, atau lokasi..."
              className="pl-9 h-10 border-[#e5e7eb] rounded-lg bg-white text-sm focus-visible:ring-0 focus-visible:border-[#111111] shadow-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {hasFilters && (
            <Button
              variant="ghost"
              onClick={clearFilters}
              className="h-10 px-3 text-zinc-500 hover:text-[#111111] hover:bg-zinc-100 text-sm font-medium rounded-lg"
            >
              <X className="h-4 w-4 mr-1.5" />
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden border border-[#e5e7eb] rounded-xl bg-white shadow-none">
        <div className="px-6 py-4 border-b border-[#e5e7eb] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider">Daftar Muthowif</h3>
          {filteredMuthowifs.length !== totalCount && (
            <span className="text-xs text-zinc-400 font-medium">
              {filteredMuthowifs.length} dari {totalCount} muthowif
            </span>
          )}
        </div>
        <DataTable
          data={filteredMuthowifs}
          columns={columns}
          loading={isLoading}
          emptyMessage="Belum ada data muthowif. Tambah muthowif pertama."
          noCard={true}
        />
      </div>

      {/* Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md border border-[#e5e7eb] rounded-2xl shadow-xl p-0 overflow-hidden bg-white">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#e5e7eb]">
            <DialogTitle className="text-base font-bold text-[#111111] tracking-tight">
              Tambah Muthowif Baru
            </DialogTitle>
            <p className="text-xs text-zinc-400 mt-0.5">Masukkan detail informasi tim pendamping</p>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
            {/* Name + Phone */}
            <div>
              <label className={labelCls}>Nama Lengkap *</label>
              <Input
                required
                placeholder="e.g. Ahmad Fauzi"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>No HP (WhatsApp) *</label>
              <Input
                required
                placeholder="+966 55 123 4567"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className={inputCls}
              />
            </div>

            {/* Resident Type + Visa */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Tipe Residen *</label>
                <select
                  value={formData.residentType}
                  onChange={(e) => setFormData({ ...formData, residentType: e.target.value })}
                  className={selectCls}
                  required
                >
                  {RESIDENT_TYPES.map(t => (
                    <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Status Visa *</label>
                <select
                  value={formData.visaStatus}
                  onChange={(e) => setFormData({ ...formData, visaStatus: e.target.value })}
                  className={selectCls}
                  required
                >
                  {VISA_STATUSES.map(v => (
                    <option key={v} value={v}>{VISA_LABELS[v]}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Location + Education */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Lokasi Tinggal</label>
                <Input
                  placeholder="Makkah / Madinah"
                  value={formData.residenceLocation}
                  onChange={(e) => setFormData({ ...formData, residenceLocation: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Pendidikan Terakhir</label>
                <Input
                  placeholder="S1 Syariah, LIPIA..."
                  value={formData.lastEducation}
                  onChange={(e) => setFormData({ ...formData, lastEducation: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Iqama / Passport */}
            <div>
              <label className={labelCls}>No. Iqama / Paspor</label>
              <Input
                placeholder="Nomor dokumen identitas"
                value={formData.iqamaOrPassportNo}
                onChange={(e) => setFormData({ ...formData, iqamaOrPassportNo: e.target.value })}
                className={inputCls}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end items-center space-x-3 pt-2 border-t border-[#f3f4f6]">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="h-9 px-4 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 rounded-md text-xs font-semibold shadow-none"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || !formData.name || !formData.phone}
                className="bg-[#111111] hover:bg-[#242424] text-white h-9 px-5 rounded-md text-xs font-semibold transition-colors border border-transparent shadow-none disabled:opacity-50"
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Simpan Data
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}
