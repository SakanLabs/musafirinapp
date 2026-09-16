import { createFileRoute, redirect, Link, useNavigate } from "@tanstack/react-router"
import { useState, useMemo } from "react"
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
  Users,
  Loader2,
  Building,
  Search,
  Filter,
  X,
  CheckCircle2,
  Clock,
  CreditCard,
  Building2
} from "lucide-react"
import { SARCurrency } from "@/components/ui/sar-currency"
import { authService } from "@/lib/auth"
import {
  formatCurrency,
  formatDate,
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
  const navigate = useNavigate()
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

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState("")
  const [bookingStatusFilter, setBookingStatusFilter] = useState("all")
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all")
  const [cityFilter, setCityFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState("")

  // Fetch bookings using TanStack Query
  const { data: bookings = [], isLoading, error } = useBookings()
  const createBookingMutation = useCreateBooking()

  // Available unique cities
  const availableCities = useMemo(() => {
    const set = new Set<string>()
    bookings.forEach(b => {
      if (b.city && b.city.trim()) set.add(b.city.trim())
    })
    return Array.from(set).sort()
  }, [bookings])

  // Active filters check
  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
    bookingStatusFilter !== "all" ||
    paymentStatusFilter !== "all" ||
    cityFilter !== "all" ||
    dateFilter
  )

  const clearFilters = () => {
    setSearchQuery("")
    setBookingStatusFilter("all")
    setPaymentStatusFilter("all")
    setCityFilter("all")
    setDateFilter("")
  }

  // Filtered bookings
  const filteredBookings = useMemo(() => {
    return bookings.filter(booking => {
      // 1. Text Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const idStr = booking.id.toString()
        const idMatch = `#${idStr}`.includes(q) || idStr.includes(q)
        const codeMatch = booking.code ? booking.code.toLowerCase().includes(q) : false
        const clientMatch = booking.clientName ? booking.clientName.toLowerCase().includes(q) : false
        const emailMatch = booking.clientEmail ? booking.clientEmail.toLowerCase().includes(q) : false
        const phoneMatch = booking.clientPhone ? booking.clientPhone.toLowerCase().includes(q) : false
        const hotelMatch = booking.hotelName ? booking.hotelName.toLowerCase().includes(q) : false
        const cityMatch = booking.city ? booking.city.toLowerCase().includes(q) : false
        const confirmMatch = booking.hotelConfirmationNo ? booking.hotelConfirmationNo.toLowerCase().includes(q) : false
        const roomTypeMatch = booking.items?.some(item => item.roomType?.toLowerCase().includes(q)) || false

        if (!idMatch && !codeMatch && !clientMatch && !emailMatch && !phoneMatch && !hotelMatch && !cityMatch && !confirmMatch && !roomTypeMatch) {
          return false
        }
      }

      // 2. Booking Status
      if (bookingStatusFilter !== "all") {
        if (booking.bookingStatus?.toLowerCase() !== bookingStatusFilter.toLowerCase()) {
          return false
        }
      }

      // 3. Payment Status
      if (paymentStatusFilter !== "all") {
        if (booking.paymentStatus?.toLowerCase() !== paymentStatusFilter.toLowerCase()) {
          return false
        }
      }

      // 4. City
      if (cityFilter !== "all") {
        if (booking.city?.toLowerCase() !== cityFilter.toLowerCase()) {
          return false
        }
      }

      // 5. Check-in Date
      if (dateFilter) {
        if (!booking.checkIn || !booking.checkIn.startsWith(dateFilter)) {
          return false
        }
      }

      return true
    })
  }, [bookings, searchQuery, bookingStatusFilter, paymentStatusFilter, cityFilter, dateFilter])

  // Stats calculation
  const totalBookings = bookings.length
  const confirmedBookings = useMemo(() => bookings.filter(b => b.bookingStatus?.toLowerCase() === 'confirmed').length, [bookings])
  const pendingBookings = useMemo(() => bookings.filter(b => b.bookingStatus?.toLowerCase() === 'pending').length, [bookings])
  const totalRevenue = useMemo(() => bookings.filter(b => b.bookingStatus?.toLowerCase() === 'confirmed').reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0), [bookings])

  // Define columns for bookings table
  const bookingColumns: Column<Booking>[] = [
    {
      key: 'id',
      header: 'ID / Kode',
      sortable: true,
      width: 'w-24',
      render: (booking) => (
        <div>
          <span className="font-mono text-xs font-bold text-[#111111]">
            #{booking.id}
          </span>
          {booking.code && (
            <div className="font-mono text-[10px] text-zinc-500 font-medium tracking-tight">
              {booking.code}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'clientName',
      header: 'Guest / Client',
      sortable: true,
      render: (booking) => (
        <div>
          <div className="font-semibold text-[#111111] text-sm">{booking.clientName || 'N/A Guest'}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">{booking.clientPhone || 'No WhatsApp'}</div>
        </div>
      )
    },
    {
      key: 'hotelName',
      header: 'Hotel Details',
      sortable: true,
      render: (booking) => (
        <div>
          <div className="font-medium text-[#374151] text-xs flex items-center gap-1.5">
            <Building className="h-3 w-3 text-gray-400 shrink-0" />
            {booking.hotelName}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">{booking.city}</div>
        </div>
      )
    },
    {
      key: 'roomType',
      header: 'Room Type',
      render: (booking) => {
        const roomTypes = booking.items?.map((item) => item.roomType).filter(Boolean) ?? [];
        return (
          <span className="text-xs text-[#374151] font-medium bg-gray-50 border border-gray-200/50 px-2 py-0.5 rounded">
            {roomTypes.length > 0 ? roomTypes.join(', ') : 'N/A Room'}
          </span>
        );
      },
      sortable: true
    },
    {
      key: 'mealPlan',
      header: 'Meal Plan',
      render: (booking) => (
        <span className="text-xs text-gray-500 font-medium">{booking.mealPlan}</span>
      ),
      sortable: true,
      width: 'w-24'
    },
    {
      key: 'checkIn',
      header: 'Check-in',
      render: (booking) => (
        <span className="text-xs font-semibold text-[#374151] bg-[#f8f9fa] border border-[#e5e7eb] px-2 py-0.5 rounded-md">
          {formatDate(booking.checkIn)}
        </span>
      ),
      sortable: true,
      width: 'w-24'
    },
    {
      key: 'checkOut',
      header: 'Check-out',
      render: (booking) => (
        <span className="text-xs font-semibold text-[#374151] bg-[#f8f9fa] border border-[#e5e7eb] px-2 py-0.5 rounded-md">
          {formatDate(booking.checkOut)}
        </span>
      ),
      sortable: true,
      width: 'w-24'
    },
    {
      key: 'totalAmount',
      header: 'Total Rates',
      render: (booking) => (
        <span className="font-bold text-sm text-[#111111] tracking-[-0.02em]">
          {formatCurrency(booking.totalAmount.toString(), 'SAR')}
        </span>
      ),
      sortable: true,
      width: 'w-24'
    },
    {
      key: 'bookingStatus',
      header: 'Status',
      render: (booking) => {
        const rawStatus = booking.bookingStatus?.toLowerCase() || 'pending';
        let variantColor = "bg-[#f3f4f6] text-gray-800 border-gray-200";
        if (rawStatus === 'confirmed') variantColor = "bg-[#ecfdf5] text-[#047857] border-[#d1fae5]";
        if (rawStatus === 'pending') variantColor = "bg-[#fffbeb] text-[#d97706] border-[#fef3c7]";
        if (rawStatus === 'cancelled') variantColor = "bg-[#fef2f2] text-[#b91c1c] border-[#fee2e2]";
        if (rawStatus === 'completed') variantColor = "bg-[#eff6ff] text-[#1d4ed8] border-[#dbeafe]";

        const rawPay = booking.paymentStatus?.toLowerCase();
        let payColor = "bg-zinc-50 text-zinc-600 border-zinc-200";
        if (rawPay === 'paid') payColor = "bg-emerald-50 text-emerald-700 border-emerald-200/60";
        if (rawPay === 'partial') payColor = "bg-amber-50 text-amber-700 border-amber-200/60";
        if (rawPay === 'unpaid') payColor = "bg-rose-50 text-rose-700 border-rose-200/60";
        if (rawPay === 'overdue') payColor = "bg-red-50 text-red-700 border-red-200/60";

        return (
          <div className="flex flex-col gap-1 items-start">
            <Badge className={`text-[10px] px-2 py-0.5 rounded font-semibold border ${variantColor} capitalize shadow-none`}>
              {booking.bookingStatus}
            </Badge>
            {booking.paymentStatus && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${payColor}`}>
                {booking.paymentStatus}
              </span>
            )}
          </div>
        )
      },
      sortable: true,
      width: 'w-24'
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (booking) => (
        <div className="flex space-x-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate({ to: "/booking-detail", search: { id: booking.id.toString() } })}
            title="Lihat Detail Booking"
            className="h-8 w-8 p-0 rounded-full border border-transparent hover:border-[#e5e7eb] hover:bg-[#f8f9fa] transition-all flex items-center justify-center"
          >
            <Eye className="h-3.5 w-3.5 text-[#374151]" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleShareWhatsApp(booking)}
            title="Share ke WhatsApp"
            className="h-8 w-8 p-0 rounded-full border border-transparent hover:border-[#e5e7eb] hover:bg-[#f8f9fa] transition-all flex items-center justify-center text-[#10b981]"
          >
            <Share className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
      width: 'w-20'
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
        rooms: [{
          roomType: formData.roomType,
          roomCount: 1,
          unitPrice: formData.totalAmount,
          hotelCostPrice: 0
        }],
        mealPlan: 'Room Only',
        numberOfGuests: formData.numberOfGuests,
        totalAmount: formData.totalAmount,
        specialRequests: formData.specialRequests || undefined,
        // Legacy fields for backward compatibility
        roomType: formData.roomType
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
      <PageLayout title="Bookings" subtitle="Hotel reservations registry">
        <div className="flex flex-col items-center justify-center h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-[#111111] mb-3" />
          <span className="text-sm font-medium text-gray-500">Retrieving active reservations...</span>
        </div>
      </PageLayout>
    )
  }

  if (error) {
    return (
      <PageLayout title="Bookings" subtitle="Hotel reservations registry">
        <div className="text-center text-red-600 p-8">
          Error loading bookings: {error.message}
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="Bookings"
      subtitle="Hotel reservations registry and check-in statuses."
      actions={
        <Link to="/create-booking">
          <Button className="bg-[#111111] hover:bg-[#242424] text-white text-xs font-semibold px-4 h-9 rounded-md transition-all shadow-none flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Create Booking
          </Button>
        </Link>
      }
    >
      <div className="w-full pb-12">
        {/* Summary Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="border border-[#e5e7eb] rounded-xl bg-white p-5 shadow-none hover:border-[#111111]/30 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Total Bookings</p>
                <p className="text-2xl font-bold text-[#111111] tracking-tight">{totalBookings}</p>
              </div>
              <div className="bg-zinc-50 p-2 rounded-lg border border-zinc-200/40">
                <Calendar className="h-5 w-5 text-zinc-700" />
              </div>
            </div>
          </div>

          <div className="border border-[#e5e7eb] rounded-xl bg-white p-5 shadow-none hover:border-[#111111]/30 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Confirmed</p>
                <p className="text-2xl font-bold text-emerald-600 tracking-tight">{confirmedBookings}</p>
              </div>
              <div className="bg-emerald-50/60 p-2 rounded-lg border border-emerald-100">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="border border-[#e5e7eb] rounded-xl bg-white p-5 shadow-none hover:border-[#111111]/30 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Pending</p>
                <p className="text-2xl font-bold text-amber-600 tracking-tight">{pendingBookings}</p>
              </div>
              <div className="bg-amber-50/60 p-2 rounded-lg border border-amber-100">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </div>

          <div className="border border-[#e5e7eb] rounded-xl bg-white p-5 shadow-none hover:border-[#111111]/30 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Total Nilai (SAR)</p>
                <p className="text-2xl font-bold text-[#111111] tracking-tight">
                  {formatCurrency(totalRevenue.toString(), 'SAR')}
                </p>
              </div>
              <div className="bg-zinc-50 p-2 rounded-lg border border-zinc-200/40">
                <CreditCard className="h-5 w-5 text-zinc-700" />
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="border border-[#e5e7eb] rounded-xl bg-white p-4 mb-4 shadow-none">
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
            {/* Search Input */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
              <Input
                placeholder="Cari ID, kode booking, nama tamu, no. telepon, hotel, kamar..."
                className="pl-9 h-10 border-[#e5e7eb] rounded-lg bg-white text-sm focus-visible:ring-0 focus-visible:border-[#111111] shadow-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
              {/* Booking Status Filter */}
              <select
                value={bookingStatusFilter}
                onChange={(e) => setBookingStatusFilter(e.target.value)}
                className="h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-xs font-medium text-zinc-700 focus:outline-none focus:border-[#111111] transition-colors"
                title="Filter Status Booking"
              >
                <option value="all">Status: Semua</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>

              {/* Payment Status Filter */}
              <select
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value)}
                className="h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-xs font-medium text-zinc-700 focus:outline-none focus:border-[#111111] transition-colors"
                title="Filter Status Pembayaran"
              >
                <option value="all">Bayar: Semua</option>
                <option value="unpaid">Unpaid</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>

              {/* City Filter */}
              {availableCities.length > 0 && (
                <select
                  value={cityFilter}
                  onChange={(e) => setCityFilter(e.target.value)}
                  className="h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-xs font-medium text-zinc-700 focus:outline-none focus:border-[#111111] transition-colors"
                  title="Filter Kota"
                >
                  <option value="all">Kota: Semua</option>
                  {availableCities.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              )}

              {/* Date Filter (Check-in) */}
              <div className="relative">
                <Input
                  type="date"
                  title="Filter Tanggal Check-in"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-xs font-medium text-zinc-700 focus-visible:ring-0 focus-visible:border-[#111111] shadow-none"
                />
              </div>

              {/* Reset Filter Button */}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  onClick={clearFilters}
                  className="h-10 px-3 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 text-xs font-semibold rounded-lg flex items-center shadow-none"
                  title="Reset Filter"
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Reset
                </Button>
              )}
            </div>
          </div>

          {/* Results count indicator */}
          <div className="mt-3 pt-3 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
            <div>
              Menampilkan <span className="font-semibold text-zinc-900">{filteredBookings.length}</span> dari <span className="font-semibold text-zinc-900">{bookings.length}</span> pemesanan
              {hasActiveFilters && <span className="ml-2 text-zinc-400 italic">(filter aktif)</span>}
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-[11px] text-zinc-500 hover:text-zinc-900 underline"
              >
                Hapus semua filter
              </button>
            )}
          </div>
        </div>

        {/* Bookings Table container */}
        <div className="bg-white border border-[#e5e7eb] rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <DataTable
            data={filteredBookings}
            columns={bookingColumns}
            noCard={true}
            emptyMessage={hasActiveFilters ? "Tidak ada pemesanan yang sesuai dengan filter pencarian." : "No bookings records registered on the system."}
          />
        </div>
      </div>

      {/* Create Booking Drawer (Kept intact with clean styles for legacy safety) */}
      <Drawer
        isOpen={isCreateDrawerOpen}
        onClose={() => setIsCreateDrawerOpen(false)}
        title="Create New Booking"
        size="lg"
      >
        <div className="space-y-6 text-xs font-semibold text-gray-700">
          {/* Client Information */}
          <Card className="p-5 border border-[#e5e7eb] rounded-xl shadow-xs bg-white">
            <div className="flex items-center space-x-2 mb-4">
              <Users className="h-4.5 w-4.5 text-[#111111]" />
              <h3 className="text-sm font-bold text-[#111111]">Client Information</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500">Guest Name *</label>
                <Input
                  value={formData.guestName}
                  onChange={(e) => handleInputChange('guestName', e.target.value)}
                  placeholder="Guest full name"
                  className="h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111]"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500">Email *</label>
                <Input
                  type="email"
                  value={formData.guestEmail}
                  onChange={(e) => handleInputChange('guestEmail', e.target.value)}
                  placeholder="guest@example.com"
                  className="h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111]"
                />
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="block text-xs font-medium text-gray-500">Phone Number *</label>
                <Input
                  value={formData.guestPhone}
                  onChange={(e) => handleInputChange('guestPhone', e.target.value)}
                  placeholder="081234567890"
                  className="h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111]"
                />
              </div>
            </div>
          </Card>

          {/* Booking Details */}
          <Card className="p-5 border border-[#e5e7eb] rounded-xl shadow-xs bg-white">
            <div className="flex items-center space-x-2 mb-4">
              <Calendar className="h-4.5 w-4.5 text-[#111111]" />
              <h3 className="text-sm font-bold text-[#111111]">Booking Details</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500">Check-in Date *</label>
                <Input
                  type="date"
                  value={formData.checkInDate}
                  onChange={(e) => handleInputChange('checkInDate', e.target.value)}
                  className="h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111]"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500">Check-out Date *</label>
                <Input
                  type="date"
                  value={formData.checkOutDate}
                  onChange={(e) => handleInputChange('checkOutDate', e.target.value)}
                  className="h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111]"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500">Room Type *</label>
                <Input
                  value={formData.roomType}
                  onChange={(e) => handleInputChange('roomType', e.target.value)}
                  placeholder="Double Room, Spacious suites"
                  className="h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111]"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500">Number of Guests *</label>
                <Input
                  type="number"
                  min="1"
                  value={formData.numberOfGuests}
                  onChange={(e) => handleInputChange('numberOfGuests', parseInt(e.target.value) || 1)}
                  className="h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111]"
                />
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="block text-xs font-medium text-gray-500">Special Requests</label>
                <Input
                  value={formData.specialRequests}
                  onChange={(e) => handleInputChange('specialRequests', e.target.value)}
                  placeholder="Special Requests or notes"
                  className="h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111]"
                />
              </div>
            </div>
          </Card>

          {/* Pricing */}
          <Card className="p-5 border border-[#e5e7eb] rounded-xl shadow-xs bg-white">
            <div className="flex items-center space-x-2 mb-4">
              <SARCurrency iconSize={18} className="text-[#111111]" amount={""} />
              <h3 className="text-sm font-bold text-[#111111]">Pricing</h3>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500">Total Amount *</label>
                <Input
                  type="number"
                  value={formData.totalAmount}
                  onChange={(e) => handleInputChange('totalAmount', parseFloat(e.target.value) || 0)}
                  placeholder="Total amount"
                  className="h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111]"
                />
              </div>
              <div className="bg-[#f5f5f5] p-3 rounded-lg border border-[#e5e7eb]/40">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-gray-500">Grand Total:</span>
                  <span className="text-[#111111]">
                    {formatCurrency(formData.totalAmount.toString(), 'SAR')}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="flex justify-end space-x-2 mt-6">
          <Button
            variant="outline"
            onClick={() => setIsCreateDrawerOpen(false)}
            className="text-xs h-9 border-[#e5e7eb] text-gray-600"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateBooking}
            className="bg-[#111111] hover:bg-[#242424] text-white text-xs h-9 px-4 rounded-md transition-all font-semibold"
            disabled={!formData.guestName || !formData.guestEmail || !formData.checkInDate || !formData.checkOutDate || !formData.roomType || !formData.totalAmount || createBookingMutation.isPending}
          >
            {createBookingMutation.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
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
