import { createFileRoute } from "@tanstack/react-router"
import { useState, useMemo } from "react"
import { toast } from "sonner"
import { PageLayout } from "@/components/layout/PageLayout"
import { DataTable, type Column } from "@/components/ui/data-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Plus,
  Edit,
  Trash2,
  Tags,
  DollarSign,
  Search,
  X,
  Loader2,
  CheckCircle2,
  XCircle,
  Save,
  Layers
} from "lucide-react"
import {
  useServices,
  useCreateService,
  useUpdateService,
  useDeleteService,
  type ServiceMaster
} from "@/lib/queries/master"

export const Route = createFileRoute("/master-services")({
  component: MasterServicesPage
})

const CATEGORIES = [
  'Handling Airport',
  'Handling Hotel',
  'Muthowif',
  'Visa',
  'Tiket Museum',
  'Siskopatuh',
  'Lainnya'
]

// Category color map for visual variety
const CATEGORY_COLORS: Record<string, string> = {
  'Handling Airport': 'bg-sky-50 text-sky-700 border-sky-200',
  'Handling Hotel': 'bg-violet-50 text-violet-700 border-violet-200',
  'Muthowif': 'bg-amber-50 text-amber-700 border-amber-200',
  'Visa': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Tiket Museum': 'bg-rose-50 text-rose-700 border-rose-200',
  'Siskopatuh': 'bg-orange-50 text-orange-700 border-orange-200',
  'Lainnya': 'bg-zinc-100 text-zinc-600 border-zinc-200',
}

function MasterServicesPage() {
  const { data: services = [], isLoading, error } = useServices()
  const createService = useCreateService()
  const updateService = useUpdateService()
  const deleteService = useDeleteService()

  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("All")
  const [statusFilter, setStatusFilter] = useState("All")

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingService, setEditingService] = useState<ServiceMaster | null>(null)
  const [formData, setFormData] = useState({
    category: CATEGORIES[0],
    name: "",
    price: "",
    unitType: "Per Grup",
    isActive: true
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const filteredServices = useMemo(() => {
    return services.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            s.category.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = categoryFilter === 'All' || s.category === categoryFilter
      const matchesStatus = statusFilter === 'All' || (statusFilter === 'Active' ? s.isActive : !s.isActive)
      return matchesSearch && matchesCategory && matchesStatus
    })
  }, [services, searchQuery, categoryFilter, statusFilter])

  const clearFilters = () => {
    setSearchQuery("")
    setCategoryFilter("All")
    setStatusFilter("All")
  }

  const hasFilters = searchQuery || categoryFilter !== "All" || statusFilter !== "All"

  const handleOpenCreate = () => {
    setEditingService(null)
    setFormData({ category: CATEGORIES[0], name: "", price: "", unitType: "Per Grup", isActive: true })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (service: ServiceMaster) => {
    setEditingService(service)
    setFormData({
      category: service.category,
      name: service.name,
      price: service.price.toString(),
      unitType: service.unitType,
      isActive: service.isActive
    })
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.price) {
      toast.error("Please fill in all required fields.")
      return
    }
    try {
      setIsSubmitting(true)
      if (editingService) {
        await updateService.mutateAsync({ id: editingService.id, ...formData })
        toast.success("Service updated successfully")
      } else {
        await createService.mutateAsync(formData)
        toast.success("Service created successfully")
      }
      setIsModalOpen(false)
    } catch {
      toast.error("An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this service?')) return
    try {
      await deleteService.mutateAsync(id)
      toast.success('Service deleted successfully')
    } catch {
      toast.error('Failed to delete service')
    }
  }

  // Stats
  const totalServices = services.length
  const activeServices = services.filter(s => s.isActive).length
  const categoriesUsed = new Set(services.map(s => s.category)).size

  const columns: Column<ServiceMaster>[] = [
    {
      key: 'category',
      header: 'Category',
      sortable: true,
      width: 'w-44',
      render: (item) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${CATEGORY_COLORS[item.category] || CATEGORY_COLORS['Lainnya']}`}>
          {item.category}
        </span>
      )
    },
    {
      key: 'name',
      header: 'Service Name',
      sortable: true,
      render: (item) => (
        <p className="text-sm font-semibold text-[#111111]">{item.name}</p>
      )
    },
    {
      key: 'price',
      header: 'Price',
      sortable: true,
      width: 'w-40',
      render: (item) => (
        <div>
          <p className="text-sm font-bold text-[#111111] font-mono">
            {item.currency} {parseFloat(String(item.price)).toLocaleString('en-US')}
          </p>
          <p className="text-[10px] text-zinc-400 font-medium mt-0.5">{item.unitType}</p>
        </div>
      )
    },
    {
      key: 'isActive',
      header: 'Status',
      sortable: true,
      width: 'w-28',
      render: (item) => item.isActive ? (
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
      width: 'w-24',
      render: (item) => (
        <div className="flex items-center justify-end space-x-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => handleOpenEdit(item)}
            title="Edit Service"
            className="h-8 w-8 text-zinc-500 hover:text-[#111111] hover:bg-zinc-100 rounded-full"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => handleDelete(item.id)}
            title="Delete Service"
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
      <PageLayout title="Master Services">
        <div className="flex items-center justify-center py-16">
          <p className="text-red-500 text-sm font-medium">Error loading services.</p>
        </div>
      </PageLayout>
    )
  }

  const selectCls = "w-full h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm text-zinc-700 focus:outline-none focus:border-[#111111] transition-colors"
  const inputCls = "h-10 px-3 border-[#e5e7eb] rounded-lg bg-white text-sm focus-visible:ring-0 focus-visible:border-[#111111] shadow-none transition-colors"
  const labelCls = "text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 block"

  return (
    <PageLayout
      title="Master Services"
      subtitle="Manage pricing for additional services like Handling, Muthowif, Visa, etc."
      actions={
        <Button
          onClick={handleOpenCreate}
          className="bg-[#111111] hover:bg-[#242424] text-white h-9 px-4 rounded-md text-xs font-semibold transition-colors border border-transparent shadow-none"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Service
        </Button>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="border border-[#e5e7eb] rounded-xl bg-white p-5 shadow-none hover:border-[#111111]/30 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Total Services</h3>
              <p className="text-2xl font-bold text-[#111111] tracking-tight">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : totalServices}
              </p>
            </div>
            <Tags className="h-5 w-5 text-zinc-300" />
          </div>
        </div>
        <div className="border border-[#e5e7eb] rounded-xl bg-white p-5 shadow-none hover:border-[#111111]/30 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Active</h3>
              <p className="text-2xl font-bold text-emerald-600 tracking-tight">
                {isLoading ? '—' : activeServices}
              </p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-emerald-300" />
          </div>
        </div>
        <div className="border border-[#e5e7eb] rounded-xl bg-white p-5 shadow-none hover:border-[#111111]/30 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Categories</h3>
              <p className="text-2xl font-bold text-[#111111] tracking-tight">
                {isLoading ? '—' : categoriesUsed}
              </p>
            </div>
            <Layers className="h-5 w-5 text-zinc-300" />
          </div>
        </div>
      </div>

      {/* Category quick-filter pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setCategoryFilter("All")}
          className={`h-7 px-3 rounded-full text-xs font-semibold transition-colors border ${categoryFilter === "All" ? 'bg-[#111111] text-white border-[#111111]' : 'bg-white text-zinc-500 border-[#e5e7eb] hover:border-[#111111]/40'}`}
        >
          All
        </button>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat === categoryFilter ? "All" : cat)}
            className={`h-7 px-3 rounded-full text-xs font-semibold transition-colors border ${categoryFilter === cat ? 'bg-[#111111] text-white border-[#111111]' : `${CATEGORY_COLORS[cat] || CATEGORY_COLORS['Lainnya']} hover:border-zinc-400`}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Search + Status Filter Bar */}
      <div className="border border-[#e5e7eb] rounded-xl bg-white p-4 mb-4 shadow-none">
        <div className="flex flex-col md:flex-row gap-3 items-end">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
            <Input
              placeholder="Search service name or category..."
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
          <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider">Service Registry</h3>
          {filteredServices.length !== totalServices && (
            <span className="text-xs text-zinc-400 font-medium">
              {filteredServices.length} of {totalServices} services
            </span>
          )}
        </div>
        <DataTable
          data={filteredServices}
          columns={columns}
          loading={isLoading}
          emptyMessage={
            filteredServices.length === 0 && services.length > 0
              ? "No services match your filters."
              : "No services found. Add your first service."
          }
          noCard={true}
        />
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md border border-[#e5e7eb] rounded-2xl shadow-xl p-0 overflow-hidden bg-white">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#e5e7eb]">
            <DialogTitle className="text-base font-bold text-[#111111] tracking-tight">
              {editingService ? 'Edit Service' : 'Add New Service'}
            </DialogTitle>
            <p className="text-xs text-zinc-400 mt-0.5">
              {editingService ? `Editing: ${editingService.name}` : 'Register a new billable service item'}
            </p>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
            {/* Category */}
            <div>
              <label className={labelCls}>Category *</label>
              <select
                required
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                className={selectCls}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Service Name */}
            <div>
              <label className={labelCls}>Service Name *</label>
              <Input
                required
                placeholder="e.g. Jeddah Terminal 1"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className={inputCls}
              />
            </div>

            {/* Price + Unit */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Price (SAR) *</label>
                <Input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="200"
                  value={formData.price}
                  onChange={e => setFormData({ ...formData, price: e.target.value })}
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div>
                <label className={labelCls}>Unit Type *</label>
                <select
                  required
                  value={formData.unitType}
                  onChange={e => setFormData({ ...formData, unitType: e.target.value })}
                  className={selectCls}
                >
                  <option value="Per Grup">Per Grup</option>
                  <option value="Per Pax">Per Pax</option>
                </select>
              </div>
            </div>

            {/* Active Toggle */}
            <div className="pt-1">
              <label className="flex items-center space-x-3 cursor-pointer select-none">
                <div
                  className={`relative w-9 h-5 rounded-full transition-colors ${formData.isActive ? 'bg-[#111111]' : 'bg-zinc-200'}`}
                  onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                >
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${formData.isActive ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#111111]">Active (Visible in B2B)</p>
                  <p className="text-xs text-zinc-400">{formData.isActive ? 'Service can be selected in orders' : 'Service is hidden from orders'}</p>
                </div>
              </label>
            </div>

            {/* Actions */}
            <div className="flex justify-end items-center space-x-3 pt-2 border-t border-[#f3f4f6]">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="h-9 px-4 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 rounded-md text-xs font-semibold shadow-none"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !formData.name || !formData.price}
                className="bg-[#111111] hover:bg-[#242424] text-white h-9 px-5 rounded-md text-xs font-semibold transition-colors border border-transparent shadow-none disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {editingService ? 'Save Changes' : 'Create Service'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}
