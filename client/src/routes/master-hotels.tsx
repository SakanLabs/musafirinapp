import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useMemo } from "react"
import { toast } from "sonner"
import { PageLayout } from "@/components/layout/PageLayout"
import { DataTable, type Column } from "@/components/ui/data-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Plus,
  Eye,
  Edit,
  Trash2,
  Building,
  MapPin,
  Star,
  Search,
  FilterX
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

  // Filter States
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

  const hotelColumns: Column<Hotel>[] = [
    {
      key: 'id',
      header: 'ID',
      sortable: true,
      width: 'w-20'
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (hotel) => (
        <div className="flex space-x-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate({ to: "/master-hotel-detail/$hotelId", params: { hotelId: hotel.id.toString() } })}
            title="View Details / Pricing"
            className="flex items-center space-x-1"
          >
            <Eye className="h-4 w-4" />
            <span>Pricing</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate({ to: "/master-hotel-edit/$hotelId", params: { hotelId: hotel.id.toString() } })}
            title="Edit Hotel"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDeleteHotel(hotel.id)}
            title="Delete Hotel"
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
      width: 'w-48'
    },
    {
      key: 'name',
      header: 'Name',
      sortable: true
    },
    {
      key: 'city',
      header: 'City',
      render: (hotel) => (
        <div className="flex items-center space-x-2">
          <MapPin className="h-4 w-4 text-gray-400" />
          <span>{hotel.city}</span>
        </div>
      ),
      sortable: true
    },
    {
      key: 'starRating',
      header: 'Stars',
      render: (hotel) => hotel.starRating ? (
        <div className="flex items-center text-yellow-500">
          <span>{hotel.starRating}</span>
          <Star className="h-4 w-4 ml-1 fill-current" />
        </div>
      ) : (
        <span className="text-gray-400">-</span>
      ),
      sortable: true
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (hotel) => (
        <span className={`px-2 py-1 rounded text-xs font-semibold ${hotel.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {hotel.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
      sortable: true
    }
  ]

  const handleDeleteHotel = async (id: number) => {
    if (!confirm('Are you sure you want to delete this hotel?')) return
    try {
      await deleteHotelMutation.mutateAsync(id)
      toast.success('Hotel deleted successfully')
    } catch (error) {
      toast.error('Failed to delete hotel')
    }
  }

  if (error) {
    return (
      <PageLayout title="Master Hotels">
        <div className="text-center py-8 text-red-600">Error: {error.message}</div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="Master Hotels"
      subtitle="Manage your hotel master data"
      actions={
        <Button onClick={() => navigate({ to: '/create-master-hotel' })} className="flex items-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>Add Hotel</span>
        </Button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hotels</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{hotels.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Hotels</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{hotels.filter(h => h.isActive).length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search Database</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search by hotel name or address..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="w-full md:w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">City Filter</label>
            <select
              value={cityFilter}
              title="Filter by City"
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Cities</option>
              <option value="Makkah">Makkah</option>
              <option value="Madinah">Madinah</option>
            </select>
          </div>
          <div className="w-full md:w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">Status Filter</label>
            <select
              value={statusFilter}
              title="Filter by Status"
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active Only</option>
              <option value="Inactive">Inactive Only</option>
            </select>
          </div>
          <div className="w-full md:w-auto">
             <Button variant="outline" onClick={clearFilters} className="text-gray-500 hover:text-gray-900 border-gray-300">
                <FilterX className="h-4 w-4 mr-2" />
                Clear
             </Button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <DataTable
          data={filteredHotels}
          columns={hotelColumns}
          loading={isLoading}
          emptyMessage={
            filteredHotels.length === 0 && hotels.length > 0 
              ? "No hotels match your filters." 
              : "No hotels found."
          }
        />
      </div>
    </PageLayout>
  )
}
