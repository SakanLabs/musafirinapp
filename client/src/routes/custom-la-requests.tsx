import { createFileRoute, redirect, Link, useNavigate } from "@tanstack/react-router"
import { PageLayout } from "@/components/layout/PageLayout"
import { DataTable, Column } from "@/components/ui/data-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Eye, Loader2, Package } from "lucide-react"
import { authService } from "@/lib/auth"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useCustomLaRequests, type CustomLaRequest } from "@/lib/queries"

export const Route = createFileRoute("/custom-la-requests")({
  beforeLoad: async () => {
    const isAuthenticated = await authService.isAuthenticated()
    if (!isAuthenticated) {
      throw redirect({ to: "/login" })
    }
  },
  component: CustomLaRequestsPage
})

function CustomLaRequestsPage() {
  const navigate = useNavigate()
  const { data: requests = [], isLoading, error } = useCustomLaRequests()

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-100 text-yellow-800"
      case "quoted": return "bg-blue-100 text-blue-800"
      case "invoiced": return "bg-green-100 text-green-800"
      case "cancelled": return "bg-red-100 text-red-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  const columns: Column<CustomLaRequest>[] = [
    {
      key: 'number',
      header: 'No. Request',
      sortable: true,
      width: 'w-32'
    },
    {
      key: 'customerName',
      header: 'Nama Pemesan',
      render: (req) => (
        <div>
          <div className="font-semibold">{req.customerName}</div>
          <div className="text-xs text-gray-500">{req.travelName || '-'}</div>
        </div>
      ),
      sortable: true
    },
    {
      key: 'customerPhone',
      header: 'No. WA',
      sortable: true
    },
    {
      key: 'totalPax',
      header: 'Jamaah',
      render: (req) => `${req.totalPax} Pax`,
      sortable: true,
      width: 'w-24'
    },
    {
      key: 'totalAmountSAR',
      header: 'Estimasi (SAR)',
      render: (req) => formatCurrency(req.totalAmountSAR.toString(), 'SAR'),
      sortable: true
    },
    {
      key: 'createdAt',
      header: 'Tanggal Request',
      render: (req) => formatDate(req.createdAt),
      sortable: true
    },
    {
      key: 'status',
      header: 'Status',
      render: (req) => (
        <Badge className={getStatusColor(req.status)}>
          {req.status.toUpperCase()}
        </Badge>
      ),
      sortable: true,
      width: 'w-28'
    },
    {
      key: 'actions',
      header: 'Aksi',
      render: (req) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate({ to: "/custom-la-detail/$id", params: { id: req.id.toString() } })}
          className="flex items-center space-x-1"
        >
          <Eye className="h-4 w-4" />
          <span>Review</span>
        </Button>
      ),
      width: 'w-28'
    }
  ]

  if (isLoading) {
    return (
      <PageLayout title="Permintaan LA Custom" subtitle="Kelola permintaan Land Arrangement dari pelanggan">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </PageLayout>
    )
  }

  if (error) {
    return (
      <PageLayout title="Permintaan LA Custom" subtitle="Kelola permintaan Land Arrangement dari pelanggan">
        <div className="text-center text-red-600 p-8">
          Error loading requests: {error.message}
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="Permintaan LA Custom"
      subtitle="Kelola permintaan Land Arrangement Dinamis dari pelanggan (B2C & Agen)"
      actions={
        <Button onClick={() => navigate({ to: "/create-custom-la" })}>
          <Package className="h-4 w-4 mr-2" />
          Buat Permintaan Manual
        </Button>
      }
    >
      <div className="bg-white">
        <DataTable
          data={requests}
          columns={columns}
          emptyMessage="Belum ada permintaan LA"
        />
      </div>
    </PageLayout>
  )
}
