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
  MessageCircle,
  Edit,
  CreditCard,
  SlidersHorizontal,
  Layers
} from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useInvoices, type Invoice, useBackfillInvoiceStatus, useDeleteInvoice } from "@/lib/queries/invoices"
import { Fragment, useEffect, useState } from "react"
import { authService } from "@/lib/auth"
import { MergeInvoiceModal } from "@/components/modals/MergeInvoiceModal"

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

  // Merge Invoices selection state
  const [isMergeMode, setIsMergeMode] = useState(false)
  const [selectedInvoiceNumbers, setSelectedInvoiceNumbers] = useState<Set<string>>(new Set())
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false)

  const toggleInvoiceSelection = (invoiceNumber: string) => {
    setSelectedInvoiceNumbers((prev) => {
      const next = new Set(prev)
      if (next.has(invoiceNumber)) {
        next.delete(invoiceNumber)
      } else {
        next.add(invoiceNumber)
      }
      return next
    })
  }

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
        if (invoice.number.startsWith('INV-MRG-')) {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
              Merged
            </span>
          );
        }

        if (invoice.bookingCode === 'MANUAL' || invoice.number.startsWith('INV-MAN-')) {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-100 text-zinc-600 border border-zinc-200">
              Manual
            </span>
          );
        }

        let bookingLink = `/booking-view/${invoice.bookingId}`;
        if (invoice.number.startsWith('TI-')) {
          bookingLink = `/transportation-booking-detail/${invoice.bookingId}`;
        } else if (invoice.number.startsWith('SOI-')) {
          bookingLink = `/service-order-detail/${invoice.bookingId}`;
        } else if (invoice.number.startsWith('LA-INV-')) {
          bookingLink = `/custom-la-detail/${invoice.bookingId}`;
        } else if (invoice.number.startsWith('INV-AR-')) {
          bookingLink = `/agent-requests-admin-detail/${invoice.bookingId}`;
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
        } else if (invoice.number.startsWith('MBI-')) {
          detailLink = `/muthowif-booking-detail/${invoice.bookingId}`;
        } else if (invoice.number.startsWith('INV-AR-')) {
          detailLink = `/agent-requests-admin-detail/${invoice.bookingId}`;
        }

        return (
          <div className="flex items-center gap-1.5">
            {invoice.number.startsWith('INV-MAN-') || invoice.number.startsWith('INV-MRG-') ? (
              <>
                <Link
                  to={`/create-manual-invoice?id=${invoice.id}` as any}
                  className="h-8 w-8 rounded-md border border-[#e5e7eb] text-zinc-700 hover:bg-zinc-50 hover:text-black flex items-center justify-center transition-colors bg-white shadow-none"
                  title="Detail & Pembayaran Invoice"
                >
                  <Edit className="h-3.5 w-3.5" />
                </Link>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(`${API_BASE_URL}/api/invoices/by-number/${invoice.number}`, '_blank')}
                  className="h-8 w-8 p-0 border-[#e5e7eb] text-zinc-700 hover:bg-zinc-50 hover:text-black flex items-center justify-center transition-colors bg-white shadow-none"
                  title="Lihat Invoice PDF"
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : (
              <Link
                to={detailLink as any}
                className="h-8 w-8 rounded-md border border-[#e5e7eb] text-zinc-700 hover:bg-zinc-50 hover:text-black flex items-center justify-center transition-colors bg-white shadow-none"
                title="Lihat Detail"
              >
                <Eye className="h-3.5 w-3.5" />
              </Link>
            )}
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
                  invoice.hotelName && invoice.hotelName !== '-' ? `🏨 ${invoice.hotelName}` : null,
                  `📝 *${invoice.number}*`,
                  `💰 Total: *${formatCurrency(invoice.amount, invoice.currency)}*`,
                  ``,
                  `Download PDF: ${pdfUrl}`,
                  ``,
                  `Ada pertanyaan? Hubungi kami ya ❤️`,
                ].filter(Boolean).join('\n');
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

  const selectionColumn: Column<Invoice> = {
    key: 'selection',
    header: '',
    render: (invoice) => (
      <div className="flex items-center justify-center">
        <input
          type="checkbox"
          checked={selectedInvoiceNumbers.has(invoice.number)}
          onChange={(e) => {
            e.stopPropagation();
            toggleInvoiceSelection(invoice.number);
          }}
          className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
        />
      </div>
    ),
    width: 'w-10',
  };

  const displayedColumns = isMergeMode ? [selectionColumn, ...invoiceColumns] : invoiceColumns;

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
  // Revenue is grouped per currency — amounts in different currencies can't be summed together
  type CurrencyRevenue = { total: number; paid: number; outstanding: number; totalCount: number; paidCount: number }
  const revenueByCurrency: Record<string, CurrencyRevenue> = {}
  for (const inv of invoices) {
    const currency = inv.currency || 'IDR'
    const amount = parseFloat(inv.amount) || 0
    const rev = revenueByCurrency[currency] ??= { total: 0, paid: 0, outstanding: 0, totalCount: 0, paidCount: 0 }
    rev.total += amount
    rev.totalCount++
    if (inv.status === 'paid') {
      rev.paid += amount
      rev.paidCount++
    } else {
      rev.outstanding += amount
    }
  }
  const revenueEntries = Object.entries(revenueByCurrency)
  if (revenueEntries.length === 0) {
    revenueEntries.push(['IDR', { total: 0, paid: 0, outstanding: 0, totalCount: 0, paidCount: 0 }])
  }

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
          <Button
            variant={isMergeMode ? "default" : "outline"}
            onClick={() => {
              if (isMergeMode) {
                setIsMergeMode(false);
                setSelectedInvoiceNumbers(new Set());
              } else {
                setIsMergeMode(true);
              }
            }}
            className={isMergeMode
              ? "h-9 px-3.5 bg-zinc-900 hover:bg-zinc-800 text-white flex items-center rounded-md font-semibold text-xs shadow-sm"
              : "h-9 px-3.5 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 hover:text-black flex items-center rounded-md font-semibold text-xs bg-white shadow-none"
            }
            title="Gabungkan beberapa invoice menjadi 1 invoice"
          >
            <Layers className="h-3.5 w-3.5 mr-1.5" />
            {isMergeMode ? 'Batal Merge' : 'Merge Invoices'}
          </Button>
          <Link to="/invoice-terms-settings">
            <Button
              variant="outline"
              className="h-9 px-3.5 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 hover:text-black flex items-center rounded-md font-semibold text-xs bg-white shadow-none"
              title="Pengaturan Syarat & Ketentuan Invoice"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5 text-zinc-500" />
              Setting T&C
            </Button>
          </Link>
          <Link to="/create-manual-invoice">
            <Button
              variant="outline"
              className="h-9 px-4 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 hover:text-black flex items-center rounded-md font-semibold text-xs bg-white shadow-none"
            >
              <Plus className="h-4 w-4 mr-2 text-zinc-500" />
              Manual Invoice
            </Button>
          </Link>
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

      {/* Revenue Summary — one row of cards per currency */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {revenueEntries.map(([currency, rev]) => (
          <Fragment key={currency}>
            <div className="border border-[#e5e7eb] rounded-xl bg-white p-5 shadow-none flex flex-col justify-between hover:border-[#111111]/30 transition-all">
              <div>
                <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Total Revenue · {currency}</h3>
                <p className="text-2xl font-bold text-[#111111] tracking-tight">
                  {formatCurrency(rev.total, currency)}
                </p>
              </div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mt-3">
                Berdasarkan {rev.totalCount} invoice diterbitkan
              </p>
            </div>

            <div className="border border-[#e5e7eb] rounded-xl bg-white p-5 shadow-none flex flex-col justify-between hover:border-[#111111]/30 transition-all">
              <div>
                <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Collected Revenue · {currency}</h3>
                <p className="text-2xl font-bold text-[#111111] tracking-tight">
                  {formatCurrency(rev.paid, currency)}
                </p>
              </div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mt-3">
                Berdasarkan {rev.paidCount} invoice lunas
              </p>
            </div>

            <div className="border border-[#e5e7eb] rounded-xl bg-white p-5 shadow-none flex flex-col justify-between hover:border-[#111111]/30 transition-all">
              <div>
                <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Outstanding Revenue · {currency}</h3>
                <p className="text-2xl font-bold text-[#111111] tracking-tight">
                  {formatCurrency(rev.outstanding, currency)}
                </p>
              </div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mt-3">
                Berdasarkan {rev.totalCount - rev.paidCount} invoice belum lunas
              </p>
            </div>
          </Fragment>
        ))}
      </div>

      {/* Merge Mode Action Bar */}
      {isMergeMode && (
        <div className="mb-5 bg-zinc-900 text-white rounded-xl p-3.5 px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm border border-zinc-800 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-lg">
              <Layers className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold flex items-center gap-2">
                <span>Mode Pemilihan Invoice untuk Digabungkan</span>
                <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full font-mono">
                  {selectedInvoiceNumbers.size} dipilih
                </span>
              </div>
              <p className="text-xs text-zinc-300 mt-0.5">
                Centang minimal 2 invoice dari tabel di bawah untuk digabungkan menjadi satu invoice resmi.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (selectedInvoiceNumbers.size === invoices.length) {
                  setSelectedInvoiceNumbers(new Set());
                } else {
                  setSelectedInvoiceNumbers(new Set(invoices.map((i) => i.number)));
                }
              }}
              className="text-xs bg-transparent text-white border-zinc-700 hover:bg-white/10 hover:text-white h-8"
            >
              {selectedInvoiceNumbers.size === invoices.length ? 'Batal Semua' : 'Pilih Semua'}
            </Button>
            <Button
              size="sm"
              disabled={selectedInvoiceNumbers.size < 2}
              onClick={() => setIsMergeModalOpen(true)}
              className="bg-white text-zinc-950 hover:bg-zinc-100 font-bold text-xs h-8 px-4 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              Lanjutkan Merge ({selectedInvoiceNumbers.size})
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setIsMergeMode(false);
                setSelectedInvoiceNumbers(new Set());
              }}
              className="text-xs text-zinc-400 hover:text-white hover:bg-white/10 h-8"
            >
              Batal
            </Button>
          </div>
        </div>
      )}

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
            columns={displayedColumns}
            emptyMessage="No invoices found"
            noCard={true}
          />
        )}
      </div>

      {/* Merge Invoice Modal */}
      <MergeInvoiceModal
        isOpen={isMergeModalOpen}
        onClose={() => setIsMergeModalOpen(false)}
        selectedInvoices={invoices.filter((i) => selectedInvoiceNumbers.has(i.number))}
        onSuccess={() => {
          setIsMergeMode(false);
          setSelectedInvoiceNumbers(new Set());
        }}
      />
    </PageLayout>
  )
}