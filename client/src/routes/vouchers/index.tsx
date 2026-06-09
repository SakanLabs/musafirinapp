import { createFileRoute, Link } from "@tanstack/react-router"
import { PageLayout } from "@/components/layout/PageLayout"
import { DataTable, Column } from "@/components/ui/data-table"
import { Button } from "@/components/ui/button"
import { 
  Ticket,
  Download,
  Eye,
  Plus,
  Filter,
  Share,
  Loader2
} from "lucide-react"
import { formatDate, shareToWhatsApp, generateVoucherWhatsAppMessage } from "@/lib/utils"
import { useVouchers, type Voucher } from "@/lib/queries/vouchers"

export const Route = createFileRoute("/vouchers/")({
  component: VouchersPage
})

function VouchersPage() {
  // Fetch vouchers using TanStack Query
  const { data: vouchers = [], isLoading, error } = useVouchers()

  // Calculate nights between check-in and check-out
  const calculateNights = (checkIn: string, checkOut: string) => {
    const checkInDate = new Date(checkIn)
    const checkOutDate = new Date(checkOut)
    const diffTime = Math.abs(checkOutDate.getTime() - checkInDate.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  // Define columns for vouchers table
  const voucherColumns: Column<Voucher>[] = [
    {
      key: 'number',
      header: 'Voucher Number',
      sortable: true,
      width: 'w-36'
    },
    {
      key: 'guestName',
      header: 'Guest',
      sortable: true
    },
    {
      key: 'hotelName',
      header: 'Hotel',
      sortable: true
    },
    {
      key: 'checkIn',
      header: 'Check-in',
      render: (voucher) => formatDate(voucher.checkIn),
      sortable: true,
      width: 'w-28'
    },
    {
      key: 'checkOut',
      header: 'Check-out',
      render: (voucher) => formatDate(voucher.checkOut),
      sortable: true,
      width: 'w-28'
    },
    {
      key: 'nights',
      header: 'Nights',
      render: (voucher) => {
        const nights = calculateNights(voucher.checkIn, voucher.checkOut)
        return `${nights} night${nights > 1 ? 's' : ''}`
      },
      sortable: true,
      width: 'w-20'
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (voucher) => formatDate(voucher.createdAt),
      sortable: true,
      width: 'w-28'
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (voucher) => (
        <div className="flex items-center space-x-1">
          <Button 
            size="icon" 
            variant="ghost"
            onClick={() => handleViewVoucher(voucher)}
            title="View Voucher"
            className="h-8 w-8 text-zinc-500 hover:text-[#111111] hover:bg-zinc-100 rounded-full"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button 
            size="icon" 
            variant="ghost"
            onClick={() => handleDownloadPDF(voucher)}
            title="Download PDF"
            className="h-8 w-8 text-zinc-500 hover:text-[#111111] hover:bg-zinc-100 rounded-full"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button 
            size="icon" 
            variant="ghost"
            onClick={() => handleShareWhatsApp(voucher)}
            title="Share via WhatsApp"
            className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-full"
          >
            <Share className="h-4 w-4" />
          </Button>
        </div>
      ),
      width: 'w-32'
    }
  ]

  const handleViewVoucher = (voucher: Voucher) => {
    import("@/lib/api").then(({ apiClient }) => {
      apiClient.downloadFile(`/api/vouchers/by-number/${voucher.number}`, `Voucher-${voucher.number}.pdf`);
    });
  }

  const handleDownloadPDF = (voucher: Voucher) => {
    import("@/lib/api").then(({ apiClient }) => {
      apiClient.downloadFile(`/api/vouchers/by-number/${voucher.number}`, `Voucher-${voucher.number}.pdf`);
    });
  }

  const handleShareWhatsApp = (voucher: Voucher) => {
    const message = generateVoucherWhatsAppMessage({
      number: voucher.number,
      guestName: voucher.guestName,
      hotelName: voucher.hotelName,
      checkIn: voucher.checkIn,
      checkOut: voucher.checkOut,
      pdfUrl: voucher.pdfUrl
    })
    shareToWhatsApp({ phoneNumber: voucher.clientEmail, message })
  }

  // Calculate summary stats
  const totalVouchers = vouchers?.length || 0
  const currentDate = new Date()
  const activeVouchers = vouchers?.filter(v => v.checkOut && new Date(v.checkOut) >= currentDate).length || 0
  const usedVouchers = vouchers?.filter(v => v.checkOut && new Date(v.checkOut) < currentDate).length || 0
  const totalNights = vouchers?.reduce((sum, v) => {
    if (v.checkIn && v.checkOut) {
      return sum + calculateNights(v.checkIn, v.checkOut)
    }
    return sum
  }, 0) || 0

  return (
    <PageLayout
      title="Vouchers"
      subtitle="Kelola voucher hotel dan konfirmasi reservasi jamaah"
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
            <Link to="/vouchers/create">
              <Plus className="h-4 w-4 mr-2 text-white" />
              Create Voucher
            </Link>
          </Button>
        </div>
      }
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="border border-[#e5e7eb] rounded-xl bg-white p-5 shadow-none flex flex-col justify-between hover:border-[#111111]/30 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Total Vouchers</h3>
              <p className="text-2xl font-bold text-[#111111] tracking-tight">{totalVouchers}</p>
            </div>
            <Ticket className="h-5 w-5 text-zinc-400" />
          </div>
        </div>

        <div className="border border-[#e5e7eb] rounded-xl bg-white p-5 shadow-none flex flex-col justify-between hover:border-[#111111]/30 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Voucher Aktif</h3>
              <p className="text-2xl font-bold text-emerald-600 tracking-tight">{activeVouchers}</p>
            </div>
            <Ticket className="h-5 w-5 text-emerald-500" />
          </div>
        </div>

        <div className="border border-[#e5e7eb] rounded-xl bg-white p-5 shadow-none flex flex-col justify-between hover:border-[#111111]/30 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Sudah Digunakan</h3>
              <p className="text-2xl font-bold text-zinc-700 tracking-tight">{usedVouchers}</p>
            </div>
            <Ticket className="h-5 w-5 text-zinc-400" />
          </div>
        </div>

        <div className="border border-[#e5e7eb] rounded-xl bg-white p-5 shadow-none flex flex-col justify-between hover:border-[#111111]/30 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Total Malam</h3>
              <p className="text-2xl font-bold text-[#111111] tracking-tight">{totalNights}</p>
            </div>
            <Ticket className="h-5 w-5 text-zinc-400" />
          </div>
        </div>
      </div>

      {/* Vouchers Table Container */}
      <div className="overflow-hidden border border-[#e5e7eb] rounded-xl bg-white shadow-none">
        <div className="px-6 py-4 border-b border-[#e5e7eb] bg-white">
          <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider">All Vouchers Registry</h3>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
            <span className="ml-2 text-zinc-500 text-sm">Loading vouchers...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-red-500 text-sm font-medium">Error loading vouchers. Please try again.</p>
          </div>
        ) : (
          <DataTable
            data={vouchers || []}
            columns={voucherColumns}
            emptyMessage="No vouchers found"
            noCard={true}
          />
        )}
      </div>
    </PageLayout>
  )
}
