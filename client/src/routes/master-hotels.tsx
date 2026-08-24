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
} from "lucide-react"
import {
  useHotels,
  useDeleteHotel,
  useImportHotelPricing,
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

  const [searchQuery, setSearchQuery] = useState("")
  const [cityFilter, setCityFilter] = useState("All")
  const [statusFilter, setStatusFilter] = useState("All")

  // Import modal state
  const [importOpen, setImportOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
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

  const handleImport = async () => {
    if (!selectedFile) return
    try {
      const result = await importMutation.mutateAsync(selectedFile)
      setImportResult(result)
      if (result.errors.length === 0) {
        toast.success(`Import berhasil! ${result.pricingCreated} harga ditambahkan, ${result.pricingOverwritten} di-overwrite.`)
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
              Upload file Excel dengan sheet "Makkah" dan/atau "Madinah". Format: Nama Hotel, Bintang, From, To, Days, Double, Triple, Quad.
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

              {/* Format hints */}
              <div className="bg-zinc-50 border border-zinc-100 rounded-lg p-3">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Format yang didukung</p>
                <ul className="text-xs text-zinc-500 space-y-1">
                  <li>• Sheet bernama <span className="font-semibold text-zinc-700">"Makkah"</span> dan/atau <span className="font-semibold text-zinc-700">"Madinah"</span></li>
                  <li>• Kolom: Nama Hotel, Bintang, From, To, Days, Double, Triple, Quad</li>
                  <li>• Harga yang sama akan <span className="font-semibold text-amber-600">di-overwrite</span></li>
                  <li>• Hotel baru akan <span className="font-semibold text-emerald-600">otomatis dibuat</span></li>
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
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-amber-700">{importResult.pricingOverwritten}</p>
                  <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Di-overwrite</p>
                </div>
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
    </PageLayout>
  )
}

