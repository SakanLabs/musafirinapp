import { createFileRoute, redirect, Link } from "@tanstack/react-router"
import { toast } from "sonner"
import { PageLayout } from "@/components/layout/PageLayout"
import { DataTable, Column } from "@/components/ui/data-table"
import { Button } from "@/components/ui/button"
import {
  Receipt as ReceiptIcon,
  Download,
  Eye,
  Filter,
  Loader2,
  FileText,
  Plus,
  MessageCircle
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

    // Check if user is finance or owner
    const isFinance = await authService.isFinance()
    if (!isFinance) {
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
        <div className="flex items-center space-x-1">
          <Button
            size="icon"
            variant="ghost"
            asChild
            title="View Receipt Detail"
            className="h-8 w-8 text-zinc-500 hover:text-[#111111] hover:bg-zinc-100 rounded-full"
          >
            <Link to="/receipt-detail" search={{ number: receipt.number }}>
              <Eye className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              const API_BASE_URL = import.meta.env.VITE_API_URL || window.location.origin.replace(':5173', ':3000');
              window.open(`${API_BASE_URL}/api/receipts/number/${receipt.number}/download`, '_blank');
            }}
            title="Download PDF"
            className="h-8 w-8 text-zinc-500 hover:text-[#111111] hover:bg-zinc-100 rounded-full"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-full"
            onClick={() => {
              const API_BASE_URL = import.meta.env.VITE_API_URL || window.location.origin.replace(':5173', ':3000');
              const pdfUrl = `${API_BASE_URL}/api/receipts/number/${receipt.number}/download`;
              const msg = [
                `Assalamu'alaikum *${receipt.clientName}* 🙏`,
                ``,
                `Pembayaran Anda sudah kami terima, berikut kwitansinya:`,
                `🧳 No. Kwitansi: *${receipt.number}*`,
                `💰 Jumlah: *${formatCurrency(receipt.amount, receipt.currency)}*`,
                `📅 Tanggal: ${formatDate(receipt.issueDate)}`,
                ``,
                `Download PDF: ${pdfUrl}`,
                ``,
                `Terima kasih atas kepercayaannya ❤️`,
              ].join('\n');
              window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
            }}
            title="Kirim via WhatsApp"
          >
            <MessageCircle className="h-4 w-4" />
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
      subtitle="Kelola kwitansi pembayaran dan tanda terima transaksi"
      actions={
        <div className="flex items-center space-x-2.5">
          <Button 
            variant="outline"
            className="h-9 px-4 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 hover:text-black flex items-center rounded-md font-semibold text-xs bg-white shadow-none"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Button 
            className="bg-[#111111] hover:bg-[#242424] text-white h-9 px-4 rounded-md text-xs font-semibold transition-colors border border-transparent shadow-none"
            asChild
          >
            <Link to="/create-receipt">
              <Plus className="h-4 w-4 mr-2 text-white" />
              Create Receipt
            </Link>
          </Button>
        </div>
      }
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="border border-[#e5e7eb] rounded-xl bg-white p-5 shadow-none flex flex-col justify-between hover:border-[#111111]/30 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Total Kwitansi</h3>
              <p className="text-2xl font-bold text-[#111111] tracking-tight">{totalReceipts}</p>
            </div>
            <ReceiptIcon className="h-5 w-5 text-zinc-400" />
          </div>
        </div>

        <div className="border border-[#e5e7eb] rounded-xl bg-white p-5 shadow-none flex flex-col justify-between hover:border-[#111111]/30 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Halaman Ini</h3>
              <p className="text-2xl font-bold text-[#111111] tracking-tight">{receipts.length}</p>
            </div>
            <FileText className="h-5 w-5 text-zinc-400" />
          </div>
        </div>

        <div className="border border-[#e5e7eb] rounded-xl bg-white p-5 shadow-none flex flex-col justify-between hover:border-[#111111]/30 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Total Nilai Kwitansi</h3>
              <p className="text-2xl font-bold text-[#111111] tracking-tight">
                {formatCurrency(totalAmount.toString(), 'IDR')}
              </p>
            </div>
            <ReceiptIcon className="h-5 w-5 text-zinc-400" />
          </div>
        </div>
      </div>

      {/* Receipts Table Container */}
      <div className="overflow-hidden border border-[#e5e7eb] rounded-xl bg-white shadow-none">
        <div className="px-6 py-4 border-b border-[#e5e7eb] bg-white">
          <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider">All Receipts Registry</h3>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
            <span className="ml-2 text-zinc-500 text-sm">Loading receipts...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-red-500 text-sm font-medium">Error loading receipts. Please try again.</p>
          </div>
        ) : (
          <>
            <DataTable
              data={receipts}
              columns={receiptColumns}
              emptyMessage="No receipts found"
              noCard={true}
            />

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-[#e5e7eb] flex items-center justify-between bg-white">
                <div className="text-xs font-semibold text-zinc-500">
                  Menampilkan {((currentPage - 1) * pageSize) + 1} s/d {Math.min(currentPage * pageSize, pagination.total)} dari {pagination.total} kwitansi
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="h-8 border-[#e5e7eb] hover:bg-gray-50 text-zinc-700 rounded-md font-semibold text-xs bg-white shadow-none"
                  >
                    Previous
                  </Button>
                  <span className="text-xs font-bold text-zinc-700 px-2">
                    Halaman {currentPage} dari {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                    disabled={currentPage === pagination.totalPages}
                    className="h-8 border-[#e5e7eb] hover:bg-gray-50 text-zinc-700 rounded-md font-semibold text-xs bg-white shadow-none"
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