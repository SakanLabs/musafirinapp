import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
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
      `Are you sure you want to delete visa ${serviceOrder.number}? This action cannot be undone.`
    )

    if (confirmed) {
      try {
        await deleteServiceOrder.mutateAsync(serviceOrder.id.toString())
        toast.success('Visa deleted successfully!')
      } catch (error) {
        console.error('Error deleting visa:', error)
        const msg = error instanceof Error ? error.message : 'An unexpected error occurred'
        toast.error(msg)
      }
    }
  }

  const columns: Column<ServiceOrderListItem>[] = [
    {
      key: 'number',
      header: 'Visa Number',
      sortable: true,
      width: 'w-36',
      render: (so) => <span className="font-semibold text-gray-800 font-mono text-xs">{so.number}</span>
    },
    { key: 'clientName', header: 'Client', sortable: true },
    {
      key: 'productType',
      header: 'Product',
      sortable: true,
      width: 'w-36',
      render: (so) => <span className="capitalize text-gray-600 text-xs">{so.productType?.replace('_', ' ') || '-'}</span>
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      width: 'w-28',
      render: (so) => (
        <Badge variant="outline" className={`text-[10px] font-semibold py-0.5 px-2 rounded-md shadow-none capitalize ${getStatusColor(so.status)}`}>
          {so.status}
        </Badge>
      )
    },
    { key: 'totalPeople', header: 'Pax', sortable: true, width: 'w-16' },
    {
      key: 'unitPriceUSD',
      header: 'Unit Price',
      width: 'w-28',
      render: (so) => <span className="text-gray-600 font-mono text-xs">{formatCurrency(so.unitPriceUSD, 'USD')}</span>
    },
    {
      key: 'totalPriceUSD',
      header: 'Total (USD)',
      width: 'w-28',
      render: (so) => <span className="font-semibold text-[#111111] font-mono text-xs">{formatCurrency(so.totalPriceUSD, 'USD')}</span>
    },
    {
      key: 'departureDate',
      header: 'Departure',
      width: 'w-28',
      render: (so) => <span className="text-gray-500 font-mono text-xs">{formatDate(so.departureDate)}</span>
    },
    {
      key: 'actions',
      header: 'Actions',
      width: 'w-32',
      render: (so) => (
        <div className="flex items-center space-x-1.5">
          <Link to="/service-order-detail/$serviceOrderId" params={{ serviceOrderId: so.id.toString() }} title="View Visa Details">
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2.5 border-[#e5e7eb] text-xs font-medium hover:bg-gray-50 text-[#111111] flex items-center space-x-1 rounded-md"
            >
              <Eye className="h-3.5 w-3.5 text-gray-500" />
              <span>Details</span>
            </Button>
          </Link>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleEdit(so.id.toString())}
            title="Edit Visa"
            className="h-8 w-8 p-0 text-gray-500 hover:text-[#111111] hover:bg-gray-50 rounded-md"
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDelete(so)}
            disabled={deleteServiceOrder.isPending}
            title="Delete Visa"
            className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"
          >
            {deleteServiceOrder.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      )
    },
  ]

  return (
    <PageLayout
      title="Visa Management"
      subtitle="Kelola pesanan layanan visa dan checklist dokumen"
      actions={
        <Link to="/create-service-order">
          <Button className="bg-[#111111] hover:bg-[#242424] text-white flex items-center space-x-2 h-9 px-4 rounded-md font-medium text-sm transition-colors border border-transparent shadow-sm">
            <Plus className="h-4 w-4 mr-2" />
            <span>Buat Pesanan Visa</span>
          </Button>
        </Link>
      }
    >
      <div className="overflow-hidden border border-[#e5e7eb] rounded-xl bg-white shadow-none">
        <DataTable<ServiceOrderListItem>
          data={orders}
          columns={columns}
          loading={isLoading}
          emptyMessage="No visa orders found"
          noCard={true}
        />
      </div>
    </PageLayout>
  )
}

function getStatusColor(status: string) {
  switch (status?.toLowerCase()) {
    case 'draft':
      return 'bg-zinc-100 text-zinc-800 border-zinc-200/50'
    case 'submitted':
      return 'bg-amber-50 text-amber-700 border-amber-200/30'
    case 'paid':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200/30'
    case 'cancelled':
      return 'bg-rose-50 text-rose-700 border-rose-200/30'
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200/50'
  }
}
