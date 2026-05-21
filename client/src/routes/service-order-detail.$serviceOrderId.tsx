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
  Link as LinkIcon
} from "lucide-react"
import { authService } from "@/lib/auth"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useServiceOrder, useDeleteServiceOrder, useGenerateServiceOrderInvoice, useServiceOrderInvoice, useRegenerateServiceOrderInvoice, useUpdateServiceOrderStatus, type ServiceOrderStatus } from "@/lib/queries/serviceOrders"
import { DueDateModal } from "@/components/modals/DueDateModal"
import { StatusUpdateModal } from "@/components/modals/StatusUpdateModal"
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
  const [isRegenerateMode, setIsRegenerateMode] = useState(false)

  // Fetch service order data using TanStack Query
  const { data: serviceOrder, isLoading, error } = useServiceOrder(serviceOrderId)

  // Check if invoice already exists
  const { data: existingInvoice, isLoading: isInvoiceLoading } = useServiceOrderInvoice(serviceOrderId)

  // Mutations
  const deleteServiceOrder = useDeleteServiceOrder()
  const generateInvoice = useGenerateServiceOrderInvoice()
  const regenerateInvoice = useRegenerateServiceOrderInvoice()
  const updateStatus = useUpdateServiceOrderStatus()

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

  const handleInvoiceSubmit = async (dueDate: string) => {
    if (!serviceOrder) return

    try {
      if (isRegenerateMode) {
        await regenerateInvoice.mutateAsync({
          serviceOrderId,
          customDueDate: dueDate
        })
        toast.success('Invoice regenerated successfully!')
      } else {
        await generateInvoice.mutateAsync({
          serviceOrderId,
          customDueDate: dueDate
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
    if (existingInvoice?.pdfUrl) {
      window.open(existingInvoice.pdfUrl, '_blank')
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
    <PageLayout title="Visa Details" subtitle={`Visa Number: ${serviceOrder.number}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: "/service-orders" })}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Visa
            </Button>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEdit}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={deleteServiceOrder.isPending}
            >
              {deleteServiceOrder.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleShareWhatsApp}
            >
              <Share className="h-4 w-4 mr-2" />
              Share
            </Button>
            {/* Invoice buttons - show different buttons based on whether invoice exists */}
            {!isInvoiceLoading && existingInvoice ? (
              // Show View and Regenerate buttons if invoice exists
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleViewInvoice}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Invoice
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openRegenerateModal}
                  disabled={regenerateInvoice.isPending}
                >
                  {regenerateInvoice.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Regenerate Invoice
                </Button>
              </>
            ) : (
              // Show Generate button if no invoice exists
              <Button
                variant="outline"
                size="sm"
                onClick={openGenerateModal}
                disabled={generateInvoice.isPending || isInvoiceLoading}
              >
                {generateInvoice.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Receipt className="h-4 w-4 mr-2" />
                )}
                Generate Invoice
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsStatusModalOpen(true)}
              disabled={updateStatus.isPending}
            >
              {updateStatus.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Update Status
            </Button>
          </div>
        </div>

        {/* Service Order Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Order Status</span>
              <Badge
                className={getStatusColor(serviceOrder.status)}
              >
                {serviceOrder.status}
              </Badge>
            </CardTitle>
          </CardHeader>
        </Card>

        {/* Client Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Client Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Client Name</label>
                <p className="text-lg">{serviceOrder.clientName || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Product Type</label>
                <div className="flex items-center">
                  <Plane className="h-4 w-4 mr-2 text-gray-400" />
                  <p className="capitalize">{serviceOrder.productType?.replace('_', ' ') || 'N/A'}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Booking Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Booking Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Group Leader</label>
                <p className="text-lg">{serviceOrder.groupLeaderName || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Group Leader Phone</label>
                <div className="flex items-center">
                  <Phone className="h-4 w-4 mr-2 text-gray-400" />
                  <p className="text-lg">{serviceOrder.groupLeaderPhone || 'N/A'}</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Total People</label>
                <div className="flex items-center">
                  <Users className="h-4 w-4 mr-2 text-gray-400" />
                  <p className="text-lg">{serviceOrder.totalPeople} people</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Travel Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Travel Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Departure Date</label>
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                  <p className="text-lg">{serviceOrder.departureDate ? formatDate(serviceOrder.departureDate) : 'N/A'}</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Return Date</label>
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                  <p className="text-lg">{serviceOrder.returnDate ? formatDate(serviceOrder.returnDate) : 'N/A'}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hotel Information */}
        {serviceOrder.meta && (serviceOrder.meta.hotelMakkah?.name || serviceOrder.meta.hotelMadinah?.name) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building className="h-5 w-5 mr-2" />
                Hotel Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {serviceOrder.meta.hotelMakkah?.name && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2 border-b pb-1">Makkah Hotel</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Name</label>
                      <p className="text-base">{serviceOrder.meta.hotelMakkah.name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Check In</label>
                      <p className="text-base">{serviceOrder.meta.hotelMakkah.checkIn ? formatDate(serviceOrder.meta.hotelMakkah.checkIn) : 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Check Out</label>
                      <p className="text-base">{serviceOrder.meta.hotelMakkah.checkOut ? formatDate(serviceOrder.meta.hotelMakkah.checkOut) : 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}
              {serviceOrder.meta.hotelMadinah?.name && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2 border-b pb-1">Madinah Hotel</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Name</label>
                      <p className="text-base">{serviceOrder.meta.hotelMadinah.name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Check In</label>
                      <p className="text-base">{serviceOrder.meta.hotelMadinah.checkIn ? formatDate(serviceOrder.meta.hotelMadinah.checkIn) : 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Check Out</label>
                      <p className="text-base">{serviceOrder.meta.hotelMadinah.checkOut ? formatDate(serviceOrder.meta.hotelMadinah.checkOut) : 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Transportation */}
        {serviceOrder.meta?.transportation && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Car className="h-5 w-5 mr-2" />
                Transportation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 p-3 rounded-md">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1">Route 1: Airport - Hotel</label>
                  <p className="text-base font-semibold">{serviceOrder.meta.transportation.route1Vehicle || 'Not Specified'}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-md">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1">Route 2: City - City</label>
                  <p className="text-base font-semibold">{serviceOrder.meta.transportation.route2Vehicle || 'Not Specified'}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-md">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1">Route 3: Hotel - Airport</label>
                  <p className="text-base font-semibold">{serviceOrder.meta.transportation.route3Vehicle || 'Not Specified'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Jamaah List */}
        {serviceOrder.meta?.jamaah && serviceOrder.meta.jamaah.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Jamaah Details
                </div>
                <Badge variant="outline">{serviceOrder.meta.jamaah.length} People</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 rounded-tl-md">No</th>
                      <th className="px-4 py-3">Nama</th>
                      <th className="px-4 py-3">No. Paspor</th>
                      <th className="px-4 py-3 rounded-tr-md">L/P</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serviceOrder.meta.jamaah.map((j: any, index: number) => (
                      <tr key={index} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3">{index + 1}</td>
                        <td className="px-4 py-3 font-medium">{j.name}</td>
                        <td className="px-4 py-3">{j.passportNo}</td>
                        <td className="px-4 py-3">{j.gender === 'L' ? 'Laki-laki' : j.gender === 'P' ? 'Perempuan' : j.gender}</td>
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <LinkIcon className="h-5 w-5 mr-2" />
                Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <a 
                href={serviceOrder.meta.googleDriveLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <LinkIcon className="h-4 w-4 mr-2" />
                Open Google Drive Folder
              </a>
              <p className="mt-2 text-sm text-gray-500">
                Contains all jamaah documents (Visa, Passport, KTP, KK, etc).
              </p>
            </CardContent>
          </Card>
        )}

        {/* Pricing Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <DollarSign className="h-5 w-5 mr-2" />
              Pricing Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Unit Price (USD)</label>
                <p className="text-lg font-semibold">{formatCurrency(serviceOrder.unitPriceUSD, 'USD')}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Total Price (USD)</label>
                <p className="text-lg font-semibold text-green-600">{formatCurrency(serviceOrder.totalPriceUSD, 'USD')}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Total Price (SAR)</label>
                <p className="text-lg font-semibold text-blue-600">{formatCurrency(serviceOrder.totalPriceSAR, 'SAR')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timestamps */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="h-5 w-5 mr-2" />
              Order Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Created At</label>
                <p className="text-lg">{serviceOrder.createdAt ? formatDate(serviceOrder.createdAt) : 'N/A'}</p>
              </div>
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