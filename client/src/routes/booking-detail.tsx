import { createFileRoute, redirect, Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DueDateModal } from "@/components/modals/DueDateModal"
import { UpdateBookingStatusModal } from "@/components/modals/UpdateBookingStatusModal"
import { Modal } from "@/components/ui/modal"
import {
  ArrowLeft,
  FileText,
  Ticket,
  Share,
  Calendar,
  Users,
  Phone,
  Mail,
  Loader2,
  Edit,
  Clock,
  Settings,
  Trash2,
  CheckCircle2,
  Building,
  DollarSign,
  HelpCircle,
  TrendingUp
} from "lucide-react"
import { SARCurrency } from "@/components/ui/sar-currency"
import { authService } from "@/lib/auth"
import {
  formatCurrency,
  formatDate
} from "@/lib/utils"
import { useBooking, useGenerateInvoice, useGenerateVoucher, useRegenerateVoucher, useUpdateBookingStatus, useDeleteBooking } from "@/lib/queries"
import { useCheckInvoiceExists } from "@/lib/queries/invoices"
import { useCheckVoucherExists } from "@/lib/queries/vouchers"

// Helper functions for monochromatic theme
const getBookingStatusColor = (status: string) => {
  const raw = status.toLowerCase();
  if (raw === 'confirmed') return 'bg-[#ecfdf5] text-[#047857] border-[#d1fae5]';
  if (raw === 'pending') return 'bg-[#fffbeb] text-[#d97706] border-[#fef3c7]';
  if (raw === 'cancelled') return 'bg-[#fef2f2] text-[#b91c1c] border-[#fee2e2]';
  return 'bg-[#f3f4f6] text-gray-800 border-gray-200';
}

const getPaymentStatusColor = (status: string) => {
  const raw = status.toLowerCase();
  if (raw === 'paid') return 'bg-[#ecfdf5] text-[#047857] border-[#d1fae5]';
  if (raw === 'partial') return 'bg-[#fffbeb] text-[#d97706] border-[#fef3c7]';
  if (raw === 'unpaid' || raw === 'overdue') return 'bg-[#fef2f2] text-[#b91c1c] border-[#fee2e2]';
  return 'bg-[#f3f4f6] text-gray-800 border-gray-200';
}

export const Route = createFileRoute("/booking-detail")({
  validateSearch: (search: Record<string, unknown>) => {
    let id = search.id as string;
    if (id) {
      id = id.replace(/["']/g, '');
    }
    if (!id) {
      throw new Error('Booking ID is required');
    }
    return {
      id: id,
    }
  },
  beforeLoad: async () => {
    // Check if user is authenticated
    const isAuthenticated = await authService.isAuthenticated()
    if (!isAuthenticated) {
      throw redirect({ to: "/login" })
    }
  },
  component: BookingDetailPage
})

function BookingDetailPage() {
  const { id } = Route.useSearch()
  const navigate = useNavigate()
  const [isDueDateModalOpen, setIsDueDateModalOpen] = useState(false)
  const [isUpdateStatusModalOpen, setIsUpdateStatusModalOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false)

  // Fetch booking data using TanStack Query
  const { data: booking, isLoading, error } = useBooking(id)
  const generateInvoiceMutation = useGenerateInvoice()
  const generateVoucherMutation = useGenerateVoucher()
  const regenerateVoucherMutation = useRegenerateVoucher()
  const updateBookingStatusMutation = useUpdateBookingStatus()
  const deleteBookingMutation = useDeleteBooking()

  // Check if invoice and voucher already exist
  const { data: existingInvoice } = useCheckInvoiceExists(id)
  const { data: existingVoucher } = useCheckVoucherExists(id)

  const handleGenerateInvoice = () => {
    setIsDueDateModalOpen(true)
  }

  const handleDueDateSubmit = async (dueDate: string) => {
    try {
      await generateInvoiceMutation.mutateAsync({
        bookingId: id,
        dueDate
      })

      const message = existingInvoice
        ? "Invoice berhasil digenerate ulang! Anda akan diarahkan ke halaman invoices."
        : "Invoice berhasil digenerate! Anda akan diarahkan ke halaman invoices."

      toast.success(message)
      setIsDueDateModalOpen(false)
      navigate({ to: '/invoices' })
    } catch (error) {
      console.error("Failed to generate invoice:", error)
      const msg = error instanceof Error ? error.message : "Gagal generate invoice"
      toast.error(msg)
    }
  }

  const handleGenerateVoucher = async () => {
    if (!booking || !id) {
      toast.warning("Booking data tidak tersedia")
      return
    }

    try {
      if (existingVoucher) {
        await regenerateVoucherMutation.mutateAsync({
          bookingId: id.toString(),
          guestName: booking.clientName
        })
        toast.success("Voucher berhasil digenerate ulang dan diunduh!")
      } else {
        await generateVoucherMutation.mutateAsync({
          bookingId: id.toString(),
          guestName: booking.clientName
        })
        toast.success("Voucher berhasil digenerate dan diunduh!")
      }
    } catch (error) {
      console.error("Failed to generate voucher:", error)
      const msg = error instanceof Error ? error.message : "Gagal generate voucher"
      toast.error(msg)
    }
  }

  const handleShareWhatsApp = () => {
    if (!booking) return

    const message = `Booking Details:\nGuest: ${booking.clientName}\nCode: ${booking.code}\nHotel: ${booking.hotelName}\nCheck-in: ${formatDate(booking.checkIn)}\nCheck-out: ${formatDate(booking.checkOut)}\nTotal: ${formatCurrency(booking.totalAmount.toString(), 'SAR')}`
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, '_blank')
  }

  const handleEditBooking = () => {
    navigate({ to: "/booking-edit", search: { id } })
  }

  const handleUpdateBookingStatus = async (updateData: {
    paymentStatus?: "unpaid" | "partial" | "paid" | "overdue"
    bookingStatus?: "pending" | "confirmed" | "cancelled"
    hotelConfirmationNo?: string
  }) => {
    try {
      await updateBookingStatusMutation.mutateAsync({
        id: id.toString(),
        ...updateData
      })
      setIsUpdateStatusModalOpen(false)
      toast.success("Status booking berhasil diupdate!")
    } catch (error) {
      console.error("Failed to update booking status:", error)
      const msg = error instanceof Error ? error.message : "Gagal update status booking"
      toast.error(msg)
    }
  }

  const handleDeleteBooking = async () => {
    try {
      await deleteBookingMutation.mutateAsync(id)
      setIsDeleteConfirmOpen(false)
      setIsSuccessModalOpen(true)
    } catch (error) {
      console.error("Failed to delete booking:", error)
      const msg = error instanceof Error ? error.message : "Gagal menghapus booking"
      toast.error(msg)
    }
  }

  const handleSuccessModalClose = () => {
    setIsSuccessModalOpen(false)
    navigate({ to: "/bookings" })
  }

  if (isLoading) {
    return (
      <PageLayout title="Loading Details" subtitle="Accessing reservation registry...">
        <div className="flex flex-col items-center justify-center h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-[#111111] mb-3" />
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest select-none">Retrieving file logs...</span>
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

  // Calculate nights for subtotal calculation
  const checkInDate = new Date(booking.checkIn);
  const checkOutDate = new Date(booking.checkOut);
  const diffTime = checkOutDate.getTime() - checkInDate.getTime();
  const nights = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  // Calculate dynamic grand total to ensure synchronization with UI items
  const calculatedGrandTotal = booking.items && booking.items.length > 0 
    ? booking.items.reduce((sum, item) => {
        if (item.hasPricingPeriods && item.pricingPeriods && item.pricingPeriods.length > 0) {
          const itemTotal = item.pricingPeriods.reduce((pSum, p) => pSum + p.subtotal, 0) * item.roomCount;
          return sum + itemTotal;
        } else {
          return sum + (Number(item.unitPrice) * Number(item.roomCount) * nights);
        }
      }, 0)
    : Number(booking.totalAmount);

  return (
    <PageLayout title="Booking Details" subtitle={`System Registry Code: ${booking.code}`}>
      <div className="space-y-6 max-w-[1400px] mx-auto pb-16 text-xs font-semibold text-[#374151]">
        
        {/* Navigation Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#e5e7eb]">
          <Link to="/bookings">
            <Button 
              variant="outline" 
              size="sm"
              className="text-xs h-8 border-[#e5e7eb] hover:bg-gray-50 text-gray-600 font-semibold"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Registry Overview
            </Button>
          </Link>
          
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleShareWhatsApp}
              className="text-xs h-8 border-[#e5e7eb] hover:bg-gray-50 text-[#10b981]"
            >
              <Share className="h-3.5 w-3.5 mr-1" />
              Share
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleEditBooking}
              className="text-xs h-8 border-[#e5e7eb] hover:bg-gray-50 text-[#111111]"
            >
              <Edit className="h-3.5 w-3.5 mr-1" />
              Edit Specification
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteConfirmOpen(true)}
              className="text-xs h-8 border-[#fee2e2] text-red-600 hover:text-red-700 hover:bg-[#fef2f2] ml-auto sm:ml-0"
            >
              {deleteBookingMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 mr-1" />
              )}
              Delete
            </Button>
          </div>
        </div>

        {/* 3-Column Split Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Main specifications container (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Guest Information card */}
            <Card className="border border-[#e5e7eb] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] bg-white overflow-hidden">
              <CardHeader className="border-b border-[#e5e7eb] px-6 py-4 bg-gray-50/20">
                <CardTitle className="text-sm font-bold text-[#111111] flex items-center gap-2">
                  <Users className="h-4 w-4 text-gray-400" />
                  Primary Guest Contact
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 md:p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Full Name</label>
                    <p className="text-sm font-bold text-[#111111]">{booking.clientName || 'N/A Guest'}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Email Address</label>
                    <div className="flex items-center text-sm font-semibold text-[#111111] gap-1">
                      <Mail className="h-3.5 w-3.5 text-gray-300" />
                      <span>{booking.clientEmail || 'N/A Email'}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">WhatsApp Phone</label>
                    <div className="flex items-center text-sm font-semibold text-[#047857] gap-1">
                      <Phone className="h-3.5 w-3.5 text-[#047857]/40" />
                      <span>{booking.clientPhone || 'N/A Phone'}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Lodging & Slots card */}
            <Card className="border border-[#e5e7eb] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] bg-white overflow-hidden">
              <CardHeader className="border-b border-[#e5e7eb] px-6 py-4 bg-gray-50/20">
                <CardTitle className="text-sm font-bold text-[#111111] flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  Lodging Specifications & Slices
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 md:p-6 space-y-6">
                {/* Visual duration metadata */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-6 border-b border-gray-100">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Lodging Hotel</label>
                    <p className="text-sm font-bold text-[#111111] flex items-center gap-1.5">
                      <Building className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                      {booking.hotelName}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Location / City</label>
                    <p className="text-sm font-bold text-[#111111]">{booking.city}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Catering / Meal Plan</label>
                    <p className="text-sm font-bold text-[#111111]">{booking.mealPlan}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-gray-100">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Check-in Schedule</label>
                    <p className="text-sm font-bold text-[#111111] bg-[#f8f9fa] border border-[#e5e7eb] px-3 py-1.5 rounded-lg w-fit">
                      {formatDate(booking.checkIn)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Check-out Schedule</label>
                    <p className="text-sm font-bold text-[#111111] bg-[#f8f9fa] border border-[#e5e7eb] px-3 py-1.5 rounded-lg w-fit">
                      {formatDate(booking.checkOut)}
                    </p>
                  </div>
                </div>

                {/* Rooms Information details */}
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 block">Rooms & Inventory Breakdown</label>
                  <div className="space-y-4">
                    {booking.items && booking.items.length > 0 ? (
                      booking.items.map((item, index) => (
                        <div key={index} className="bg-[#f5f5f5] p-5 rounded-xl border border-[#e5e7eb]/60 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-0.5">
                              <label className="text-[9px] font-bold text-gray-400 uppercase">Room Category</label>
                              <p className="text-sm font-bold text-[#111111]">{item.roomType}</p>
                            </div>
                            <div className="space-y-0.5">
                              <label className="text-[9px] font-bold text-gray-400 uppercase">Room Inventory</label>
                              <p className="text-sm font-bold text-[#111111]">{item.roomCount} room(s)</p>
                            </div>
                            
                            {!item.hasPricingPeriods && (
                              <div className="space-y-0.5">
                                <label className="text-[9px] font-bold text-gray-400 uppercase">Unit Price</label>
                                <p className="text-sm font-bold text-[#111111]">
                                  {formatCurrency(item.unitPrice.toString(), 'SAR')}
                                </p>
                              </div>
                            )}
                          </div>

                          {!item.hasPricingPeriods && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-3 border-t border-[#e5e7eb]/40">
                              {item.hotelCostPrice && (
                                <div className="space-y-0.5">
                                  <label className="text-[9px] font-bold text-gray-400 uppercase">Hotel Base Cost</label>
                                  <p className="text-xs font-semibold text-gray-500">
                                    {formatCurrency(item.hotelCostPrice.toString(), 'SAR')}
                                  </p>
                                </div>
                              )}
                              <div className="space-y-0.5 md:col-span-2 text-right">
                                <label className="text-[9px] font-bold text-gray-400 uppercase">Inventory Subtotal ({nights} nights)</label>
                                <p className="text-sm font-bold text-[#111111]">
                                  {formatCurrency((Number(item.unitPrice) * Number(item.roomCount) * nights).toString(), 'SAR')}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Multiple Pricing Periods Breakdown */}
                          {item.hasPricingPeriods && item.pricingPeriods && item.pricingPeriods.length > 0 && (
                            <div className="mt-4 border-t border-[#e5e7eb] pt-4 space-y-3">
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Seasonal Pricing Slices</label>
                              <div className="space-y-2">
                                {item.pricingPeriods.map((period, periodIndex) => (
                                  <div key={periodIndex} className="bg-white p-3 rounded-lg border border-[#e5e7eb]">
                                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
                                      <div className="space-y-0.5">
                                        <label className="text-[9px] font-bold text-gray-400 uppercase">Date Range</label>
                                        <p className="text-xs font-semibold text-[#111111]">
                                          {formatDate(period.startDate)} - {formatDate(period.endDate)}
                                        </p>
                                      </div>
                                      <div className="space-y-0.5">
                                        <label className="text-[9px] font-bold text-gray-400 uppercase">Nights</label>
                                        <p className="text-xs font-semibold text-[#111111]">{period.nights} nights</p>
                                      </div>
                                      <div className="space-y-0.5">
                                        <label className="text-[9px] font-bold text-gray-400 uppercase">Rate/Night</label>
                                        <p className="text-xs font-bold text-[#111111]">{formatCurrency(period.unitPrice.toString(), 'SAR')}</p>
                                      </div>
                                      {period.hotelCostPrice && (
                                        <div className="space-y-0.5">
                                          <label className="text-[9px] font-bold text-gray-400 uppercase">Hotel Cost/Night</label>
                                          <p className="text-xs font-semibold text-gray-500">{formatCurrency(period.hotelCostPrice.toString(), 'SAR')}</p>
                                        </div>
                                      )}
                                      <div className="space-y-0.5 text-right">
                                        <label className="text-[9px] font-bold text-gray-400 uppercase font-sans">Period Subtotal</label>
                                        <p className="text-xs font-bold text-[#111111]">
                                          {formatCurrency((period.subtotal * item.roomCount).toString(), 'SAR')}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                                
                                {/* Monochromatic sum tag */}
                                <div className="bg-[#f8f9fa] p-3 rounded-lg border border-[#e5e7eb] flex items-center justify-between text-xs font-bold">
                                  <span className="text-gray-500 font-sans">Accrued Seasonal Total ({item.roomType})</span>
                                  <span className="text-[#111111] font-sans">
                                    {formatCurrency(
                                      (item.pricingPeriods.reduce((sum, period) => sum + period.subtotal, 0) * item.roomCount).toString(),
                                      'SAR'
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-400 text-xs py-4 text-center">No room inventory registered.</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar parameters (1 col) */}
          <div className="space-y-6">
            {/* Status Panel */}
            <Card className="border border-[#e5e7eb] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] bg-white overflow-hidden">
              <CardHeader className="border-b border-[#e5e7eb] px-5 py-4 bg-gray-50/20">
                <CardTitle className="text-sm font-bold text-[#111111] flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  Reservation Status
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Booking Status</label>
                  <div className="mt-1">
                    <Badge className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${getBookingStatusColor(booking.bookingStatus)}`}>
                      {booking.bookingStatus}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Payment Status</label>
                  <div className="mt-1">
                    <Badge className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${getPaymentStatusColor(booking.paymentStatus)}`}>
                      {booking.paymentStatus}
                    </Badge>
                  </div>
                </div>
                {booking.hotelConfirmationNo && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Hotel Confirmation No.</label>
                    <p className="mt-1 text-xs font-mono font-bold text-[#111111] bg-gray-50 border border-[#e5e7eb] px-3 py-2 rounded-lg text-center">
                      {booking.hotelConfirmationNo}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Invoicing Operations Panel */}
            <Card className="border border-[#e5e7eb] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] bg-white overflow-hidden">
              <CardHeader className="border-b border-[#e5e7eb] px-5 py-4 bg-gray-50/20">
                <CardTitle className="text-sm font-bold text-[#111111] flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-gray-400" />
                  Total Invoiced Rate
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-6">
                <div className="text-center py-2 bg-[#f8f9fa] border border-[#e5e7eb] rounded-xl">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase">Grand Total Value</span>
                  <div className="text-xl font-bold text-[#111111] tracking-[-0.04em] mt-0.5">
                    {formatCurrency(calculatedGrandTotal.toString(), 'SAR')}
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <Button
                    className="w-full bg-[#111111] hover:bg-[#242424] text-white text-xs font-semibold h-9 rounded-md transition-all flex items-center justify-center gap-1 shadow-xs"
                    onClick={handleGenerateInvoice}
                    disabled={generateInvoiceMutation.isPending}
                  >
                    {generateInvoiceMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileText className="h-3.5 w-3.5" />
                    )}
                    {generateInvoiceMutation.isPending ? (
                      "Generating..."
                    ) : (
                      existingInvoice ? "Regenerate Invoice" : "Generate Invoice"
                    )}
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="w-full text-xs h-9 border-[#e5e7eb] hover:bg-gray-50 text-gray-600 font-semibold flex items-center justify-center gap-1"
                    onClick={handleGenerateVoucher}
                    disabled={generateVoucherMutation.isPending || regenerateVoucherMutation.isPending}
                  >
                    {(generateVoucherMutation.isPending || regenerateVoucherMutation.isPending) ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Ticket className="h-3.5 w-3.5" />
                    )}
                    {(generateVoucherMutation.isPending || regenerateVoucherMutation.isPending) ? (
                      "Generating..."
                    ) : (
                      existingVoucher ? "Regenerate Voucher" : "Generate Voucher"
                    )}
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="w-full text-xs h-9 border-[#e5e7eb] hover:bg-gray-50 text-gray-600 font-semibold flex items-center justify-center gap-1"
                    onClick={() => setIsUpdateStatusModalOpen(true)}
                    disabled={updateBookingStatusMutation.isPending}
                  >
                    {updateBookingStatusMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Settings className="h-3.5 w-3.5" />
                    )}
                    Update Status Settings
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Timestamps Card */}
            <Card className="border border-[#e5e7eb] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] bg-white overflow-hidden">
              <CardHeader className="border-b border-[#e5e7eb] px-5 py-4 bg-gray-50/20">
                <CardTitle className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <HelpCircle className="h-3.5 w-3.5 text-gray-300" />
                  Additional Registry Logs
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider select-none">
                <div className="flex items-center justify-between">
                  <span>Created</span>
                  <span className="text-[#374151]">{formatDate(booking.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Last Updated</span>
                  <span className="text-[#374151]">{formatDate(booking.updatedAt)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Due Date dialog modal */}
      <DueDateModal
        isOpen={isDueDateModalOpen}
        onClose={() => setIsDueDateModalOpen(false)}
        onSubmit={handleDueDateSubmit}
        isLoading={generateInvoiceMutation.isPending}
      />

      {/* Booking status config modal */}
      <UpdateBookingStatusModal
        isOpen={isUpdateStatusModalOpen}
        onClose={() => setIsUpdateStatusModalOpen(false)}
        onSubmit={handleUpdateBookingStatus}
        isLoading={updateBookingStatusMutation.isPending}
        booking={booking}
      />

      {/* Delete confirmation modal */}
      <Modal
        isOpen={isDeleteConfirmOpen}
        onClose={() => {
          if (!deleteBookingMutation.isPending) {
            setIsDeleteConfirmOpen(false)
          }
        }}
        title="Delete Booking Record"
        footer={
          <div className="flex justify-end space-x-2 text-xs font-semibold">
            <Button
              variant="outline"
              onClick={() => setIsDeleteConfirmOpen(false)}
              disabled={deleteBookingMutation.isPending}
              className="h-8 border-[#e5e7eb] text-gray-600"
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleDeleteBooking}
              disabled={deleteBookingMutation.isPending}
              className="h-8 border-[#fee2e2] text-red-600 hover:text-red-700 hover:bg-[#fef2f2]"
            >
              {deleteBookingMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 mr-1" />
              )}
              {deleteBookingMutation.isPending ? "Deleting..." : "Delete Reservation"}
            </Button>
          </div>
        }
      >
        <p className="text-xs text-gray-500 leading-relaxed font-semibold">
          Are you sure you want to delete the booking record for client <span className="font-bold text-[#111111] font-mono">#{booking.code}</span>? This action is permanent and cannot be undone.
        </p>
      </Modal>

      {/* Success notification modal */}
      <Modal
        isOpen={isSuccessModalOpen}
        onClose={handleSuccessModalClose}
        title="Record Successfully Deleted"
        footer={
          <Button 
            onClick={handleSuccessModalClose}
            className="bg-[#111111] hover:bg-[#242424] text-white text-xs font-semibold h-8 rounded-md"
          >
            Back to Bookings
          </Button>
        }
      >
        <div className="flex items-start space-x-3 text-xs font-semibold text-gray-500">
          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
          <div className="space-y-1 leading-relaxed">
            <p>
              Booking code <span className="font-bold text-[#111111] font-mono">#{booking.code}</span> has been permanently wiped from the operations registry database.
            </p>
          </div>
        </div>
      </Modal>
    </PageLayout>
  )
}
