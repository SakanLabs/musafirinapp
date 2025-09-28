import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { 
  ArrowLeft,
  Save,
  Loader2
} from "lucide-react"
import { authService } from "@/lib/auth"
import { useBooking, useUpdateBooking, UpdateBookingData } from "@/lib/queries/bookings"
import { useState, useEffect } from "react"

export const Route = createFileRoute("/booking-edit")({
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
  component: EditBookingPage
})

function EditBookingPage() {
  const { id } = Route.useSearch()
  const navigate = useNavigate()
  
  // Fetch booking data using TanStack Query
  const { data: booking, isLoading, error } = useBooking(id)
  const updateBookingMutation = useUpdateBooking()

  // Form state
  const [formData, setFormData] = useState<Omit<UpdateBookingData, 'id'>>({
    guestName: '',
    guestEmail: '',
    guestPhone: '',
    checkInDate: '',
    checkOutDate: '',
    roomType: '',
    numberOfGuests: 1,
    specialRequests: '',
    totalAmount: 0,
    hotelCostPerNight: 0,
    totalHotelCost: 0,
    status: 'pending'
  })

  // Initialize form data when booking data is loaded
  useEffect(() => {
    if (booking) {
      // Calculate hotel cost per night and total from booking items
      const hotelCostPrice = booking.items?.[0]?.hotelCostPrice ? parseFloat(booking.items[0].hotelCostPrice) : 0;
      const checkInDate = booking.checkIn ? new Date(booking.checkIn) : null;
      const checkOutDate = booking.checkOut ? new Date(booking.checkOut) : null;
      const nights = checkInDate && checkOutDate ? Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)) : 1;
      const totalHotelCost = hotelCostPrice * nights;

      setFormData({
        guestName: booking.clientName || '',
        guestEmail: booking.clientEmail || '',
        guestPhone: booking.clientPhone || '',
        checkInDate: booking.checkIn ? booking.checkIn.split('T')[0] : '',
        checkOutDate: booking.checkOut ? booking.checkOut.split('T')[0] : '',
        roomType: booking.items?.[0]?.roomType || '',
        numberOfGuests: (booking.meta?.numberOfGuests as number) || 1,
        specialRequests: (booking.meta?.specialRequests as string) || '', // Get from meta field
        totalAmount: booking.totalAmount || 0,
        hotelCostPerNight: hotelCostPrice,
        totalHotelCost: totalHotelCost,
        status: booking.bookingStatus || 'pending'
      })
    }
  }, [booking])

  const handleInputChange = (field: keyof Omit<UpdateBookingData, 'id'>, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      await updateBookingMutation.mutateAsync({
        id,
        ...formData
      })
      
      console.log("Booking updated successfully!")
      // Navigate back to booking detail page
      navigate({ to: "/booking-detail", search: { id } })
    } catch (error) {
      console.error("Failed to update booking:", error)
      alert("Failed to update booking. Please try again.")
    }
  }

  const handleCancel = () => {
    navigate({ to: "/booking-detail", search: { id } })
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
    <PageLayout title="Edit Booking" subtitle={`Booking ID: ${booking.id}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" onClick={handleCancel}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Guest Information */}
            <Card>
              <CardHeader>
                <CardTitle>Guest Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Guest Name</label>
                  <Input
                    type="text"
                    value={formData.guestName}
                    onChange={(e) => handleInputChange('guestName', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <Input
                    type="email"
                    value={formData.guestEmail}
                    onChange={(e) => handleInputChange('guestEmail', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <Input
                    type="tel"
                    value={formData.guestPhone}
                    onChange={(e) => handleInputChange('guestPhone', e.target.value)}
                    required
                  />
                </div>
              </CardContent>
            </Card>

            {/* Booking Details */}
            <Card>
              <CardHeader>
                <CardTitle>Booking Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Check-in Date</label>
                  <Input
                    type="date"
                    value={formData.checkInDate}
                    onChange={(e) => handleInputChange('checkInDate', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Check-out Date</label>
                  <Input
                    type="date"
                    value={formData.checkOutDate}
                    onChange={(e) => handleInputChange('checkOutDate', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Room Type</label>
                  <Input
                    value={formData.roomType}
                    onChange={(e) => handleInputChange('roomType', e.target.value)}
                    placeholder="Enter room type (e.g., Deluxe Double, Executive Suite, Standard Twin)"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Number of Guests</label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.numberOfGuests}
                    onChange={(e) => handleInputChange('numberOfGuests', parseInt(e.target.value) || 1)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Special Requests</label>
                  <Input
                    type="text"
                    value={formData.specialRequests}
                    onChange={(e) => handleInputChange('specialRequests', e.target.value)}
                    placeholder="Any special requests..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount (SAR)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.totalAmount}
                    onChange={(e) => handleInputChange('totalAmount', parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hotel Cost per Night (SAR)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.hotelCostPerNight}
                    onChange={(e) => handleInputChange('hotelCostPerNight', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">Cost price from hotel supplier</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Hotel Cost (SAR)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.totalHotelCost}
                    onChange={(e) => handleInputChange('totalHotelCost', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">Total cost for all nights</p>
                </div>
              </CardContent>
            </Card>

            {/* Status Information */}
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Booking Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateBookingMutation.isPending}
            >
              {updateBookingMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </PageLayout>
  )
}