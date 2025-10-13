import { createFileRoute, redirect } from "@tanstack/react-router"
import { PageLayout } from "@/components/layout/PageLayout"
import { DataTable, Column } from "@/components/ui/data-table"
import { Button } from "@/components/ui/button"
import { 
  Receipt as ReceiptIcon,
  Download,
  Eye,
  Filter,
  Loader2,
  FileText
} from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useReceipts, type Receipt } from "@/lib/queries/receipts"
import { useState } from "react"
import { authService } from "@/lib/auth"

export const Route = createFileRoute("/receipts")({ 
  beforeLoad: async () => {
    // Check if user is authenticated
    const isAuthenticated = await authService.isAuthenticated()
    if (!isAuthenticated) {
      throw redirect({ to: '/login' })
    }
    
    // Check if user is admin
    const isAdmin = await authService.isAdmin()
    if (!isAdmin) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: ReceiptsPage
})

function ReceiptsPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)
  
  // Fetch receipts using TanStack Query
  const { data: receiptsResponse, isLoading, error } = useReceipts(currentPage, pageSize)
  
  const receipts = receiptsResponse?.data || []
  const pagination = receiptsResponse?.pagination

  // Define columns for receipts table
  const receiptColumns: Column<Receipt>[] = [
    {
      key: 'number',
      header: 'Receipt Number',
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
      key: 'invoiceNumber',
      header: 'Invoice',
      sortable: true,
      width: 'w-32'
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (receipt) => formatCurrency(receipt.amount, receipt.currency),
      sortable: true,
      width: 'w-32'
    },
    {
      key: 'issueDate',
      header: 'Issue Date',
      render: (receipt) => formatDate(receipt.issueDate),
      sortable: true,
      width: 'w-28'
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (receipt) => (
        <div className="flex space-x-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              // For now, just show receipt info in alert
              alert(`Receipt ${receipt.number}\nClient: ${receipt.clientName}\nAmount: ${formatCurrency(receipt.amount, receipt.currency)}\nBooking: ${receipt.bookingCode}`)
            }}
            title="View Receipt Detail"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => window.open(`http://localhost:3000/api/receipts/${receipt.id}/download`, '_blank')}
            title="Download PDF"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      ),
      width: 'w-24'
    }
  ]

  // Calculate summary stats
  const totalReceipts = pagination?.total || 0
  const totalAmount = receipts.reduce((sum, receipt) => sum + parseInt(receipt.amount), 0)

  return (
    <PageLayout
      title="Receipts"
      subtitle="Manage payment receipts and kwitansi"
      actions={
        <div className="flex space-x-3">
          <Button variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
        </div>
      }
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Receipts</p>
              <p className="text-3xl font-bold text-gray-900">{totalReceipts}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <ReceiptIcon className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Current Page</p>
              <p className="text-3xl font-bold text-gray-900">{receipts.length}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <FileText className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Value</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(totalAmount.toString(), 'IDR')}
              </p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <ReceiptIcon className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Receipts Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">All Receipts</h3>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-600">Loading receipts...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-red-600">Error loading receipts. Please try again.</p>
          </div>
        ) : (
          <>
            <DataTable
              data={receipts}
              columns={receiptColumns}
              emptyMessage="No receipts found"
            />
            
            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, pagination.total)} of {pagination.total} receipts
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="px-3 py-1 text-sm text-gray-600">
                    Page {currentPage} of {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                    disabled={currentPage === pagination.totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </PageLayout>
  )
}