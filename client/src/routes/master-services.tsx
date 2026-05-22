import { createFileRoute } from "@tanstack/react-router"
import { useState, useMemo } from "react"
import { toast } from "sonner"
import { PageLayout } from "@/components/layout/PageLayout"
import { DataTable, type Column } from "@/components/ui/data-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Plus,
  Edit,
  Trash2,
  Tags,
  DollarSign,
  Search,
  FilterX
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
];

function MasterServicesPage() {
  const { data: services = [], isLoading, error } = useServices()
  const createService = useCreateService()
  const updateService = useUpdateService()
  const deleteService = useDeleteService()

  // Filter States
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("All")

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingService, setEditingService] = useState<ServiceMaster | null>(null)
  const [formData, setFormData] = useState({
    category: CATEGORIES[0],
    name: "",
    price: "",
    unitType: "Per Grup",
    isActive: true
  })

  const filteredServices = useMemo(() => {
    return services.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = categoryFilter === 'All' || s.category === categoryFilter
      return matchesSearch && matchesCategory
    })
  }, [services, searchQuery, categoryFilter])

  const clearFilters = () => {
    setSearchQuery("")
    setCategoryFilter("All")
  }

  const handleOpenCreate = () => {
    setEditingService(null)
    setFormData({
      category: CATEGORIES[0],
      name: "",
      price: "",
      unitType: "Per Grup",
      isActive: true
    })
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
    try {
      if (editingService) {
        await updateService.mutateAsync({
          id: editingService.id,
          ...formData
        })
        toast.success("Service updated successfully")
      } else {
        await createService.mutateAsync(formData)
        toast.success("Service created successfully")
      }
      setIsModalOpen(false)
    } catch (err) {
      toast.error("An error occurred")
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this service?')) return
    try {
      await deleteService.mutateAsync(id)
      toast.success('Service deleted successfully')
    } catch (error) {
      toast.error('Failed to delete service')
    }
  }

  const columns: Column<ServiceMaster>[] = [
    {
      key: 'id',
      header: 'ID',
      width: 'w-16'
    },
    {
      key: 'category',
      header: 'Category',
      render: (item) => (
        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-md font-medium">
          {item.category}
        </span>
      ),
      sortable: true
    },
    {
      key: 'name',
      header: 'Service Name',
      sortable: true
    },
    {
      key: 'price',
      header: 'Price',
      render: (item) => (
        <div className="font-semibold text-amber-700">
          {item.currency} {parseFloat(item.price).toLocaleString('en-US')}
        </div>
      ),
      sortable: true
    },
    {
      key: 'unitType',
      header: 'Unit',
      render: (item) => (
        <span className="text-gray-500 text-sm">{item.unitType}</span>
      )
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (item) => (
        <span className={`px-2 py-1 rounded text-xs font-semibold ${item.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {item.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
      sortable: true
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item) => (
        <div className="flex space-x-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleOpenEdit(item)}
            title="Edit Service"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDelete(item.id)}
            title="Delete Service"
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
      width: 'w-24'
    }
  ]

  if (error) {
    return (
      <PageLayout title="Master Services">
        <div className="text-center py-8 text-red-600">Error loading data.</div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="Master Services"
      subtitle="Manage pricing for additional LA services like Handling, Muthowif, etc."
      actions={
        <Button onClick={handleOpenCreate} className="flex items-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>Add Service</span>
        </Button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Services</CardTitle>
            <Tags className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{services.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Services</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{services.filter(s => s.isActive).length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search Service</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search by name..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="w-full md:w-64">
            <label className="block text-sm font-medium text-gray-700 mb-1">Category Filter</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
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
          data={filteredServices}
          columns={columns}
          loading={isLoading}
          emptyMessage="No services found."
        />
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingService ? 'Edit Service' : 'Add New Service'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <select
                required
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Service Name</label>
              <Input
                required
                placeholder="e.g. Jeddah Terminal 1"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Price (SAR)</label>
                <Input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="200"
                  value={formData.price}
                  onChange={e => setFormData({ ...formData, price: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Unit Type</label>
                <select
                  required
                  value={formData.unitType}
                  onChange={e => setFormData({ ...formData, unitType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Per Grup">Per Grup</option>
                  <option value="Per Pax">Per Pax</option>
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
              />
              <label htmlFor="isActive" className="text-sm font-medium">
                Active (Visible to B2B)
              </label>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingService ? 'Save Changes' : 'Create Service'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}
