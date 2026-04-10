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
  Car,
  Search,
  FilterX
} from "lucide-react"
import {
  useTransportRoutes,
  useDeleteTransportRoute,
  type TransportationRouteMaster
} from "@/lib/queries/master"

export const Route = createFileRoute("/master-transport")({
  component: MasterTransportPage
})

function MasterTransportPage() {
  const navigate = useNavigate()

  const { data: routes = [], isLoading, error } = useTransportRoutes()
  const deleteRouteMutation = useDeleteTransportRoute()

  // Filter States
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("All")

  const filteredRoutes = useMemo(() => {
    return routes.filter(r => {
      const matchesSearch = r.originLocation.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            r.destinationLocation.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === 'All' || (statusFilter === 'Active' ? r.isActive : !r.isActive)
      return matchesSearch && matchesStatus
    })
  }, [routes, searchQuery, statusFilter])

  const clearFilters = () => {
    setSearchQuery("")
    setStatusFilter("All")
  }

  const routeColumns: Column<TransportationRouteMaster>[] = [
    {
      key: 'id',
      header: 'ID',
      sortable: true,
      width: 'w-20'
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (route) => (
        <div className="flex space-x-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate({ to: "/master-transport-detail/$routeId", params: { routeId: route.id.toString() } })}
            title="View Details / Pricing"
            className="flex items-center space-x-1"
          >
            <Eye className="h-4 w-4" />
            <span>Pricing</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate({ to: "/master-transport-edit/$routeId", params: { routeId: route.id.toString() } })}
            title="Edit Route"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDeleteRoute(route.id)}
            title="Delete Route"
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
      width: 'w-48'
    },
    {
      key: 'originLocation',
      header: 'Origin',
      sortable: true
    },
    {
      key: 'destinationLocation',
      header: 'Destination',
      sortable: true
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (route) => (
        <span className={`px-2 py-1 rounded text-xs font-semibold ${route.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {route.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
      sortable: true
    }
  ]

  const handleDeleteRoute = async (id: number) => {
    if (!confirm('Are you sure you want to delete this route?')) return
    try {
      await deleteRouteMutation.mutateAsync(id)
      toast.success('Route deleted successfully')
    } catch (error) {
      toast.error('Failed to delete route')
    }
  }

  if (error) {
    return (
      <PageLayout title="Master Transport">
        <div className="text-center py-8 text-red-600">Error: {error.message}</div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="Master Transport Routes"
      subtitle="Manage your transportation master data"
      actions={
        <Button onClick={() => navigate({ to: '/create-master-transport' })} className="flex items-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>Add Route</span>
        </Button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Routes</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{routes.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Routes</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{routes.filter(r => r.isActive).length}</div>
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
                placeholder="Search by origin or destination..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
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
          data={filteredRoutes}
          columns={routeColumns}
          loading={isLoading}
          emptyMessage={
            filteredRoutes.length === 0 && routes.length > 0 
              ? "No routes match your filters." 
              : "No routes found."
          }
        />
      </div>
    </PageLayout>
  )
}
