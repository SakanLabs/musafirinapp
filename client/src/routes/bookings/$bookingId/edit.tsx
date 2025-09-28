import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Save, Loader2, X } from "lucide-react"
import { authService } from "@/lib/auth"
import { useBooking, useUpdateBooking, UpdateBookingData } from "@/lib/queries/bookings"
import { useState, useEffect } from "react"

export const Route = createFileRoute("/bookings/$bookingId/edit")({
  beforeLoad: async () => {
    const isAuthenticated = await authService.isAuthenticated()
    if (!isAuthenticated) {
      throw redirect({ to: "/login" })
    }
  },
  component: EditBookingPage
})



function EditBookingPage() {
  const { bookingId } = Route.useParams()
  const navigate = useNavigate()
  const { data: booking, isLoading, error } = useBooking(bookingId)
  const updateBookingMutation = useUpdateBooking()

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
    status: 'pending'
  })

  useEffect(() => {
    if (booking) {
      setFormData({
        guestName: booking.clientName || '',
        guestEmail: booking.clientEmail || '',
        guestPhone: booking.clientPhone || '',
        checkInDate: booking.checkIn || '',
        checkOutDate: booking.checkOut || '',
        roomType: booking.items?.[0]?.roomType || '',
        numberOfGuests: (booking.meta?.numberOfGuests as number) || 1,
        specialRequests: (booking.meta?.specialRequests as string) || '',
        totalAmount: booking.totalAmount || 0,
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
        id: bookingId,
        ...formData
      })
      
      console.log("Booking updated successfully!")
      navigate({ to: `/bookings/${bookingId}` })
    } catch (error) {
      console.error('Error updating booking:', error)
      alert("Failed to update booking. Please try again.")
    }
  }

  const handleCancel = () => {
    navigate({ to: `/bookings/${bookingId}` })
  }

  if (isLoading) {
    return (
      <PageLayout title="Edit Booking" subtitle="Loading booking details...">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </PageLayout>
    )
  }

  if (error || !booking) {
    return (
      <PageLayout title="Edit Booking" subtitle="Error loading booking">
        <div className="text-center py-12">
          <p className="text-red-600">Failed to load booking details</p>
          <Button onClick={() => navigate({ to: "/bookings" })} className="mt-4">
            Back to Bookings
          </Button>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title={`Edit Booking ${booking.id}`}
      subtitle="Update booking details"
      showBackButton={true}
      actions={
        <div className="flex space-x-3">
          <Button variant="outline" onClick={handleCancel}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={updateBookingMutation.isPending}
          >
            {updateBookingMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      }
    >
      <div className="max-w-4xl mx-auto space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Guest Information */}
          <Card>
            <CardHeader>
              <CardTitle>Guest Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="guestName" className="block text-sm font-medium mb-1">Guest Name *</label>
                  <Input
                    id="guestName"
                    value={formData.guestName}
                    onChange={(e) => handleInputChange('guestName', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="guestEmail" className="block text-sm font-medium mb-1">Email *</label>
                  <Input
                    id="guestEmail"
                    type="email"
                    value={formData.guestEmail}
                    onChange={(e) => handleInputChange('guestEmail', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="guestPhone" className="block text-sm font-medium mb-1">Phone *</label>
                  <Input
                    id="guestPhone"
                    value={formData.guestPhone}
                    onChange={(e) => handleInputChange('guestPhone', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="numberOfGuests" className="block text-sm font-medium mb-1">Number of Guests *</label>
                  <Input
                    id="numberOfGuests"
                    type="number"
                    min="1"
                    value={formData.numberOfGuests}
                    onChange={(e) => handleInputChange('numberOfGuests', parseInt(e.target.value))}
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Booking Details */}
          <Card>
            <CardHeader>
              <CardTitle>Booking Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="checkInDate" className="block text-sm font-medium mb-1">Check-in Date *</label>
                  <Input
                    id="checkInDate"
                    type="date"
                    value={formData.checkInDate}
                    onChange={(e) => handleInputChange('checkInDate', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="checkOutDate" className="block text-sm font-medium mb-1">Check-out Date *</label>
                  <Input
                    id="checkOutDate"
                    type="date"
                    value={formData.checkOutDate}
                    onChange={(e) => handleInputChange('checkOutDate', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="roomType" className="block text-sm font-medium mb-1">Room Type *</label>
                  <select 
                    id="roomType"
                    value={formData.roomType} 
                    onChange={(e) => handleInputChange('roomType', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select room type</option>
                    <option value="DBL">Double Room (DBL)</option>
                    <option value="TPL">Triple Room (TPL)</option>
                    <option value="Quad">Quad Room (Quad)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="totalAmount" className="block text-sm font-medium mb-1">Total Amount *</label>
                  <Input
                    id="totalAmount"
                    type="number"
                    step="0.01"
                    value={formData.totalAmount}
                    onChange={(e) => handleInputChange('totalAmount', parseFloat(e.target.value))}
                    required
                  />
                </div>
              </div>
              <div>
                <label htmlFor="specialRequests" className="block text-sm font-medium mb-1">Special Requests</label>
                <textarea
                  id="specialRequests"
                  value={formData.specialRequests}
                  onChange={(e) => handleInputChange('specialRequests', e.target.value)}
                  placeholder="Any special requests or notes..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </CardContent>
          </Card>

          {/* Status Information */}
          <Card>
            <CardHeader>
              <CardTitle>Status Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="status" className="block text-sm font-medium mb-1">Booking Status</label>
                  <select 
                    id="status"
                    value={formData.status} 
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </PageLayout>
  )
}