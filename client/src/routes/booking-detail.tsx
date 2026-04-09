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
  CheckCircle2
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

// Helper functions
const getBookingStatusColor = (status: string) => {
  switch (status) {
    case 'confirmed':
      return 'bg-green-100 text-green-800'
    case 'pending':
      return 'bg-yellow-100 text-yellow-800'
    case 'cancelled':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const getPaymentStatusColor = (status: string) => {
  switch (status) {
    case 'paid':
      return 'bg-green-100 text-green-800'
    case 'partial':
      return 'bg-yellow-100 text-yellow-800'
    case 'unpaid':
      return 'bg-red-100 text-red-800'
    case 'overdue':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
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
    // Always show due date modal to generate/regenerate invoice
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

      // Redirect to invoices page
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
        // If voucher already exists, regenerate it
        await regenerateVoucherMutation.mutateAsync({
          bookingId: id.toString(),
          guestName: booking.clientName
        })

        toast.success("Voucher berhasil digenerate ulang dan diunduh!")
      } else {
        // If no voucher exists, generate new one
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
    <PageLayout title="Booking Details" subtitle={`Booking Code: ${booking.code}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/bookings">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Bookings
              </Button>
            </Link>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleShareWhatsApp}
            >
              <Share className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleEditBooking}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsDeleteConfirmOpen(true)}
            >
              {deleteBookingMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              {deleteBookingMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Guest Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Guest Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Name</label>
                    <p className="text-gray-900">{booking.clientName || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Email</label>
                    <div className="flex items-center">
                      <Mail className="h-4 w-4 mr-2 text-gray-400" />
                      <p className="text-gray-900">{booking.clientEmail || 'N/A'}</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Phone</label>
                    <div className="flex items-center">
                      <Phone className="h-4 w-4 mr-2 text-gray-400" />
                      <p className="text-gray-900">{booking.clientPhone || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Booking Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="h-5 w-5 mr-2" />
                  Booking Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Check-in</label>
                    <p className="text-gray-900">{formatDate(booking.checkIn)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Check-out</label>
                    <p className="text-gray-900">{formatDate(booking.checkOut)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Hotel Name</label>
                    <p className="text-gray-900">{booking.hotelName}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">City</label>
                    <p className="text-gray-900">{booking.city}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Meal Plan</label>
                    <p className="text-gray-900">{booking.mealPlan}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Total Amount</label>
                    <div className="flex items-center">
                      <SARCurrency amount={booking.totalAmount.toString()} iconSize={16} className="text-gray-900 font-semibold" />
                    </div>
                  </div>
                </div>

                {/* Rooms Information */}
                <div className="mt-6">
                  <label className="text-sm font-medium text-gray-500 mb-3 block">Rooms Information</label>
                  <div className="space-y-3">
                    {booking.items && booking.items.length > 0 ? (
                      booking.items.map((item, index) => (
                        <div key={index} className="bg-gray-50 p-4 rounded-lg">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="text-xs font-medium text-gray-500">Room Type</label>
                              <p className="text-sm text-gray-900">{item.roomType}</p>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500">Quantity</label>
                              <p className="text-sm text-gray-900">{item.roomCount} room(s)</p>
                            </div>
                            {!item.hasPricingPeriods && (
                              <>
                                <div>
                                  <label className="text-xs font-medium text-gray-500">Unit Price</label>
                                  <p className="text-sm text-gray-900">{formatCurrency(item.unitPrice.toString(), 'SAR')}</p>
                                </div>
                                {item.hotelCostPrice && (
                                  <div>
                                    <label className="text-xs font-medium text-gray-500">Hotel Cost</label>
                                    <p className="text-sm text-gray-900">{formatCurrency(item.hotelCostPrice.toString(), 'SAR')}</p>
                                  </div>
                                )}
                                <div>
                                  <label className="text-xs font-medium text-gray-500">Subtotal</label>
                                  <p className="text-sm text-gray-900 font-semibold">
                                    {formatCurrency((Number(item.unitPrice) * Number(item.roomCount)).toString(), 'SAR')}
                                  </p>
                                </div>
                              </>
                            )}
                          </div>

                          {/* Pricing Periods Breakdown */}
                          {item.hasPricingPeriods && item.pricingPeriods && item.pricingPeriods.length > 0 && (
                            <div className="mt-4 border-t pt-4">
                              <label className="text-xs font-medium text-gray-500 mb-2 block">Pricing Periods</label>
                              <div className="space-y-2">
                                {item.pricingPeriods.map((period, periodIndex) => (
                                  <div key={periodIndex} className="bg-white p-3 rounded border">
                                    <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-xs">
                                      <div>
                                        <label className="font-medium text-gray-500">Period</label>
                                        <p className="text-gray-900">
                                          {formatDate(period.startDate)} - {formatDate(period.endDate)}
                                        </p>
                                      </div>
                                      <div>
                                        <label className="font-medium text-gray-500">Nights</label>
                                        <p className="text-gray-900">{period.nights}</p>
                                      </div>
                                      <div>
                                        <label className="font-medium text-gray-500">Price/Night</label>
                                        <p className="text-gray-900">{formatCurrency(period.unitPrice.toString(), 'SAR')}</p>
                                      </div>
                                      {period.hotelCostPrice && (
                                        <div>
                                          <label className="font-medium text-gray-500">Hotel Cost/Night</label>
                                          <p className="text-gray-900">{formatCurrency(period.hotelCostPrice.toString(), 'SAR')}</p>
                                        </div>
                                      )}
                                      <div>
                                        <label className="font-medium text-gray-500">Period Subtotal</label>
                                        <p className="text-gray-900 font-semibold">
                                          {formatCurrency((period.subtotal * item.roomCount).toString(), 'SAR')}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                                <div className="bg-blue-50 p-3 rounded border border-blue-200">
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-blue-800">Total for {item.roomType}</span>
                                    <span className="text-sm font-bold text-blue-900">
                                      {formatCurrency(
                                        (item.pricingPeriods.reduce((sum, period) => sum + period.subtotal, 0) * item.roomCount).toString(),
                                        'SAR'
                                      )}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-sm">No room information available</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Status Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="h-5 w-5 mr-2" />
                  Status Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Booking Status</label>
                  <div className="mt-1">
                    <Badge className={getBookingStatusColor(booking.bookingStatus)}>
                      {booking.bookingStatus}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Payment Status</label>
                  <div className="mt-1">
                    <Badge className={getPaymentStatusColor(booking.paymentStatus)}>
                      {booking.paymentStatus}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status */}
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Booking Status</label>
                  <div className="mt-1">
                    <Badge className={getBookingStatusColor(booking.bookingStatus)}>
                      {booking.bookingStatus}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Payment Status</label>
                  <div className="mt-1">
                    <Badge className={getPaymentStatusColor(booking.paymentStatus)}>
                      {booking.paymentStatus}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full"
                  onClick={handleGenerateInvoice}
                  disabled={generateInvoiceMutation.isPending}
                >
                  {generateInvoiceMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  {generateInvoiceMutation.isPending ? (
                    "Generating..."
                  ) : (
                    existingInvoice ? "Generate Ulang Invoice" : "Generate Invoice"
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleGenerateVoucher}
                  disabled={generateVoucherMutation.isPending || regenerateVoucherMutation.isPending}
                >
                  {(generateVoucherMutation.isPending || regenerateVoucherMutation.isPending) ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Ticket className="h-4 w-4 mr-2" />
                  )}
                  {(generateVoucherMutation.isPending || regenerateVoucherMutation.isPending) ? (
                    "Generating..."
                  ) : (
                    existingVoucher ? "Generate Ulang Voucher" : "Generate Voucher"
                  )}
                </Button>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => setIsUpdateStatusModalOpen(true)}
                  disabled={updateBookingStatusMutation.isPending}
                >
                  {updateBookingStatusMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Settings className="h-4 w-4 mr-2" />
                  )}
                  Update Status
                </Button>
              </CardContent>
            </Card>

            {/* Timestamps */}
            <Card>
              <CardHeader>
                <CardTitle>Additional Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <label className="text-sm font-medium text-gray-500">Created</label>
                  <p className="text-sm text-gray-900">{formatDate(booking.createdAt)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Updated</label>
                  <p className="text-sm text-gray-900">{formatDate(booking.updatedAt)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <DueDateModal
        isOpen={isDueDateModalOpen}
        onClose={() => setIsDueDateModalOpen(false)}
        onSubmit={handleDueDateSubmit}
        isLoading={generateInvoiceMutation.isPending}
      />

      <UpdateBookingStatusModal
        isOpen={isUpdateStatusModalOpen}
        onClose={() => setIsUpdateStatusModalOpen(false)}
        onSubmit={handleUpdateBookingStatus}
        isLoading={updateBookingStatusMutation.isPending}
        booking={booking}
      />
      <Modal
        isOpen={isDeleteConfirmOpen}
        onClose={() => {
          if (!deleteBookingMutation.isPending) {
            setIsDeleteConfirmOpen(false)
          }
        }}
        title="Delete Booking"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setIsDeleteConfirmOpen(false)}
              disabled={deleteBookingMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteBooking}
              disabled={deleteBookingMutation.isPending}
            >
              {deleteBookingMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              {deleteBookingMutation.isPending ? "Deleting..." : "Delete Booking"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete booking <span className="font-semibold">{booking.code}</span>? This action cannot be undone.
        </p>
      </Modal>
      <Modal
        isOpen={isSuccessModalOpen}
        onClose={handleSuccessModalClose}
        title="Booking Deleted"
        footer={
          <Button onClick={handleSuccessModalClose}>
            Back to Bookings
          </Button>
        }
      >
        <div className="flex items-start space-x-3">
          <CheckCircle2 className="h-6 w-6 text-green-500 mt-1" />
          <div className="space-y-1">
            <p className="text-sm text-gray-700">
              Booking <span className="font-semibold">{booking.code}</span> has been deleted successfully.
            </p>
          </div>
        </div>
      </Modal>
    </PageLayout>
  )
}
