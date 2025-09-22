import { createFileRoute, redirect, Link } from "@tanstack/react-router"
import { useState } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { DataTable, Column } from "@/components/ui/data-table"
import { Drawer } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { 
  Plus,
  Eye,
  Share,
  Calendar,
  MapPin,
  Users,
  DollarSign,
  Loader2
} from "lucide-react"
import { authService } from "@/lib/auth"
import { 
  formatCurrency, 
  formatDate, 
  getPaymentStatusColor, 
  getBookingStatusColor, 
  shareToWhatsApp, 
  generateBookingWhatsAppMessage 
} from "@/lib/utils"
import { useBookings, useCreateBooking, type Booking, type CreateBookingData } from "@/lib/queries"

export const Route = createFileRoute("/bookings")({ 
  beforeLoad: async () => {
    // Check if user is authenticated
    const isAuthenticated = await authService.isAuthenticated()
    if (!isAuthenticated) {
      throw redirect({ to: "/login" })
    }
  },
  component: BookingsPage
})

function BookingsPage() {
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false)
  const [formData, setFormData] = useState({
    guestName: "",
    guestEmail: "",
    guestPhone: "",
    hotelName: "",
    city: "",
    checkInDate: "",
    checkOutDate: "",
    roomType: "",
    numberOfGuests: 1,
    totalAmount: 0,
    specialRequests: ""
  })

  // Fetch bookings using TanStack Query
  const { data: bookings = [], isLoading, error } = useBookings()
  const createBookingMutation = useCreateBooking()

  // Define columns for bookings table
  const bookingColumns: Column<Booking>[] = [
    {
      key: 'id',
      header: 'ID',
      sortable: true,
      width: 'w-24'
    },
    {
      key: 'clientName',
      header: 'Guest',
      sortable: true
    },
    {
      key: 'hotelName',
      header: 'Hotel',
      sortable: true
    },
    {
      key: 'roomType',
      header: 'Room Type',
      render: (booking) => booking.items?.[0]?.roomType || 'N/A',
      sortable: true
    },
    {
      key: 'checkIn',
      header: 'Check-in',
      render: (booking) => formatDate(booking.checkIn),
      sortable: true,
      width: 'w-28'
    },
    {
      key: 'checkOut',
      header: 'Check-out',
      render: (booking) => formatDate(booking.checkOut),
      sortable: true,
      width: 'w-28'
    },
    {
      key: 'totalAmount',
      header: 'Total',
      render: (booking) => formatCurrency(booking.totalAmount.toString(), 'SAR'),
      sortable: true,
      width: 'w-32'
    },
    {
      key: 'bookingStatus',
      header: 'Status',
      render: (booking) => (
        <Badge className={getBookingStatusColor(booking.bookingStatus)}>
          {booking.bookingStatus}
        </Badge>
      ),
      sortable: true,
      width: 'w-24'
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (booking) => (
        <div className="flex space-x-2">
          <Button 
            size="sm" 
            variant="ghost"
            onClick={() => window.location.href = `/booking-detail?id=${booking.id}`}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button 
            size="sm" 
            variant="ghost"
            onClick={() => handleShareWhatsApp(booking)}
          >
            <Share className="h-4 w-4" />
          </Button>
        </div>
      ),
      width: 'w-24'
    }
  ]

  const handleShareWhatsApp = (booking: Booking) => {
    const message = generateBookingWhatsAppMessage({
      code: booking.code,
      clientName: booking.clientName,
      hotelName: booking.hotelName,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      totalAmount: booking.totalAmount.toString(),
      currency: "SAR"
    })
    shareToWhatsApp({ phoneNumber: booking.clientPhone, message })
  }

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleCreateBooking = async () => {
    try {
      const bookingData: CreateBookingData = {
        guestName: formData.guestName,
        guestEmail: formData.guestEmail,
        guestPhone: formData.guestPhone,
        hotelName: formData.hotelName,
        city: formData.city,
        checkInDate: formData.checkInDate,
        checkOutDate: formData.checkOutDate,
        roomType: formData.roomType,
        numberOfGuests: formData.numberOfGuests,
        totalAmount: formData.totalAmount,
        specialRequests: formData.specialRequests || undefined
      }

      await createBookingMutation.mutateAsync(bookingData)
      
      // Reset form and close drawer
      setFormData({
        guestName: "",
        guestEmail: "",
        guestPhone: "",
        hotelName: "",
        city: "",
        checkInDate: "",
        checkOutDate: "",
        roomType: "",
        numberOfGuests: 1,
        totalAmount: 0,
        specialRequests: ""
      })
      setIsCreateDrawerOpen(false)
    } catch (error) {
      console.error("Failed to create booking:", error)
    }
  }

  if (isLoading) {
    return (
      <PageLayout title="Bookings" subtitle="Manage hotel bookings and reservations">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </PageLayout>
    )
  }

  if (error) {
    return (
      <PageLayout title="Bookings" subtitle="Manage hotel bookings and reservations">
        <div className="text-center text-red-600 p-8">
          Error loading bookings: {error.message}
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
        title="Bookings"
        subtitle="Manage hotel bookings and reservations"
        actions={
          <Link to="/create-booking">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Booking
            </Button>
          </Link>
        }
      >
      {/* Bookings Table */}
      <DataTable
        data={bookings}
        columns={bookingColumns}
        emptyMessage="No bookings found"
      />

      {/* Create Booking Drawer */}
      <Drawer
        isOpen={isCreateDrawerOpen}
        onClose={() => setIsCreateDrawerOpen(false)}
        title="Create New Booking"
        size="lg"
      >
        <div className="space-y-6">
          {/* Client Information */}
          <Card className="p-4">
            <div className="flex items-center space-x-2 mb-4">
              <Users className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold">Client Information</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Guest Name *
                </label>
                <Input
                  value={formData.guestName}
                  onChange={(e) => handleInputChange('guestName', e.target.value)}
                  placeholder="Enter guest name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <Input
                  type="email"
                  value={formData.guestEmail}
                  onChange={(e) => handleInputChange('guestEmail', e.target.value)}
                  placeholder="Enter email address"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number *
                </label>
                <Input
                  value={formData.guestPhone}
                  onChange={(e) => handleInputChange('guestPhone', e.target.value)}
                  placeholder="Enter phone number"
                />
              </div>
            </div>
          </Card>

          {/* Booking Details */}
          <Card className="p-4">
            <div className="flex items-center space-x-2 mb-4">
              <Calendar className="h-5 w-5 text-purple-600" />
              <h3 className="text-lg font-semibold">Booking Details</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Check-in Date *
                </label>
                <Input
                  type="date"
                  value={formData.checkInDate}
                  onChange={(e) => handleInputChange('checkInDate', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Check-out Date *
                </label>
                <Input
                  type="date"
                  value={formData.checkOutDate}
                  onChange={(e) => handleInputChange('checkOutDate', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Room Type *
                </label>
                <select
                  value={formData.roomType}
                  onChange={(e) => handleInputChange('roomType', e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                >
                  <option value="">Select room type</option>
                  <option value="DBL">Double Room (DBL)</option>
                  <option value="TPL">Triple Room (TPL)</option>
                  <option value="Quad">Quad Room (Quad)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Guests *
                </label>
                <Input
                  type="number"
                  min="1"
                  value={formData.numberOfGuests}
                  onChange={(e) => handleInputChange('numberOfGuests', parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Special Requests
                </label>
                <Input
                  value={formData.specialRequests}
                  onChange={(e) => handleInputChange('specialRequests', e.target.value)}
                  placeholder="Any special requests or notes"
                />
              </div>
            </div>
          </Card>

          {/* Pricing */}
          <Card className="p-4">
            <div className="flex items-center space-x-2 mb-4">
              <DollarSign className="h-5 w-5 text-orange-600" />
              <h3 className="text-lg font-semibold">Pricing</h3>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Amount *
                </label>
                <Input
                  type="number"
                  value={formData.totalAmount}
                  onChange={(e) => handleInputChange('totalAmount', parseFloat(e.target.value) || 0)}
                  placeholder="Enter total amount"
                />
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Amount:</span>
                  <span className="text-lg font-semibold text-gray-900">
                    {formatCurrency(formData.totalAmount.toString(), 'SAR')}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <Button 
            variant="outline" 
            onClick={() => setIsCreateDrawerOpen(false)}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleCreateBooking}
            disabled={!formData.guestName || !formData.guestEmail || !formData.checkInDate || !formData.checkOutDate || !formData.roomType || !formData.totalAmount || createBookingMutation.isPending}
          >
            {createBookingMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Booking"
            )}
          </Button>
        </div>
      </Drawer>
    </PageLayout>
  )
}