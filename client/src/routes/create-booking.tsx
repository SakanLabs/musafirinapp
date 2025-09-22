import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { 
  Users,
  Calendar,
  MapPin,
  DollarSign,
  Save,
  ArrowLeft,
  Loader2
} from "lucide-react"
import { authService } from "@/lib/auth"
import { useCreateBooking, type CreateBookingData } from "@/lib/queries/bookings"

export const Route = createFileRoute("/create-booking")({ 
  beforeLoad: async () => {
    const isAuthenticated = await authService.isAuthenticated()
    
    if (!isAuthenticated) {
      throw redirect({ to: "/login" })
    }
  },
  component: CreateBookingPage
})

function CreateBookingPage() {
  const navigate = useNavigate()
  const createBookingMutation = useCreateBooking()
  
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
    pricePerNight: 0,
    totalAmount: 0,
    specialRequests: ""
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleInputChange = (field: string, value: string | number) => {
    const updatedData = {
      ...formData,
      [field]: value
    }
    
    // Auto-calculate total amount when price per night or dates change
    if (field === 'pricePerNight' || field === 'checkInDate' || field === 'checkOutDate') {
      const nights = field === 'checkInDate' || field === 'checkOutDate' 
        ? calculateNightsFromDates(
            field === 'checkInDate' ? value as string : updatedData.checkInDate,
            field === 'checkOutDate' ? value as string : updatedData.checkOutDate
          )
        : calculateNights()
      
      const pricePerNight = field === 'pricePerNight' ? value as number : updatedData.pricePerNight
      updatedData.totalAmount = nights * pricePerNight
    }
    
    setFormData(updatedData)
    
    // Clear error when user starts typing
    if (errors[field as keyof typeof errors]) {
      setErrors(prev => ({
        ...prev,
        [field]: ""
      }))
    }
  }

  const calculateNightsFromDates = (checkInDate: string, checkOutDate: string) => {
    if (checkInDate && checkOutDate) {
      const checkIn = new Date(checkInDate)
      const checkOut = new Date(checkOutDate)
      const diffTime = Math.abs(checkOut.getTime() - checkIn.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      return diffDays
    }
    return 0
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.guestName.trim()) {
      newErrors.guestName = "Guest name is required"
    }
    if (!formData.guestEmail.trim()) {
      newErrors.guestEmail = "Guest email is required"
    } else if (!/\S+@\S+\.\S+/.test(formData.guestEmail)) {
      newErrors.guestEmail = "Please enter a valid email address"
    }
    if (!formData.guestPhone.trim()) {
      newErrors.guestPhone = "Guest phone is required"
    }
    if (!formData.hotelName.trim()) {
      newErrors.hotelName = "Hotel name is required"
    }
    if (!formData.city.trim()) {
      newErrors.city = "City is required"
    }
    if (!formData.checkInDate) {
      newErrors.checkInDate = "Check-in date is required"
    }
    if (!formData.checkOutDate) {
      newErrors.checkOutDate = "Check-out date is required"
    }
    if (formData.checkInDate && formData.checkOutDate && new Date(formData.checkInDate) >= new Date(formData.checkOutDate)) {
      newErrors.checkOutDate = "Check-out date must be after check-in date"
    }
    if (!formData.roomType) {
      newErrors.roomType = "Room type is required"
    }
    if (formData.numberOfGuests < 1) {
      newErrors.numberOfGuests = "Number of guests must be at least 1"
    }
    if (formData.pricePerNight <= 0) {
      newErrors.pricePerNight = "Price per night must be greater than 0"
    }
    if (formData.totalAmount <= 0) {
      newErrors.totalAmount = "Total amount must be greater than 0"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

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

      const result = await createBookingMutation.mutateAsync(bookingData)
      
      // Navigate to booking detail page or bookings list
      navigate({ to: "/bookings" })
    } catch (error) {
      console.error("Failed to create booking:", error)
    }
  }

  const calculateNights = () => {
    if (formData.checkInDate && formData.checkOutDate) {
      const checkIn = new Date(formData.checkInDate)
      const checkOut = new Date(formData.checkOutDate)
      const diffTime = Math.abs(checkOut.getTime() - checkIn.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      return diffDays
    }
    return 0
  }

  const calculateTotalAmount = () => {
    const nights = calculateNights()
    return nights * formData.pricePerNight
  }

  const formatSAR = (amount: number) => {
    return `${amount.toLocaleString()} SAR`
  }

  return (
    <PageLayout
      title="Create New Booking"
      subtitle="Add a new hotel booking to the system"
      actions={
        <Button 
          variant="outline" 
          onClick={() => navigate({ to: "/bookings" })}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Bookings
        </Button>
      }
    >
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-8">
        {/* Guest Information */}
        <Card className="p-6">
          <div className="flex items-center space-x-2 mb-6">
            <Users className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold">Guest Information</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Guest Name *
              </label>
              <Input
                value={formData.guestName}
                onChange={(e) => handleInputChange('guestName', e.target.value)}
                placeholder="Enter guest full name"
                className={errors.guestName ? "border-red-500" : ""}
              />
              {errors.guestName && (
                <p className="text-red-500 text-sm mt-1">{errors.guestName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address *
              </label>
              <Input
                type="email"
                value={formData.guestEmail}
                onChange={(e) => handleInputChange('guestEmail', e.target.value)}
                placeholder="guest@example.com"
                className={errors.guestEmail ? "border-red-500" : ""}
              />
              {errors.guestEmail && (
                <p className="text-red-500 text-sm mt-1">{errors.guestEmail}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number *
              </label>
              <Input
                value={formData.guestPhone}
                onChange={(e) => handleInputChange('guestPhone', e.target.value)}
                placeholder="+62 812 3456 7890"
                className={errors.guestPhone ? "border-red-500" : ""}
              />
              {errors.guestPhone && (
                <p className="text-red-500 text-sm mt-1">{errors.guestPhone}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number of Guests *
              </label>
              <Input
                type="number"
                min="1"
                max="10"
                value={formData.numberOfGuests}
                onChange={(e) => handleInputChange('numberOfGuests', parseInt(e.target.value) || 1)}
                className={errors.numberOfGuests ? "border-red-500" : ""}
              />
              {errors.numberOfGuests && (
                <p className="text-red-500 text-sm mt-1">{errors.numberOfGuests}</p>
              )}
            </div>
          </div>
        </Card>

        {/* Hotel Information */}
        <Card className="p-6">
          <div className="flex items-center space-x-2 mb-6">
            <MapPin className="h-5 w-5 text-purple-600" />
            <h3 className="text-lg font-semibold">Hotel Information</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hotel Name *
              </label>
              <Input
                value={formData.hotelName}
                onChange={(e) => handleInputChange('hotelName', e.target.value)}
                placeholder="Enter hotel name"
                className={errors.hotelName ? "border-red-500" : ""}
              />
              {errors.hotelName && (
                <p className="text-red-500 text-sm mt-1">{errors.hotelName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                City *
              </label>
              <select
                value={formData.city}
                onChange={(e) => handleInputChange('city', e.target.value)}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.city ? "border-red-500" : ""}`}
              >
                <option value="">Select city</option>
                <option value="Makkah">Makkah</option>
                <option value="Madinah">Madinah</option>
              </select>
              {errors.city && (
                <p className="text-red-500 text-sm mt-1">{errors.city}</p>
              )}
            </div>
          </div>
        </Card>

        {/* Booking Details */}
        <Card className="p-6">
          <div className="flex items-center space-x-2 mb-6">
            <Calendar className="h-5 w-5 text-green-600" />
            <h3 className="text-lg font-semibold">Booking Details</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Check-in Date *
              </label>
              <Input
                type="date"
                value={formData.checkInDate}
                onChange={(e) => handleInputChange('checkInDate', e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className={errors.checkInDate ? "border-red-500" : ""}
              />
              {errors.checkInDate && (
                <p className="text-red-500 text-sm mt-1">{errors.checkInDate}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Check-out Date *
              </label>
              <Input
                type="date"
                value={formData.checkOutDate}
                onChange={(e) => handleInputChange('checkOutDate', e.target.value)}
                min={formData.checkInDate || new Date().toISOString().split('T')[0]}
                className={errors.checkOutDate ? "border-red-500" : ""}
              />
              {errors.checkOutDate && (
                <p className="text-red-500 text-sm mt-1">{errors.checkOutDate}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Room Type *
              </label>
              <select
                value={formData.roomType}
                onChange={(e) => handleInputChange('roomType', e.target.value)}
                className={`flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm ${errors.roomType ? "border-red-500" : ""}`}
              >
                <option value="">Select room type</option>
                <option value="DBL">Double Room (DBL)</option>
                <option value="TPL">Triple Room (TPL)</option>
                <option value="Quad">Quad Room (Quad)</option>
              </select>
              {errors.roomType && (
                <p className="text-red-500 text-sm mt-1">{errors.roomType}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duration
              </label>
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm text-gray-600">
                  {calculateNights()} night{calculateNights() !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Pricing */}
        <Card className="p-6">
          <div className="flex items-center space-x-2 mb-6">
            <DollarSign className="h-5 w-5 text-yellow-600" />
            <h3 className="text-lg font-semibold">Pricing</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Price per Night (SAR) *
              </label>
              <Input
                type="number"
                min="0"
                step="10"
                value={formData.pricePerNight}
                onChange={(e) => handleInputChange('pricePerNight', parseFloat(e.target.value) || 0)}
                placeholder="0"
                className={errors.pricePerNight ? "border-red-500" : ""}
              />
              {errors.pricePerNight && (
                <p className="text-red-500 text-sm mt-1">{errors.pricePerNight}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Total Amount
              </label>
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm text-gray-600">
                  {formatSAR(formData.totalAmount)} ({calculateNights()} night{calculateNights() !== 1 ? 's' : ''})
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Special Requests */}
        <Card className="p-6">
          <div className="flex items-center space-x-2 mb-6">
            <MapPin className="h-5 w-5 text-purple-600" />
            <h3 className="text-lg font-semibold">Additional Information</h3>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Special Requests
            </label>
            <textarea
              value={formData.specialRequests}
              onChange={(e) => handleInputChange('specialRequests', e.target.value)}
              placeholder="Any special requests or notes..."
              rows={3}
              className={`flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm ${errors.specialRequests ? "border-red-500" : ""}`}
            />
            {errors.specialRequests && (
              <p className="text-red-500 text-sm mt-1">{errors.specialRequests}</p>
            )}
          </div>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end space-x-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => navigate({ to: "/bookings" })}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={createBookingMutation.isPending}
            className="min-w-[120px]"
          >
            {createBookingMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Create Booking
              </>
            )}
          </Button>
        </div>
      </form>
    </PageLayout>
  )
}