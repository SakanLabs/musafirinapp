import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
import { useEffect, useState, useMemo } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { SARAmount, SaudiRiyalIcon } from "@/components/ui/sar-currency"
import {
  Users,
  Calendar,
  MapPin,
  Save,
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  CalendarDays
} from "lucide-react"
import { authService } from "@/lib/auth"
import { useCreateBooking, type CreateBookingData, type CreateBookingRoomItem, type PricingPeriod } from "@/lib/queries/bookings"
import { useClients } from "@/lib/queries"
import { useHotels, useHotelPricing } from "@/lib/queries/master"

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
  const { data: clients = [], isLoading: isClientsLoading } = useClients()
  const { data: masterHotels = [], isLoading: isHotelsLoading } = useHotels()
  const [selectedClientId, setSelectedClientId] = useState("")
  const [selectedMasterHotelId, setSelectedMasterHotelId] = useState("")
  const { data: hotelPricingPeriods = [] } = useHotelPricing(Number(selectedMasterHotelId))

  const [formData, setFormData] = useState({
    guestName: "",
    guestEmail: "",
    guestPhone: "",
    hotelName: "",
    city: "",
    checkInDate: "",
    checkOutDate: "",
    roomType: "",
    mealPlan: "Room Only",
    numberOfGuests: 1,
    pricePerNight: 0,
    hotelCostPerNight: 0,
    totalAmount: 0,
    totalHotelCost: 0,
    specialRequests: "",
    paymentMethod: "",
    paymentAmount: 0,
  })

  const availableRoomTypes = useMemo(() => {
    if (!hotelPricingPeriods || hotelPricingPeriods.length === 0) return [];
    // Only show room types that have the current meal plan configured, or show all if Meal Plan is somehow empty
    const filtered = hotelPricingPeriods.filter(p => !formData.mealPlan || p.mealPlan === formData.mealPlan);
    const types = new Set(filtered.map(p => p.roomType));
    return Array.from(types);
  }, [hotelPricingPeriods, formData.mealPlan]);

  const [rooms, setRooms] = useState<CreateBookingRoomItem[]>([
    {
      roomType: "",
      roomCount: 1,
      unitPrice: 0,
      hotelCostPrice: 0
    }
  ])

  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!selectedClientId) {
      return
    }

    const clientExists = clients.some(client => client.id.toString() === selectedClientId)

    if (!clientExists) {
      setSelectedClientId("")
      setFormData(prev => ({
        ...prev,
        guestName: "",
        guestEmail: "",
        guestPhone: ""
      }))
    }
  }, [clients, selectedClientId])

  const handleInputChange = (field: string, value: string | number) => {
    const updatedData = {
      ...formData,
      [field]: value
    }

    // Auto-calculate total amount and hotel cost when price per night, hotel cost per night, or dates change
    if (field === 'pricePerNight' || field === 'hotelCostPerNight' || field === 'checkInDate' || field === 'checkOutDate') {
      const nights = field === 'checkInDate' || field === 'checkOutDate'
        ? calculateNightsFromDates(
          field === 'checkInDate' ? value as string : updatedData.checkInDate,
          field === 'checkOutDate' ? value as string : updatedData.checkOutDate
        )
        : calculateNights()

      const pricePerNight = field === 'pricePerNight' ? value as number : updatedData.pricePerNight
      const hotelCostPerNight = field === 'hotelCostPerNight' ? value as number : updatedData.hotelCostPerNight
      updatedData.totalAmount = nights * pricePerNight
      updatedData.totalHotelCost = nights * hotelCostPerNight
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

  const handleClientSelection = (value: string) => {
    if (!value) {
      setSelectedClientId("")
      setFormData(prev => ({
        ...prev,
        guestName: "",
        guestEmail: "",
        guestPhone: ""
      }))
      return
    }

    const selectedClient = clients.find(client => client.id.toString() === value)
    setSelectedClientId(value)

    if (selectedClient) {
      setFormData(prev => ({
        ...prev,
        guestName: selectedClient.name,
        guestEmail: selectedClient.email,
        guestPhone: selectedClient.phone
      }))
      setErrors(prev => ({
        ...prev,
        guestName: "",
        guestEmail: "",
        guestPhone: "",
        client: ""
      }))
    }
  }

  const handleMasterHotelSelection = (value: string) => {
    setSelectedMasterHotelId(value)
    if (!value) return

    const selectedHotel = masterHotels.find(h => h.id.toString() === value)
    if (selectedHotel) {
      setFormData(prev => ({
        ...prev,
        hotelName: selectedHotel.name,
        city: selectedHotel.city
      }))
      setErrors(prev => ({
        ...prev,
        hotelName: "",
        city: ""
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

    if (!selectedClientId) {
      newErrors.client = "Please select or create a client"
    }

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
    if (!formData.mealPlan) {
      newErrors.mealPlan = "Meal plan is required"
    }
    if (formData.numberOfGuests < 1) {
      newErrors.numberOfGuests = "Number of guests must be at least 1"
    }

    // Validate rooms
    if (rooms.length === 0) {
      newErrors.rooms = "At least one room is required"
    } else {
      rooms.forEach((room, index) => {
        if (!room.roomType.trim()) {
          newErrors[`room_${index}_type`] = "Room type is required"
        }
        if (room.roomCount < 1) {
          newErrors[`room_${index}_count`] = "Room count must be at least 1"
        }

        // Validate pricing based on whether pricing periods are used
        if (room.hasPricingPeriods && room.pricingPeriods) {
          if (room.pricingPeriods.length === 0) {
            newErrors[`room_${index}_periods`] = "At least one pricing period is required"
          } else {
            room.pricingPeriods.forEach((period, periodIndex) => {
              if (period.unitPrice <= 0) {
                newErrors[`room_${index}_period_${periodIndex}_price`] = "Period price must be greater than 0"
              }
              if (!period.startDate) {
                newErrors[`room_${index}_period_${periodIndex}_start`] = "Start date is required"
              }
              if (!period.endDate) {
                newErrors[`room_${index}_period_${periodIndex}_end`] = "End date is required"
              }
              if (period.startDate && period.endDate && new Date(period.startDate) >= new Date(period.endDate)) {
                newErrors[`room_${index}_period_${periodIndex}_dates`] = "End date must be after start date"
              }
            })
          }
        } else {
          if (room.unitPrice <= 0) {
            newErrors[`room_${index}_price`] = "Unit price must be greater than 0"
          }
        }

        if (room.hotelCostPrice !== undefined && room.hotelCostPrice < 0) {
          newErrors[`room_${index}_cost`] = "Hotel cost cannot be negative"
        }
      })
    }

    // Calculate total amount considering pricing periods
    const totalAmount = rooms.reduce((sum, room) => {
      if (room.hasPricingPeriods && room.pricingPeriods) {
        return sum + room.pricingPeriods.reduce((periodSum, period) =>
          periodSum + (period.subtotal * room.roomCount), 0)
      } else {
        return sum + (room.unitPrice * room.roomCount)
      }
    }, 0)

    if (totalAmount <= 0) {
      newErrors.totalAmount = "Total amount must be greater than 0"
    }
    // Payment validations
    if (formData.paymentMethod && formData.paymentAmount <= 0) {
      newErrors.paymentAmount = "Payment amount must be greater than 0"
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
      // Calculate total amount from all rooms considering pricing periods
      const totalAmount = rooms.reduce((sum, room) => {
        if (room.hasPricingPeriods && room.pricingPeriods) {
          const roomTotal = room.pricingPeriods.reduce((periodSum, period) => {
            const periodTotal = period.subtotal * room.roomCount;
            return periodSum + periodTotal;
          }, 0);
          return sum + roomTotal;
        } else {
          const nights = calculateNights();
          const roomTotal = room.unitPrice * room.roomCount * nights;
          return sum + roomTotal;
        }
      }, 0);

      const bookingData: CreateBookingData = {
        guestName: formData.guestName,
        guestEmail: formData.guestEmail,
        guestPhone: formData.guestPhone,
        hotelName: formData.hotelName,
        city: formData.city,
        checkInDate: formData.checkInDate,
        checkOutDate: formData.checkOutDate,
        rooms: rooms,
        mealPlan: formData.mealPlan as CreateBookingData['mealPlan'],
        numberOfGuests: formData.numberOfGuests,
        totalAmount: totalAmount,
        specialRequests: formData.specialRequests || undefined,
        paymentMethod: formData.paymentMethod ? (formData.paymentMethod as 'bank_transfer' | 'deposit' | 'cash') : undefined,
        paymentAmount: formData.paymentMethod ? formData.paymentAmount : undefined,
        // Legacy fields for backward compatibility
        roomType: formData.roomType,
        hotelCostPerNight: formData.hotelCostPerNight || undefined,
        totalHotelCost: formData.totalHotelCost || undefined
      }

      await createBookingMutation.mutateAsync(bookingData)

      // Navigate to booking detail page or bookings list
      navigate({ to: "/bookings" })
    } catch (error) {
      console.error("Failed to create booking:", error)
      console.error("Error details:", error instanceof Error ? error.message : error)

      // Show error to user
      toast.error(`Failed to create booking: ${error instanceof Error ? error.message : 'Unknown error'}`)
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

  const autoFillRoomPricing = (index: number) => {
    const rootRooms = [...rooms];
    const room = rootRooms[index];
    if (!selectedMasterHotelId || !formData.checkInDate || !formData.checkOutDate) {
      toast.error('Please ensure Master Hotel, Check-in, and Check-out dates are selected first.');
      return;
    }
    if (!room.roomType) {
      toast.error('Please select a Room Type to use auto-fill.');
      return;
    }

    const checkIn = new Date(formData.checkInDate);
    const checkOut = new Date(formData.checkOutDate);
    
    const matchedPeriods = hotelPricingPeriods.filter(p => 
      p.roomType.toLowerCase() === room.roomType.toLowerCase() && 
      p.mealPlan === formData.mealPlan &&
      p.isActive
    );

    if (matchedPeriods.length === 0) {
      toast.warning(`No Master Pricing found for ${room.roomType} with Meal Plan ${formData.mealPlan}.`);
      return;
    }

    matchedPeriods.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

    const generatedPeriods: PricingPeriod[] = [];
    let currentDate = new Date(checkIn);
    
    while (currentDate < checkOut) {
      const activeMaster = matchedPeriods.find(p => {
        const start = new Date(p.startDate);
        const end = new Date(p.endDate);
        return currentDate >= start && currentDate <= end;
      });

      if (!activeMaster) {
        toast.error(`Pricing gap detected on ${currentDate.toLocaleDateString()}. Automatic slice aborted.`);
        return;
      }

      let subNights = 1;
      let nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + 1);
      const activeMasterEnd = new Date(activeMaster.endDate);

      while (nextDate < checkOut && nextDate <= activeMasterEnd) {
        subNights++;
        nextDate.setDate(nextDate.getDate() + 1);
      }

      generatedPeriods.push({
        startDate: currentDate.toISOString().split('T')[0],
        endDate: nextDate.toISOString().split('T')[0],
        nights: subNights,
        unitPrice: Number(activeMaster.sellingPrice),
        hotelCostPrice: Number(activeMaster.costPrice),
        subtotal: Number(activeMaster.sellingPrice) * subNights
      });

      currentDate = nextDate;
    }

    if (generatedPeriods.length === 0) return;

    if (generatedPeriods.length === 1) {
      rootRooms[index] = {
        ...room,
        hasPricingPeriods: false,
        unitPrice: generatedPeriods[0].unitPrice,
        hotelCostPrice: generatedPeriods[0].hotelCostPrice,
        pricingPeriods: undefined
      };
    } else {
      rootRooms[index] = {
        ...room,
        hasPricingPeriods: true,
        pricingPeriods: generatedPeriods
      };
    }

    setRooms(rootRooms);
    updateTotalAmount(rootRooms);
    toast.success(`Pricing automatically assigned for Room ${index + 1}`);
  }

  const addRoom = () => {
    setRooms([...rooms, {
      roomType: "",
      roomCount: 1,
      unitPrice: 0,
      hotelCostPrice: 0
    }])
  }

  const removeRoom = (index: number) => {
    if (rooms.length > 1) {
      setRooms(rooms.filter((_, i) => i !== index))
    }
  }

  const updateRoom = (index: number, field: keyof CreateBookingRoomItem, value: string | number | boolean) => {
    const updatedRooms = [...rooms]

    if (field === 'hasPricingPeriods' && value === true) {
      // Initialize with one pricing period covering the full stay
      const nights = calculateNights()
      updatedRooms[index] = {
        ...updatedRooms[index],
        [field]: value,
        pricingPeriods: [{
          startDate: formData.checkInDate,
          endDate: formData.checkOutDate,
          nights: nights,
          unitPrice: updatedRooms[index].unitPrice || 0,
          hotelCostPrice: updatedRooms[index].hotelCostPrice || 0,
          subtotal: (updatedRooms[index].unitPrice || 0) * nights
        }]
      }
    } else if (field === 'hasPricingPeriods' && value === false) {
      // Remove pricing periods and use single price
      updatedRooms[index] = {
        ...updatedRooms[index],
        [field]: value,
        pricingPeriods: undefined
      }
    } else {
      updatedRooms[index] = {
        ...updatedRooms[index],
        [field]: field === 'roomType' ? value : typeof value === 'boolean' ? value : Number(value)
      }
    }

    setRooms(updatedRooms)
    updateTotalAmount(updatedRooms)
  }

  const updateTotalAmount = (updatedRooms: CreateBookingRoomItem[]) => {
    const totalAmount = updatedRooms.reduce((sum, room) => {
      if (room.hasPricingPeriods && room.pricingPeriods) {
        const roomTotal = room.pricingPeriods.reduce((periodSum, period) => {
          return periodSum + (period.subtotal * room.roomCount);
        }, 0);
        return sum + roomTotal;
      } else {
        const nights = calculateNights();
        return sum + (room.unitPrice * room.roomCount * nights);
      }
    }, 0);
    setFormData(prev => ({ ...prev, totalAmount }))
  }

  const addPricingPeriod = (roomIndex: number) => {
    const updatedRooms = [...rooms]
    const room = updatedRooms[roomIndex]

    if (!room.pricingPeriods) {
      room.pricingPeriods = []
    }

    // Get the last period's end date or check-in date
    const lastPeriod = room.pricingPeriods[room.pricingPeriods.length - 1]
    const startDate = lastPeriod ? lastPeriod.endDate : formData.checkInDate

    room.pricingPeriods.push({
      startDate: startDate,
      endDate: formData.checkOutDate,
      nights: 1,
      unitPrice: 0,
      hotelCostPrice: 0,
      subtotal: 0
    })

    setRooms(updatedRooms)
  }

  const removePricingPeriod = (roomIndex: number, periodIndex: number) => {
    const updatedRooms = [...rooms]
    const room = updatedRooms[roomIndex]

    if (room.pricingPeriods && room.pricingPeriods.length > 1) {
      room.pricingPeriods.splice(periodIndex, 1)
      setRooms(updatedRooms)
      updateTotalAmount(updatedRooms)
    }
  }

  const updatePricingPeriod = (roomIndex: number, periodIndex: number, field: keyof PricingPeriod, value: string | number) => {
    const updatedRooms = [...rooms]
    const room = updatedRooms[roomIndex]

    if (!room.pricingPeriods) return

    const period = room.pricingPeriods[periodIndex]

    // Type-safe field assignment
    if (field === 'startDate' || field === 'endDate') {
      (period as any)[field] = value as string
    } else {
      (period as any)[field] = Number(value)
    }

    // Recalculate nights and subtotal when dates or prices change
    if (field === 'startDate' || field === 'endDate') {
      const startDate = new Date(period.startDate)
      const endDate = new Date(period.endDate)
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime())
      period.nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    }

    period.subtotal = period.unitPrice * period.nights

    setRooms(updatedRooms)
    updateTotalAmount(updatedRooms)
  }

  return (
    <>
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
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Client
                </label>
                <div className="flex flex-col gap-2 md:flex-row md:items-center">
                  <select
                    value={selectedClientId}
                    onChange={(e) => handleClientSelection(e.target.value)}
                    className="w-full flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isClientsLoading && clients.length === 0}
                  >
                    <option value="">
                      {isClientsLoading && clients.length === 0
                        ? "Loading clients..."
                        : "Select existing client"}
                    </option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id.toString()}>
                        {client.name} • {client.email}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate({ to: "/clients/create", search: { redirectTo: "/create-booking" } })}
                  >
                    New Client
                  </Button>
                </div>
                {selectedClientId && (
                  <p className="text-xs text-gray-500 mt-2">
                    Guest details are pre-filled from the selected client.
                  </p>
                )}
                {!isClientsLoading && clients.length === 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    No clients found. Create a new client to continue.
                  </p>
                )}
                {errors.client && (
                  <p className="text-red-500 text-sm mt-2">{errors.client}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Guest Name *
                </label>
                <Input
                  value={formData.guestName}
                  onChange={(e) => handleInputChange('guestName', e.target.value)}
                  placeholder="Enter guest full name"
                  className={errors.guestName ? "border-red-500" : ""}
                  disabled={!selectedClientId}
                  readOnly={!!selectedClientId}
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
                  disabled={!selectedClientId}
                  readOnly={!!selectedClientId}
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
                  disabled={!selectedClientId}
                  readOnly={!!selectedClientId}
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

            <div className="mb-6 bg-blue-50 border border-blue-100 p-4 rounded-md">
              <label className="block text-sm font-medium text-blue-900 mb-2">
                Quick Select from Master Data
              </label>
              <select
                value={selectedMasterHotelId}
                onChange={(e) => handleMasterHotelSelection(e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                disabled={isHotelsLoading}
              >
                <option value="">-- Custom Hotel Entry --</option>
                {masterHotels.map(hotel => (
                  <option key={hotel.id} value={hotel.id.toString()}>
                    {hotel.name} ({hotel.city}) {hotel.starRating ? ` - ${hotel.starRating} Stars` : ''}
                  </option>
                ))}
              </select>
              {masterHotels.length === 0 && !isHotelsLoading && (
                <p className="text-xs text-blue-600 mt-2">No master hotels configured. Using custom entry.</p>
              )}
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

              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Rooms *
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addRoom}
                    className="flex items-center space-x-1"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Room</span>
                  </Button>
                </div>

                <div className="space-y-4">
                  {rooms.map((room, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-gray-700">Room {index + 1}</h4>
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

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Room Type *
                          </label>
                          {availableRoomTypes.length > 0 ? (
                            <select
                              value={room.roomType}
                              title="Select Room Type"
                              onChange={(e) => updateRoom(index, 'roomType', e.target.value)}
                              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${errors[`room_${index}_type`] ? "border-red-500" : "border-gray-300"}`}
                            >
                              <option value="">Select Room Type</option>
                              {availableRoomTypes.map(type => (
                                <option key={type} value={type}>{type}</option>
                              ))}
                            </select>
                          ) : (
                            <Input
                              value={room.roomType}
                              onChange={(e) => updateRoom(index, 'roomType', e.target.value)}
                              placeholder="e.g., Deluxe Double"
                              className={errors[`room_${index}_type`] ? "border-red-500" : ""}
                            />
                          )}
                          {errors[`room_${index}_type`] && (
                            <p className="text-red-500 text-xs mt-1">{errors[`room_${index}_type`]}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Quantity *
                          </label>
                          <Input
                            type="number"
                            min="1"
                            value={room.roomCount}
                            onChange={(e) => updateRoom(index, 'roomCount', parseInt(e.target.value) || 1)}
                            className={errors[`room_${index}_count`] ? "border-red-500" : ""}
                          />
                          {errors[`room_${index}_count`] && (
                            <p className="text-red-500 text-xs mt-1">{errors[`room_${index}_count`]}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Unit Price (SAR) *
                          </label>
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            value={room.unitPrice}
                            onChange={(e) => updateRoom(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className={errors[`room_${index}_price`] ? "border-red-500" : ""}
                          />
                          {errors[`room_${index}_price`] && (
                            <p className="text-red-500 text-xs mt-1">{errors[`room_${index}_price`]}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Hotel Cost (SAR)
                          </label>
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            value={room.hotelCostPrice || 0}
                            onChange={(e) => updateRoom(index, 'hotelCostPrice', parseFloat(e.target.value) || 0)}
                            className={errors[`room_${index}_cost`] ? "border-red-500" : ""}
                          />
                          {errors[`room_${index}_cost`] && (
                            <p className="text-red-500 text-xs mt-1">{errors[`room_${index}_cost`]}</p>
                          )}
                        </div>
                      </div>

                      {/* Auto Fill Action */}
                      {selectedMasterHotelId && hotelPricingPeriods.length > 0 && (
                        <div className="mt-4 flex justify-end">
                          <Button type="button" variant="secondary" size="sm" onClick={() => autoFillRoomPricing(index)} className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200">
                            ⚡ Auto-Fill Pricing from Master
                          </Button>
                        </div>
                      )}

                      {/* Pricing Periods Toggle */}
                      <div className="mt-4 pt-3 border-t border-gray-200">
                        <div className="flex items-center justify-between mb-3">
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={room.hasPricingPeriods || false}
                              onChange={(e) => updateRoom(index, 'hasPricingPeriods', e.target.checked)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-gray-700">
                              Multiple Pricing Periods
                            </span>
                          </label>
                          <CalendarDays className="h-4 w-4 text-gray-400" />
                        </div>

                        {room.hasPricingPeriods && room.pricingPeriods && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-gray-600">
                                Configure different prices for different date ranges
                              </p>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => addPricingPeriod(index)}
                                className="flex items-center space-x-1"
                              >
                                <Plus className="h-3 w-3" />
                                <span>Add Period</span>
                              </Button>
                            </div>

                            {room.pricingPeriods.map((period, periodIndex) => (
                              <div key={periodIndex} className="bg-white border border-gray-200 rounded-md p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <h5 className="text-xs font-medium text-gray-700">
                                    Period {periodIndex + 1}
                                  </h5>
                                  {room.pricingPeriods!.length > 1 && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => removePricingPeriod(index, periodIndex)}
                                      className="text-red-600 hover:text-red-700 h-6 w-6 p-0"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                      Start Date
                                    </label>
                                    <Input
                                      type="date"
                                      value={period.startDate}
                                      onChange={(e) => updatePricingPeriod(index, periodIndex, 'startDate', e.target.value)}
                                      min={formData.checkInDate}
                                      max={formData.checkOutDate}
                                      className="text-xs"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                      End Date
                                    </label>
                                    <Input
                                      type="date"
                                      value={period.endDate}
                                      onChange={(e) => updatePricingPeriod(index, periodIndex, 'endDate', e.target.value)}
                                      min={period.startDate}
                                      max={formData.checkOutDate}
                                      className="text-xs"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                      Nights
                                    </label>
                                    <Input
                                      type="number"
                                      value={period.nights}
                                      readOnly
                                      className="text-xs bg-gray-50"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                      Price/Night
                                    </label>
                                    <Input
                                      type="number"
                                      min="0"
                                      step="any"
                                      value={period.unitPrice}
                                      onChange={(e) => updatePricingPeriod(index, periodIndex, 'unitPrice', parseFloat(e.target.value) || 0)}
                                      className="text-xs"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                      Hotel Cost
                                    </label>
                                    <Input
                                      type="number"
                                      min="0"
                                      step="any"
                                      value={period.hotelCostPrice || 0}
                                      onChange={(e) => updatePricingPeriod(index, periodIndex, 'hotelCostPrice', parseFloat(e.target.value) || 0)}
                                      className="text-xs"
                                    />
                                  </div>
                                </div>

                                <div className="mt-2 text-right">
                                  <p className="text-xs text-gray-600">
                                    Period Subtotal: <SARAmount amount={period.subtotal} />
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mt-3 text-right">
                        <p className="text-sm text-gray-600">
                          Subtotal: <SARAmount amount={
                            room.hasPricingPeriods && room.pricingPeriods
                              ? room.pricingPeriods.reduce((sum, period) => sum + period.subtotal, 0) * room.roomCount
                              : room.unitPrice * room.roomCount
                          } />
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {errors.rooms && (
                  <p className="text-red-500 text-sm mt-2">{errors.rooms}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Meal Plan *
                </label>
                <select
                  value={formData.mealPlan}
                  onChange={(e) => handleInputChange('mealPlan', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.mealPlan ? 'border-red-500' : 'border-gray-300'}`}
                >
                  <option value="">Select meal plan</option>
                  <option value="Breakfast">Breakfast</option>
                  <option value="Half Board">Half Board</option>
                  <option value="Full Board">Full Board</option>
                  <option value="Room Only">Room Only</option>
                </select>
                {errors.mealPlan && (
                  <p className="text-red-500 text-sm mt-1">{errors.mealPlan}</p>
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

          {/* Booking Summary */}
          <Card className="p-6">
            <div className="flex items-center space-x-2 mb-6">
              <SaudiRiyalIcon size={16} className="text-yellow-600" />
              <h3 className="text-lg font-semibold">Booking Summary</h3>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total Rooms
                  </label>
                  <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                    <p className="text-sm text-blue-800 font-medium">
                      {rooms.reduce((sum, room) => sum + room.roomCount, 0)} room{rooms.reduce((sum, room) => sum + room.roomCount, 0) !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total Revenue
                  </label>
                  <div className="bg-green-50 p-3 rounded-md border border-green-200">
                    <p className="text-sm text-green-800 font-medium">
                      <SARAmount amount={rooms.reduce((sum, room) => {
                        if (room.hasPricingPeriods && room.pricingPeriods) {
                          return sum + room.pricingPeriods.reduce((periodSum, period) =>
                            periodSum + (period.subtotal * room.roomCount), 0)
                        } else {
                          const nights = calculateNights()
                          return sum + (room.unitPrice * room.roomCount * nights)
                        }
                      }, 0)} />
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total Hotel Cost
                  </label>
                  <div className="bg-red-50 p-3 rounded-md border border-red-200">
                    <p className="text-sm text-red-800 font-medium">
                      <SARAmount amount={rooms.reduce((sum, room) => {
                        if (room.hasPricingPeriods && room.pricingPeriods) {
                          return sum + room.pricingPeriods.reduce((periodSum, period) =>
                            periodSum + ((period.hotelCostPrice || 0) * room.roomCount), 0)
                        } else {
                          const nights = calculateNights()
                          return sum + ((room.hotelCostPrice || 0) * room.roomCount * nights)
                        }
                      }, 0)} />
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estimated Profit
                </label>
                <div className={`p-3 rounded-md border ${(() => {
                    const totalRevenue = rooms.reduce((sum, room) => {
                      if (room.hasPricingPeriods && room.pricingPeriods) {
                        return sum + room.pricingPeriods.reduce((periodSum, period) =>
                          periodSum + (period.subtotal * room.roomCount), 0)
                      } else {
                        const nights = calculateNights()
                        return sum + (room.unitPrice * room.roomCount * nights)
                      }
                    }, 0)
                    const totalCost = rooms.reduce((sum, room) => {
                      if (room.hasPricingPeriods && room.pricingPeriods) {
                        return sum + room.pricingPeriods.reduce((periodSum, period) =>
                          periodSum + ((period.hotelCostPrice || 0) * room.roomCount), 0)
                      } else {
                        const nights = calculateNights()
                        return sum + ((room.hotelCostPrice || 0) * room.roomCount * nights)
                      }
                    }, 0)
                    return (totalRevenue - totalCost) >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-yellow-50 border-yellow-200'
                  })()
                  }`}>
                  <p className={`text-sm font-semibold ${(() => {
                      const totalRevenue = rooms.reduce((sum, room) => {
                        if (room.hasPricingPeriods && room.pricingPeriods) {
                          return sum + room.pricingPeriods.reduce((periodSum, period) =>
                            periodSum + (period.subtotal * room.roomCount), 0)
                        } else {
                          const nights = calculateNights()
                          return sum + (room.unitPrice * room.roomCount * nights)
                        }
                      }, 0)
                      const totalCost = rooms.reduce((sum, room) => {
                        if (room.hasPricingPeriods && room.pricingPeriods) {
                          return sum + room.pricingPeriods.reduce((periodSum, period) =>
                            periodSum + ((period.hotelCostPrice || 0) * room.roomCount), 0)
                        } else {
                          const nights = calculateNights()
                          return sum + ((room.hotelCostPrice || 0) * room.roomCount * nights)
                        }
                      }, 0)
                      return (totalRevenue - totalCost) >= 0 ? 'text-blue-800' : 'text-yellow-800'
                    })()
                    }`}>
                    <SARAmount amount={(() => {
                      const totalRevenue = rooms.reduce((sum, room) => {
                        if (room.hasPricingPeriods && room.pricingPeriods) {
                          return sum + room.pricingPeriods.reduce((periodSum, period) =>
                            periodSum + (period.subtotal * room.roomCount), 0)
                        } else {
                          const nights = calculateNights()
                          return sum + (room.unitPrice * room.roomCount * nights)
                        }
                      }, 0)
                      const totalCost = rooms.reduce((sum, room) => {
                        if (room.hasPricingPeriods && room.pricingPeriods) {
                          return sum + room.pricingPeriods.reduce((periodSum, period) =>
                            periodSum + ((period.hotelCostPrice || 0) * room.roomCount), 0)
                        } else {
                          const nights = calculateNights()
                          return sum + ((room.hotelCostPrice || 0) * room.roomCount * nights)
                        }
                      }, 0)
                      return totalRevenue - totalCost
                    })()} />
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Payment */}
          <Card className="p-6">
            <div className="flex items-center space-x-2 mb-6">
              <SaudiRiyalIcon size={16} className="text-yellow-600" />
              <h3 className="text-lg font-semibold">Payment</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method
                </label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) => handleInputChange('paymentMethod', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No payment now</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="deposit">Deposit</option>
                  <option value="cash">Cash</option>
                </select>
              </div>

              {formData.paymentMethod && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Amount (SAR) {formData.paymentMethod ? '*' : ''}
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.paymentAmount}
                    onChange={(e) => handleInputChange('paymentAmount', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className={errors.paymentAmount ? "border-red-500" : ""}
                  />
                  {errors.paymentAmount && (
                    <p className="text-red-500 text-sm mt-1">{errors.paymentAmount}</p>
                  )}
                  {formData.paymentMethod === 'deposit' && (
                    <p className="text-xs text-gray-500 mt-1">
                      Deposit usage will be validated on server. If sufficient, deposit will be deducted to pay this booking. Partial usage is allowed.
                    </p>
                  )}
                  {(formData.paymentMethod === 'bank_transfer' || formData.paymentMethod === 'cash') && (
                    <p className="text-xs text-gray-500 mt-1">
                      If amount exceeds total, the surplus will be credited to the client's deposit automatically.
                    </p>
                  )}
                </div>
              )}
            </div>

            {(formData.paymentMethod === 'bank_transfer' || formData.paymentMethod === 'cash') && formData.paymentAmount > formData.totalAmount && (
              <div className="mt-4 bg-blue-50 border border-blue-200 p-3 rounded">
                <p className="text-sm text-blue-800">
                  Surplus to deposit: SAR {(formData.paymentAmount - formData.totalAmount).toFixed(2)}
                </p>
              </div>
            )}
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
    </>
  )
}
