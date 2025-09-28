import { createFileRoute, redirect, Link } from "@tanstack/react-router"
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
import { authService } from "@/lib/auth"
import { formatDate, shareToWhatsApp, generateVoucherWhatsAppMessage } from "@/lib/utils"
import { useVouchers, type Voucher } from "@/lib/queries/vouchers"

export const Route = createFileRoute("/vouchers")({ 
  beforeLoad: async () => {
    // Check if user is authenticated
    const isAuthenticated = await authService.isAuthenticated()
    if (!isAuthenticated) {
      throw redirect({ to: "/login" })
    }
  },
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
        <div className="flex space-x-2">
          <Button 
            size="sm" 
            variant="ghost"
            onClick={() => handleViewVoucher(voucher)}
            title="View Voucher"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button 
            size="sm" 
            variant="ghost"
            onClick={() => handleDownloadPDF(voucher)}
            title="Download PDF"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button 
            size="sm" 
            variant="ghost"
            onClick={() => handleShareWhatsApp(voucher)}
            title="Share via WhatsApp"
          >
            <Share className="h-4 w-4" />
          </Button>
        </div>
      ),
      width: 'w-32'
    }
  ]

  const handleViewVoucher = (voucher: Voucher) => {
    // Here you would typically navigate to voucher detail page or open in modal
    console.log("Viewing voucher:", voucher.number)
    window.open(voucher.pdfUrl, '_blank')
  }

  const handleDownloadPDF = (voucher: Voucher) => {
    // Here you would typically trigger PDF download
    console.log("Downloading PDF for voucher:", voucher.number)
    
    // Create a temporary link to trigger download
    const link = document.createElement('a')
    link.href = voucher.pdfUrl
    link.download = `${voucher.number}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
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
    shareToWhatsApp({ phoneNumber: voucher.clientEmail, message }) // Using email since phone not available
  }



  // Calculate summary stats
  const totalVouchers = vouchers?.length || 0
  // Calculate active/used based on checkout dates since vouchers don't have status field
  const currentDate = new Date()
  const activeVouchers = vouchers?.filter(v => v.checkOut && new Date(v.checkOut) >= currentDate).length || 0
  const usedVouchers = vouchers?.filter(v => v.checkOut && new Date(v.checkOut) < currentDate).length || 0
  // Calculate total nights using checkIn/checkOut dates
  const totalNights = vouchers?.reduce((sum, v) => {
    if (v.checkIn && v.checkOut) {
      return sum + calculateNights(v.checkIn, v.checkOut)
    }
    return sum
  }, 0) || 0

  return (
    <PageLayout
      title="Vouchers"
      subtitle="Manage hotel vouchers and guest confirmations"
      actions={
        <div className="flex space-x-3">
          <Button variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Link to="/vouchers/create">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Voucher
            </Button>
          </Link>
        </div>
      }
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Vouchers</p>
              <p className="text-3xl font-bold text-gray-900">{totalVouchers}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <Ticket className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active</p>
              <p className="text-3xl font-bold text-green-600">{activeVouchers}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <Ticket className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Used</p>
              <p className="text-3xl font-bold text-blue-600">{usedVouchers}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <Ticket className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Nights</p>
              <p className="text-3xl font-bold text-purple-600">{totalNights}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <Ticket className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Vouchers Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">All Vouchers</h3>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-600">Loading vouchers...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-red-600">Error loading vouchers. Please try again.</p>
          </div>
        ) : (
          <DataTable
            data={vouchers || []}
            columns={voucherColumns}
            emptyMessage="No vouchers found"
          />
        )}
      </div>
    </PageLayout>
  )
}