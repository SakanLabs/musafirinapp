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

  if (isLoading) {
    return (
      <PageLayout title="Loading..." subtitle="Loading service order details">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </PageLayout>
    )
  }

  if (error || !serviceOrder) {
    return (
      <PageLayout title="Error" subtitle="Failed to load service order details">
        <div className="text-center text-red-600 p-8">
          {error?.message || "Service order not found"}
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Service Order Details" subtitle={`SO Number: ${serviceOrder.number}`}>
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
              Back to Service Orders
            </Button>
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
