import { createFileRoute, redirect, Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
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
  Building2,
  DollarSign,
  HelpCircle,
  TrendingUp,
  CreditCard,
  Plus,
  Receipt,
  AlertCircle,
  Eye,
  RefreshCw,
  Wallet,
  Banknote,
  Download,
  ExternalLink,
  MessageCircle
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
import { BookingNotificationCard } from "@/components/bookings/BookingNotificationCard"

function parseBookingPayments(meta: unknown) {
  if (!meta || typeof meta !== "object") return []
  const payments = (meta as Record<string, unknown>)["payments"]
  if (!Array.isArray(payments)) return []
  return payments
    .map((p): { method: string; amount: number; date: string; status: string; reference?: string; description?: string; termin?: number; terminLabel?: string } | null => {
      if (!p || typeof p !== "object") return null
      const method = String(p.method || "")
      const amount = typeof p.amount === "number" ? p.amount : parseFloat(String(p.amount)) || 0
      const date = String(p.date || new Date().toISOString())
      const status = String(p.status || "completed")
      const reference = p.reference ? String(p.reference) : undefined
      const description = p.description ? String(p.description) : undefined
      const termin = typeof p.termin === "number" ? p.termin : undefined
      const terminLabel = p.terminLabel ? String(p.terminLabel) : undefined
      if (!method && amount <= 0) return null
      return { method, amount, date, status, reference, description, termin, terminLabel }
    })
    .filter((p): p is { method: string; amount: number; date: string; status: string; reference?: string; description?: string; termin?: number; terminLabel?: string } => !!p)
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

  const queryClient = useQueryClient()

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
    description: "",
    sendEmail: false,
    sendWhatsApp: false,
  })

  // PDF Preview State (for instant view modal)
  const [viewingPdf, setViewingPdf] = useState<{ url: string; title: string; filename: string } | null>(null)

  // Check if invoice and voucher already exist
  const { data: existingInvoice } = useCheckInvoiceExists(id)
  const { data: existingVoucher } = useCheckVoucherExists(id)

  const handleViewReceipt = (receiptNumber: string) => {
    setViewingPdf({
      url: `/api/receipts/number/${receiptNumber}/download?view=true`,
      title: `Kwitansi Resmi #${receiptNumber}`,
      filename: `Receipt-${receiptNumber}.pdf`
    })
  }

  const handleDownloadReceipt = (receiptNumber: string) => {
    import("@/lib/api").then(({ apiClient }) => {
      apiClient.downloadFile(`/api/receipts/number/${receiptNumber}/download`, `Receipt-${receiptNumber}.pdf`)
    })
  }

  const handleViewInvoice = () => {
    if (existingInvoice?.number) {
      setViewingPdf({
        url: `/api/invoices/by-number/${existingInvoice.number}?view=true`,
        title: `Invoice Resmi #${existingInvoice.number}`,
        filename: `Invoice-${existingInvoice.number}.pdf`
      })
    }
  }

  const handleDeletePayment = async (reference: string, amount: number) => {
    if (!window.confirm(`Yakin ingin membatalkan/menghapus pembayaran sebesar ${formatCurrency(amount.toString(), 'SAR')} ini? Sisa tagihan dan status akan diperbarui otomatis.`)) {
      return
    }
    try {
      const { apiClient } = await import("@/lib/api")
      await apiClient.delete(`/api/bookings/${id}/payments/${encodeURIComponent(reference)}`)
      toast.success('Pembayaran berhasil dibatalkan')
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    } catch (err: any) {
      toast.error(err?.message || 'Gagal membatalkan pembayaran')
    }
  }

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
      description: paid === 0 ? "Pembayaran Uang Muka (DP)" : `Pembayaran Termin ke-${payments.length + 1}`,
      sendEmail: false,
      sendWhatsApp: false,
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
        description: payForm.description.trim() || undefined,
        sendEmail: payForm.sendEmail,
        sendWhatsApp: payForm.sendWhatsApp,
      })
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success("Pembayaran berhasil dicatat dan kwitansi otomatis diterbitkan!")
      setIsPayModalOpen(false)
    } catch (err: any) {
      toast.error(err.message || "Gagal mencatat pembayaran")
    }
  }

  const handleGenerateReceipt = async () => {
    if (!booking) return
    try {
      const receipt = await generateReceiptMutation.mutateAsync(booking.id)
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      toast.success(`Kwitansi ${receipt.number} berhasil diterbitkan!`)
    } catch (err: any) {
      toast.error(err.message || "Gagal membuat kwitansi")
    }
  }

  const handleGenerateInvoice = () => {
    setIsDueDateModalOpen(true)
  }

  const handleDueDateSubmit = async (dueDate: string, options?: { sendEmail?: boolean; sendWhatsApp?: boolean }) => {
    try {
      await generateInvoiceMutation.mutateAsync({
        bookingId: id,
        dueDate,
        sendEmail: options?.sendEmail,
        sendWhatsApp: options?.sendWhatsApp,
      })

      const message = existingInvoice
        ? "Invoice berhasil diperbarui!"
        : "Invoice berhasil diterbitkan!"

      toast.success(message)
      setIsDueDateModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
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
    source?: string
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pb-6 border-b border-gray-100">
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
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Sumber Pemesanan (Source)</label>
                    <p className="text-sm font-semibold text-[#111111]">
                      {booking.source ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-zinc-100 text-zinc-800 border border-zinc-200">
                          {booking.source}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 italic font-normal">Belum diisi</span>
                      )}
                    </p>
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
                {booking.source && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Sumber Pemesanan (Source)</label>
                    <p className="mt-1 text-xs font-semibold text-[#111111] bg-gray-50 border border-[#e5e7eb] px-3 py-2 rounded-lg text-center">
                      {booking.source}
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

            {/* Client Notifications Card (Email & WhatsApp) */}
            <BookingNotificationCard
              bookingId={booking.id}
              bookingCode={booking.code}
              clientName={booking.clientName || ''}
              clientEmail={booking.clientEmail || ''}
              clientPhone={booking.clientPhone || ''}
              hasVoucher={Boolean(existingVoucher)}
              voucherNumber={existingVoucher?.number}
              paymentStatus={booking.paymentStatus}
            />

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

        {/* Tagihan & Pembayaran (Billing & Payments) - Same layout as Visa */}
        {(() => {
          const total = existingInvoice?.amount ? parseFloat(existingInvoice.amount) : (Number(booking.totalAmount) || 0)
          const payments = parseBookingPayments(booking.meta)
          const paid = payments.reduce((sum, p) => sum + p.amount, 0)
          const remaining = Math.max(total - paid, 0)
          const pct = total > 0 ? Math.min(Math.round((paid / total) * 100), 100) : 0
          const currentPaymentStatus = booking.paymentStatus || (remaining === 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid')

          return (
            <Card className="border border-[#e5e7eb] rounded-xl shadow-none bg-white overflow-hidden">
              <CardHeader className="bg-zinc-50/60 border-b border-[#e5e7eb] px-6 py-4 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-white border border-zinc-200/80 rounded-lg shadow-2xs">
                    <Receipt className="h-4 w-4 text-zinc-700" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-zinc-900 tracking-tight flex items-center gap-2">
                      <span>Tagihan & Pembayaran</span>
                      {existingInvoice?.number && (
                        <span className="font-mono text-xs font-semibold text-zinc-500">
                          ({existingInvoice.number})
                        </span>
                      )}
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md ${
                          currentPaymentStatus === 'paid'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                            : currentPaymentStatus === 'partial'
                            ? 'bg-amber-50 text-amber-700 border-amber-200/60'
                            : 'bg-zinc-100 text-zinc-600 border-zinc-200/60'
                        }`}
                      >
                        {currentPaymentStatus === 'paid' ? 'Lunas' : currentPaymentStatus === 'partial' ? 'Cicilan' : 'Belum Bayar'}
                      </Badge>
                    </CardTitle>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Kelola tagihan, pencatatan pembayaran masuk, dan kwitansi resmi hotel.
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {existingInvoice?.number && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleViewInvoice}
                      className="h-8 px-3 border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-xs font-medium"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1.5 text-zinc-400" />
                      <span>Lihat Invoice</span>
                    </Button>
                  )}

                  {existingInvoice && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateInvoice}
                      disabled={generateInvoiceMutation.isPending}
                      className="h-8 px-3 border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-xs font-medium"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 mr-1.5 text-zinc-400 ${generateInvoiceMutation.isPending ? 'animate-spin' : ''}`} />
                      <span>Perbarui PDF</span>
                    </Button>
                  )}

                  {!existingInvoice && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateInvoice}
                      disabled={generateInvoiceMutation.isPending}
                      className="h-8 px-3 border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-xs font-medium"
                    >
                      <FileText className="h-3.5 w-3.5 mr-1.5 text-zinc-400" />
                      <span>Terbitkan Invoice</span>
                    </Button>
                  )}

                  {remaining > 0 && (
                    <Button
                      size="sm"
                      onClick={handleOpenPayModal}
                      disabled={payBookingMutation.isPending}
                      className="h-8 px-3.5 bg-[#111111] hover:bg-[#242424] text-white font-semibold text-xs rounded-md shadow-none flex items-center space-x-1.5 border border-transparent"
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      <span>Terima Pembayaran</span>
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                {/* 3 Summary Stat Boxes */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-zinc-50/70 rounded-xl border border-zinc-200/70">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Total Tagihan</span>
                    <p className="text-xl font-bold font-mono text-zinc-900">
                      {formatCurrency(total.toString(), 'SAR')}
                    </p>
                    {booking.meta && (booking.meta as any).totalPriceUSD ? (
                      <p className="text-[11px] font-mono text-zinc-400">
                        {formatCurrency(String((booking.meta as any).totalPriceUSD), 'USD')} (USD)
                      </p>
                    ) : (
                      <p className="text-[11px] text-zinc-400">
                        {booking.hotelName} • {nights} Malam
                      </p>
                    )}
                  </div>

                  <div className="space-y-1 border-t md:border-t-0 md:border-l border-zinc-200/60 pt-3 md:pt-0 md:pl-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Telah Dibayar</span>
                    <p className="text-xl font-bold font-mono text-emerald-600">
                      {formatCurrency(paid.toString(), 'SAR')}
                    </p>
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{pct}% Terbayar</span>
                    </div>
                  </div>

                  <div className="space-y-1 border-t md:border-t-0 md:border-l border-zinc-200/60 pt-3 md:pt-0 md:pl-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Sisa Tagihan</span>
                    <p className={`text-xl font-bold font-mono ${remaining === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {formatCurrency(remaining.toString(), 'SAR')}
                    </p>
                    <p className="text-[11px] text-zinc-400">
                      {remaining === 0 ? 'Semua tagihan lunas' : 'Menunggu pelunasan'}
                    </p>
                  </div>
                </div>

                {/* Riwayat Pembayaran & Kwitansi Resmi */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-600">
                      Riwayat Pembayaran & Kwitansi Resmi
                    </h4>
                    <span className="text-xs text-zinc-400 font-medium">
                      {payments.length} transaksi tercatat
                    </span>
                  </div>

                  {payments && payments.length > 0 ? (
                    <div className="overflow-x-auto rounded-lg border border-zinc-200">
                      <table className="w-full text-xs">
                        <thead className="bg-zinc-50 border-b border-zinc-200">
                          <tr>
                            <th className="text-left font-bold text-zinc-600 py-2.5 px-4 uppercase tracking-wider">Tanggal</th>
                            <th className="text-left font-bold text-zinc-600 py-2.5 px-4 uppercase tracking-wider">Metode</th>
                            <th className="text-left font-bold text-zinc-600 py-2.5 px-4 uppercase tracking-wider">No. Referensi / Catatan</th>
                            <th className="text-right font-bold text-zinc-600 py-2.5 px-4 uppercase tracking-wider">Nominal</th>
                            <th className="text-right font-bold text-zinc-600 py-2.5 px-4 uppercase tracking-wider">Kwitansi (PDF)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {payments.map((p, idx) => {
                            const terminNumber = p.termin || (idx + 1);
                            const isFullyPaid = remaining <= 0 && idx === payments.length - 1;
                            let terminLabel = p.terminLabel;
                            if (!terminLabel) {
                              if (isFullyPaid && terminNumber === 1) {
                                terminLabel = 'Pelunasan (Lunas Penuh)';
                              } else if (isFullyPaid) {
                                terminLabel = `Termin #${terminNumber} (Pelunasan)`;
                              } else if (terminNumber === 1) {
                                terminLabel = 'Termin #1 (Uang Muka / DP)';
                              } else {
                                terminLabel = `Termin #${terminNumber}`;
                              }
                            }

                            // Find matching receipt from receiptsForBooking
                            const receipt = receiptsForBooking.find(r => 
                              (r.meta?.payment?.referenceNumber && r.meta.payment.referenceNumber === p.reference) ||
                              (r.meta?.termin && r.meta.termin === terminNumber) ||
                              (parseFloat(r.paidAmount) === p.amount)
                            ) || (receiptsForBooking.length === 1 && payments.length === 1 ? receiptsForBooking[0] : null);
                            const receiptNumber = receipt?.number;

                            return (
                              <tr key={idx} className="hover:bg-zinc-50/60 transition-colors">
                                <td className="py-3 px-4 font-mono text-zinc-700">
                                  {formatDate(p.date)}
                                </td>
                                <td className="py-3 px-4">
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-medium text-[11px] bg-zinc-100 text-zinc-700">
                                    {p.method === 'bank_transfer' ? (
                                      <>
                                        <Building2 className="w-3 h-3 text-zinc-500" />
                                        <span>Transfer Bank</span>
                                      </>
                                    ) : p.method === 'deposit' ? (
                                      <>
                                        <Wallet className="w-3 h-3 text-emerald-600" />
                                        <span>Saldo Deposit</span>
                                      </>
                                    ) : (
                                      <>
                                        <Banknote className="w-3 h-3 text-zinc-500" />
                                        <span>Tunai</span>
                                      </>
                                    )}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {terminLabel ? (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                                        {terminLabel}
                                      </span>
                                    ) : null}
                                    <span className="font-mono text-zinc-800">{p.reference || '-'}</span>
                                  </div>
                                  {p.description && (
                                    <div className="text-[11px] text-zinc-500 mt-0.5">{p.description}</div>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 text-sm">
                                  {formatCurrency(p.amount.toString(), 'SAR')}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <div className="flex items-center justify-end space-x-1.5">
                                    {receiptNumber ? (
                                      <>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleViewReceipt(receiptNumber)}
                                          className="h-7 text-[11px] px-2.5 font-medium border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 inline-flex items-center space-x-1"
                                          title="Lihat Kwitansi PDF Langsung"
                                        >
                                          <Receipt className="w-3.5 h-3.5 text-zinc-500" />
                                          <span className="font-mono">{receiptNumber}</span>
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDownloadReceipt(receiptNumber)}
                                          className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded"
                                          title="Unduh Kwitansi PDF"
                                        >
                                          <Download className="w-3.5 h-3.5" />
                                        </Button>
                                      </>
                                    ) : (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleGenerateReceipt}
                                        disabled={generateReceiptMutation.isPending}
                                        className="h-7 text-[11px] px-2 font-medium border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                                      >
                                        <Plus className="w-3 h-3 mr-1" />
                                        <span>Generate</span>
                                      </Button>
                                    )}

                                    {p.reference && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeletePayment(p.reference!, p.amount)}
                                        className="h-7 w-7 p-0 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded"
                                        title="Batalkan / Hapus Pembayaran Ini"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-6 text-center bg-zinc-50/50 rounded-xl border border-dashed border-zinc-200 text-zinc-400">
                      <Clock className="h-5 w-5 mx-auto mb-1.5 text-zinc-300" />
                      <p className="text-xs font-medium">Belum ada riwayat pembayaran yang dicatat untuk pemesanan ini.</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5">Gunakan tombol "Terima Pembayaran" di atas untuk memasukkan pembayaran atau uang muka (DP).</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })()}
      </div>

      {/* Modal: Lihat PDF Langsung (Invoice & Kwitansi) */}
      <Modal
        isOpen={!!viewingPdf}
        onClose={() => setViewingPdf(null)}
        title={viewingPdf?.title || "Lihat Dokumen PDF"}
        size="xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="text-xs text-zinc-500 font-medium">
              Dokumen resmi tercatat dalam sistem Musafirin
            </div>
            <div className="flex items-center space-x-2">
              {viewingPdf && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(viewingPdf.url, '_blank')}
                    className="h-8 text-xs font-medium"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1 text-zinc-500" />
                    Buka di Tab Baru
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      import("@/lib/api").then(({ apiClient }) => {
                        apiClient.downloadFile(viewingPdf.url.replace('?view=true', ''), viewingPdf.filename);
                      });
                    }}
                    className="h-8 text-xs font-medium bg-[#111111] hover:bg-[#242424] text-white"
                  >
                    <Download className="w-3.5 h-3.5 mr-1" />
                    Unduh PDF
                  </Button>
                </>
              )}
            </div>
          </div>
        }
      >
        {viewingPdf && (
          <div className="w-full h-[650px] bg-zinc-100 rounded-lg overflow-hidden border border-zinc-200">
            <iframe
              src={viewingPdf.url}
              className="w-full h-full"
              title={viewingPdf.title}
            />
          </div>
        )}
      </Modal>

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

            {/* Notification delivery checkboxes */}
            <div className="bg-zinc-50 border border-zinc-200/80 rounded-lg p-3 space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                Kirim Konfirmasi Pembayaran (Opsional)
              </label>
              <div className="space-y-1.5">
                <label className="flex items-center space-x-2.5 cursor-pointer text-xs font-medium text-zinc-700 hover:text-zinc-950">
                  <input
                    type="checkbox"
                    checked={payForm.sendEmail}
                    onChange={(e) => setPayForm({ ...payForm, sendEmail: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                  />
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-zinc-400" />
                    <span>Kirim konfirmasi via <strong>Email</strong></span>
                  </span>
                </label>
                <label className="flex items-center space-x-2.5 cursor-pointer text-xs font-medium text-zinc-700 hover:text-zinc-950">
                  <input
                    type="checkbox"
                    checked={payForm.sendWhatsApp}
                    onChange={(e) => setPayForm({ ...payForm, sendWhatsApp: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                  />
                  <span className="flex items-center gap-1.5">
                    <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Kirim konfirmasi via <strong>WhatsApp</strong></span>
                  </span>
                </label>
              </div>
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
