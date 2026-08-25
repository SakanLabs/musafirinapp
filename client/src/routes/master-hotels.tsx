import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useMemo, useRef, useCallback } from "react"
import { toast } from "sonner"
import { PageLayout } from "@/components/layout/PageLayout"
import { DataTable, type Column } from "@/components/ui/data-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Plus,
  Eye,
  Edit,
  Trash2,
  Building2,
  MapPin,
  Star,
  Search,
  X,
  Loader2,
  CheckCircle2,
  XCircle,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  RotateCcw,
  AlertTriangle,
  RefreshCw,
} from "lucide-react"
import {
  useHotels,
  useDeleteHotel,
  useImportHotelPricing,
  useResetHotelPricing,
  type Hotel,
  type ImportPricingResult,
} from "@/lib/queries/master"

export const Route = createFileRoute("/master-hotels")({
  component: MasterHotelsPage
})

function MasterHotelsPage() {
  const navigate = useNavigate()
  const { data: hotels = [], isLoading, error } = useHotels()
  const deleteHotelMutation = useDeleteHotel()
  const importMutation = useImportHotelPricing()
  const resetPricingMutation = useResetHotelPricing()

  const [searchQuery, setSearchQuery] = useState("")
  const [cityFilter, setCityFilter] = useState("All")
  const [statusFilter, setStatusFilter] = useState("All")

  // Reset modal state
  const [resetOpen, setResetOpen] = useState(false)
  const [resetScope, setResetScope] = useState<'all' | 'city'>('all')
  const [resetCity, setResetCity] = useState<'Makkah' | 'Madinah'>('Makkah')
  const [resetConfirmText, setResetConfirmText] = useState('')

  // Import modal state
  const [importOpen, setImportOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [resetBeforeImport, setResetBeforeImport] = useState(true)
  const [importResult, setImportResult] = useState<ImportPricingResult | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const filteredHotels = useMemo(() => {
    return hotels.filter(h => {
      const matchesSearch = h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (h.address && h.address.toLowerCase().includes(searchQuery.toLowerCase()))
      const matchesCity = cityFilter === 'All' || h.city === cityFilter
      const matchesStatus = statusFilter === 'All' || (statusFilter === 'Active' ? h.isActive : !h.isActive)
      return matchesSearch && matchesCity && matchesStatus
    })
  }, [hotels, searchQuery, cityFilter, statusFilter])

  const clearFilters = () => {
    setSearchQuery("")
    setCityFilter("All")
    setStatusFilter("All")
  }

  const hasFilters = searchQuery || cityFilter !== "All" || statusFilter !== "All"

  const handleDeleteHotel = async (id: number) => {
    if (!confirm('Are you sure you want to delete this hotel?')) return
    try {
      await deleteHotelMutation.mutateAsync(id)
      toast.success('Hotel deleted successfully')
    } catch {
      toast.error('Failed to delete hotel')
    }
  }

  // Import handlers
  const handleFileSelect = useCallback((file: File) => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ]
    const validExtensions = ['.xlsx', '.xls']
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()

    if (!validTypes.includes(file.type) && !validExtensions.includes(ext)) {
      toast.error('Please upload an Excel file (.xlsx or .xls)')
      return
    }
    setSelectedFile(file)
    setImportResult(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }, [handleFileSelect])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleResetPricing = async () => {
    try {
      const params = resetScope === 'city'
        ? { scope: 'city' as const, city: resetCity }
        : { scope: 'all' as const }

      const result = await resetPricingMutation.mutateAsync(params)
      toast.success(result.message || 'Harga hotel berhasil direset')
      setResetOpen(false)
      setResetConfirmText('')
    } catch (err: any) {
      toast.error(err.message || 'Gagal mereset harga hotel')
    }
  }

  const handleImport = async () => {
    if (!selectedFile) return
    try {
      const result = await importMutation.mutateAsync({ file: selectedFile, resetBeforeImport })
      setImportResult(result)
      if (result.errors.length === 0) {
        toast.success(`Import berhasil! ${result.pricingCreated} harga ditambahkan${result.pricingResetCount ? ` (${result.pricingResetCount} harga lama direset)` : ''}.`)
      } else {
        toast.warning(`Import selesai dengan ${result.errors.length} warning.`)
      }
    } catch (err: any) {
      toast.error(err.message || 'Import gagal')
    }
  }

  const handleCloseImport = () => {
    setImportOpen(false)
    setSelectedFile(null)
    setImportResult(null)
    setResetBeforeImport(true)
    setIsDragOver(false)
  }

  const totalHotels = hotels.length
  const activeHotels = hotels.filter(h => h.isActive).length
  const makkahHotels = hotels.filter(h => h.city === 'Makkah').length
  const madinahHotels = hotels.filter(h => h.city === 'Madinah').length

  const hotelColumns: Column<Hotel>[] = [
    {
      key: 'name',
      header: 'Hotel Name',
      sortable: true,
      render: (hotel) => (
        <div>
          <p className="text-sm font-semibold text-[#111111]">{hotel.name}</p>
          {hotel.address && (
            <p className="text-xs text-zinc-400 mt-0.5 truncate max-w-[200px]">{hotel.address}</p>
          )}
        </div>
      )
    },
    {
      key: 'city',
      header: 'City',
      sortable: true,
      width: 'w-28',
      render: (hotel) => (
        <div className="flex items-center space-x-1.5">
          <MapPin className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
          <span className="text-sm text-zinc-700">{hotel.city}</span>
        </div>
      )
    },
    {
      key: 'starRating',
      header: 'Stars',
      sortable: true,
      width: 'w-24',
      render: (hotel) => hotel.starRating ? (
        <div className="flex items-center space-x-1">
          <span className="text-sm font-semibold text-[#111111]">{hotel.starRating}</span>
          <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
        </div>
      ) : (
        <span className="text-zinc-300 text-sm">—</span>
      )
    },
    {
      key: 'supplierName',
      header: 'Supplier',
      sortable: true,
      render: (hotel) => (
        <span className="text-sm text-zinc-600">{hotel.supplierName || '—'}</span>
      )
    },
    {
      key: 'isActive',
      header: 'Status',
      sortable: true,
      width: 'w-28',
      render: (hotel) => hotel.isActive ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="h-3 w-3" />
          Active
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-100 text-zinc-500 border border-zinc-200">
          <XCircle className="h-3 w-3" />
          Inactive
        </span>
      )
    },
    {
      key: 'actions',
      header: '',
      width: 'w-32',
      render: (hotel) => (
        <div className="flex items-center justify-end space-x-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => navigate({ to: "/master-hotel-detail/$hotelId", params: { hotelId: hotel.id.toString() } })}
            title="View Pricing"
            className="h-8 w-8 text-zinc-500 hover:text-[#111111] hover:bg-zinc-100 rounded-full"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => navigate({ to: "/master-hotel-edit/$hotelId", params: { hotelId: hotel.id.toString() } })}
            title="Edit Hotel"
            className="h-8 w-8 text-zinc-500 hover:text-[#111111] hover:bg-zinc-100 rounded-full"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => handleDeleteHotel(hotel.id)}
            title="Delete Hotel"
            className="h-8 w-8 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-full"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )
    }
  ]

  if (error) {
    return (
      <PageLayout title="Master Hotels">
        <div className="flex items-center justify-center py-16">
          <p className="text-red-500 text-sm font-medium">{error.message}</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="Master Hotels"
      subtitle="Manage your hotel master database"
      actions={
        <div className="flex items-center space-x-2.5">
          <Button
            variant="outline"
            onClick={() => {
              setResetConfirmText('')
              setResetScope('all')
              setResetOpen(true)
            }}
            className="h-9 px-3.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300 rounded-md text-xs font-semibold shadow-none transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Reset Harga
          </Button>
          <Button
            variant="outline"
            onClick={() => setImportOpen(true)}
            className="h-9 px-4 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 hover:text-black rounded-md text-xs font-semibold shadow-none"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import Excel
          </Button>
          <Button
            onClick={() => navigate({ to: '/create-master-hotel' })}
            className="bg-[#111111] hover:bg-[#242424] text-white h-9 px-4 rounded-md text-xs font-semibold transition-colors border border-transparent shadow-none"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Hotel
          </Button>
        </div>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="border border-[#e5e7eb] rounded-xl bg-white p-5 shadow-none hover:border-[#111111]/30 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Total Hotels</h3>
              <p className="text-2xl font-bold text-[#111111] tracking-tight">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : totalHotels}
              </p>
            </div>
            <Building2 className="h-5 w-5 text-zinc-300" />
          </div>
        </div>
        <div className="border border-[#e5e7eb] rounded-xl bg-white p-5 shadow-none hover:border-[#111111]/30 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Active</h3>
              <p className="text-2xl font-bold text-emerald-600 tracking-tight">
                {isLoading ? '—' : activeHotels}
              </p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-emerald-300" />
          </div>
        </div>
        <div className="border border-[#e5e7eb] rounded-xl bg-white p-5 shadow-none hover:border-[#111111]/30 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Makkah</h3>
              <p className="text-2xl font-bold text-[#111111] tracking-tight">
                {isLoading ? '—' : makkahHotels}
              </p>
            </div>
            <MapPin className="h-5 w-5 text-zinc-300" />
          </div>
        </div>
        <div className="border border-[#e5e7eb] rounded-xl bg-white p-5 shadow-none hover:border-[#111111]/30 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Madinah</h3>
              <p className="text-2xl font-bold text-[#111111] tracking-tight">
                {isLoading ? '—' : madinahHotels}
              </p>
            </div>
            <MapPin className="h-5 w-5 text-zinc-300" />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="border border-[#e5e7eb] rounded-xl bg-white p-4 mb-4 shadow-none">
        <div className="flex flex-col md:flex-row gap-3 items-end">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
            <Input
              placeholder="Search hotel name or address..."
              className="pl-9 h-10 border-[#e5e7eb] rounded-lg bg-white text-sm focus-visible:ring-0 focus-visible:border-[#111111] shadow-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="w-full md:w-44">
            <select
              value={cityFilter}
              title="Filter by City"
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm text-zinc-700 focus:outline-none focus:border-[#111111] transition-colors"
            >
              <option value="All">All Cities</option>
              <option value="Makkah">Makkah</option>
              <option value="Madinah">Madinah</option>
            </select>
          </div>
          <div className="w-full md:w-44">
            <select
              value={statusFilter}
              title="Filter by Status"
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm text-zinc-700 focus:outline-none focus:border-[#111111] transition-colors"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active Only</option>
              <option value="Inactive">Inactive Only</option>
            </select>
          </div>
          {hasFilters && (
            <Button
              variant="ghost"
              onClick={clearFilters}
              className="h-10 px-3 text-zinc-500 hover:text-[#111111] hover:bg-zinc-100 text-sm font-medium rounded-lg"
            >
              <X className="h-4 w-4 mr-1.5" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden border border-[#e5e7eb] rounded-xl bg-white shadow-none">
        <div className="px-6 py-4 border-b border-[#e5e7eb] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider">Hotel Registry</h3>
          {filteredHotels.length !== totalHotels && (
            <span className="text-xs text-zinc-400 font-medium">
              {filteredHotels.length} of {totalHotels} hotels
            </span>
          )}
        </div>
        <DataTable
          data={filteredHotels}
          columns={hotelColumns}
          loading={isLoading}
          emptyMessage={
            filteredHotels.length === 0 && hotels.length > 0
              ? "No hotels match your filters."
              : "No hotels found. Add your first hotel."
          }
          noCard={true}
        />
      </div>

      {/* Import Excel Dialog */}
      <Dialog open={importOpen} onOpenChange={(open) => { if (!open) handleCloseImport() }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              <span>Import Harga Hotel dari Excel</span>
            </DialogTitle>
            <DialogDescription>
              Upload file Excel dengan sheet "Makkah" dan/atau "Madinah". Format: Nama Hotel, Bintang, From, To, Days, Double, Triple, Quad, Meals.
            </DialogDescription>
          </DialogHeader>

          {/* File Upload Zone */}
          {!importResult && (
            <div className="space-y-4">
              <div
                className={`
                  relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer
                  ${isDragOver
                    ? 'border-emerald-400 bg-emerald-50'
                    : selectedFile
                      ? 'border-emerald-300 bg-emerald-50/50'
                      : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50/50'
                  }
                `}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFileSelect(file)
                    e.target.value = '' // Reset so same file can be re-selected
                  }}
                />

                {selectedFile ? (
                  <div className="space-y-2">
                    <FileSpreadsheet className="h-10 w-10 text-emerald-500 mx-auto" />
                    <p className="text-sm font-semibold text-[#111111]">{selectedFile.name}</p>
                    <p className="text-xs text-zinc-400">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                    <button
                      type="button"
                      className="text-xs text-zinc-500 hover:text-red-500 underline transition-colors"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedFile(null)
                      }}
                    >
                      Ganti file
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-10 w-10 text-zinc-300 mx-auto" />
                    <p className="text-sm font-medium text-zinc-600">
                      Drag & drop file Excel di sini
                    </p>
                    <p className="text-xs text-zinc-400">
                      atau klik untuk pilih file (.xlsx, .xls)
                    </p>
                  </div>
                )}
              </div>

              {/* Reset Before Import Option */}
              <div
                onClick={() => setResetBeforeImport(!resetBeforeImport)}
                className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  resetBeforeImport
                    ? 'bg-amber-50/60 border-amber-200'
                    : 'bg-zinc-50 border-zinc-200 hover:bg-zinc-100/60'
                }`}
              >
                <input
                  type="checkbox"
                  id="resetBeforeImport"
                  checked={resetBeforeImport}
                  onChange={(e) => setResetBeforeImport(e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#111111] focus:ring-black accent-[#111111]"
                />
                <div className="text-left flex-1">
                  <label htmlFor="resetBeforeImport" className="text-xs font-semibold text-zinc-900 cursor-pointer flex items-center gap-1.5">
                    Kosongkan seluruh harga lama sebelum import
                    <span className="text-[10px] font-normal px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded">Disarankan</span>
                  </label>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Mencegah duplikasi atau periode tanggal yang bentrok jika ada perubahan jadwal/harga pada Excel terbaru.
                  </p>
                </div>
              </div>

              {/* Format hints */}
              <div className="bg-zinc-50 border border-zinc-100 rounded-lg p-3">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Format yang didukung</p>
                <ul className="text-xs text-zinc-500 space-y-1">
                  <li>• Sheet bernama <span className="font-semibold text-zinc-700">"Makkah"</span> dan/atau <span className="font-semibold text-zinc-700">"Madinah"</span></li>
                  <li>• Kolom: Nama Hotel, Bintang, From, To, Days, Double, Triple, Quad, Meals</li>
                  <li>• Tipe Meals: <span className="font-semibold text-zinc-700">Room Only, Breakfast, Full Board</span> (default: Room Only)</li>
                  <li>• Hotel baru yang belum ada di master akan <span className="font-semibold text-emerald-600">otomatis dibuat</span></li>
                </ul>
              </div>
            </div>
          )}

          {/* Import Results */}
          {importResult && (
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-700">{importResult.pricingCreated}</p>
                  <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Harga Ditambahkan</p>
                </div>
                {importResult.pricingResetCount !== undefined && importResult.pricingResetCount > 0 ? (
                  <div className="bg-rose-50 border border-rose-100 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-rose-700">{importResult.pricingResetCount}</p>
                    <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Harga Lama Direset</p>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-amber-700">{importResult.pricingOverwritten}</p>
                    <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Di-overwrite</p>
                  </div>
                )}
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-700">{importResult.totalRowsProcessed}</p>
                  <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Row Diproses</p>
                </div>
                <div className="bg-violet-50 border border-violet-100 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-violet-700">{importResult.hotelsCreated}</p>
                  <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wider">Hotel Baru</p>
                </div>
              </div>

              {/* Sheets processed */}
              {importResult.sheets.length > 0 && (
                <div className="bg-zinc-50 border border-zinc-100 rounded-lg p-3">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Sheet Diproses</p>
                  <div className="space-y-1">
                    {importResult.sheets.map((s, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-zinc-700 font-medium">{s.name}</span>
                        <span className="text-zinc-400">{s.city} · {s.rows} row</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Errors */}
              {importResult.errors.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                  <div className="flex items-center space-x-1.5 mb-1.5">
                    <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                    <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider">
                      {importResult.errors.length} Warning{importResult.errors.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-0.5">
                    {importResult.errors.map((err, i) => (
                      <p key={i} className="text-xs text-red-600">{err}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {!importResult ? (
              <>
                <Button
                  variant="outline"
                  onClick={handleCloseImport}
                  className="h-9 px-4 border-[#e5e7eb] text-zinc-700 rounded-md text-xs font-semibold shadow-none"
                >
                  Batal
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={!selectedFile || importMutation.isPending}
                  className="bg-[#111111] hover:bg-[#242424] text-white h-9 px-4 rounded-md text-xs font-semibold transition-colors border border-transparent shadow-none disabled:opacity-50"
                >
                  {importMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Import
                    </>
                  )}
                </Button>
              </>
            ) : (
              <Button
                onClick={handleCloseImport}
                className="bg-[#111111] hover:bg-[#242424] text-white h-9 px-4 rounded-md text-xs font-semibold transition-colors border border-transparent shadow-none"
              >
                Selesai
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Pricing Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2 text-red-600">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <span>Reset Harga Hotel</span>
            </DialogTitle>
            <DialogDescription>
              Fitur ini akan menghapus seluruh data periode harga hotel yang ada di database. Berguna untuk membersihkan data harga double sebelum upload file Excel baru.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Scope Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-700">Pilih Cakupan Reset:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setResetScope('all')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    resetScope === 'all'
                      ? 'border-red-500 bg-red-50/60 ring-1 ring-red-500'
                      : 'border-zinc-200 hover:border-zinc-300 bg-white'
                  }`}
                >
                  <p className="text-xs font-bold text-zinc-900">Semua Hotel</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Makkah & Madinah ({totalHotels} hotel)</p>
                </button>
                <button
                  type="button"
                  onClick={() => setResetScope('city')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    resetScope === 'city'
                      ? 'border-red-500 bg-red-50/60 ring-1 ring-red-500'
                      : 'border-zinc-200 hover:border-zinc-300 bg-white'
                  }`}
                >
                  <p className="text-xs font-bold text-zinc-900">Per Kota</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Khusus 1 kota saja</p>
                </button>
              </div>
            </div>

            {/* City Selection if Scope is 'city' */}
            {resetScope === 'city' && (
              <div className="space-y-1.5 bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                <label className="text-xs font-semibold text-zinc-700">Pilih Kota:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setResetCity('Makkah')}
                    className={`py-2 px-3 rounded-md text-xs font-semibold transition-all ${
                      resetCity === 'Makkah'
                        ? 'bg-[#111111] text-white'
                        : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    Makkah ({makkahHotels} Hotel)
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetCity('Madinah')}
                    className={`py-2 px-3 rounded-md text-xs font-semibold transition-all ${
                      resetCity === 'Madinah'
                        ? 'bg-[#111111] text-white'
                        : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    Madinah ({madinahHotels} Hotel)
                  </button>
                </div>
              </div>
            )}

            {/* Warning Box */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <div className="text-xs text-red-800 space-y-1">
                  <p className="font-semibold">Perhatian:</p>
                  <p>
                    {resetScope === 'all'
                      ? 'Seluruh data harga kamar untuk SEMUA hotel di database akan dihapus permanen.'
                      : `Seluruh data harga kamar untuk hotel di kota ${resetCity} akan dihapus permanen.`}
                  </p>
                  <p className="text-[11px] text-red-600">
                    * Data profil hotel dan data transaksi booking yang sudah ada tidak akan hilang.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setResetOpen(false)}
              disabled={resetPricingMutation.isPending}
              className="h-9 px-4 border-[#e5e7eb] text-zinc-700 rounded-md text-xs font-semibold shadow-none"
            >
              Batal
            </Button>
            <Button
              onClick={handleResetPricing}
              disabled={resetPricingMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white h-9 px-4 rounded-md text-xs font-semibold transition-colors border border-transparent shadow-none"
            >
              {resetPricingMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Mereset Harga...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Konfirmasi Reset Harga
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}

