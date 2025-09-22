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
  DollarSign,
  Phone,
  Mail,
  Loader2,
  Edit,
  Clock
} from "lucide-react"
import { authService } from "@/lib/auth"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useBooking, useGenerateInvoice, useGenerateVoucher } from "@/lib/queries"

export const Route = createFileRoute("/booking-view/$bookingId")({
  beforeLoad: async () => {
    // Check if user is authenticated
    const isAuthenticated = await authService.isAuthenticated()
    if (!isAuthenticated) {
      throw redirect({ to: "/login" })
    }
  },
  component: BookingViewPage,
})

function BookingViewPage() {
  const { bookingId } = Route.useParams()
  const navigate = useNavigate()
  
  // Fetch booking data using TanStack Query
  const { data: booking, isLoading, error } = useBooking(bookingId)
  const generateInvoiceMutation = useGenerateInvoice()
  const generateVoucherMutation = useGenerateVoucher()

  const handleGenerateInvoice = async () => {
    if (!booking) return
    
    try {
      await generateInvoiceMutation.mutateAsync(booking.id)
      // Handle success (e.g., show toast, download file)
    } catch (error) {
      console.error('Failed to generate invoice:', error)
      // Handle error
    }
  }

  const handleGenerateVoucher = async () => {
    if (!booking) return
    
    try {
      await generateVoucherMutation.mutateAsync(booking.id)
      // Handle success (e.g., show toast, download file)
    } catch (error) {
      console.error('Failed to generate voucher:', error)
      // Handle error
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
Total: ${formatCurrency(booking.totalAmount.toString(), 'SAR')}`
    
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, '_blank')
  }

  const handleEditBooking = () => {
    if (booking?.id) {
      navigate({ to: "/booking-edit", search: { id: booking.id } })
    }
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
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate({ to: "/bookings" })}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Bookings
            </Button>
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

        {/* Booking Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Booking Status</span>
              <div className="flex space-x-2">
                <Badge 
                  variant={booking.bookingStatus === 'confirmed' ? 'default' : 
                          booking.bookingStatus === 'pending' ? 'secondary' : 'destructive'}
                >
                  {booking.bookingStatus}
                </Badge>
                <Badge 
                  variant={booking.paymentStatus === 'paid' ? 'default' : 
                          booking.paymentStatus === 'partial' ? 'secondary' : 'destructive'}
                >
                  {booking.paymentStatus}
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
        </Card>

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
                <p className="text-lg">{booking.clientName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Email</label>
                <div className="flex items-center">
                  <Mail className="h-4 w-4 mr-2 text-gray-400" />
                  <p>{booking.clientEmail}</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Phone</label>
                <div className="flex items-center">
                  <Phone className="h-4 w-4 mr-2 text-gray-400" />
                  <p>{booking.clientPhone}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hotel Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <MapPin className="h-5 w-5 mr-2" />
              Hotel Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Hotel Name</label>
                <p className="text-lg">{booking.hotelName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">City</label>
                <p className="text-lg">{booking.city}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Booking Items */}
        {booking.items && booking.items.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="h-5 w-5 mr-2" />
                Booking Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {booking.items.map((item, index) => (
                  <div key={item.id || index} className="border rounded-lg p-4 bg-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Room Type</label>
                        <p className="text-lg font-semibold">{item.roomType}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Room Count</label>
                        <p className="text-lg">{item.roomCount}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Unit Price</label>
                        <div className="flex items-center">
                          <DollarSign className="h-4 w-4 mr-2 text-gray-400" />
                          <p className="text-lg font-semibold">{formatCurrency(item.unitPrice, 'SAR')}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

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
                <label className="text-sm font-medium text-gray-500">Check-in Date</label>
                <p className="text-lg">{formatDate(booking.checkIn)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Check-out Date</label>
                <p className="text-lg">{formatDate(booking.checkOut)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Total Amount</label>
                <div className="flex items-center">
                  <DollarSign className="h-4 w-4 mr-2 text-gray-400" />
                  <p className="text-lg font-semibold">{formatCurrency(booking.totalAmount.toString(), 'SAR')}</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Created</label>
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-2 text-gray-400" />
                  <p>{formatDate(booking.createdAt)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <Button
                onClick={handleGenerateInvoice}
                disabled={generateInvoiceMutation.isPending}
                className="flex items-center"
              >
                {generateInvoiceMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Generate Invoice
              </Button>
              <Button
                onClick={handleGenerateVoucher}
                disabled={generateVoucherMutation.isPending}
                variant="outline"
                className="flex items-center"
              >
                {generateVoucherMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Ticket className="h-4 w-4 mr-2" />
                )}
                Generate Voucher
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  )
}