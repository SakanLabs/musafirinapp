import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
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
  Clock,
  Plane,
  DollarSign
} from "lucide-react"
import { authService } from "@/lib/auth"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useServiceOrder } from "@/lib/queries/serviceOrders"

export const Route = createFileRoute("/service-orders/$id")({
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
  const { id } = Route.useParams()
  const navigate = useNavigate()
  
  // Fetch service order data using TanStack Query
  const { data: serviceOrder, isLoading, error } = useServiceOrder(id)

  const handleShareWhatsApp = () => {
    if (!serviceOrder) return
    
    const message = `Visa Details:
- Number: ${serviceOrder.number}
- Client: ${serviceOrder.clientName}
- Product: ${serviceOrder.productType}
- Total Pax: ${serviceOrder.totalPeople}
- Status: ${serviceOrder.status}`
    const encodedMessage = encodeURIComponent(message)
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank')
  }

  const handleEdit = () => {
    navigate({ to: `/service-order-edit/${serviceOrderId}` })
  }

  // Loading state
  if (isLoading) {
    return (
      <PageLayout title="Loading...">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading visa details...</span>
        </div>
      </PageLayout>
    )
  }

  // Error state
  if (error) {
    return (
      <PageLayout title="Error">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-red-600 mb-4">Failed to load visa details</p>
            <Button onClick={() => navigate({ to: "/service-orders" })}>
              Back to Visa
            </Button>
          </div>
        </div>
      </PageLayout>
    )
  }

  // No data state
  if (!serviceOrder) {
    return (
      <PageLayout title="Not Found">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-gray-600 mb-4">Visa not found</p>
            <Button onClick={() => navigate({ to: "/service-orders" })}>
              Back to Visa
            </Button>
          </div>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Visa Details" subtitle={`Visa Number: ${serviceOrder.number}`}>
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: '/service-orders' })}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Visa
            </Button>
            <Badge className={getStatusColor(serviceOrder.status)}>
              {serviceOrder.status.toUpperCase()}
            </Badge>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={handleShareWhatsApp}>
              <MessageCircle className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button variant="outline" size="sm" onClick={handleEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </div>

        {/* Visa Status */}
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
                <p className="text-lg">{serviceOrder.clientName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Product Type</label>
                <div className="flex items-center">
                  <Plane className="h-4 w-4 mr-2 text-gray-400" />
                  <p className="capitalize">{serviceOrder.productType.replace('_', ' ')}</p>
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
                <p className="text-lg">{serviceOrder.groupLeaderName}</p>
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
