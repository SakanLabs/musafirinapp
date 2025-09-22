import { createFileRoute, redirect, Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DueDateModal } from "@/components/modals/DueDateModal"
import { 
  ArrowLeft,
  FileText,
  Ticket,
  Share,
  Calendar,
  MapPin,
  Users,
  DollarSign,
  Phone,
  Mail,
  Loader2,
  Edit,
  Clock
} from "lucide-react"
import { authService } from "@/lib/auth"
import { 
  formatCurrency, 
  formatDate
} from "@/lib/utils"
import { useBooking, useGenerateInvoice, useGenerateVoucher } from "@/lib/queries"

// Helper functions
const getBookingStatusColor = (status: string) => {
  switch (status) {
    case 'confirmed':
      return 'bg-green-100 text-green-800'
    case 'pending':
      return 'bg-yellow-100 text-yellow-800'
    case 'cancelled':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const getPaymentStatusColor = (status: string) => {
  switch (status) {
    case 'paid':
      return 'bg-green-100 text-green-800'
    case 'partial':
      return 'bg-yellow-100 text-yellow-800'
    case 'unpaid':
      return 'bg-red-100 text-red-800'
    case 'overdue':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export const Route = createFileRoute("/booking-detail")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      id: (search.id as string) || '',
    }
  },
  beforeLoad: async () => {
    // Check if user is authenticated
    const isAuthenticated = await authService.isAuthenticated()
    if (!isAuthenticated) {
      throw redirect({ to: "/login" })
    }
  },
  component: BookingDetailPage
})

function BookingDetailPage() {
  const { id } = Route.useSearch()
  const navigate = useNavigate()
  const [isDueDateModalOpen, setIsDueDateModalOpen] = useState(false)
  
  // Fetch booking data using TanStack Query
  const { data: booking, isLoading, error } = useBooking(id)
  const generateInvoiceMutation = useGenerateInvoice()
  const generateVoucherMutation = useGenerateVoucher()

  const handleGenerateInvoice = () => {
    setIsDueDateModalOpen(true)
  }

  const handleDueDateSubmit = async (dueDate: string) => {
    try {
      await generateInvoiceMutation.mutateAsync({ 
        bookingId: id, 
        dueDate 
      })
      setIsDueDateModalOpen(false)
      
      // Show success message
      alert("Invoice berhasil digenerate! Anda akan diarahkan ke halaman invoices.")
      
      // Redirect to invoices page
      navigate({ to: '/invoices' })
    } catch (error) {
      console.error("Failed to generate invoice:", error)
      alert("Gagal generate invoice. Silakan coba lagi.")
    }
  }

  const handleGenerateVoucher = async () => {
    try {
      await generateVoucherMutation.mutateAsync(id)
      console.log("Voucher generated successfully")
    } catch (error) {
      console.error("Failed to generate voucher:", error)
    }
  }

  const handleShareWhatsApp = () => {
    if (!booking) return
    
    const message = `Booking Details:\nGuest: ${booking.clientName}\nCode: ${booking.code}\nHotel: ${booking.hotelName}\nCheck-in: ${formatDate(booking.checkIn)}\nCheck-out: ${formatDate(booking.checkOut)}\nTotal: ${formatCurrency(booking.totalAmount.toString(), 'SAR')}`
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, '_blank')
  }

  const handleEditBooking = () => {
    navigate({ to: "/booking-edit", search: { id } })
  }

  if (isLoading) {
    return (
      <PageLayout title="Loading..." subtitle="Loading booking details">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </PageLayout>
    )
  }

  if (error || !booking) {
    return (
      <PageLayout title="Error" subtitle="Failed to load booking details">
        <div className="text-center text-red-600 p-8">
          {error?.message || "Booking not found"}
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Booking Details" subtitle={`Booking Code: ${booking.code}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/bookings">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Bookings
              </Button>
            </Link>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleShareWhatsApp}
            >
              <Share className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleEditBooking}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Guest Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Guest Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Name</label>
                    <p className="text-gray-900">{booking.clientName}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Email</label>
                    <div className="flex items-center">
                      <Mail className="h-4 w-4 mr-2 text-gray-400" />
                      <p className="text-gray-900">{booking.clientEmail}</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Phone</label>
                    <div className="flex items-center">
                      <Phone className="h-4 w-4 mr-2 text-gray-400" />
                      <p className="text-gray-900">{booking.clientPhone}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Booking Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="h-5 w-5 mr-2" />
                  Booking Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Check-in</label>
                    <p className="text-gray-900">{formatDate(booking.checkIn)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Check-out</label>
                    <p className="text-gray-900">{formatDate(booking.checkOut)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Hotel Name</label>
                    <p className="text-gray-900">{booking.hotelName}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">City</label>
                    <p className="text-gray-900">{booking.city}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Room Type</label>
                    <p className="text-gray-900">{booking.items?.[0]?.roomType || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Total Amount</label>
                    <div className="flex items-center">
                      <DollarSign className="h-4 w-4 mr-2 text-gray-400" />
                      <p className="text-gray-900 font-semibold">{formatCurrency(booking.totalAmount.toString(), 'SAR')}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Status Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="h-5 w-5 mr-2" />
                  Status Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Booking Status</label>
                  <div className="mt-1">
                    <Badge className={getBookingStatusColor(booking.bookingStatus)}>
                      {booking.bookingStatus}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Payment Status</label>
                  <div className="mt-1">
                    <Badge className={getPaymentStatusColor(booking.paymentStatus)}>
                      {booking.paymentStatus}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status */}
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Booking Status</label>
                  <div className="mt-1">
                    <Badge className={getBookingStatusColor(booking.bookingStatus)}>
                      {booking.bookingStatus}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Payment Status</label>
                  <div className="mt-1">
                    <Badge className={getPaymentStatusColor(booking.paymentStatus)}>
                      {booking.paymentStatus}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full"
                  onClick={handleGenerateInvoice}
                  disabled={generateInvoiceMutation.isPending}
                >
                  {generateInvoiceMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  Generate Invoice
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleGenerateVoucher}
                  disabled={generateVoucherMutation.isPending}
                >
                  {generateVoucherMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Ticket className="h-4 w-4 mr-2" />
                  )}
                  Generate Voucher
                </Button>
              </CardContent>
            </Card>

            {/* Timestamps */}
            <Card>
              <CardHeader>
                <CardTitle>Additional Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <label className="text-sm font-medium text-gray-500">Created</label>
                  <p className="text-sm text-gray-900">{formatDate(booking.createdAt)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Updated</label>
                  <p className="text-sm text-gray-900">{formatDate(booking.updatedAt)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <DueDateModal
        isOpen={isDueDateModalOpen}
        onClose={() => setIsDueDateModalOpen(false)}
        onSubmit={handleDueDateSubmit}
        isLoading={generateInvoiceMutation.isPending}
      />
    </PageLayout>
  )
}