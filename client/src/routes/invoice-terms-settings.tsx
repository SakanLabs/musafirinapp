import { createFileRoute, redirect, Link } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { PageLayout } from '@/components/layout/PageLayout'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { authService } from '@/lib/auth'
import {
  useInvoiceTermsSettings,
  useUpdateInvoiceTermsSetting,
  useResetInvoiceTermsSetting,
  type InvoiceTermsSetting
} from '@/lib/queries/invoices'
import {
  FileText,
  Building,
  Car,
  Package,
  UserCheck,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Clock,
  Sparkles,
  FileCode,
  CheckCircle2,
  Eye,
  SlidersHorizontal,
  ArrowLeft,
  Loader2,
  Info
} from 'lucide-react'

export const Route = createFileRoute('/invoice-terms-settings')({
  beforeLoad: async () => {
    const isAuthenticated = await authService.isAuthenticated()
    if (!isAuthenticated) {
      throw redirect({ to: '/login' })
    }
    const user = await authService.getCurrentUser()
    const allowedRoles = ['admin', 'owner', 'finance']
    if (!user || !allowedRoles.includes(user.role)) {
      throw redirect({ to: '/invoices' })
    }
  },
  component: InvoiceTermsSettingsPage,
})

interface CategoryMeta {
  id: string
  label: string
  icon: typeof Building
  desc: string
  badgeText: string
}

const CATEGORIES: CategoryMeta[] = [
  {
    id: 'hotel',
    label: 'Hotel & Umum',
    icon: Building,
    desc: 'Invoice reservasi hotel standar, flat rate, dan kombinasi layanan',
    badgeText: 'invoice.html & invoice-simple.html'
  },
  {
    id: 'manual',
    label: 'Invoice Manual',
    icon: FileText,
    desc: 'Invoice manual yang dibuat via form custom admin',
    badgeText: 'manual-invoice.html'
  },
  {
    id: 'transportation',
    label: 'Transportasi',
    icon: Car,
    desc: 'Invoice reservasi armada transportasi dan rute perjalanan',
    badgeText: 'transportation-invoice.html'
  },
  {
    id: 'custom_la',
    label: 'Land Arrangement (LA)',
    icon: Package,
    desc: 'Invoice penagihan paket Land Arrangement jamaah',
    badgeText: 'custom-la-invoice.html'
  },
  {
    id: 'muthowif',
    label: 'Muthowif',
    icon: UserCheck,
    desc: 'Invoice penugasan bimbingan ibadah dan muthowif',
    badgeText: 'muthowif-invoice.html'
  },
  {
    id: 'visa',
    label: 'Visa Umrah',
    icon: FileText,
    desc: 'Invoice pengurusan visa umrah & siskopatuh jamaah',
    badgeText: 'invoice-visa.html'
  }
]

function InvoiceTermsSettingsPage() {
  const { data: allSettings = [], isLoading, refetch } = useInvoiceTermsSettings()
  const updateMutation = useUpdateInvoiceTermsSetting()
  const resetMutation = useResetInvoiceTermsSetting()

  const [activeTab, setActiveTab] = useState<string>('hotel')
  const [activeMode, setActiveMode] = useState<'list' | 'raw'>('list')

  // Form states for current active category
  const [title, setTitle] = useState<string>('Ketentuan Pemesanan')
  const [checkInTime, setCheckInTime] = useState<string>('16:00')
  const [checkOutTime, setCheckOutTime] = useState<string>('12:00')
  const [termsList, setTermsList] = useState<string[]>([])
  const [rawText, setRawText] = useState<string>('')
  const [isDirty, setIsDirty] = useState<boolean>(false)

  // Populate state when active category or fetched data changes
  useEffect(() => {
    const currentSetting = allSettings.find(s => s.type === activeTab)
    if (currentSetting) {
      setTitle(currentSetting.title || 'Ketentuan Pemesanan')
      setCheckInTime(currentSetting.checkInTime || '16:00')
      setCheckOutTime(currentSetting.checkOutTime || '12:00')
      const items = Array.isArray(currentSetting.terms) ? currentSetting.terms : []
      setTermsList(items)
      setRawText(items.join('\n'))
    } else {
      // Fallback initial values based on category
      if (activeTab === 'transportation') {
        setTitle('Syarat & Ketentuan')
        setTermsList([
          'Pemesanan transportasi terkonfirmasi setelah pembayaran diterima.',
          'Pembatalan: Mengikuti kebijakan operasional armada.',
          'Perubahan jadwal mohon konfirmasi maksimal 24 jam sebelum penjemputan.',
          'Kapasitas bagasi menyesuaikan jenis kendaraan yang dipesan.'
        ])
        setRawText([
          'Pemesanan transportasi terkonfirmasi setelah pembayaran diterima.',
          'Pembatalan: Mengikuti kebijakan operasional armada.',
          'Perubahan jadwal mohon konfirmasi maksimal 24 jam sebelum penjemputan.',
          'Kapasitas bagasi menyesuaikan jenis kendaraan yang dipesan.'
        ].join('\n'))
      } else if (activeTab === 'manual') {
        setTitle('Ketentuan Pemesanan')
        setTermsList([
          'Pemesanan terkonfirmasi setelah pembayaran uang muka / termin disetujui sesuai kesepakatan.',
          'Pembatalan & Perubahan: Mengikuti ketentuan dan kebijakan layanan terkait yang telah disepakati.',
          'Pelunasan wajib diselesaikan paling lambat pada tanggal jatuh tempo yang tertera pada invoice.'
        ])
        setRawText([
          'Pemesanan terkonfirmasi setelah pembayaran uang muka / termin disetujui sesuai kesepakatan.',
          'Pembatalan & Perubahan: Mengikuti ketentuan dan kebijakan layanan terkait yang telah disepakati.',
          'Pelunasan wajib diselesaikan paling lambat pada tanggal jatuh tempo yang tertera pada invoice.'
        ].join('\n'))
      } else {
        setTitle('Ketentuan Pemesanan')
        setTermsList([
          'Pemesanan terkonfirmasi setelah Full Payment.',
          'Pembatalan: Pesanan ini tidak dapat di batalkan dan di refund.',
          'Check-in: {checkInTime} | Check-out: {checkOutTime}.',
          'Perubahan/permintaan khusus tergantung ketersediaan. Harga dapat berubah sebelum pelunasan.'
        ])
        setRawText([
          'Pemesanan terkonfirmasi setelah Full Payment.',
          'Pembatalan: Pesanan ini tidak dapat di batalkan dan di refund.',
          'Check-in: {checkInTime} | Check-out: {checkOutTime}.',
          'Perubahan/permintaan khusus tergantung ketersediaan. Harga dapat berubah sebelum pelunasan.'
        ].join('\n'))
      }
    }
    setIsDirty(false)
  }, [activeTab, allSettings])

  // Sync from raw text to list
  const handleRawTextChange = (text: string) => {
    setRawText(text)
    const lines = text.split('\n').map(l => l.replace(/^[•\-\*]\s*/, '').trim()).filter(Boolean)
    setTermsList(lines)
    setIsDirty(true)
  }

  // Add new item in list mode
  const handleAddItem = () => {
    const next = [...termsList, 'Poin ketentuan baru...']
    setTermsList(next)
    setRawText(next.join('\n'))
    setIsDirty(true)
  }

  // Update item in list mode
  const handleUpdateItem = (index: number, value: string) => {
    const next = [...termsList]
    next[index] = value
    setTermsList(next)
    setRawText(next.join('\n'))
    setIsDirty(true)
  }

  // Remove item
  const handleRemoveItem = (index: number) => {
    const next = termsList.filter((_, i) => i !== index)
    setTermsList(next)
    setRawText(next.join('\n'))
    setIsDirty(true)
  }

  // Move item up
  const handleMoveUp = (index: number) => {
    if (index === 0) return
    const next = [...termsList]
    const temp = next[index - 1]
    next[index - 1] = next[index]
    next[index] = temp
    setTermsList(next)
    setRawText(next.join('\n'))
    setIsDirty(true)
  }

  // Move item down
  const handleMoveDown = (index: number) => {
    if (index === termsList.length - 1) return
    const next = [...termsList]
    const temp = next[index + 1]
    next[index + 1] = next[index]
    next[index] = temp
    setTermsList(next)
    setRawText(next.join('\n'))
    setIsDirty(true)
  }

  // Quick insert helper
  const handleInsertTag = (tag: string, index?: number) => {
    if (index !== undefined) {
      const next = [...termsList]
      next[index] = (next[index] || '') + ' ' + tag
      setTermsList(next)
      setRawText(next.join('\n'))
      setIsDirty(true)
    } else {
      const next = [...termsList, tag]
      setTermsList(next)
      setRawText(next.join('\n'))
      setIsDirty(true)
    }
  }

  // Save changes
  const handleSave = async () => {
    const cleanedTerms = termsList.map(t => t.trim()).filter(Boolean)
    if (cleanedTerms.length === 0) {
      toast.error('Minimal harus ada 1 poin ketentuan!')
      return
    }

    try {
      const res = await updateMutation.mutateAsync({
        type: activeTab,
        data: {
          title: title.trim() || 'Ketentuan Pemesanan',
          checkInTime: checkInTime.trim() || '16:00',
          checkOutTime: checkOutTime.trim() || '12:00',
          terms: cleanedTerms
        }
      })
      toast.success(res.message || 'Pengaturan Syarat & Ketentuan berhasil disimpan!')
      setIsDirty(false)
      refetch()
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menyimpan pengaturan')
    }
  }

  // Reset to default
  const handleReset = async () => {
    const currentCat = CATEGORIES.find(c => c.id === activeTab)
    const confirmed = window.confirm(
      `Apakah Anda yakin ingin mengembalikan Syarat & Ketentuan kategori "${currentCat?.label}" ke bawaan sistem?`
    )
    if (!confirmed) return

    try {
      const res = await resetMutation.mutateAsync(activeTab)
      toast.success(res.message || 'Pengaturan berhasil dikembalikan ke default!')
      setIsDirty(false)
      refetch()
    } catch (err: any) {
      toast.error(err?.message || 'Gagal mengembalikan pengaturan ke default')
    }
  }

  const currentCategory = CATEGORIES.find(c => c.id === activeTab) || CATEGORIES[0]

  return (
    <PageLayout
      title="Pengaturan Syarat & Ketentuan Invoice"
      description="Kelola teks Ketentuan Pemesanan (Terms & Conditions) yang tercetak otomatis di lembar PDF invoice resmi Musafirin."
      actions={
        <div className="flex items-center gap-2">
          <Link to="/invoices">
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3.5 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 flex items-center rounded-md font-semibold text-xs bg-white shadow-none"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5 text-zinc-500" />
              Kembali ke Invoices
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={resetMutation.isPending}
            className="h-9 px-3.5 border-rose-200 text-rose-700 hover:bg-rose-50 flex items-center rounded-md font-semibold text-xs bg-white shadow-none"
            title="Kembalikan ketentuan kategori ini ke standar pabrik"
          >
            {resetMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5 mr-1.5 text-rose-500" />
            )}
            Reset Default
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="h-9 px-4 bg-[#111111] hover:bg-[#242424] text-white flex items-center rounded-md font-semibold text-xs transition-colors shadow-none"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin text-white" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-2 text-white" />
            )}
            Simpan Pengaturan
          </Button>
        </div>
      }
    >
      {/* Category Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 mb-6">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon
          const isActive = activeTab === cat.id
          return (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={`p-3.5 rounded-xl text-left border transition-all flex flex-col justify-between ${
                isActive
                  ? 'border-[#111111] bg-white ring-1 ring-[#111111] shadow-xs'
                  : 'border-[#e5e7eb] bg-white hover:border-zinc-300 text-zinc-600'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-lg ${isActive ? 'bg-[#111111] text-white' : 'bg-zinc-100 text-zinc-600'}`}>
                  <Icon className="h-4 w-4" />
                </div>
                {isActive && (
                  <Badge variant="outline" className="text-[10px] font-bold border-zinc-900 bg-zinc-900 text-white px-1.5 py-0">
                    Aktif
                  </Badge>
                )}
              </div>
              <div>
                <p className={`text-xs font-bold ${isActive ? 'text-[#111111]' : 'text-zinc-800'}`}>
                  {cat.label}
                </p>
                <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-1">
                  {cat.badgeText}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      {isLoading ? (
        <div className="border border-[#e5e7eb] rounded-xl bg-white p-12 flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400 mb-3" />
          <p className="text-sm font-medium text-zinc-500">Memuat data syarat & ketentuan...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Form Editor (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            {/* Header Card */}
            <Card className="p-5 border-[#e5e7eb] rounded-xl bg-white shadow-none">
              <div className="flex items-center justify-between border-b border-[#e5e7eb] pb-3 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                    <currentCategory.icon className="h-4 w-4 text-zinc-700" />
                    Editor {currentCategory.label}
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">{currentCategory.desc}</p>
                </div>
                {isDirty && (
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 text-[11px] font-semibold">
                    Perubahan belum disimpan
                  </Badge>
                )}
              </div>

              {/* Title Input */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                    Judul Header Ketentuan
                  </label>
                  <Input
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value)
                      setIsDirty(true)
                    }}
                    placeholder="Contoh: Ketentuan Pemesanan / Syarat & Ketentuan"
                    className="h-10 px-3.5 border border-[#e5e7eb] rounded-md bg-white text-sm font-medium text-zinc-950 focus:border-[#111111]"
                  />
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Judul ini akan menjadi tajuk utama kartu info ketentuan di lembar PDF invoice.
                  </p>
                </div>

                {/* Check-in & Check-out Times (Relevant for Hotel & General) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-zinc-400" />
                      Kebijakan Check-In
                    </label>
                    <Input
                      value={checkInTime}
                      onChange={(e) => {
                        setCheckInTime(e.target.value)
                        setIsDirty(true)
                      }}
                      placeholder="16:00"
                      className="h-9 px-3 border border-[#e5e7eb] rounded-md bg-white text-xs font-medium text-zinc-950 focus:border-[#111111]"
                    />
                    <p className="text-[10px] text-zinc-400 mt-1">
                      Menggantikan variabel <code className="bg-zinc-100 px-1 py-0.5 rounded text-zinc-700">{"{checkInTime}"}</code>
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-zinc-400" />
                      Kebijakan Check-Out
                    </label>
                    <Input
                      value={checkOutTime}
                      onChange={(e) => {
                        setCheckOutTime(e.target.value)
                        setIsDirty(true)
                      }}
                      placeholder="12:00"
                      className="h-9 px-3 border border-[#e5e7eb] rounded-md bg-white text-xs font-medium text-zinc-950 focus:border-[#111111]"
                    />
                    <p className="text-[10px] text-zinc-400 mt-1">
                      Menggantikan variabel <code className="bg-zinc-100 px-1 py-0.5 rounded text-zinc-700">{"{checkOutTime}"}</code>
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Points Editor Card */}
            <Card className="p-5 border-[#e5e7eb] rounded-xl bg-white shadow-none">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#e5e7eb] pb-3 mb-4">
                <div>
                  <h4 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4 text-zinc-700" />
                    Daftar Poin Ketentuan ({termsList.length})
                  </h4>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Setiap poin akan otomatis diformat menjadi bullet point pada invoice.
                  </p>
                </div>

                {/* Editor Mode Switcher */}
                <div className="flex items-center gap-1 bg-zinc-100 p-0.5 rounded-lg border border-zinc-200">
                  <button
                    type="button"
                    onClick={() => setActiveMode('list')}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                      activeMode === 'list'
                        ? 'bg-white text-zinc-900 shadow-xs'
                        : 'text-zinc-500 hover:text-zinc-900'
                    }`}
                  >
                    Editor Poin
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveMode('raw')}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                      activeMode === 'raw'
                        ? 'bg-white text-zinc-900 shadow-xs'
                        : 'text-zinc-500 hover:text-zinc-900'
                    }`}
                  >
                    Teks Bebas (Raw)
                  </button>
                </div>
              </div>

              {/* Quick Helper Chips */}
              <div className="bg-zinc-50 border border-zinc-200/60 rounded-lg p-3 mb-4">
                <p className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-zinc-500" />
                  Sisipkan Variabel & Tag Cepat
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleInsertTag('{checkInTime}')}
                    className="text-[11px] font-mono bg-white border border-zinc-200 hover:border-zinc-400 px-2 py-1 rounded text-zinc-700 transition-colors"
                    title="Klik untuk menyisipkan waktu check-in"
                  >
                    + {"{checkInTime}"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertTag('{checkOutTime}')}
                    className="text-[11px] font-mono bg-white border border-zinc-200 hover:border-zinc-400 px-2 py-1 rounded text-zinc-700 transition-colors"
                    title="Klik untuk menyisipkan waktu check-out"
                  >
                    + {"{checkOutTime}"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertTag('Pemesanan terkonfirmasi setelah Full Payment.')}
                    className="text-[11px] bg-white border border-zinc-200 hover:border-zinc-400 px-2 py-1 rounded text-zinc-700 transition-colors"
                  >
                    + Template Full Payment
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertTag('Pembatalan: Pesanan ini tidak dapat di batalkan dan di refund.')}
                    className="text-[11px] bg-white border border-zinc-200 hover:border-zinc-400 px-2 py-1 rounded text-zinc-700 transition-colors"
                  >
                    + Template Non-refundable
                  </button>
                </div>
              </div>

              {activeMode === 'list' ? (
                <div className="space-y-3">
                  {termsList.map((term, index) => (
                    <div
                      key={index}
                      className="border border-[#e5e7eb] rounded-lg p-3 bg-white hover:border-zinc-300 transition-all flex items-start gap-2.5"
                    >
                      <span className="h-6 w-6 rounded-full bg-zinc-100 text-zinc-600 text-[11px] font-bold flex items-center justify-center shrink-0 mt-1">
                        {index + 1}
                      </span>

                      <div className="flex-1">
                        <Textarea
                          value={term}
                          onChange={(e) => handleUpdateItem(index, e.target.value)}
                          placeholder="Tuliskan isi ketentuan..."
                          rows={2}
                          className="w-full text-xs font-medium text-zinc-900 border border-[#e5e7eb] rounded-md p-2 focus:border-[#111111] resize-y min-h-[48px]"
                        />
                      </div>

                      {/* Action buttons per row */}
                      <div className="flex items-center gap-1 shrink-0 pt-0.5">
                        <button
                          type="button"
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          className="p-1 rounded text-zinc-400 hover:text-zinc-800 disabled:opacity-30 disabled:hover:text-zinc-400 transition-colors"
                          title="Geser ke atas"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveDown(index)}
                          disabled={index === termsList.length - 1}
                          className="p-1 rounded text-zinc-400 hover:text-zinc-800 disabled:opacity-30 disabled:hover:text-zinc-400 transition-colors"
                          title="Geser ke bawah"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="p-1 rounded text-zinc-400 hover:text-rose-600 transition-colors"
                          title="Hapus baris ini"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddItem}
                    className="w-full h-9 border-dashed border-zinc-300 hover:border-zinc-900 text-zinc-700 hover:text-zinc-950 text-xs font-semibold rounded-lg mt-2 flex items-center justify-center shadow-none"
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Tambah Poin Ketentuan Baru
                  </Button>
                </div>
              ) : (
                <div>
                  <Textarea
                    value={rawText}
                    onChange={(e) => handleRawTextChange(e.target.value)}
                    placeholder="Tuliskan setiap baris sebagai satu poin ketentuan..."
                    rows={8}
                    className="w-full text-xs font-mono text-zinc-900 border border-[#e5e7eb] rounded-md p-3 focus:border-[#111111] leading-relaxed resize-y"
                  />
                  <p className="text-[11px] text-zinc-400 mt-2">
                    Setiap baris baru (Enter) akan otomatis dijadikan 1 butir poin peluru (•) di invoice.
                  </p>
                </div>
              )}
            </Card>
          </div>

          {/* Right Column: Live PDF Card Preview (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            <div className="sticky top-6">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-zinc-400" />
                  Pratinjau Lembar Invoice (Live)
                </span>
                <Badge variant="outline" className="text-[10px] font-semibold border-zinc-200 text-zinc-600 bg-white">
                  Format Asli PDF
                </Badge>
              </div>

              {/* Simulated Invoice Document Paper */}
              <div className="border border-[#e5e7eb] rounded-2xl bg-white p-6 shadow-sm">
                <div className="border-b border-dashed border-zinc-200 pb-3 mb-4 flex items-center justify-between">
                  <div className="text-[11px] font-mono font-bold text-zinc-400">
                    MUSAFIRIN INVOICE PREVIEW
                  </div>
                  <div className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
                    A4 Output Simulation
                  </div>
                </div>

                {/* Exactly styled like the cs-info-card in invoice.html & manual-invoice.html */}
                <div
                  style={{
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    padding: '16px',
                    marginBottom: '16px'
                  }}
                >
                  <h3
                    style={{
                      fontSize: '15px',
                      fontWeight: 700,
                      color: '#1e293b',
                      marginBottom: '8px',
                      marginTop: 0,
                    }}
                  >
                    {title || 'Ketentuan Pemesanan'}
                  </h3>

                  <div
                    style={{
                      color: '#475569',
                      fontSize: '11px',
                      lineHeight: '1.6',
                    }}
                  >
                    {termsList.length === 0 ? (
                      <p style={{ fontStyle: 'italic', color: '#94a3b8', margin: 0 }}>
                        (Belum ada poin ketentuan yang dimasukkan)
                      </p>
                    ) : (
                      termsList.map((term, i) => {
                        const replaced = term
                          .replace(/\{checkInTime\}/g, checkInTime || '16:00')
                          .replace(/\{checkOutTime\}/g, checkOutTime || '12:00')

                        // Highlight prominent phrases like in template
                        const renderFormatted = () => {
                          const parts = replaced.split(/(terkonfirmasi|Pembatalan & Perubahan:|Pembatalan:)/gi)
                          return parts.map((part, pIdx) => {
                            if (/^(terkonfirmasi|Pembatalan & Perubahan:|Pembatalan:)$/i.test(part)) {
                              return <strong key={pIdx} style={{ fontWeight: 600, color: '#0f172a' }}>{part}</strong>
                            }
                            return part
                          })
                        }

                        return (
                          <p
                            key={i}
                            style={{
                              margin: i === termsList.length - 1 ? 0 : '0 0 6px 0',
                            }}
                          >
                            • {renderFormatted()}
                          </p>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* Simulated Invoice Context Hint */}
                <div className="bg-zinc-50 border border-zinc-200/50 rounded-lg p-3 text-[11px] text-zinc-500 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-zinc-700 font-semibold">
                    <Info className="h-3.5 w-3.5 text-zinc-500" />
                    Informasi Integrasi
                  </div>
                  <p>
                    Ketentuan di atas otomatis digunakan setiap kali invoice kategori{' '}
                    <strong>{currentCategory.label}</strong> dicetak, di-download PDF, atau dibuat baru oleh admin.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}
