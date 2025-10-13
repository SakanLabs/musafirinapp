import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { SARAmount, SaudiRiyalIcon } from "@/components/ui/sar-currency"
import { 
  ArrowLeft,
  Save,
  Loader2,
  Users,
  Calendar,
  Plus,
  Trash2,
  CalendarDays
} from "lucide-react"
import { authService } from "@/lib/auth"
import { useBooking, useUpdateBooking, UpdateBookingData, type CreateBookingRoomItem, type PricingPeriod } from "@/lib/queries/bookings"
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
  const [formData, setFormData] = useState({
    guestName: '',
    guestEmail: '',
    guestPhone: '',
    hotelName: '',
    city: '',
    checkInDate: '',
    checkOutDate: '',
    mealPlan: 'Room Only' as 'Breakfast' | 'Half Board' | 'Full Board' | 'Room Only',
    numberOfGuests: 1,
    specialRequests: '',
    totalAmount: 0,
    status: 'pending' as 'pending' | 'confirmed' | 'cancelled'
  })

  const [rooms, setRooms] = useState<CreateBookingRoomItem[]>([
    {
      roomType: "",
      roomCount: 1,
      unitPrice: 0,
      hotelCostPrice: 0
    }
  ])

  const [hasPricingPeriods, setHasPricingPeriods] = useState(false)
  const [pricingPeriods, setPricingPeriods] = useState<PricingPeriod[]>([
    {
      startDate: "",
      endDate: "",
      nights: 0,
      unitPrice: 0,
      hotelCostPrice: 0,
      subtotal: 0
    }
  ])

  // Initialize form data when booking data is loaded
  useEffect(() => {
    if (booking) {
      setFormData({
        guestName: booking.clientName || '',
        guestEmail: booking.clientEmail || '',
        guestPhone: booking.clientPhone || '',
        hotelName: booking.hotelName || '',
        city: booking.city || '',
        checkInDate: booking.checkIn ? booking.checkIn.split('T')[0] : '',
        checkOutDate: booking.checkOut ? booking.checkOut.split('T')[0] : '',
        mealPlan: booking.mealPlan,
        numberOfGuests: (booking.meta?.numberOfGuests as number) || 1,
        specialRequests: (booking.meta?.specialRequests as string) || '',
        totalAmount: booking.totalAmount || 0,
        status: booking.bookingStatus || 'pending'
      })

      // Initialize rooms from booking items
      if (booking.items && booking.items.length > 0) {
        const bookingRooms: CreateBookingRoomItem[] = booking.items.map(item => ({
          roomType: item.roomType,
          roomCount: item.roomCount,
          unitPrice: parseFloat(item.unitPrice),
          hotelCostPrice: parseFloat(item.hotelCostPrice || '0'),
          hasPricingPeriods: item.hasPricingPeriods || false,
          pricingPeriods: item.pricingPeriods ? item.pricingPeriods.map(period => ({
            ...period,
            startDate: period.startDate ? period.startDate.split('T')[0] : '',
            endDate: period.endDate ? period.endDate.split('T')[0] : '',
            unitPrice: period.unitPrice,
            hotelCostPrice: period.hotelCostPrice,
            subtotal: period.subtotal
          })) : []
        }))
        setRooms(bookingRooms)

        // Check if any room has pricing periods
        const hasAnyPricingPeriods = bookingRooms.some(room => room.hasPricingPeriods && room.pricingPeriods && room.pricingPeriods.length > 0)
        setHasPricingPeriods(hasAnyPricingPeriods)

        // If there are pricing periods, use the first room's pricing periods as the global periods
        if (hasAnyPricingPeriods && bookingRooms[0].pricingPeriods) {
          setPricingPeriods(bookingRooms[0].pricingPeriods)
        }
        
        // Calculate total amount based on current rooms
        setTimeout(() => updateTotalAmount(bookingRooms), 0)
      }
    }
  }, [booking])

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // Helper functions for managing rooms
  const addRoom = () => {
    setRooms(prev => [...prev, {
      roomType: "",
      roomCount: 1,
      unitPrice: 0,
      hotelCostPrice: 0,
      hasPricingPeriods: hasPricingPeriods,
      pricingPeriods: hasPricingPeriods ? [...pricingPeriods] : undefined
    }])
  }

  const removeRoom = (index: number) => {
    if (rooms.length > 1) {
      setRooms(prev => prev.filter((_, i) => i !== index))
      updateTotalAmount(rooms.filter((_, i) => i !== index))
    }
  }

  const updateRoom = (index: number, field: keyof CreateBookingRoomItem, value: any) => {
    const updatedRooms = rooms.map((room, i) => 
      i === index ? { ...room, [field]: value } : room
    )
    setRooms(updatedRooms)
    updateTotalAmount(updatedRooms)
  }

  // Helper functions for managing pricing periods
  const addPricingPeriod = () => {
    const newPeriod = {
      startDate: "",
      endDate: "",
      nights: 0,
      unitPrice: 0,
      hotelCostPrice: 0,
      subtotal: 0
    }
    setPricingPeriods(prev => [...prev, newPeriod])
    
    // Update all rooms with the new pricing period
    const updatedRooms = rooms.map(room => ({
      ...room,
      hasPricingPeriods: true,
      pricingPeriods: [...(room.pricingPeriods || []), newPeriod]
    }))
    setRooms(updatedRooms)
  }

  const removePricingPeriod = (index: number) => {
    if (pricingPeriods.length > 1) {
      const updatedPeriods = pricingPeriods.filter((_, i) => i !== index)
      setPricingPeriods(updatedPeriods)
      
      // Update all rooms
      const updatedRooms = rooms.map(room => ({
        ...room,
        pricingPeriods: updatedPeriods
      }))
      setRooms(updatedRooms)
      updateTotalAmount(updatedRooms)
    }
  }

  const updatePricingPeriod = (index: number, field: keyof PricingPeriod, value: any) => {
    const updatedPeriods = pricingPeriods.map((period, i) => {
      if (i === index) {
        const updatedPeriod = { ...period, [field]: value }
        
        // Auto-calculate nights and subtotal when dates or price change
        if (field === 'startDate' || field === 'endDate') {
          if (updatedPeriod.startDate && updatedPeriod.endDate) {
            const start = new Date(updatedPeriod.startDate)
            const end = new Date(updatedPeriod.endDate)
            updatedPeriod.nights = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
            updatedPeriod.subtotal = updatedPeriod.unitPrice * updatedPeriod.nights
          }
        } else if (field === 'unitPrice' || field === 'nights') {
          updatedPeriod.subtotal = updatedPeriod.unitPrice * updatedPeriod.nights
        }
        
        return updatedPeriod
      }
      return period
    })
    
    setPricingPeriods(updatedPeriods)
    
    // Update all rooms with the new pricing periods
    const updatedRooms = rooms.map(room => ({
      ...room,
      pricingPeriods: updatedPeriods
    }))
    setRooms(updatedRooms)
    updateTotalAmount(updatedRooms)
  }

  // Calculate total amount
  const updateTotalAmount = (updatedRooms: CreateBookingRoomItem[]) => {
    const totalAmount = updatedRooms.reduce((total, room) => {
      // Prioritize room-level pricing periods over global flag
      if (room.pricingPeriods && room.pricingPeriods.length > 0) {
        // Use pricing periods calculation
        const roomTotal = room.pricingPeriods.reduce((sum, period) => {
          return sum + parseFloat(period.subtotal.toString());
        }, 0);
        return total + (roomTotal * room.roomCount);
      } else {
        // Use regular calculation
        const nights = calculateNights();
        return total + (room.unitPrice * room.roomCount * nights);
      }
    }, 0);
    
    setFormData(prev => ({ ...prev, totalAmount }))
  }

  // Toggle pricing periods
  const togglePricingPeriods = (enabled: boolean) => {
    setHasPricingPeriods(enabled)
    
    if (enabled) {
      // Enable pricing periods for all rooms
      const updatedRooms = rooms.map(room => ({
        ...room,
        hasPricingPeriods: true,
        pricingPeriods: [...pricingPeriods]
      }))
      setRooms(updatedRooms)
      updateTotalAmount(updatedRooms)
    } else {
      // Disable pricing periods for all rooms
      const updatedRooms = rooms.map(room => ({
        ...room,
        hasPricingPeriods: false,
        pricingPeriods: undefined
      }))
      setRooms(updatedRooms)
      updateTotalAmount(updatedRooms)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!booking) return
    
    try {
      // Use the new format that supports multiple rooms and pricing periods
      const bookingData: UpdateBookingData = {
        id: booking.id.toString(),
        guestName: formData.guestName,
        guestEmail: formData.guestEmail,
        guestPhone: formData.guestPhone,
        checkInDate: formData.checkInDate,
        checkOutDate: formData.checkOutDate,
        mealPlan: formData.mealPlan,
        numberOfGuests: formData.numberOfGuests,
        totalAmount: formData.totalAmount,
        status: formData.status,
        specialRequests: formData.specialRequests,
        rooms: rooms.map(room => ({
          ...room,
          pricingPeriods: room.pricingPeriods || []
        }))
      }
      
      await updateBookingMutation.mutateAsync(bookingData)
      
      navigate({ to: `/booking-view/${booking.id}` })
    } catch (error) {
      console.error('Error updating booking:', error)
    }
  }

  // Helper function to calculate nights
  const calculateNights = () => {
    if (formData.checkInDate && formData.checkOutDate) {
      const checkIn = new Date(formData.checkInDate)
      const checkOut = new Date(formData.checkOutDate)
      return Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
    }
    return 1
  }

  const handleCancel = () => {
    navigate({ to: "/booking-detail", search: { id } })
  }

  if (isLoading || updateBookingMutation.isPending) {
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hotel Name</label>
                    <Input
                      value={formData.hotelName}
                      onChange={(e) => handleInputChange('hotelName', e.target.value)}
                      placeholder="Enter hotel name"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <Input
                      value={formData.city}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      placeholder="Enter city"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Meal Plan</label>
                    <select
                      value={formData.mealPlan}
                      onChange={(e) => handleInputChange('mealPlan', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="Breakfast">Breakfast</option>
                      <option value="Half Board">Half Board</option>
                      <option value="Full Board">Full Board</option>
                      <option value="Room Only">Room Only</option>
                    </select>
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
              </CardContent>
            </Card>

            {/* Pricing Periods Toggle */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  Pricing Configuration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="hasPricingPeriods"
                    checked={hasPricingPeriods}
                    onChange={(e) => togglePricingPeriods(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                  <label htmlFor="hasPricingPeriods" className="text-sm font-medium text-gray-700">
                    Use multiple pricing periods
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Enable this to set different prices for different date ranges
                </p>
              </CardContent>
            </Card>

            {/* Pricing Periods */}
            {hasPricingPeriods && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Pricing Periods
                    </CardTitle>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addPricingPeriod}
                      className="flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add Period
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {pricingPeriods.map((period, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900">Period {index + 1}</h4>
                        {pricingPeriods.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removePricingPeriod(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                          <Input
                            type="date"
                            value={period.startDate}
                            onChange={(e) => updatePricingPeriod(index, 'startDate', e.target.value)}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                          <Input
                            type="date"
                            value={period.endDate}
                            onChange={(e) => updatePricingPeriod(index, 'endDate', e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Nights</label>
                          <Input
                            type="number"
                            min="1"
                            value={period.nights}
                            onChange={(e) => updatePricingPeriod(index, 'nights', parseInt(e.target.value) || 0)}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Price/Night (SAR)</label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={period.unitPrice}
                            onChange={(e) => updatePricingPeriod(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Hotel Cost/Night (SAR)</label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={period.hotelCostPrice}
                            onChange={(e) => updatePricingPeriod(index, 'hotelCostPrice', parseFloat(e.target.value) || 0)}
                            placeholder="0"
                          />
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 p-3 rounded-md">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">Period Subtotal:</span>
                          <SARAmount amount={period.subtotal} />
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Rooms */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Rooms
                  </CardTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addRoom}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Room
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {rooms.map((room, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900">Room {index + 1}</h4>
                      {rooms.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeRoom(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Room Type</label>
                        <Input
                          value={room.roomType}
                          onChange={(e) => updateRoom(index, 'roomType', e.target.value)}
                          placeholder="Enter room type (e.g., Deluxe Double, Executive Suite)"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Room Count</label>
                        <Input
                          type="number"
                          min="1"
                          value={room.roomCount}
                          onChange={(e) => updateRoom(index, 'roomCount', parseInt(e.target.value) || 1)}
                          required
                        />
                      </div>
                    </div>
                    
                    {!hasPricingPeriods && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price (SAR)</label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={room.unitPrice}
                            onChange={(e) => updateRoom(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Hotel Cost Price (SAR)</label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={room.hotelCostPrice}
                            onChange={(e) => updateRoom(index, 'hotelCostPrice', parseFloat(e.target.value) || 0)}
                            placeholder="0"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Total Amount Display */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SaudiRiyalIcon className="h-5 w-5" />
                  Total Amount
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-medium text-gray-900">Total Booking Amount:</span>
                    <SARAmount amount={formData.totalAmount} className="text-xl font-bold text-blue-600" />
                  </div>
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
