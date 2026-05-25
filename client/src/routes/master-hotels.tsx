import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useMemo } from "react"
import { toast } from "sonner"
import { PageLayout } from "@/components/layout/PageLayout"
import { DataTable, type Column } from "@/components/ui/data-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  XCircle
} from "lucide-react"
import {
  useHotels,
  useDeleteHotel,
  type Hotel
} from "@/lib/queries/master"

export const Route = createFileRoute("/master-hotels")({
  component: MasterHotelsPage
})

function MasterHotelsPage() {
  const navigate = useNavigate()
  const { data: hotels = [], isLoading, error } = useHotels()
  const deleteHotelMutation = useDeleteHotel()

  const [searchQuery, setSearchQuery] = useState("")
  const [cityFilter, setCityFilter] = useState("All")
  const [statusFilter, setStatusFilter] = useState("All")

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
        <Button
          onClick={() => navigate({ to: '/create-master-hotel' })}
          className="bg-[#111111] hover:bg-[#242424] text-white h-9 px-4 rounded-md text-xs font-semibold transition-colors border border-transparent shadow-none"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Hotel
        </Button>
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
    </PageLayout>
  )
}
