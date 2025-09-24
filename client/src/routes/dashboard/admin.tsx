import { createFileRoute, redirect } from "@tanstack/react-router"
import { PageLayout } from "@/components/layout/PageLayout"
import { StatCard } from "@/components/ui/stat-card"
import { DataTable, Column } from "@/components/ui/data-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Calendar,
  FileText,
  Ticket,
  Hotel,
  Users,
  TrendingUp,
  Eye,
  Share,
  Plus,
  Loader2
} from "lucide-react"
import { SARCurrency } from "@/components/ui/sar-currency"
import { formatCurrency, formatDate, getPaymentStatusColor, getBookingStatusColor, shareToWhatsApp, generateBookingWhatsAppMessage } from "@/lib/utils"
import { useDashboardSummary } from "@/lib/queries"
import { authService } from "@/lib/auth"

export const Route = createFileRoute("/dashboard/admin")({
  beforeLoad: async () => {
    // Check if user is authenticated
    const isAuthenticated = await authService.isAuthenticated()
    if (!isAuthenticated) {
      throw redirect({ to: "/login" })
    }
  },
  component: AdminDashboard
})

function AdminDashboard() {
  // Fetch dashboard data using TanStack Query
  const { data: dashboardData, isLoading, error } = useDashboardSummary();

  // Show loading state
  if (isLoading) {
    return (
      <PageLayout title="Dashboard" subtitle="Hotel Booking Management Overview">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          <span className="ml-2 text-gray-500">Loading dashboard data...</span>
        </div>
      </PageLayout>
    );
  }

  // Show error state
  if (error) {
    return (
      <PageLayout title="Dashboard" subtitle="Hotel Booking Management Overview">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-red-600 mb-4">Error loading dashboard data</p>
            <Button onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        </div>
      </PageLayout>
    );
  }

  // Ensure dashboardData exists
  if (!dashboardData) {
    return (
      <PageLayout title="Dashboard" subtitle="Hotel Booking Management Overview">
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">No data available</p>
        </div>
      </PageLayout>
    );
  }

  // Define columns for recent bookings table
  const bookingColumns: Column<typeof dashboardData.recentBookings[0]>[] = [
    {
      key: 'id',
      header: 'ID',
      sortable: true,
      width: 'w-24'
    },
    {
      key: 'guestName',
      header: 'Guest',
      sortable: true
    },
    {
      key: 'hotelName',
      header: 'Hotel',
      sortable: true
    },
    {
      key: 'roomType',
      header: 'Room Type',
      sortable: true
    },
    {
      key: 'checkInDate',
      header: 'Check-in',
      render: (booking) => formatDate(booking.checkInDate),
      sortable: true,
      width: 'w-28'
    },
    {
      key: 'totalAmount',
      header: 'Total',
      render: (booking) => formatCurrency(booking.totalAmount.toString(), 'SAR'),
      sortable: true,
      width: 'w-32'
    },
    {
      key: 'status',
      header: 'Status',
      render: (booking) => (
        <Badge className={getBookingStatusColor(booking.status)}>
          {booking.status}
        </Badge>
      ),
      sortable: true,
      width: 'w-24'
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (booking) => (
        <div className="flex space-x-2">
          <Button size="sm" variant="ghost">
            <Eye className="h-4 w-4" />
          </Button>
          <Button 
            size="sm" 
            variant="ghost"
            onClick={() => handleShareWhatsApp(booking)}
          >
            <Share className="h-4 w-4" />
          </Button>
        </div>
      ),
      width: 'w-24'
    }
  ]

  const handleShareWhatsApp = (booking: typeof dashboardData.recentBookings[0]) => {
    const message = generateBookingWhatsAppMessage({
      code: booking.id,
      clientName: booking.guestName,
      hotelName: booking.roomType,
      checkIn: booking.checkInDate,
      checkOut: booking.checkInDate, // Using checkInDate as placeholder since checkOut is not in the API response
      totalAmount: booking.totalAmount.toString(),
      currency: 'SAR'
    })
    
    shareToWhatsApp({ message })
  }

  return (
    <PageLayout
      title="Dashboard"
      subtitle="Hotel Booking Management Overview"
      actions={
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Booking
        </Button>
      }
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Bookings"
          value={dashboardData.totalBookings.toString()}
          change={{
            value: "+12%", // Placeholder - you can calculate this from monthlyRevenue data
            type: 'increase'
          }}
          icon={Calendar}
        />
        
        <StatCard
          title="Total Revenue"
          value={formatCurrency(dashboardData.totalRevenue.toString())}
          change={{
            value: "+8%", // Placeholder - you can calculate this from monthlyRevenue data
            type: 'increase'
          }}
          icon={SARCurrency}
        />
        
        <StatCard
          title="Pending Invoices"
          value={dashboardData.pendingInvoices.toString()}
          change={{
            value: "-3%", // Placeholder
            type: 'decrease'
          }}
          icon={FileText}
        />
        
        <StatCard
          title="Total Vouchers"
          value={dashboardData.totalVouchers.toString()}
          change={{
            value: "+15%", // Placeholder
            type: 'increase'
          }}
          icon={Ticket}
        />
      </div>

      {/* Recent Bookings */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Bookings</h2>
          <Button variant="outline" size="sm">
            View All
          </Button>
        </div>
        
        <DataTable
          data={dashboardData.recentBookings}
          columns={bookingColumns}
          emptyMessage="No bookings found"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Hotel className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Manage Hotels</h3>
          </div>
          <p className="text-gray-600 mb-4">Add, edit, or remove hotels from your inventory.</p>
          <Button variant="outline" className="w-full">
            Manage Hotels
          </Button>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="bg-green-100 p-2 rounded-lg">
              <Users className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Client Management</h3>
          </div>
          <p className="text-gray-600 mb-4">View and manage your client database.</p>
          <Button variant="outline" className="w-full">
            Manage Clients
          </Button>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="bg-purple-100 p-2 rounded-lg">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Reports</h3>
          </div>
          <p className="text-gray-600 mb-4">Generate detailed reports and analytics.</p>
          <Button variant="outline" className="w-full">
            View Reports
          </Button>
        </div>
      </div>
    </PageLayout>
  )
}