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
    switch (status?.toLowerCase()) {
      case "pending": return "bg-amber-50 text-amber-700 border-amber-200/50"
      case "quoted": return "bg-blue-50 text-blue-700 border-blue-200/50"
      case "invoiced": return "bg-emerald-50 text-emerald-700 border-emerald-200/50"
      case "cancelled": return "bg-red-50 text-red-700 border-red-200/50"
      default: return "bg-zinc-50 text-zinc-700 border-zinc-200/50"
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
          <div className="font-semibold text-zinc-900">{req.customerName}</div>
          <div className="text-xs text-zinc-500">{req.travelName || '-'}</div>
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
        <Badge variant="outline" className={`text-[10px] font-semibold py-0.5 px-2 rounded-md shadow-none capitalize ${getStatusColor(req.status)}`}>
          {req.status}
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
          className="flex items-center space-x-1 h-8 px-2.5 rounded-md text-xs font-medium border-[#e5e7eb] hover:bg-gray-50 hover:text-black transition-colors"
        >
          <Eye className="h-3.5 w-3.5 mr-1" />
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
          <Loader2 className="h-8 w-8 animate-spin text-zinc-950" />
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
        <Button
          onClick={() => navigate({ to: "/create-custom-la" })}
          className="bg-[#111111] hover:bg-[#242424] text-white flex items-center space-x-2 h-9 px-4 rounded-md font-medium text-sm transition-colors border border-transparent shadow-sm"
        >
          <Package className="h-4 w-4 mr-2" />
          Buat Permintaan Manual
        </Button>
      }
    >
      <div className="overflow-hidden border border-[#e5e7eb] rounded-xl bg-white shadow-none">
        <DataTable
          data={requests}
          columns={columns}
          emptyMessage="Belum ada permintaan LA"
          noCard={true}
        />
      </div>
    </PageLayout>
  )
}
