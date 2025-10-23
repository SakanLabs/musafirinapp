import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { PageLayout } from "@/components/layout/PageLayout"
import { DataTable, Column } from "@/components/ui/data-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Eye, Edit, Trash2, Loader2 } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useServiceOrders, useDeleteServiceOrder, type ServiceOrderListItem } from "@/lib/queries/serviceOrders"

export const Route = createFileRoute("/service-orders")({
  component: ServiceOrdersPage
})

function ServiceOrdersPage() {
  const navigate = useNavigate()
  const { data, isLoading } = useServiceOrders()
  const orders: ServiceOrderListItem[] = data ?? []
  const deleteServiceOrder = useDeleteServiceOrder()

  const handleEdit = (serviceOrderId: string) => {
    navigate({ to: `/service-order-edit/${serviceOrderId}` })
  }

  const handleDelete = async (serviceOrder: ServiceOrderListItem) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete service order ${serviceOrder.number}? This action cannot be undone.`
    )
    
    if (confirmed) {
      try {
        await deleteServiceOrder.mutateAsync(serviceOrder.id.toString())
        alert('Service order deleted successfully!')
      } catch (error) {
        console.error('Error deleting service order:', error)
        alert('Failed to delete service order. Please try again.')
      }
    }
  }

  const columns: Column<ServiceOrderListItem>[] = [
    { key: 'number', header: 'SO Number', sortable: true, width: 'w-36' },
    { key: 'clientName', header: 'Client', sortable: true },
    { key: 'productType', header: 'Product', sortable: true, width: 'w-32' },
    { key: 'status', header: 'Status', sortable: true, width: 'w-28', render: (so) => (
      <Badge className={getStatusColor(so.status)}>{so.status}</Badge>
    ) },
    { key: 'totalPeople', header: 'Pax', sortable: true, width: 'w-20' },
    { key: 'unitPriceUSD', header: 'Unit Price', width: 'w-28', render: (so) => formatCurrency(so.unitPriceUSD, 'USD') },
    { key: 'totalPriceUSD', header: 'Total (USD)', width: 'w-28', render: (so) => formatCurrency(so.totalPriceUSD, 'USD') },
    { key: 'departureDate', header: 'Departure', width: 'w-28', render: (so) => formatDate(so.departureDate) },
    { 
      key: 'actions', 
      header: 'Actions', 
      width: 'w-32', 
      render: (so) => (
        <div className="flex items-center space-x-1">
          <Link to="/service-order-detail/$serviceOrderId" params={{ serviceOrderId: so.id.toString() }}>
            <Button variant="outline" size="sm">
              <Eye className="h-4 w-4" />
            </Button>
          </Link>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => handleEdit(so.id.toString())}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => handleDelete(so)}
            disabled={deleteServiceOrder.isPending}
          >
            {deleteServiceOrder.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      )
    },
  ]

  return (
    <PageLayout
      title="Service Orders (Visa)"
      subtitle="Kelola pesanan layanan visa dan checklist dokumen"
      actions={
        <Link to="/create-service-order">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Buat Pesanan Visa
          </Button>
        </Link>
      }
    >
      <div className="space-y-4">
        <DataTable<ServiceOrderListItem>
          data={orders}
          columns={columns}
          loading={isLoading}
          emptyMessage="No service orders found"
        />
      </div>
    </PageLayout>
  )
}

function getStatusColor(status: string) {
  switch (status) {
    case 'draft':
      return 'bg-gray-100 text-gray-800 border-gray-200'
    case 'submitted':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'paid':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'cancelled':
      return 'bg-red-100 text-red-800 border-red-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}