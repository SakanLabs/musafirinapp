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
  CalendarDays,
  Sparkles,
  Layers,
  ShieldCheck,
  TrendingUp
} from "lucide-react"
import { authService } from "@/lib/auth"
import { useCreateBooking, type CreateBookingData, type CreateBookingRoomItem, type PricingPeriod } from "@/lib/queries/bookings"
import { useClients } from "@/lib/queries"
import { useHotels, useHotelPricing } from "@/lib/queries/master"
import { formatCurrency } from "@/lib/utils"

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
    if (formData.guestEmail.trim() && !/\S+@\S+\.\S+/.test(formData.guestEmail)) {
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
      toast.success('Pemesanan hotel baru berhasil disimpan!')
    } catch (error) {
      console.error("Failed to create booking:", error)
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

    if (field === 'startDate' || field === 'endDate') {
      (period as any)[field] = value as string
    } else {
      (period as any)[field] = Number(value)
    }

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
    <PageLayout
      title="Create New Booking"
      subtitle="Input client credentials, lodging slices, and invoice rates."
      actions={
        <Button
          variant="outline"
          onClick={() => navigate({ to: "/bookings" })}
          className="text-xs h-9 border-[#e5e7eb] hover:bg-gray-50 text-[#374151] font-semibold"
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1" />
          Cancel
        </Button>
      }
    >
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-8 pb-20 text-xs font-semibold text-gray-700">
        {/* Guest Information */}
        <Card className="p-4 md:p-6 border border-[#e5e7eb] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] bg-white">
          <div className="flex items-center space-x-2 mb-6">
            <Users className="h-4.5 w-4.5 text-[#111111]" />
            <h3 className="text-sm font-bold text-[#111111] tracking-[-0.02em]">Guest Information</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:p-6">
            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-xs font-semibold text-gray-500">Client CRM Lookup</label>
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <select
                  value={selectedClientId}
                  onChange={(e) => handleClientSelection(e.target.value)}
                  className="flex-1 h-9 px-3 border border-[#e5e7eb] rounded-md bg-white text-xs font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#111111] focus-visible:border-[#111111]"
                  disabled={isClientsLoading && clients.length === 0}
                >
                  <option value="">
                    {isClientsLoading && clients.length === 0
                      ? "Loading clients..."
                      : "-- Select Existing CRM Client --"}
                  </option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id.toString()}>
                      {client.name} ({client.email || 'No email'})
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  className="text-xs h-9 px-4 border-[#e5e7eb] hover:bg-gray-50 text-[#374151]"
                  onClick={() => navigate({ to: "/clients", search: { redirectTo: "/create-booking" } })}
                >
                  New Client
                </Button>
              </div>
              {errors.client && (
                <p className="text-red-500 text-xs mt-1">{errors.client}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-500">Guest Name *</label>
              <Input
                value={formData.guestName}
                onChange={(e) => handleInputChange('guestName', e.target.value)}
                placeholder="Full Name"
                className={`h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111] bg-white ${errors.guestName ? "border-red-500" : ""}`}
              />
              {errors.guestName && (
                <p className="text-red-500 text-xs mt-1">{errors.guestName}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-500">Email Address (Optional)</label>
              <Input
                type="email"
                value={formData.guestEmail}
                onChange={(e) => handleInputChange('guestEmail', e.target.value)}
                placeholder="guest@domain.com"
                className={`h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111] bg-white ${errors.guestEmail ? "border-red-500" : ""}`}
              />
              {errors.guestEmail && (
                <p className="text-red-500 text-xs mt-1">{errors.guestEmail}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-500">WhatsApp Phone *</label>
              <Input
                value={formData.guestPhone}
                onChange={(e) => handleInputChange('guestPhone', e.target.value)}
                placeholder="08123456789"
                className={`h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111] bg-white ${errors.guestPhone ? "border-red-500" : ""}`}
              />
              {errors.guestPhone && (
                <p className="text-red-500 text-xs mt-1">{errors.guestPhone}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-500">Total Guests *</label>
              <Input
                type="number"
                min="1"
                value={formData.numberOfGuests}
                onChange={(e) => handleInputChange('numberOfGuests', parseInt(e.target.value) || 1)}
                className={`h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111] bg-white ${errors.numberOfGuests ? "border-red-500" : ""}`}
              />
              {errors.numberOfGuests && (
                <p className="text-red-500 text-xs mt-1">{errors.numberOfGuests}</p>
              )}
            </div>
          </div>
        </Card>

        {/* Hotel Information */}
        <Card className="p-4 md:p-6 border border-[#e5e7eb] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] bg-white">
          <div className="flex items-center space-x-2 mb-6">
            <MapPin className="h-4.5 w-4.5 text-[#111111]" />
            <h3 className="text-sm font-bold text-[#111111] tracking-[-0.02em]">Hotel Information</h3>
          </div>

          {/* Master Hotel Selection in Surface Card style */}
          <div className="mb-6 bg-[#f5f5f5] border border-[#e5e7eb]/60 p-5 rounded-lg space-y-2">
            <label className="block text-xs font-bold text-[#111111]">
              Auto-select from Master Registry
            </label>
            <select
              value={selectedMasterHotelId}
              onChange={(e) => handleMasterHotelSelection(e.target.value)}
              className="w-full h-9 px-3 border border-[#e5e7eb] rounded-md bg-white text-xs font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#111111]"
              disabled={isHotelsLoading}
            >
              <option value="">-- Custom Manual Entry --</option>
              {masterHotels.map(hotel => (
                <option key={hotel.id} value={hotel.id.toString()}>
                  {hotel.name} ({hotel.city}) {hotel.starRating ? ` - ${hotel.starRating} Stars` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:p-6">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-500">Hotel Name *</label>
              <Input
                value={formData.hotelName}
                onChange={(e) => handleInputChange('hotelName', e.target.value)}
                placeholder="Hotel Name"
                className={`h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111] bg-white ${errors.hotelName ? "border-red-500" : ""}`}
              />
              {errors.hotelName && (
                <p className="text-red-500 text-xs mt-1">{errors.hotelName}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-500">City *</label>
              <select
                value={formData.city}
                onChange={(e) => handleInputChange('city', e.target.value)}
                className={`w-full h-9 px-3 border border-gray-300 rounded-md bg-white text-xs font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#111111] ${errors.city ? "border-red-500" : ""}`}
              >
                <option value="">Select City</option>
                <option value="Makkah">Makkah</option>
                <option value="Madinah">Madinah</option>
              </select>
              {errors.city && (
                <p className="text-red-500 text-xs mt-1">{errors.city}</p>
              )}
            </div>
          </div>
        </Card>

        {/* Lodging & Slices */}
        <Card className="p-4 md:p-6 border border-[#e5e7eb] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] bg-white">
          <div className="flex items-center space-x-2 mb-6">
            <Calendar className="h-4.5 w-4.5 text-[#111111]" />
            <h3 className="text-sm font-bold text-[#111111] tracking-[-0.02em]">Lodging & Slices</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:p-6">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-500 font-sans">Check-in Date *</label>
              <Input
                type="date"
                value={formData.checkInDate}
                onChange={(e) => handleInputChange('checkInDate', e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className={`h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111] bg-white ${errors.checkInDate ? "border-red-500" : ""}`}
              />
              {errors.checkInDate && (
                <p className="text-red-500 text-xs mt-1">{errors.checkInDate}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-500 font-sans">Check-out Date *</label>
              <Input
                type="date"
                value={formData.checkOutDate}
                onChange={(e) => handleInputChange('checkOutDate', e.target.value)}
                min={formData.checkInDate || new Date().toISOString().split('T')[0]}
                className={`h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111] bg-white ${errors.checkOutDate ? "border-red-500" : ""}`}
              />
              {errors.checkOutDate && (
                <p className="text-red-500 text-xs mt-1">{errors.checkOutDate}</p>
              )}
            </div>

            <div className="md:col-span-2 space-y-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-[#111111]">Rooms Specification *</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addRoom}
                  className="text-xs h-8 border-[#e5e7eb] hover:bg-gray-50 text-[#374151]"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  <span>Add Room</span>
                </Button>
              </div>

              {/* Room list slices */}
              <div className="space-y-4">
                {rooms.map((room, index) => (
                  <div key={index} className="border border-[#e5e7eb] rounded-xl p-5 bg-[#f5f5f5] space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-[#111111]">Room Slice #{index + 1}</h4>
                      {rooms.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeRoom(index)}
                          className="h-8 border-[#fee2e2] text-red-600 hover:text-red-700 hover:bg-[#fef2f2]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Room Type *</label>
                        {availableRoomTypes.length > 0 ? (
                          <select
                            value={room.roomType}
                            title="Select Room Type"
                            onChange={(e) => updateRoom(index, 'roomType', e.target.value)}
                            className={`w-full h-9 px-3 border rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#111111] bg-white text-xs font-semibold ${errors[`room_${index}_type`] ? "border-red-500" : "border-[#e5e7eb]"}`}
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
                            placeholder="e.g. Deluxe Twin"
                            className={`h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111] bg-white text-xs ${errors[`room_${index}_type`] ? "border-red-500" : ""}`}
                          />
                        )}
                        {errors[`room_${index}_type`] && (
                          <p className="text-red-500 text-[10px] mt-1">{errors[`room_${index}_type`]}</p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Rooms Count *</label>
                        <Input
                          type="number"
                          min="1"
                          value={room.roomCount}
                          onChange={(e) => updateRoom(index, 'roomCount', parseInt(e.target.value) || 1)}
                          className={`h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111] bg-white text-xs ${errors[`room_${index}_count`] ? "border-red-500" : ""}`}
                        />
                        {errors[`room_${index}_count`] && (
                          <p className="text-red-500 text-[10px] mt-1">{errors[`room_${index}_count`]}</p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Unit Price (SAR) *</label>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={room.unitPrice}
                          onChange={(e) => updateRoom(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className={`h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111] bg-white text-xs ${errors[`room_${index}_price`] ? "border-red-500" : ""}`}
                        />
                        {errors[`room_${index}_price`] && (
                          <p className="text-red-500 text-[10px] mt-1">{errors[`room_${index}_price`]}</p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Hotel Cost (SAR)</label>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={room.hotelCostPrice || 0}
                          onChange={(e) => updateRoom(index, 'hotelCostPrice', parseFloat(e.target.value) || 0)}
                          className={`h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111] bg-white text-xs ${errors[`room_${index}_cost`] ? "border-red-500" : ""}`}
                        />
                        {errors[`room_${index}_cost`] && (
                          <p className="text-red-500 text-[10px] mt-1">{errors[`room_${index}_cost`]}</p>
                        )}
                      </div>
                    </div>

                    {/* Auto-Fill Trigger inside the room card */}
                    {selectedMasterHotelId && hotelPricingPeriods.length > 0 && (
                      <div className="mt-3 flex justify-end">
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          onClick={() => autoFillRoomPricing(index)} 
                          className="text-[11px] h-8 bg-white border-[#e5e7eb] text-[#111111] font-bold hover:bg-gray-50 flex items-center gap-1.5 rounded-md"
                        >
                          <Sparkles className="h-3 w-3 text-orange-400" />
                          Auto-Fill from Master Registry
                        </Button>
                      </div>
                    )}

                    {/* Pricing Periods breakdown list */}
                    <div className="mt-4 pt-3 border-t border-[#e5e7eb]">
                      <div className="flex items-center justify-between mb-3 select-none">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={room.hasPricingPeriods || false}
                            onChange={(e) => updateRoom(index, 'hasPricingPeriods', e.target.checked)}
                            className="rounded border-[#e5e7eb] text-[#111111] focus:ring-[#111111]"
                          />
                          <span className="text-xs font-semibold text-[#111111]">
                            Enable Multiple Seasonal Pricing Periods
                          </span>
                        </label>
                        <CalendarDays className="h-4 w-4 text-gray-400" />
                      </div>

                      {room.hasPricingPeriods && room.pricingPeriods && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-[11px] text-gray-400 font-semibold select-none">
                            <span>Adjust specific price slots for dates:</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addPricingPeriod(index)}
                              className="text-[10px] h-7 border-[#e5e7eb] hover:bg-gray-50 text-[#374151]"
                            >
                              <Plus className="h-3 w-3 mr-0.5" /> Add Slot
                            </Button>
                          </div>

                          {room.pricingPeriods.map((period, periodIndex) => (
                            <div key={periodIndex} className="bg-white border border-[#e5e7eb] rounded-lg p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Period Slot #{periodIndex + 1}</span>
                                {room.pricingPeriods!.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => removePricingPeriod(index, periodIndex)}
                                    className="h-6 w-6 p-0 border-[#fee2e2] text-red-500 hover:bg-[#fef2f2]"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                <div className="space-y-1">
                                  <label className="block text-[9px] font-semibold text-gray-400 uppercase">Start Date</label>
                                  <Input
                                    type="date"
                                    value={period.startDate}
                                    onChange={(e) => updatePricingPeriod(index, periodIndex, 'startDate', e.target.value)}
                                    min={formData.checkInDate}
                                    max={formData.checkOutDate}
                                    className="text-xs h-8 border-[#e5e7eb] bg-white rounded"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="block text-[9px] font-semibold text-gray-400 uppercase">End Date</label>
                                  <Input
                                    type="date"
                                    value={period.endDate}
                                    onChange={(e) => updatePricingPeriod(index, periodIndex, 'endDate', e.target.value)}
                                    min={period.startDate}
                                    max={formData.checkOutDate}
                                    className="text-xs h-8 border-[#e5e7eb] bg-white rounded"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="block text-[9px] font-semibold text-gray-400 uppercase">Nights</label>
                                  <Input
                                    type="number"
                                    value={period.nights}
                                    readOnly
                                    className="text-xs h-8 border-[#e5e7eb] bg-[#f8f9fa] rounded cursor-not-allowed text-gray-400"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="block text-[9px] font-semibold text-gray-400 uppercase">Price/Night</label>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={period.unitPrice}
                                    onChange={(e) => updatePricingPeriod(index, periodIndex, 'unitPrice', parseFloat(e.target.value) || 0)}
                                    className="text-xs h-8 border-[#e5e7eb] bg-white rounded"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="block text-[9px] font-semibold text-gray-400 uppercase">Hotel Cost</label>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={period.hotelCostPrice || 0}
                                    onChange={(e) => updatePricingPeriod(index, periodIndex, 'hotelCostPrice', parseFloat(e.target.value) || 0)}
                                    className="text-xs h-8 border-[#e5e7eb] bg-white rounded"
                                  />
                                </div>
                              </div>

                              <div className="text-right text-[11px] font-bold text-[#111111] pt-1">
                                Subtotal Slot: {formatCurrency((period.subtotal * room.roomCount).toString(), 'SAR')}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Room Subtotal */}
                    <div className="text-right text-xs font-bold text-[#111111] pt-1 border-t border-[#e5e7eb]/40">
                      Room Total: {formatCurrency((room.hasPricingPeriods && room.pricingPeriods
                        ? room.pricingPeriods.reduce((sum, period) => sum + period.subtotal, 0) * room.roomCount
                        : room.unitPrice * room.roomCount * calculateNights()).toString(), 'SAR')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 pt-4">
              <label className="block text-xs font-semibold text-gray-500">Meal Plan *</label>
              <select
                value={formData.mealPlan}
                onChange={(e) => handleInputChange('mealPlan', e.target.value)}
                className={`w-full h-9 px-3 border rounded-md bg-white text-xs font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#111111] ${errors.mealPlan ? 'border-red-500' : 'border-gray-300'}`}
              >
                <option value="">Select Meal Plan</option>
                <option value="Breakfast">Breakfast</option>
                <option value="Half Board">Half Board</option>
                <option value="Full Board">Full Board</option>
                <option value="Room Only">Room Only</option>
              </select>
              {errors.mealPlan && (
                <p className="text-red-500 text-xs mt-1">{errors.mealPlan}</p>
              )}
            </div>

            <div className="space-y-1.5 pt-4">
              <label className="block text-xs font-semibold text-gray-500 font-sans">Duration of Stay</label>
              <div className="bg-[#f5f5f5] p-2.5 rounded-md border border-gray-200/40">
                <span className="text-[#111111] font-bold text-xs">
                  {calculateNights()} Nights
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Pricing Summary */}
        <Card className="p-4 md:p-6 border border-[#e5e7eb] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] bg-white">
          <div className="flex items-center space-x-2 mb-6">
            <Layers className="h-4.5 w-4.5 text-[#111111]" />
            <h3 className="text-sm font-bold text-[#111111] tracking-[-0.02em]">Pricing Summary</h3>
          </div>

          <div className="space-y-6">
            {/* Monochromatic Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:p-6">
              <div className="p-4 bg-[#f8f9fa] rounded-lg border border-[#e5e7eb]">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Rooms</span>
                <p className="text-base font-bold text-[#111111] mt-1">
                  {rooms.reduce((sum, room) => sum + room.roomCount, 0)} Rooms
                </p>
              </div>

              <div className="p-4 bg-[#f8f9fa] rounded-lg border border-[#e5e7eb]">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Accrued Revenue</span>
                <p className="text-base font-bold text-[#111111] mt-1">
                  {formatCurrency(rooms.reduce((sum, room) => {
                    if (room.hasPricingPeriods && room.pricingPeriods) {
                      return sum + room.pricingPeriods.reduce((periodSum, period) =>
                        periodSum + (period.subtotal * room.roomCount), 0)
                    } else {
                      const nights = calculateNights()
                      return sum + (room.unitPrice * room.roomCount * nights)
                    }
                  }, 0).toString(), 'SAR')}
                </p>
              </div>

              <div className="p-4 bg-[#f8f9fa] rounded-lg border border-[#e5e7eb]">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Sourced Cost</span>
                <p className="text-base font-bold text-[#111111] mt-1">
                  {formatCurrency(rooms.reduce((sum, room) => {
                    if (room.hasPricingPeriods && room.pricingPeriods) {
                      return sum + room.pricingPeriods.reduce((periodSum, period) =>
                        periodSum + ((period.hotelCostPrice || 0) * room.roomCount), 0)
                    } else {
                      const nights = calculateNights()
                      return sum + ((room.hotelCostPrice || 0) * room.roomCount * nights)
                    }
                  }, 0).toString(), 'SAR')}
                </p>
              </div>
            </div>

            {/* Estimated Net Profit split */}
            <div className="p-4 bg-[#f5f5f5] rounded-lg border border-[#e5e7eb] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#111111]" />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Estimated Profit Margin</span>
              </div>
              <span className="text-sm font-bold text-[#111111]">
                {formatCurrency((rooms.reduce((sum, room) => {
                  if (room.hasPricingPeriods && room.pricingPeriods) {
                    return sum + room.pricingPeriods.reduce((periodSum, period) =>
                      periodSum + (period.subtotal * room.roomCount), 0)
                  } else {
                    const nights = calculateNights()
                    return sum + (room.unitPrice * room.roomCount * nights)
                  }
                }, 0) - rooms.reduce((sum, room) => {
                  if (room.hasPricingPeriods && room.pricingPeriods) {
                    return sum + room.pricingPeriods.reduce((periodSum, period) =>
                      periodSum + ((period.hotelCostPrice || 0) * room.roomCount), 0)
                  } else {
                    const nights = calculateNights()
                    return sum + ((room.hotelCostPrice || 0) * room.roomCount * nights)
                  }
                }, 0)).toString(), 'SAR')}
              </span>
            </div>
          </div>
        </Card>

        {/* Immediate Payments */}
        <Card className="p-4 md:p-6 border border-[#e5e7eb] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] bg-white">
          <div className="flex items-center space-x-2 mb-6">
            <ShieldCheck className="h-4.5 w-4.5 text-[#111111]" />
            <h3 className="text-sm font-bold text-[#111111] tracking-[-0.02em]">Immediate Payments</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:p-6">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-500">Payment Gateway Method</label>
              <select
                value={formData.paymentMethod}
                onChange={(e) => handleInputChange('paymentMethod', e.target.value)}
                className="w-full h-9 px-3 border border-gray-300 rounded-md bg-white text-xs font-semibold focus-visible:outline-none focus-visible:ring-1"
              >
                <option value="">No payment record now</option>
                <option value="bank_transfer">Bank Transfer (Giro)</option>
                <option value="deposit">Client CRM Deposit</option>
                <option value="cash">Cash (Manual)</option>
              </select>
            </div>

            {formData.paymentMethod && (
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-500">Payment Amount (SAR) *</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.paymentAmount}
                  onChange={(e) => handleInputChange('paymentAmount', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className={`h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111] bg-white ${errors.paymentAmount ? "border-red-500" : ""}`}
                />
                {errors.paymentAmount && (
                  <p className="text-red-500 text-xs mt-1">{errors.paymentAmount}</p>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Special Requests */}
        <Card className="p-4 md:p-6 border border-[#e5e7eb] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] bg-white">
          <div className="flex items-center space-x-2 mb-6">
            <MapPin className="h-4.5 w-4.5 text-[#111111]" />
            <h3 className="text-sm font-bold text-[#111111] tracking-[-0.02em]">Additional Notes</h3>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-500">Special Instructions / Requests</label>
            <textarea
              value={formData.specialRequests}
              onChange={(e) => handleInputChange('specialRequests', e.target.value)}
              placeholder="Input diet requests, high floor preferences, etc..."
              rows={3}
              className={`flex min-h-[70px] w-full rounded-md border border-[#e5e7eb] bg-transparent px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#111111] focus-visible:border-[#111111]`}
            />
          </div>
        </Card>

        {/* Action Panel Buttons */}
        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: "/bookings" })}
            className="text-xs h-9 border-[#e5e7eb] text-gray-600 font-semibold px-4"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createBookingMutation.isPending}
            className="bg-[#111111] hover:bg-[#242424] text-white text-xs h-9 px-6 rounded-md transition-all font-semibold shadow-xs"
          >
            {createBookingMutation.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5 mr-1.5" />
                Save Booking
              </>
            )}
          </Button>
        </div>
      </form>
    </PageLayout>
  )
}
