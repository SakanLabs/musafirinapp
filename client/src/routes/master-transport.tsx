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
  Bus,
  Search,
  X,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowRight
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

  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("All")

  const filteredRoutes = useMemo(() => {
    return routes.filter(r => {
      const matchesSearch =
        r.originLocation.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.destinationLocation.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.supplierName && r.supplierName.toLowerCase().includes(searchQuery.toLowerCase()))
      const matchesStatus = statusFilter === 'All' || (statusFilter === 'Active' ? r.isActive : !r.isActive)
      return matchesSearch && matchesStatus
    })
  }, [routes, searchQuery, statusFilter])

  const clearFilters = () => {
    setSearchQuery("")
    setStatusFilter("All")
  }

  const hasFilters = searchQuery || statusFilter !== "All"

  const handleDeleteRoute = async (id: number) => {
    if (!confirm('Are you sure you want to delete this route?')) return
    try {
      await deleteRouteMutation.mutateAsync(id)
      toast.success('Route deleted successfully')
    } catch {
      toast.error('Failed to delete route')
    }
  }

  const totalRoutes = routes.length
  const activeRoutes = routes.filter(r => r.isActive).length

  const routeColumns: Column<TransportationRouteMaster>[] = [
    {
      key: 'originLocation',
      header: 'Route',
      sortable: true,
      render: (route) => (
        <div className="flex items-center space-x-2">
          <span className="text-sm font-semibold text-[#111111]">{route.originLocation}</span>
          <ArrowRight className="h-3.5 w-3.5 text-zinc-300 shrink-0" />
          <span className="text-sm font-semibold text-[#111111]">{route.destinationLocation}</span>
        </div>
      )
    },
    {
      key: 'supplierName',
      header: 'Supplier',
      sortable: true,
      render: (route) => (
        <span className="text-sm text-zinc-500">{route.supplierName || '—'}</span>
      )
    },
    {
      key: 'picName',
      header: 'PIC',
      render: (route) => (
        <div>
          <p className="text-sm text-zinc-700">{route.picName || '—'}</p>
          {route.picContact && (
            <p className="text-xs text-zinc-400 mt-0.5">{route.picContact}</p>
          )}
        </div>
      )
    },
    {
      key: 'isActive',
      header: 'Status',
      sortable: true,
      width: 'w-28',
      render: (route) => route.isActive ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="h-3 w-3" />Active
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-100 text-zinc-500 border border-zinc-200">
          <XCircle className="h-3 w-3" />Inactive
        </span>
      )
    },
    {
      key: 'actions',
      header: '',
      width: 'w-32',
      render: (route) => (
        <div className="flex items-center justify-end space-x-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => navigate({ to: "/master-transport-detail/$routeId", params: { routeId: route.id.toString() } })}
            title="View Pricing"
            className="h-8 w-8 text-zinc-500 hover:text-[#111111] hover:bg-zinc-100 rounded-full"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => navigate({ to: "/master-transport-edit/$routeId", params: { routeId: route.id.toString() } })}
            title="Edit Route"
            className="h-8 w-8 text-zinc-500 hover:text-[#111111] hover:bg-zinc-100 rounded-full"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => handleDeleteRoute(route.id)}
            title="Delete Route"
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
      <PageLayout title="Master Transport">
        <div className="flex items-center justify-center py-16">
          <p className="text-red-500 text-sm font-medium">{error.message}</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="Master Transport"
      subtitle="Manage transportation routes and pricing"
      actions={
        <Button
          onClick={() => navigate({ to: '/create-master-transport' })}
          className="bg-[#111111] hover:bg-[#242424] text-white h-9 px-4 rounded-md text-xs font-semibold transition-colors border border-transparent shadow-none"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Route
        </Button>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="border border-[#e5e7eb] rounded-xl bg-white p-5 shadow-none hover:border-[#111111]/30 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Total Routes</h3>
              <p className="text-2xl font-bold text-[#111111] tracking-tight">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : totalRoutes}
              </p>
            </div>
            <Bus className="h-5 w-5 text-zinc-300" />
          </div>
        </div>
        <div className="border border-[#e5e7eb] rounded-xl bg-white p-5 shadow-none hover:border-[#111111]/30 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Active</h3>
              <p className="text-2xl font-bold text-emerald-600 tracking-tight">
                {isLoading ? '—' : activeRoutes}
              </p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-emerald-300" />
          </div>
        </div>
        <div className="border border-[#e5e7eb] rounded-xl bg-white p-5 shadow-none hover:border-[#111111]/30 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Inactive</h3>
              <p className="text-2xl font-bold text-zinc-700 tracking-tight">
                {isLoading ? '—' : totalRoutes - activeRoutes}
              </p>
            </div>
            <XCircle className="h-5 w-5 text-zinc-300" />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="border border-[#e5e7eb] rounded-xl bg-white p-4 mb-4 shadow-none">
        <div className="flex flex-col md:flex-row gap-3 items-end">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
            <Input
              placeholder="Search origin, destination, or supplier..."
              className="pl-9 h-10 border-[#e5e7eb] rounded-lg bg-white text-sm focus-visible:ring-0 focus-visible:border-[#111111] shadow-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
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
          <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider">Route Registry</h3>
          {filteredRoutes.length !== totalRoutes && (
            <span className="text-xs text-zinc-400 font-medium">
              {filteredRoutes.length} of {totalRoutes} routes
            </span>
          )}
        </div>
        <DataTable
          data={filteredRoutes}
          columns={routeColumns}
          loading={isLoading}
          emptyMessage={
            filteredRoutes.length === 0 && routes.length > 0
              ? "No routes match your filters."
              : "No routes found. Add your first transport route."
          }
          noCard={true}
        />
      </div>
    </PageLayout>
  )
}
