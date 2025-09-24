import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  ArrowLeft,
  FileText,
  Ticket,
  Share,
  Calendar,
  MapPin,
  Users,
  Phone,
  Mail,
  Loader2,
  Edit,
  Clock
} from "lucide-react"
import { authService } from "@/lib/auth"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useBooking, useGenerateInvoice, useGenerateVoucher } from "@/lib/queries"

export const Route = createFileRoute("/bookings/$bookingId")({
  beforeLoad: async () => {
    // Check if user is authenticated
    const isAuthenticated = await authService.isAuthenticated()
    if (!isAuthenticated) {
      throw redirect({ to: "/login" })
    }
  },
  component: BookingDetailPage,
})

// Helper functions
function getBookingStatusColor(status: string) {
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

function getPaymentStatusColor(status: string) {
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

function BookingDetailPage() {
  const { bookingId } = Route.useParams()
  const navigate = useNavigate()
  
  // Fetch booking data using TanStack Query
  const { data: booking, isLoading, error } = useBooking(bookingId)
  const generateInvoiceMutation = useGenerateInvoice()
  const generateVoucherMutation = useGenerateVoucher()

  const handleGenerateInvoice = async () => {
    if (!booking) return
    
    // Set due date to 30 days from now
    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    try {
      await generateInvoiceMutation.mutateAsync({
        bookingId: bookingId,
        dueDate: dueDate
      })
      console.log("Invoice generated successfully")
      alert("Invoice generated and downloaded successfully")
    } catch (error) {
      console.error("Failed to generate invoice:", error)
      alert("Failed to generate invoice")
    }
  }

  const handleGenerateVoucher = async () => {
    if (!booking) return
    
    try {
      await generateVoucherMutation.mutateAsync({
        bookingId: bookingId,
        guestName: booking.clientName
      })
      console.log("Voucher generated successfully")
      alert("Voucher generated and downloaded successfully")
    } catch (error) {
      console.error("Failed to generate voucher:", error)
      alert("Failed to generate voucher")
    }
  }

  const handleShareWhatsApp = () => {
    if (!booking) return
    
    const message = `Booking Details:
Code: ${booking.code}
Guest: ${booking.clientName}
Hotel: ${booking.hotelName}
Check-in: ${formatDate(booking.checkIn)}
Check-out: ${formatDate(booking.checkOut)}
Room: ${booking.items?.[0]?.roomType || 'N/A'}
Total: ${formatCurrency(booking.totalAmount, 'SAR')}`
    
    const whatsappUrl = `https://wa.me/${booking.clientPhone}?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, '_blank')
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
    <PageLayout
      title={`Booking ${booking.code}`}
      subtitle="Booking details and management"
      showBackButton={true}
      actions={
        <div className="flex space-x-3">
          <Button 
            variant="outline" 
            onClick={() => navigate({ to: `/booking-edit?id=${booking.id}` })}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="outline" onClick={handleShareWhatsApp}>
            <Share className="h-4 w-4 mr-2" />
            Share WA
          </Button>
          <Button 
            variant="outline" 
            onClick={handleGenerateInvoice}
            disabled={generateInvoiceMutation.isPending}
          >
            {generateInvoiceMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Generate Invoice
              </>
            )}
          </Button>
          <Button 
            onClick={handleGenerateVoucher}
            disabled={generateVoucherMutation.isPending}
          >
            {generateVoucherMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Ticket className="h-4 w-4 mr-2" />
                Generate Voucher
              </>
            )}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-blue-600" />
                <span>Status Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-500 text-sm">Booking Status</span>
                  <div className="mt-1">
                    <Badge className={getBookingStatusColor(booking.bookingStatus)}>
                      {booking.bookingStatus}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Payment Status</span>
                  <div className="mt-1">
                    <Badge className={getPaymentStatusColor(booking.paymentStatus)}>
                      {booking.paymentStatus}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Guest Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-blue-600" />
                <span>Guest Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-500 text-sm">Name</span>
                  <p className="font-semibold">{booking.clientName}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Email</span>
                  <p className="font-semibold">{booking.clientEmail}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Phone</span>
                  <p className="font-semibold">{booking.clientPhone}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">City</span>
                  <p className="font-semibold">{booking.city}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Booking Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                <span>Booking Details</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-500 text-sm">Check-in Date</span>
                  <p className="font-semibold">{formatDate(booking.checkIn)}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Check-out Date</span>
                  <p className="font-semibold">{formatDate(booking.checkOut)}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Hotel</span>
                  <p className="font-semibold">{booking.hotelName}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Room Type</span>
                  <p className="font-semibold">{booking.items?.[0]?.roomType || 'N/A'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Info */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-gray-500 text-sm">Booking ID</span>
                <p className="font-semibold">{booking.id}</p>
              </div>
              <div>
                <span className="text-gray-500 text-sm">Booking Code</span>
                <p className="font-semibold">{booking.code}</p>
              </div>
              <div>
                <span className="text-gray-500 text-sm">Created</span>
                <p className="font-semibold">{formatDate(booking.createdAt)}</p>
              </div>
              <div>
                <span className="text-gray-500 text-sm">Total Amount</span>
                <p className="font-semibold text-lg">{formatCurrency(booking.totalAmount)}</p>
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
                variant="outline"
                onClick={() => navigate({ to: `/booking-edit?id=${booking.id}` })}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Booking
              </Button>
              <Button className="w-full" variant="outline" onClick={handleShareWhatsApp}>
                <Share className="h-4 w-4 mr-2" />
                Share via WhatsApp
              </Button>
              <Button 
                className="w-full" 
                variant="outline" 
                onClick={handleGenerateInvoice}
                disabled={generateInvoiceMutation.isPending}
              >
                <FileText className="h-4 w-4 mr-2" />
                Generate Invoice
              </Button>
              <Button 
                className="w-full"
                onClick={handleGenerateVoucher}
                disabled={generateVoucherMutation.isPending}
              >
                <Ticket className="h-4 w-4 mr-2" />
                Generate Voucher
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageLayout>
  )
}