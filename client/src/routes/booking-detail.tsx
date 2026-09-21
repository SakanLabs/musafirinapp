import { createFileRoute, redirect, Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
  TrendingUp,
  CreditCard,
  Plus,
  Receipt,
  AlertCircle
} from "lucide-react"
import { SARCurrency } from "@/components/ui/sar-currency"
import { authService } from "@/lib/auth"
import {
  formatCurrency,
  formatDate
} from "@/lib/utils"
import { useBooking, useGenerateInvoice, useGenerateVoucher, useRegenerateVoucher, useUpdateBookingStatus, useDeleteBooking, usePayBooking } from "@/lib/queries"
import { useReceiptsByBooking, useGenerateReceipt } from "@/lib/queries/receipts"
import { useCheckInvoiceExists } from "@/lib/queries/invoices"
import { useCheckVoucherExists } from "@/lib/queries/vouchers"

function parseBookingPayments(meta: unknown) {
  if (!meta || typeof meta !== "object") return []
  const payments = (meta as Record<string, unknown>)["payments"]
  if (!Array.isArray(payments)) return []
  return payments
    .map((p): { method: string; amount: number; date: string; status: string; reference?: string; description?: string } | null => {
      if (!p || typeof p !== "object") return null
      const method = String(p.method || "")
      const amount = typeof p.amount === "number" ? p.amount : parseFloat(String(p.amount)) || 0
      const date = String(p.date || new Date().toISOString())
      const status = String(p.status || "completed")
      const reference = p.reference ? String(p.reference) : undefined
      const description = p.description ? String(p.description) : undefined
      if (!method && amount <= 0) return null
      return { method, amount, date, status, reference, description }
    })
    .filter((p): p is { method: string; amount: number; date: string; status: string; reference?: string; description?: string } => !!p)
}

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
  const payBookingMutation = usePayBooking()
  const generateReceiptMutation = useGenerateReceipt()

  // Receipts by booking
  const { data: receiptsForBooking = [] } = useReceiptsByBooking(id)

  // Payment modal state
  const [isPayModalOpen, setIsPayModalOpen] = useState(false)
  const [payForm, setPayForm] = useState({
    method: "bank_transfer" as "bank_transfer" | "deposit" | "cash",
    amount: "",
    referenceNumber: "",
    description: ""
  })

  // Check if invoice and voucher already exist
  const { data: existingInvoice } = useCheckInvoiceExists(id)
  const { data: existingVoucher } = useCheckVoucherExists(id)

  const handleOpenPayModal = () => {
    if (!booking) return
    const total = Number(booking.totalAmount) || 0
    const payments = parseBookingPayments(booking.meta)
    const paid = payments.reduce((sum, p) => sum + p.amount, 0)
    const remaining = Math.max(total - paid, 0)

    setPayForm({
      method: "bank_transfer",
      amount: remaining > 0 ? remaining.toString() : "",
      referenceNumber: "",
      description: paid === 0 ? "Pembayaran Uang Muka (DP)" : `Pembayaran Termin ke-${payments.length + 1}`
    })
    setIsPayModalOpen(true)
  }

  const handleRecordPayment = async () => {
    if (!booking) return
    const amountNum = parseFloat(payForm.amount)
    if (!amountNum || isNaN(amountNum) || amountNum <= 0) {
      toast.error("Nominal pembayaran harus lebih dari 0")
      return
    }

    try {
      await payBookingMutation.mutateAsync({
        id: booking.id.toString(),
        method: payForm.method,
        amount: amountNum,
        referenceNumber: payForm.referenceNumber.trim() || undefined,
        description: payForm.description.trim() || undefined
      })
      toast.success("Pembayaran berhasil dicatat!")
      setIsPayModalOpen(false)
    } catch (err: any) {
      toast.error(err.message || "Gagal mencatat pembayaran")
    }
  }

  const handleGenerateReceipt = async () => {
    if (!booking) return
    try {
      const receipt = await generateReceiptMutation.mutateAsync(booking.id)
      toast.success(`Kwitansi ${receipt.number} berhasil diterbitkan!`)
    } catch (err: any) {
      toast.error(err.message || "Gagal membuat kwitansi")
    }
  }

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
      const guestForVoucher = booking.guestName || (booking.meta as any)?.guestName || booking.clientName || 'Guest'
      if (existingVoucher) {
        await regenerateVoucherMutation.mutateAsync({
          bookingId: id.toString(),
          guestName: guestForVoucher
        })
        toast.success("Voucher berhasil digenerate ulang dan diunduh!")
      } else {
        await generateVoucherMutation.mutateAsync({
          bookingId: id.toString(),
          guestName: guestForVoucher
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

    const guestForShare = booking.guestName || (booking.meta as any)?.guestName || booking.clientName || 'Guest'
    const message = `Booking Details:\nGuest: ${guestForShare}\nCode: ${booking.code}\nHotel: ${booking.hotelName}\nCheck-in: ${formatDate(booking.checkIn)}\nCheck-out: ${formatDate(booking.checkOut)}\nTotal: ${formatCurrency(booking.totalAmount.toString(), 'SAR')}`
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
            {(() => {
              const resolvedGuestName = booking.guestName || (booking.meta as any)?.guestName || booking.clientName || 'N/A Guest'
              const resolvedGuestEmail = booking.guestEmail || (booking.meta as any)?.guestEmail || booking.clientEmail || 'N/A Email'
              const resolvedGuestPhone = booking.guestPhone || (booking.meta as any)?.guestPhone || booking.clientPhone || 'N/A Phone'

              return (
                <Card className="border border-[#e5e7eb] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] bg-white overflow-hidden">
                  <CardHeader className="border-b border-[#e5e7eb] px-6 py-4 bg-gray-50/20">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="text-sm font-bold text-[#111111] flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-400" />
                        Primary Guest Contact (Tamu Hotel)
                      </CardTitle>
                      {booking.clientName && (
                        <span className="text-xs text-gray-500">
                          Client CRM: <strong className="text-gray-900">{booking.clientName}</strong>
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 md:p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Guest Name</label>
                        <p className="text-sm font-bold text-[#111111]">{resolvedGuestName}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Email Address</label>
                        <div className="flex items-center text-sm font-semibold text-[#111111] gap-1">
                          <Mail className="h-3.5 w-3.5 text-gray-300" />
                          <span>{resolvedGuestEmail}</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">WhatsApp Phone</label>
                        <div className="flex items-center text-sm font-semibold text-[#047857] gap-1">
                          <Phone className="h-3.5 w-3.5 text-[#047857]/40" />
                          <span>{resolvedGuestPhone}</span>
                        </div>
                      </div>
                    </div>

                    {/* Booked by Client CRM details */}
                    {booking.clientName && (
                      <div className="pt-4 border-t border-gray-100 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-gray-500">
                        <div>
                          <span className="font-semibold text-gray-400">Pemesan (Client CRM):</span>{' '}
                          <span className="font-bold text-gray-800">{booking.clientName}</span>
                        </div>
                        {booking.clientEmail && (
                          <div>
                            <span className="text-gray-400">Email:</span>{' '}
                            <span className="text-gray-700">{booking.clientEmail}</span>
                          </div>
                        )}
                        {booking.clientPhone && (
                          <div>
                            <span className="text-gray-400">Phone:</span>{' '}
                            <span className="text-gray-700">{booking.clientPhone}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })()}

            {/* Lodging & Slots card */}
            <Card className="border border-[#e5e7eb] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] bg-white overflow-hidden">
              <CardHeader className="border-b border-[#e5e7eb] px-6 py-4 bg-gray-50/20">
                <CardTitle className="text-sm font-bold text-[#111111] flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  Hotel Detail
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

            {/* Payment History & Installments (Termin) Card */}
                {(() => {
                  const total = Number(booking.totalAmount) || 0
                  const payments = parseBookingPayments(booking.meta)
                  const paid = payments.reduce((sum, p) => sum + p.amount, 0)
                  const remaining = Math.max(total - paid, 0)
                  const pct = total > 0 ? Math.min(Math.round((paid / total) * 100), 100) : 0

                  return (
                    <Card className="border border-[#e5e7eb] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] bg-white overflow-hidden">
                      <CardHeader className="border-b border-[#e5e7eb] px-6 py-4 bg-gray-50/20 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-bold text-[#111111] flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-gray-400" />
                          Riwayat Pembayaran & Tracking Termin
                        </CardTitle>
                        <Button
                          size="sm"
                          onClick={handleOpenPayModal}
                          className="bg-[#111111] hover:bg-[#242424] text-white text-xs font-semibold h-8 px-3 rounded-md flex items-center gap-1 shadow-none"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Catat Pembayaran
                        </Button>
                      </CardHeader>
                      <CardContent className="p-4 md:p-6 space-y-5">
                        {/* Financial Snapshot */}
                        <div className="p-4 bg-zinc-50/70 rounded-xl border border-zinc-200/80 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                            <div>
                              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Tagihan</span>
                              <p className="text-base font-bold text-zinc-950 mt-0.5">{formatCurrency(total.toString(), "SAR")}</p>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Total Terbayar</span>
                              <p className="text-base font-bold text-emerald-600 mt-0.5">{formatCurrency(paid.toString(), "SAR")}</p>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Sisa Tagihan</span>
                              <p className={`text-base font-bold mt-0.5 ${remaining > 0 ? "text-rose-600" : "text-emerald-700"}`}>
                                {remaining > 0 ? formatCurrency(remaining.toString(), "SAR") : "Lunas ✓"}
                              </p>
                            </div>
                          </div>

                          <div className="pt-3 border-t border-zinc-200">
                            <div className="flex justify-between text-xs font-semibold mb-1.5">
                              <span className="text-zinc-600">Realisasi Pelunasan</span>
                              <span className={pct === 100 ? "text-emerald-700 font-bold" : "text-amber-700 font-bold"}>
                                {pct}% {pct === 100 ? "Lunas" : "Sebagian"}
                              </span>
                            </div>
                            <div className="w-full bg-zinc-200/70 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  pct === 100 ? "bg-emerald-600" : pct > 0 ? "bg-amber-500" : "bg-zinc-300"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* List of Payments */}
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-wider">Rincian Termin Pembayaran</h4>
                          {payments.length === 0 ? (
                            <div className="p-6 text-center bg-zinc-50/50 rounded-xl border border-dashed border-zinc-200 text-zinc-400">
                              <Clock className="h-5 w-5 mx-auto mb-1.5 text-zinc-300" />
                              <p className="text-xs font-medium">Belum ada pembayaran yang dicatat untuk pemesanan ini.</p>
                              <p className="text-[11px] text-zinc-400 mt-0.5">Gunakan tombol "Catat Pembayaran" di atas untuk memasukkan pembayaran DP.</p>
                            </div>
                          ) : (
                            payments.map((p, pIdx) => (
                              <div
                                key={pIdx}
                                className="p-3.5 bg-white rounded-xl border border-zinc-200/90 shadow-none space-y-2 hover:border-zinc-300 transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-zinc-100 text-zinc-800 border border-zinc-200">
                                      {pIdx === 0 ? "Pembayaran #1 (DP)" : `Termin ke-${pIdx + 1}`}
                                    </span>
                                    <span className="text-xs font-semibold text-zinc-600 capitalize">{p.method.replace("_", " ")}</span>
                                  </div>
                                  <span className="text-sm font-extrabold text-emerald-700">
                                    {formatCurrency(p.amount.toString(), "SAR")}
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-500 pt-1.5 border-t border-zinc-100">
                                  <div>
                                    <span className="text-zinc-400">Tanggal:</span> {formatDate(p.date)}
                                  </div>
                                  {p.reference && (
                                    <div>
                                      <span className="text-zinc-400">Referensi:</span> <span className="font-mono text-zinc-800 font-semibold">{p.reference}</span>
                                    </div>
                                  )}
                                </div>

                                {p.description && (
                                  <div className="text-[11px] text-zinc-700 bg-zinc-50 px-2.5 py-1.5 rounded-md border border-zinc-150">
                                    <span className="font-semibold text-zinc-500">Catatan:</span> {p.description}
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>

                        {/* Receipts Section */}
                        <div className="pt-3 border-t border-zinc-100 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-wider">Kwitansi Terbit</h4>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleGenerateReceipt}
                              disabled={generateReceiptMutation.isPending}
                              className="h-8 px-2.5 text-xs font-semibold rounded-md border-zinc-300 shadow-none flex items-center gap-1.5"
                            >
                              {generateReceiptMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Receipt className="h-3.5 w-3.5" />
                              )}
                              Terbitkan Kwitansi Baru
                            </Button>
                          </div>

                          {receiptsForBooking.length === 0 ? (
                            <p className="text-zinc-400 text-xs italic">Belum ada kwitansi yang diterbitkan.</p>
                          ) : (
                            <div className="space-y-2">
                              {receiptsForBooking.map((rcpt) => (
                                <div
                                  key={rcpt.id}
                                  className="p-3 bg-zinc-50/70 rounded-lg border border-zinc-200 flex items-center justify-between"
                                >
                                  <div>
                                    <div className="font-mono font-bold text-xs text-zinc-900">{rcpt.number}</div>
                                    <div className="text-[10px] text-zinc-500">
                                      Diterbitkan: {formatDate(rcpt.issueDate)} • Nominal: {formatCurrency(rcpt.amount, rcpt.currency)}
                                    </div>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => window.open(rcpt.pdfUrl || `/api/receipts/${rcpt.id}/download`, "_blank")}
                                    className="h-7 px-2.5 text-xs font-semibold text-zinc-700 hover:text-black hover:bg-zinc-200"
                                  >
                                    Buka PDF &rarr;
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })()}
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

      {/* Modal: Catat Pembayaran Baru */}
      <Modal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        title="Catat Pembayaran / Termin Booking"
      >
        <div className="space-y-4 text-xs font-medium text-zinc-700">
          <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 space-y-1">
            <p className="font-bold text-zinc-950 text-sm">{booking.clientName}</p>
            <p className="text-zinc-500">Booking: #{booking.id} ({booking.code}) • {booking.hotelName}</p>
            {(() => {
              const total = Number(booking.totalAmount) || 0
              const payments = parseBookingPayments(booking.meta)
              const paid = payments.reduce((sum, p) => sum + p.amount, 0)
              const remaining = Math.max(total - paid, 0)
              return (
                <div className="flex justify-between pt-1.5 border-t border-zinc-200 text-xs font-bold">
                  <span>Sisa Tagihan Belum Lunas:</span>
                  <span className="text-rose-600">{formatCurrency(remaining.toString(), "SAR")}</span>
                </div>
              )
            })()}
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                Metode Pembayaran *
              </label>
              <select
                value={payForm.method}
                onChange={(e) => setPayForm({ ...payForm, method: e.target.value as any })}
                className="w-full h-9 px-3 border border-[#e5e7eb] rounded-md text-xs font-medium text-zinc-900 bg-white focus:outline-none focus:border-[#111111]"
              >
                <option value="bank_transfer">Transfer Bank (BSI / Mandiri / dll)</option>
                <option value="cash">Tunai / Cash (SAR)</option>
                <option value="deposit">Potong Saldo Deposit Client</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Nominal Pembayaran (SAR) *
                </label>
                {(() => {
                  const total = Number(booking.totalAmount) || 0
                  const payments = parseBookingPayments(booking.meta)
                  const paid = payments.reduce((sum, p) => sum + p.amount, 0)
                  const remaining = Math.max(total - paid, 0)
                  return (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setPayForm({ ...payForm, amount: (total * 0.3).toFixed(2), description: "Pembayaran DP 30%" })}
                        className="text-[10px] font-semibold text-zinc-600 hover:text-black bg-zinc-100 hover:bg-zinc-200 px-1.5 py-0.5 rounded"
                      >
                        DP 30%
                      </button>
                      <button
                        type="button"
                        onClick={() => setPayForm({ ...payForm, amount: (total * 0.5).toFixed(2), description: "Pembayaran 50%" })}
                        className="text-[10px] font-semibold text-zinc-600 hover:text-black bg-zinc-100 hover:bg-zinc-200 px-1.5 py-0.5 rounded"
                      >
                        50%
                      </button>
                      <button
                        type="button"
                        onClick={() => setPayForm({ ...payForm, amount: remaining.toFixed(2), description: "Pelunasan Sisa Pembayaran" })}
                        className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded"
                      >
                        Lunasi Sisa
                      </button>
                    </div>
                  )
                })()}
              </div>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={payForm.amount}
                onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                className="h-9 border-[#e5e7eb] rounded-md text-xs font-semibold focus-visible:ring-[#111111] shadow-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                Nomor Referensi / Bukti Transfer (Opsional)
              </label>
              <Input
                placeholder="Contoh: TRX-BSI-9849204"
                value={payForm.referenceNumber}
                onChange={(e) => setPayForm({ ...payForm, referenceNumber: e.target.value })}
                className="h-9 border-[#e5e7eb] rounded-md text-xs font-medium focus-visible:ring-[#111111] shadow-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                Keterangan / Catatan Termin (Opsional)
              </label>
              <Input
                placeholder="Contoh: Pembayaran Uang Muka (DP) 30% via BSI"
                value={payForm.description}
                onChange={(e) => setPayForm({ ...payForm, description: e.target.value })}
                className="h-9 border-[#e5e7eb] rounded-md text-xs font-medium focus-visible:ring-[#111111] shadow-none"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-zinc-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPayModalOpen(false)}
              className="text-xs h-9 border-[#e5e7eb] shadow-none"
            >
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleRecordPayment}
              disabled={payBookingMutation.isPending}
              className="bg-[#111111] hover:bg-[#242424] text-white text-xs h-9 px-4 rounded-md font-semibold shadow-none flex items-center gap-1.5"
            >
              {payBookingMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Simpan Pembayaran
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  )
}
