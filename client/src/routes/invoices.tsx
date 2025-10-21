import { createFileRoute, Link } from "@tanstack/react-router"
import { PageLayout } from "@/components/layout/PageLayout"
import { DataTable, Column } from "@/components/ui/data-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  FileText,
  Download,
  Eye,
  Plus,
  Filter,
  Loader2
} from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useInvoices, type Invoice, useBackfillInvoiceStatus } from "@/lib/queries/invoices"
import { useEffect, useState } from "react"
import { authService } from "@/lib/auth"

export const Route = createFileRoute("/invoices")({ 
  component: InvoicesPage
})



function InvoicesPage() {
  // Fetch invoices using TanStack Query
  const { data: invoices = [], isLoading, error } = useInvoices()

  // State & mutation for Sync Status (admin-only)
  const [isAdmin, setIsAdmin] = useState(false)
  const { mutateAsync: backfillStatus, isPending } = useBackfillInvoiceStatus()
  const [syncSummary, setSyncSummary] = useState<{ totalProcessed: number; updatedCount: number } | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    authService.isAdmin().then(v => { if (mounted) setIsAdmin(v) }).catch(() => setIsAdmin(false))
    return () => { mounted = false }
  }, [])

  // Define columns for invoices table
  const invoiceColumns: Column<Invoice>[] = [
    {
      key: 'number',
      header: 'Invoice Number',
      sortable: true,
      width: 'w-36'
    },
    {
      key: 'clientName',
      header: 'Client',
      sortable: true
    },
    {
      key: 'bookingCode',
      header: 'Booking',
      sortable: true,
      width: 'w-24'
    },
    {
      key: 'bookingId',
      header: 'Booking ID',
      render: (invoice) => (
        <Link 
          to="/booking-view/$bookingId" 
          params={{ bookingId: invoice.bookingId.toString() }}
          className="text-blue-600 hover:text-blue-800 underline"
        >
          #{invoice.bookingId}
        </Link>
      ),
      sortable: true,
      width: 'w-24'
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (invoice) => formatCurrency(invoice.amount, invoice.currency),
      sortable: true,
      width: 'w-32'
    },
    {
      key: 'status',
      header: 'Status',
      render: (invoice) => (
        <Badge className={getInvoiceStatusColor(invoice.status)}>
          {invoice.status}
        </Badge>
      ),
      sortable: true,
      width: 'w-24'
    },
    {
      key: 'issueDate',
      header: 'Issue Date',
      render: (invoice) => formatDate(invoice.issueDate),
      sortable: true,
      width: 'w-28'
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      render: (invoice) => formatDate(invoice.dueDate),
      sortable: true,
      width: 'w-28'
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (invoice) => (
        <div className="flex space-x-2">
          <Link
            to="/invoice-detail"
            search={{ id: invoice.id.toString() }}
            className="inline-flex items-center justify-center rounded-md hover:bg-gray-100 px-2 py-1"
            title="View Invoice Detail"
          >
            <Eye className="h-4 w-4" />
          </Link>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => window.open(`http://localhost:3000/api/invoices/by-number/${invoice.number}`, '_blank')}
            title="Download PDF"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      ),
      width: 'w-24'
    }
  ]



  const getInvoiceStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'overdue':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  // Calculate summary stats
  const totalInvoices = invoices.length
  const paidInvoices = invoices.filter(inv => inv.status === 'paid').length
  const pendingInvoices = invoices.filter(inv => inv.status === 'pending').length
  const overdueInvoices = invoices.filter(inv => inv.status === 'overdue').length
  const totalAmount = invoices.reduce((sum, inv) => sum + parseInt(inv.amount), 0)
  const paidAmount = invoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + parseInt(inv.amount), 0)

  return (
    <PageLayout
      title="Invoices"
      subtitle="Manage invoices and payment tracking"
      actions={
        <div className="flex space-x-3">
          <Button variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Link to="/invoices/create">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Invoice
            </Button>
          </Link>
          {isAdmin && (
            <Button
              variant="secondary"
              onClick={async () => {
                setSyncError(null)
                setSyncSummary(null)
                try {
                  const result = await backfillStatus()
                  setSyncSummary({ totalProcessed: result.totalProcessed, updatedCount: result.updatedCount })
                } catch (e: any) {
                  setSyncError(e?.message || 'Sync gagal')
                }
              }}
              disabled={isPending}
              title="Sinkronisasi status invoice vs booking"
            >
              {isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Syncing...</>) : 'Sync Status'}
            </Button>
          )}
        </div>
      }
    >
      {/* Summary Cards */}
      {syncSummary && (
        <div className="mb-4 text-sm text-gray-700">
          Sync selesai. Total diproses: {syncSummary.totalProcessed}, diupdate: {syncSummary.updatedCount}.
        </div>
      )}
      {syncError && (
        <div className="mb-4 text-sm text-red-600">
          {syncError}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Invoices</p>
              <p className="text-3xl font-bold text-gray-900">{totalInvoices}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Paid</p>
              <p className="text-3xl font-bold text-green-600">{paidInvoices}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <FileText className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-3xl font-bold text-yellow-600">{pendingInvoices}</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-full">
              <FileText className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Overdue</p>
              <p className="text-3xl font-bold text-red-600">{overdueInvoices}</p>
            </div>
            <div className="bg-red-100 p-3 rounded-full">
              <FileText className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Total Revenue</h3>
          <p className="text-3xl font-bold text-blue-600">
            {formatCurrency(totalAmount.toString(), 'IDR')}
          </p>
          <p className="text-sm text-gray-600 mt-2">
            From {totalInvoices} invoices
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Collected Revenue</h3>
          <p className="text-3xl font-bold text-green-600">
            {formatCurrency(paidAmount.toString(), 'IDR')}
          </p>
          <p className="text-sm text-gray-600 mt-2">
            From {paidInvoices} paid invoices
          </p>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">All Invoices</h3>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-600">Loading invoices...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-red-600">Error loading invoices. Please try again.</p>
          </div>
        ) : (
          <DataTable
            data={invoices}
            columns={invoiceColumns}
            emptyMessage="No invoices found"
          />
        )}
      </div>
    </PageLayout>
  )
}