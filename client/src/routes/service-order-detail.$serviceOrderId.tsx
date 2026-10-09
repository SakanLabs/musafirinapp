import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ArrowLeft,
  FileText,
  Share,
  Calendar,
  Users,
  User,
  Phone,
  Loader2,
  Edit,
  Clock,
  Plane,
  DollarSign,
  Trash2,
  Receipt,
  RefreshCw,
  Eye,
  Building,
  Car,
  Link as LinkIcon,
  Package,
  CreditCard,
  Wallet,
  Banknote,
  Building2,
  CheckCircle2,
  Download,
  AlertCircle
} from "lucide-react"
import { authService } from "@/lib/auth"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  useServiceOrder,
  useDeleteServiceOrder,
  useGenerateServiceOrderInvoice,
  useServiceOrderInvoice,
  useRegenerateServiceOrderInvoice,
  useUpdateServiceOrderStatus,
  useServiceOrderBilling,
  usePayServiceOrder,
  useDeleteServiceOrderPayment,
  type ServiceOrderStatus
} from "@/lib/queries/serviceOrders"
import { DueDateModal } from "@/components/modals/DueDateModal"
import { StatusUpdateModal } from "@/components/modals/StatusUpdateModal"
import { ServiceOrderPaymentModal, type PaymentMethod } from "@/components/modals/ServiceOrderPaymentModal"
import { useState } from "react"

export const Route = createFileRoute("/service-order-detail/$serviceOrderId")({
  beforeLoad: async () => {
    // Check if user is authenticated
    const isAuthenticated = await authService.isAuthenticated()
    if (!isAuthenticated) {
      throw redirect({ to: "/login" })
    }
  },
  component: ServiceOrderDetailPage,
})

function ServiceOrderDetailPage() {
  const { serviceOrderId } = Route.useParams()
  const navigate = useNavigate()

  // State for modals
  const [isDueDateModalOpen, setIsDueDateModalOpen] = useState(false)
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [isRegenerateMode, setIsRegenerateMode] = useState(false)

  // Fetch service order data using TanStack Query
  const { data: serviceOrder, isLoading, error } = useServiceOrder(serviceOrderId)

  // Check if invoice already exists
  const { data: existingInvoice, isLoading: isInvoiceLoading } = useServiceOrderInvoice(serviceOrderId)

  // Fetch complete billing and payment records
  const { data: billingData, isLoading: isBillingLoading } = useServiceOrderBilling(serviceOrderId)

  // Mutations
  const deleteServiceOrder = useDeleteServiceOrder()
  const generateInvoice = useGenerateServiceOrderInvoice()
  const regenerateInvoice = useRegenerateServiceOrderInvoice()
  const updateStatus = useUpdateServiceOrderStatus()
  const payServiceOrder = usePayServiceOrder()
  const deletePayment = useDeleteServiceOrderPayment()

  const billingSummary = billingData?.summary
  const effectiveInvoice = billingData?.invoice || existingInvoice
  const paymentPercent = billingSummary && billingSummary.totalAmount > 0
    ? Math.min(100, Math.round((billingSummary.paidAmount / billingSummary.totalAmount) * 100))
    : 0

  const handleRecordPayment = async (data: {
    amount: number;
    method: PaymentMethod;
    referenceNumber?: string;
    description?: string;
    autoGenerateReceipt: boolean;
    sendEmail?: boolean;
    sendWhatsApp?: boolean;
  }) => {
    const result = await payServiceOrder.mutateAsync({
      serviceOrderId,
      amount: data.amount,
      method: data.method,
      referenceNumber: data.referenceNumber,
      description: data.description,
      autoGenerateReceipt: data.autoGenerateReceipt,
      sendEmail: data.sendEmail,
      sendWhatsApp: data.sendWhatsApp,
    })
    toast.success('Pembayaran berhasil dicatat!')
    if (result.data?.receipt?.number) {
      toast.info(`Kwitansi ${result.data.receipt.number} berhasil diterbitkan.`)
    }
  }

  const handleDeletePayment = async (paymentId: number, amount: number) => {
    if (!window.confirm(`Yakin ingin membatalkan/menghapus pembayaran sebesar ${formatCurrency(amount, billingSummary?.currency || serviceOrder?.currency || 'USD')} ini? Sisa tagihan dan status akan diperbarui otomatis.`)) {
      return
    }
    try {
      await deletePayment.mutateAsync({ serviceOrderId, paymentId })
      toast.success('Pembayaran berhasil dibatalkan/dihapus')
    } catch (err: any) {
      toast.error(err?.message || 'Gagal membatalkan pembayaran')
    }
  }

  const handleDownloadReceipt = (receiptNumber: string) => {
    import("@/lib/api").then(({ apiClient }) => {
      apiClient.downloadFile(`/api/receipts/number/${receiptNumber}/download`, `Receipt-${receiptNumber}.pdf`)
    })
  }

  const handleEdit = () => {
    navigate({ to: `/service-order-edit/${serviceOrderId}` })
  }

  const handleDelete = async () => {
    if (!serviceOrder) return

    const confirmed = window.confirm(
      `Are you sure you want to delete service order ${serviceOrder.number}? This action cannot be undone.`
    )

    if (confirmed) {
      try {
        await deleteServiceOrder.mutateAsync(serviceOrderId)
        toast.success('Service order deleted successfully!')
        navigate({ to: '/service-orders' })
      } catch (error) {
        console.error('Error deleting service order:', error)
        const msg = error instanceof Error ? error.message : 'An unexpected error occurred'
        toast.error(msg)
      }
    }
  }

  const handleShareWhatsApp = () => {
    if (!serviceOrder) return

    const message = `Service Order Details:
SO Number: ${serviceOrder.number || 'N/A'}
Client: ${serviceOrder.clientName || 'N/A'}
Product: ${serviceOrder.productType?.replace('_', ' ') || 'N/A'}
Group Leader: ${serviceOrder.groupLeaderName || 'N/A'}
Group Leader Phone: ${serviceOrder.groupLeaderPhone || 'N/A'}
Total People: ${serviceOrder.totalPeople || 0}
Departure: ${serviceOrder.departureDate ? formatDate(serviceOrder.departureDate) : 'N/A'}
Return: ${serviceOrder.returnDate ? formatDate(serviceOrder.returnDate) : 'N/A'}
Total: ${serviceOrder.totalPriceUSD ? formatCurrency(serviceOrder.totalPriceUSD, 'USD') : 'N/A'}`

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, '_blank')
  }

  const handleInvoiceSubmit = async (dueDate: string, options?: { sendEmail?: boolean; sendWhatsApp?: boolean }) => {
    if (!serviceOrder) return

    try {
      if (isRegenerateMode) {
        await regenerateInvoice.mutateAsync({
          serviceOrderId,
          customDueDate: dueDate,
          sendEmail: options?.sendEmail,
          sendWhatsApp: options?.sendWhatsApp,
        })
        toast.success('Invoice regenerated successfully!')
      } else {
        await generateInvoice.mutateAsync({
          serviceOrderId,
          customDueDate: dueDate,
          sendEmail: options?.sendEmail,
          sendWhatsApp: options?.sendWhatsApp,
        })
        toast.success('Invoice generated successfully!')
      }
      setIsDueDateModalOpen(false)
      setIsRegenerateMode(false)
    } catch (error) {
      console.error('Error with invoice:', error)
      const msg = error instanceof Error ? error.message : `Failed to ${isRegenerateMode ? 'regenerate' : 'generate'} invoice`
      toast.error(msg)
    }
  }

  const handleViewInvoice = () => {
    if (existingInvoice?.number) {
      import("@/lib/api").then(({ apiClient }) => {
        apiClient.downloadFile(`/api/invoices/by-number/${existingInvoice.number}`, `Invoice-${existingInvoice.number}.pdf`);
      });
    }
  }

  const openGenerateModal = () => {
    setIsRegenerateMode(false)
    setIsDueDateModalOpen(true)
  }

  const openRegenerateModal = () => {
    setIsRegenerateMode(true)
    setIsDueDateModalOpen(true)
  }

  const handleUpdateStatus = async (status: ServiceOrderStatus) => {
    if (!serviceOrder) return

    try {
      await updateStatus.mutateAsync({
        serviceOrderId,
        status
      })
      setIsStatusModalOpen(false)
      toast.success('Status updated successfully!')
    } catch (error) {
      console.error('Error updating status:', error)
      const msg = error instanceof Error ? error.message : 'An unexpected error occurred'
      toast.error(msg)
    }
  }

  if (isLoading) {
    return (
      <PageLayout title="Loading..." subtitle="Loading visa details">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </PageLayout>
    )
  }

  if (error || !serviceOrder) {
    return (
      <PageLayout title="Error" subtitle="Failed to load visa details">
        <div className="text-center text-red-600 p-8">
          {error?.message || "Visa not found"}
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="Visa Details"
      subtitle={`Visa Number: ${serviceOrder.number}`}
      actions={
        <div className="flex items-center space-x-2.5">
          {billingSummary && (
            <Badge
              variant="outline"
              className={`text-[10px] font-semibold py-0.5 px-2.5 rounded-full shadow-none capitalize ${
                billingSummary.paymentStatus === 'paid'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : billingSummary.paymentStatus === 'partial'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-zinc-100 text-zinc-600 border-zinc-200'
              }`}
            >
              {billingSummary.paymentStatus === 'paid' ? 'Lunas' : billingSummary.paymentStatus === 'partial' ? 'Sebagian' : 'Belum Bayar'}
            </Badge>
          )}
          <Badge variant="outline" className={`text-[10px] font-semibold py-0.5 px-2.5 rounded-full shadow-none capitalize ${getStatusColor(serviceOrder.status)}`}>
            {serviceOrder.status}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: "/service-orders" })}
            className="h-8 px-3 border-[#e5e7eb] hover:bg-gray-50 text-gray-700 font-medium rounded-md flex items-center space-x-1.5 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Visa</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Actions Toolbar */}
        <Card className="border border-[#e5e7eb] rounded-xl shadow-none bg-white p-4">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsStatusModalOpen(true)}
                disabled={updateStatus.isPending}
                className="h-9 px-4 border-[#e5e7eb] hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-md transition-colors flex items-center space-x-1.5"
              >
                {updateStatus.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 text-gray-400" />
                )}
                <span>Update Status</span>
              </Button>

              {/* Invoice & Payment Quick Actions */}
              {(!serviceOrder?.customLaRequestId) && (
                !isInvoiceLoading && existingInvoice ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleViewInvoice}
                      className="h-9 px-4 border-[#e5e7eb] hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-md transition-colors flex items-center space-x-1.5"
                    >
                      <Eye className="h-3.5 w-3.5 text-gray-400" />
                      <span>View Invoice</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openRegenerateModal}
                      disabled={regenerateInvoice.isPending}
                      className="h-9 px-4 border-[#e5e7eb] hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-md transition-colors flex items-center space-x-1.5"
                    >
                      {regenerateInvoice.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5 text-gray-400" />
                      )}
                      <span>Regenerate Invoice</span>
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openGenerateModal}
                    disabled={generateInvoice.isPending || isInvoiceLoading}
                    className="h-9 px-4 border-[#e5e7eb] hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-md transition-colors flex items-center space-x-1.5"
                  >
                    {generateInvoice.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Receipt className="h-3.5 w-3.5 text-gray-400" />
                    )}
                    <span>Generate Invoice</span>
                  </Button>
                )
              )}

              {/* Record Payment Button */}
              {billingSummary && billingSummary.remainingBalance > 0 && (
                <Button
                  size="sm"
                  onClick={() => setIsPaymentModalOpen(true)}
                  disabled={payServiceOrder.isPending}
                  className="h-9 px-4 bg-[#111111] hover:bg-[#242424] text-white font-semibold text-xs rounded-md transition-colors flex items-center space-x-1.5 shadow-none border border-transparent"
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  <span>Terima Pembayaran</span>
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={handleShareWhatsApp}
                className="h-9 px-4 border-[#e5e7eb] hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-md transition-colors flex items-center space-x-1.5"
              >
                <Share className="h-3.5 w-3.5 text-gray-400" />
                <span>Share</span>
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleEdit}
                className="h-9 px-4 border-[#e5e7eb] hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-md transition-colors flex items-center space-x-1.5"
              >
                <Edit className="h-3.5 w-3.5 text-gray-400" />
                <span>Edit</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                disabled={deleteServiceOrder.isPending}
                className="h-9 px-4 text-red-600 border-[#e5e7eb] hover:bg-red-50 hover:text-red-700 font-semibold text-xs rounded-md transition-colors flex items-center space-x-1.5"
              >
                {deleteServiceOrder.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                <span>Delete</span>
              </Button>
            </div>
          </div>
        </Card>

        {/* LA Integration Banner */}
        {serviceOrder.customLaRequestId && (
          <div className="bg-[#fcf8ff] border border-purple-100 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start space-x-3.5">
              <div className="p-2 bg-purple-50 rounded-lg text-purple-600 shrink-0">
                <Package className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-purple-800">Paket LA Terkait</p>
                <p className="text-sm text-purple-950/70 mt-0.5">Visa/Handling ini merupakan bagian dari Land Arrangement.</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={() => navigate({ to: `/custom-la-detail/${serviceOrder.customLaRequestId}` })}
              className="h-9 px-4 border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800 font-semibold text-xs rounded-md transition-colors"
            >
              Kembali ke Ringkasan LA
            </Button>
          </div>
        )}

        {/* Client Information */}
        <Card className="border border-[#e5e7eb] rounded-xl shadow-none bg-white">
          <CardHeader className="border-b border-gray-100 pb-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center space-x-2">
              <Users className="h-4 w-4 text-gray-400" />
              <span>Client Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-[#f5f5f5] rounded-lg">
                <Users className="h-4 w-4 text-gray-500" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Client Name</p>
                <p className="font-semibold text-gray-800 text-sm">{serviceOrder.clientName || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-[#f5f5f5] rounded-lg">
                <Plane className="h-4 w-4 text-gray-500" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Product Type</p>
                <p className="font-semibold text-gray-800 text-sm capitalize">{serviceOrder.productType?.replace('_', ' ') || 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Booking Details */}
        <Card className="border border-[#e5e7eb] rounded-xl shadow-none bg-white">
          <CardHeader className="border-b border-gray-100 pb-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center space-x-2">
              <FileText className="h-4 w-4 text-gray-400" />
              <span>Booking Details</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-[#f5f5f5] rounded-lg">
                <User className="h-4 w-4 text-gray-500" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Group Leader</p>
                <p className="font-semibold text-gray-800 text-sm">{serviceOrder.groupLeaderName || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-[#f5f5f5] rounded-lg">
                <Phone className="h-4 w-4 text-gray-500" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Group Leader Phone</p>
                <p className="font-semibold text-gray-800 text-sm font-mono">{serviceOrder.groupLeaderPhone || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-[#f5f5f5] rounded-lg">
                <Users className="h-4 w-4 text-gray-500" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Total People</p>
                <p className="font-semibold text-gray-800 text-sm">{serviceOrder.totalPeople} Pax</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Travel Information */}
        <Card className="border border-[#e5e7eb] rounded-xl shadow-none bg-white">
          <CardHeader className="border-b border-gray-100 pb-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span>Travel Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-[#f5f5f5] rounded-lg">
                <Calendar className="h-4 w-4 text-gray-500" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Departure Date</p>
                <p className="font-semibold text-gray-800 text-sm font-mono">{serviceOrder.departureDate ? formatDate(serviceOrder.departureDate) : 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-[#f5f5f5] rounded-lg">
                <Calendar className="h-4 w-4 text-gray-500" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Return Date</p>
                <p className="font-semibold text-gray-800 text-sm font-mono">{serviceOrder.returnDate ? formatDate(serviceOrder.returnDate) : 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hotel Information */}
        {serviceOrder.meta && (serviceOrder.meta.hotelMakkah?.name || serviceOrder.meta.hotelMadinah?.name) && (
          <Card className="border border-[#e5e7eb] rounded-xl shadow-none bg-white">
            <CardHeader className="border-b border-gray-100 pb-3">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center space-x-2">
                <Building className="h-4 w-4 text-gray-400" />
                <span>Hotel Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-4">
              {serviceOrder.meta.hotelMakkah?.name && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 border-b pb-1">Makkah Hotel</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block">Name</label>
                      <p className="font-semibold text-sm text-gray-800">{serviceOrder.meta.hotelMakkah.name}</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block">Check In</label>
                      <p className="font-semibold text-sm text-gray-800 font-mono">{serviceOrder.meta.hotelMakkah.checkIn ? formatDate(serviceOrder.meta.hotelMakkah.checkIn) : 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block">Check Out</label>
                      <p className="font-semibold text-sm text-gray-800 font-mono">{serviceOrder.meta.hotelMakkah.checkOut ? formatDate(serviceOrder.meta.hotelMakkah.checkOut) : 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}
              {serviceOrder.meta.hotelMadinah?.name && (
                <div className="space-y-2 pt-4 border-t border-gray-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 border-b pb-1">Madinah Hotel</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block">Name</label>
                      <p className="font-semibold text-sm text-gray-800">{serviceOrder.meta.hotelMadinah.name}</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block">Check In</label>
                      <p className="font-semibold text-sm text-gray-800 font-mono">{serviceOrder.meta.hotelMadinah.checkIn ? formatDate(serviceOrder.meta.hotelMadinah.checkIn) : 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block">Check Out</label>
                      <p className="font-semibold text-sm text-gray-800 font-mono">{serviceOrder.meta.hotelMadinah.checkOut ? formatDate(serviceOrder.meta.hotelMadinah.checkOut) : 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Transportation */}
        {serviceOrder.meta?.transportation && (
          <Card className="border border-[#e5e7eb] rounded-xl shadow-none bg-white">
            <CardHeader className="border-b border-gray-100 pb-3">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center space-x-2">
                <Car className="h-4 w-4 text-gray-400" />
                <span>Transportation</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#f9fafb] border border-[#e5e7eb] p-3.5 rounded-xl">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Route 1: Airport - Hotel</label>
                  <p className="text-sm font-semibold text-gray-800">{serviceOrder.meta.transportation.route1Vehicle || 'Not Specified'}</p>
                </div>
                <div className="bg-[#f9fafb] border border-[#e5e7eb] p-3.5 rounded-xl">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Route 2: City - City</label>
                  <p className="text-sm font-semibold text-gray-800">{serviceOrder.meta.transportation.route2Vehicle || 'Not Specified'}</p>
                </div>
                <div className="bg-[#f9fafb] border border-[#e5e7eb] p-3.5 rounded-xl">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Route 3: Hotel - Airport</label>
                  <p className="text-sm font-semibold text-gray-800">{serviceOrder.meta.transportation.route3Vehicle || 'Not Specified'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Jamaah List */}
        {serviceOrder.meta?.jamaah && serviceOrder.meta.jamaah.length > 0 && (
          <Card className="border border-[#e5e7eb] rounded-xl shadow-none bg-white overflow-hidden">
            <CardHeader className="border-b border-gray-100 py-4 px-6 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center space-x-2">
                  <Users className="h-4 w-4 text-gray-400" />
                  <span>Jamaah Details</span>
                </CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px] font-semibold py-0.5 px-2.5 border-[#e5e7eb] rounded-md shadow-none bg-gray-50 text-gray-600 font-mono">
                {serviceOrder.meta.jamaah.length} Pax
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto w-full">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-[#f9fafb]">
                    <tr className="border-b border-[#e5e7eb]">
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-6 py-3">No</th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-6 py-3">Nama</th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-6 py-3">No. Paspor</th>
                      <th className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-6 py-3 text-right">L/P</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5e7eb]">
                    {serviceOrder.meta.jamaah.map((j: any, index: number) => (
                      <tr key={index} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-3 text-gray-500 font-mono">{index + 1}</td>
                        <td className="px-6 py-3 font-semibold text-gray-800">{j.name}</td>
                        <td className="px-6 py-3 font-mono text-gray-600">{j.passportNo}</td>
                        <td className="px-6 py-3 text-right font-medium text-gray-600">{j.gender === 'L' ? 'Laki-laki' : j.gender === 'P' ? 'Perempuan' : j.gender}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Documents Link */}
        {serviceOrder.meta?.googleDriveLink && (
          <Card className="border border-[#e5e7eb] rounded-xl shadow-none bg-white">
            <CardHeader className="border-b border-gray-100 pb-3">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center space-x-2">
                <LinkIcon className="h-4 w-4 text-gray-400" />
                <span>Documents Folder</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <a 
                href={serviceOrder.meta.googleDriveLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center h-9 px-4 bg-[#111111] hover:bg-[#242424] text-white font-semibold text-xs rounded-md transition-colors border border-transparent shadow-sm"
              >
                <LinkIcon className="h-3.5 w-3.5 mr-2" />
                Open Google Drive Folder
              </a>
              <p className="mt-2 text-xs text-gray-400">
                Contains all jamaah documents (Visa, Passport, KTP, KK, etc).
              </p>
            </CardContent>
          </Card>
        )}

        {/* Tagihan & Pembayaran (Billing & Payments) */}
        <Card className="border border-[#e5e7eb] rounded-xl shadow-none bg-white overflow-hidden">
          <CardHeader className="bg-zinc-50/60 border-b border-[#e5e7eb] px-6 py-4 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white border border-zinc-200/80 rounded-lg shadow-2xs">
                <Receipt className="h-4 w-4 text-zinc-700" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold text-zinc-900 tracking-tight flex items-center gap-2">
                  <span>Tagihan & Pembayaran</span>
                  {effectiveInvoice?.number && (
                    <span className="font-mono text-xs font-semibold text-zinc-500">
                      ({effectiveInvoice.number})
                    </span>
                  )}
                  {billingSummary && (
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md ${
                        billingSummary.paymentStatus === 'paid'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                          : billingSummary.paymentStatus === 'partial'
                          ? 'bg-amber-50 text-amber-700 border-amber-200/60'
                          : 'bg-zinc-100 text-zinc-600 border-zinc-200/60'
                      }`}
                    >
                      {billingSummary.paymentStatus === 'paid' ? 'Lunas' : billingSummary.paymentStatus === 'partial' ? 'Cicilan' : 'Belum Bayar'}
                    </Badge>
                  )}
                </CardTitle>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Kelola tagihan, pencatatan pembayaran masuk, dan kwitansi resmi visa.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {effectiveInvoice?.pdfUrl && (
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

              {effectiveInvoice && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openRegenerateModal}
                  disabled={regenerateInvoice.isPending}
                  className="h-8 px-3 border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-xs font-medium"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5 text-zinc-400" />
                  <span>Perbarui PDF</span>
                </Button>
              )}

              {(!effectiveInvoice) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openGenerateModal}
                  disabled={generateInvoice.isPending}
                  className="h-8 px-3 border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-xs font-medium"
                >
                  <FileText className="h-3.5 w-3.5 mr-1.5 text-zinc-400" />
                  <span>Terbitkan Invoice</span>
                </Button>
              )}

              {billingSummary && billingSummary.remainingBalance > 0 && (
                <Button
                  size="sm"
                  onClick={() => setIsPaymentModalOpen(true)}
                  disabled={payServiceOrder.isPending}
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
                  {formatCurrency(billingSummary?.totalAmount || serviceOrder.totalPriceUSD, billingSummary?.currency || serviceOrder.currency || 'USD')}
                </p>
                <p className="text-[11px] font-mono text-zinc-400">
                  {serviceOrder.totalPeople} Jamaah ({formatCurrency(serviceOrder.unitPriceUSD, 'USD')}/pax)
                </p>
              </div>

              <div className="space-y-1 border-t md:border-t-0 md:border-l border-zinc-200/60 pt-3 md:pt-0 md:pl-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Telah Dibayar</span>
                <p className="text-xl font-bold font-mono text-emerald-600">
                  {formatCurrency(billingSummary?.paidAmount || 0, billingSummary?.currency || serviceOrder.currency || 'USD')}
                </p>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{paymentPercent}% Terbayar</span>
                </div>
              </div>

              <div className="space-y-1 border-t md:border-t-0 md:border-l border-zinc-200/60 pt-3 md:pt-0 md:pl-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Sisa Tagihan</span>
                <p className={`text-xl font-bold font-mono ${
                  (billingSummary?.remainingBalance || 0) === 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {formatCurrency(billingSummary?.remainingBalance ?? serviceOrder.totalPriceUSD, billingSummary?.currency || serviceOrder.currency || 'USD')}
                </p>
                <p className="text-[11px] text-zinc-400">
                  {(billingSummary?.remainingBalance || 0) === 0 ? 'Semua tagihan lunas' : 'Menunggu pelunasan'}
                </p>
              </div>
            </div>

            {/* Riwayat Pembayaran & Kwitansi */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-600">
                  Riwayat Pembayaran & Kwitansi Resmi
                </h4>
                <span className="text-xs text-zinc-400 font-medium">
                  {billingData?.payments?.length || 0} transaksi tercatat
                </span>
              </div>

              {billingData?.payments && billingData.payments.length > 0 ? (
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
                      {billingData.payments.map((p) => {
                        const receiptNumber = p.receiptNumber || billingData.receipts?.find(r => 
                          (r.meta?.paymentId && r.meta.paymentId === p.id) ||
                          (r.meta?.referenceNumber && r.meta.referenceNumber === p.referenceNumber) ||
                          (r.meta?.termin && r.meta.termin === p.termin) ||
                          (parseFloat(r.paidAmount) === parseFloat(p.amount))
                        )?.number || (billingData.receipts?.length === 1 && billingData.payments.length === 1 ? billingData.receipts[0]?.number : null);

                        return (
                          <tr key={p.id} className="hover:bg-zinc-50/60 transition-colors">
                            <td className="py-3 px-4 font-mono text-zinc-700">
                              {formatDate(p.paidAt)}
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
                                {p.terminLabel ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                                    {p.terminLabel}
                                  </span>
                                ) : null}
                                <span className="font-mono text-zinc-800">{p.referenceNumber || '-'}</span>
                              </div>
                              {p.meta?.description && (
                                <div className="text-[11px] text-zinc-500 mt-0.5">{p.meta.description}</div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 text-sm">
                              {formatCurrency(p.amount, p.currency || billingSummary?.currency || serviceOrder.currency || 'USD')}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end space-x-2">
                                {receiptNumber ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDownloadReceipt(receiptNumber)}
                                    className="h-7 text-[11px] px-2.5 font-medium border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 inline-flex items-center space-x-1"
                                    title="Download Kwitansi PDF"
                                  >
                                    <Receipt className="w-3 h-3 text-zinc-500" />
                                    <span>{receiptNumber}</span>
                                  </Button>
                                ) : (
                                  <span className="text-zinc-400 text-[11px] italic mr-1">-</span>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeletePayment(p.id, parseFloat(p.amount))}
                                  disabled={deletePayment.isPending}
                                  className="h-7 w-7 p-0 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded"
                                  title="Batalkan / Hapus Pembayaran Ini"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-6 border border-dashed border-zinc-200 rounded-lg">
                  <CreditCard className="w-6 h-6 text-zinc-300 mx-auto mb-2" />
                  <p className="text-xs text-zinc-500 font-medium">Belum ada riwayat pembayaran yang dicatat.</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Klik tombol "Terima Pembayaran" di atas untuk mencatat pembayaran klien.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pricing Information */}
        <Card className="border border-[#e5e7eb] rounded-xl shadow-none bg-white">
          <CardHeader className="border-b border-gray-100 pb-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-gray-400" />
              <span>Pricing Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block mb-0.5">Unit Price (USD)</label>
              <p className="text-lg font-bold text-gray-800 font-mono">{formatCurrency(serviceOrder.unitPriceUSD, 'USD')}</p>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block mb-0.5">Total Price (USD)</label>
              <p className="text-lg font-bold text-blue-600 font-mono">{formatCurrency(serviceOrder.totalPriceUSD, 'USD')}</p>
            </div>
          </CardContent>
        </Card>

        {/* Timestamps */}
        <Card className="border border-[#e5e7eb] rounded-xl shadow-none bg-white">
          <CardHeader className="border-b border-gray-100 pb-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center space-x-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <span>Order Metadata</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block mb-0.5">Created At</label>
              <p className="text-sm font-semibold text-gray-800 font-mono">{serviceOrder.createdAt ? formatDate(serviceOrder.createdAt) : 'N/A'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <DueDateModal
        isOpen={isDueDateModalOpen}
        onClose={() => {
          setIsDueDateModalOpen(false)
          setIsRegenerateMode(false)
        }}
        onSubmit={handleInvoiceSubmit}
        isLoading={isRegenerateMode ? regenerateInvoice.isPending : generateInvoice.isPending}
      />

      <StatusUpdateModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        onSubmit={handleUpdateStatus}
        currentStatus={serviceOrder.status}
        isLoading={updateStatus.isPending}
      />

      <ServiceOrderPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        orderNumber={serviceOrder.number}
        totalAmount={billingSummary?.totalAmount || parseFloat(serviceOrder.totalPriceUSD)}
        paidAmount={billingSummary?.paidAmount || 0}
        remainingBalance={billingSummary?.remainingBalance ?? parseFloat(serviceOrder.totalPriceUSD)}
        currency={billingSummary?.currency || serviceOrder.currency || 'USD'}
        clientName={serviceOrder.clientName || serviceOrder.groupLeaderName}
        clientDepositBalance={billingSummary?.clientDepositBalance || 0}
        onSubmit={handleRecordPayment}
        isLoading={payServiceOrder.isPending}
      />
    </PageLayout>
  )
}

function getStatusColor(status: string) {
  switch (status) {
    case 'draft':
      return 'bg-gray-100 text-gray-800 border-gray-200'
    case 'submitted':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'paid':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'cancelled':
      return 'bg-red-100 text-red-800 border-red-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}