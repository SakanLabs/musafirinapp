import { createFileRoute, Link, Outlet } from "@tanstack/react-router"
import { toast } from "sonner"
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
  Loader2,
  Trash2,
  MessageCircle
} from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useInvoices, type Invoice, useBackfillInvoiceStatus, useDeleteInvoice } from "@/lib/queries/invoices"
import { useEffect, useState } from "react"
import { authService } from "@/lib/auth"

export const Route = createFileRoute("/invoices")({
  component: InvoicesPage
})



function InvoicesPage() {
  const API_BASE_URL = import.meta.env.VITE_API_URL || window.location.origin.replace(':5173', ':3000');

  // Fetch invoices using TanStack Query
  const { data: invoices = [], isLoading, error } = useInvoices()

  // State & mutation for Sync Status (admin-only)
  const [isAdmin, setIsAdmin] = useState(false)
  const { mutateAsync: backfillStatus, isPending } = useBackfillInvoiceStatus()
  const [syncSummary, setSyncSummary] = useState<{ totalProcessed: number; updatedCount: number } | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

  // Delete invoice mutation
  const { mutateAsync: deleteInvoice, isPending: isDeleting } = useDeleteInvoice()

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
      render: (invoice) => (
        <span className="font-bold text-[#111111]">{invoice.number}</span>
      ),
      sortable: true,
      width: 'w-36'
    },
    {
      key: 'clientName',
      header: 'Client',
      render: (invoice) => (
        <span className="font-semibold text-zinc-800">{invoice.clientName}</span>
      ),
      sortable: true
    },
    {
      key: 'bookingCode',
      header: 'Booking',
      render: (invoice) => (
        <span className="font-mono text-xs bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-700 font-semibold">{invoice.bookingCode}</span>
      ),
      sortable: true,
      width: 'w-24'
    },
    {
      key: 'bookingId',
      header: 'Booking ID',
      render: (invoice) => {
        let bookingLink = `/booking-view/${invoice.bookingId}`;
        if (invoice.number.startsWith('TI-')) {
          bookingLink = `/transportation-booking-detail/${invoice.bookingId}`;
        } else if (invoice.number.startsWith('SOI-')) {
          bookingLink = `/service-order-detail/${invoice.bookingId}`;
        } else if (invoice.number.startsWith('LA-INV-')) {
          bookingLink = `/custom-la-detail/${invoice.bookingId}`;
        }

        return (
          <Link
            to={bookingLink as any}
            className="text-zinc-950 font-bold hover:underline"
          >
            #{invoice.bookingId}
          </Link>
        );
      },
      sortable: true,
      width: 'w-24'
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (invoice) => (
        <span className="font-bold text-[#111111]">
          {formatCurrency(invoice.amount, invoice.currency)}
        </span>
      ),
      sortable: true,
      width: 'w-32'
    },
    {
      key: 'status',
      header: 'Status',
      render: (invoice) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getInvoiceStatusColor(invoice.status)}`}>
          {invoice.status}
        </span>
      ),
      sortable: true,
      width: 'w-24'
    },
    {
      key: 'issueDate',
      header: 'Issue Date',
      render: (invoice) => (
        <span className="text-zinc-600 font-medium">{formatDate(invoice.issueDate)}</span>
      ),
      sortable: true,
      width: 'w-28'
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      render: (invoice) => (
        <span className="text-zinc-600 font-medium">{formatDate(invoice.dueDate)}</span>
      ),
      sortable: true,
      width: 'w-28'
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (invoice) => {
        let detailLink = `/invoice-detail?id=${invoice.id}`;
        if (invoice.number.startsWith('TI-')) {
          detailLink = `/transportation-booking-detail/${invoice.bookingId}`;
        } else if (invoice.number.startsWith('SO-INV-')) {
          detailLink = `/service-order-detail/${invoice.bookingId}`;
        } else if (invoice.number.startsWith('LA-INV-')) {
          detailLink = `/custom-la-detail/${invoice.bookingId}`;
        }

        return (
          <div className="flex items-center gap-1.5">
            <Link
              to={detailLink as any}
              className="h-8 w-8 rounded-md border border-[#e5e7eb] text-zinc-700 hover:bg-zinc-50 hover:text-black flex items-center justify-center transition-colors bg-white shadow-none"
              title="Lihat Detail"
            >
              <Eye className="h-3.5 w-3.5" />
            </Link>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(`${API_BASE_URL}/api/invoices/by-number/${invoice.number}`, '_blank')}
              className="h-8 w-8 p-0 border-[#e5e7eb] text-zinc-700 hover:bg-zinc-50 hover:text-[#111111] rounded-md flex items-center justify-center transition-colors bg-white shadow-none"
              title="Download PDF"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0 border-[#e5e7eb] text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-md flex items-center justify-center transition-colors bg-white shadow-none"
              onClick={() => {
                const pdfUrl = `${API_BASE_URL}/api/invoices/by-number/${invoice.number}`;
                const msg = [
                  `Assalamu'alaikum *${invoice.clientName}* 🙏`,
                  ``,
                  `Berikut invoice untuk pemesanan Anda:`,
                  `🏨 ${invoice.hotelName}`,
                  `📝 *${invoice.number}*`,
                  `💰 Total: *${formatCurrency(invoice.amount, invoice.currency)}*`,
                  ``,
                  `Download PDF: ${pdfUrl}`,
                  ``,
                  `Ada pertanyaan? Hubungi kami ya ❤️`,
                ].join('\n');
                window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
              }}
              title="Kirim via WhatsApp"
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </Button>
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-8 p-0 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/60 rounded-md flex items-center justify-center transition-colors shadow-none"
                title="Hapus Invoice"
                onClick={async () => {
                  const confirmed = window.confirm(`Hapus invoice ${invoice.number}? Semua payments akan ikut terhapus, receipts akan tidak terhubung.`)
                  if (!confirmed) return
                  try {
                    await deleteInvoice(invoice.id.toString())
                  } catch (err) {
                    console.error('Failed to delete invoice:', err)
                    toast.error(err instanceof Error ? err.message : 'Failed to delete invoice')
                  }
                }}
              >
                {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </Button>
            )}
          </div>
        );
      },
      width: 'w-24'
    }
  ];

  const getInvoiceStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/50'
      case 'pending':
      case 'sent':
        return 'bg-amber-50 text-amber-700 border-amber-200/50'
      case 'overdue':
        return 'bg-rose-50 text-rose-700 border-rose-200/50'
      default:
        return 'bg-zinc-50 text-zinc-700 border-zinc-200/60'
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
        <div className="flex items-center space-x-2.5">
          <Button 
            variant="outline"
            className="h-9 px-4 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 hover:text-black flex items-center rounded-md font-semibold text-xs bg-white shadow-none"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Link to="/create-invoice">
            <Button
              className="bg-[#111111] hover:bg-[#242424] text-white h-9 px-4 rounded-md text-xs font-semibold transition-colors border border-transparent shadow-none"
            >
              <Plus className="h-4 w-4 mr-2 text-white/80" />
              Create Invoice
            </Button>
          </Link>
          {isAdmin && (
            <Button
              variant="outline"
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
              className="h-9 px-4 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 hover:text-black flex items-center rounded-md font-semibold text-xs bg-white shadow-none"
              title="Sinkronisasi status invoice vs booking"
            >
              {isPending ? (
                <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Syncing...</>
              ) : (
                'Sync Status'
              )}
            </Button>
          )}
        </div>
      }
    >
      <Outlet />
      {/* Sync Status Notifications */}
      {syncSummary && (
        <div className="mb-5 border border-emerald-100 rounded-lg p-3 bg-emerald-50 text-xs font-medium text-emerald-800">
          Sync selesai. Total diproses: {syncSummary.totalProcessed}, diupdate: {syncSummary.updatedCount}.
        </div>
      )}
      {syncError && (
        <div className="mb-5 border border-rose-100 rounded-lg p-3 bg-rose-50 text-xs font-medium text-rose-800">
          {syncError}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none p-5 flex items-center justify-between transition-all hover:border-[#111111]/30">
          <div>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Invoices</p>
            <p className="text-2xl font-bold text-[#111111] mt-1 tracking-tight">{totalInvoices}</p>
          </div>
          <div className="bg-zinc-50 p-2 rounded-lg border border-zinc-200/40">
            <FileText className="h-5 w-5 text-zinc-700" />
          </div>
        </div>

        <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none p-5 flex items-center justify-between transition-all hover:border-[#111111]/30">
          <div>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Paid Invoices</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1 tracking-tight">{paidInvoices}</p>
          </div>
          <div className="bg-emerald-50/50 p-2 rounded-lg border border-emerald-100">
            <FileText className="h-5 w-5 text-emerald-700" />
          </div>
        </div>

        <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none p-5 flex items-center justify-between transition-all hover:border-[#111111]/30">
          <div>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Pending Invoices</p>
            <p className="text-2xl font-bold text-amber-700 mt-1 tracking-tight">{pendingInvoices}</p>
          </div>
          <div className="bg-amber-50/50 p-2 rounded-lg border border-amber-100">
            <FileText className="h-5 w-5 text-amber-700" />
          </div>
        </div>

        <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none p-5 flex items-center justify-between transition-all hover:border-[#111111]/30">
          <div>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Overdue Invoices</p>
            <p className="text-2xl font-bold text-rose-700 mt-1 tracking-tight">{overdueInvoices}</p>
          </div>
          <div className="bg-rose-50/50 p-2 rounded-lg border border-rose-100">
            <FileText className="h-5 w-5 text-rose-700" />
          </div>
        </div>
      </div>

      {/* Revenue Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="border border-[#e5e7eb] rounded-xl bg-white p-5 shadow-none flex flex-col justify-between hover:border-[#111111]/30 transition-all">
          <div>
            <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Total Revenue</h3>
            <p className="text-2xl font-bold text-[#111111] tracking-tight">
              {formatCurrency(totalAmount.toString(), 'IDR')}
            </p>
          </div>
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mt-3">
            Berdasarkan {totalInvoices} invoice diterbitkan
          </p>
        </div>

        <div className="border border-[#e5e7eb] rounded-xl bg-white p-5 shadow-none flex flex-col justify-between hover:border-[#111111]/30 transition-all">
          <div>
            <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Collected Revenue</h3>
            <p className="text-2xl font-bold text-[#111111] tracking-tight">
              {formatCurrency(paidAmount.toString(), 'IDR')}
            </p>
          </div>
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mt-3">
            Berdasarkan {paidInvoices} invoice lunas
          </p>
        </div>
      </div>

      {/* Invoices Table Container */}
      <div className="overflow-hidden border border-[#e5e7eb] rounded-xl bg-white shadow-none">
        <div className="px-6 py-4 border-b border-[#e5e7eb] bg-white">
          <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider">All Invoices Registry</h3>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
            <span className="ml-2 text-zinc-500 text-sm">Loading invoices...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-red-500 text-sm font-medium">Error loading invoices. Please try again.</p>
          </div>
        ) : (
          <DataTable
            data={invoices}
            columns={invoiceColumns}
            emptyMessage="No invoices found"
            noCard={true}
          />
        )}
      </div>
    </PageLayout>
  )
}