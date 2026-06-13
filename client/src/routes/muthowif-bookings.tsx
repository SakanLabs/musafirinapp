import { createFileRoute, redirect, Link } from "@tanstack/react-router"
import { useState } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Users,
  Search,
  Plus,
  Loader2,
  Calendar,
  MapPin,
  ChevronRight
} from "lucide-react"
import { authService } from "@/lib/auth"
import { useMuthowifBookings } from "@/lib/queries/muthowifBookings"
import { formatCurrency } from "@/lib/utils"

export const Route = createFileRoute("/muthowif-bookings")({
  beforeLoad: async () => {
    const isAuthenticated = await authService.isAuthenticated()

    if (!isAuthenticated) {
      throw redirect({ to: "/login" })
    }
  },
  component: MuthowifBookingsPage
})

function MuthowifBookingsPage() {
  const { data: bookings = [], isLoading } = useMuthowifBookings()
  const [search, setSearch] = useState("")

  const filteredBookings = bookings.filter((b: any) => 
    b.number.toLowerCase().includes(search.toLowerCase()) || 
    b.guestName.toLowerCase().includes(search.toLowerCase()) ||
    b.event.toLowerCase().includes(search.toLowerCase())
  )

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'confirmed': return "bg-emerald-100 text-emerald-800 border-emerald-200"
      case 'completed': return "bg-blue-100 text-blue-800 border-blue-200"
      case 'cancelled': return "bg-red-100 text-red-800 border-red-200"
      default: return "bg-amber-100 text-amber-800 border-amber-200" // pending
    }
  }

  return (
    <PageLayout title="Muthowif Bookings">
      <div className="max-w-7xl mx-auto pb-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Muthowif Orders</h1>
            <p className="text-sm md:text-base text-slate-500 mt-1">Manage umrah and city tour guide bookings.</p>
          </div>
          
          <Link to="/create-muthowif-booking">
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              New Order
            </Button>
          </Link>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-6">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by order #, guest name, or event..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-white"
              />
            </div>
            <div className="hidden sm:block text-sm font-medium text-slate-500">
              {filteredBookings.length} {filteredBookings.length === 1 ? 'order' : 'orders'}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <th className="px-6 py-4 font-semibold">Order Number</th>
                  <th className="px-6 py-4 font-semibold">Guest Details</th>
                  <th className="px-6 py-4 font-semibold">Event</th>
                  <th className="px-6 py-4 font-semibold">Date & Time</th>
                  <th className="px-6 py-4 font-semibold">Total Amount</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto mb-2" />
                      <p className="text-slate-500">Loading orders...</p>
                    </td>
                  </tr>
                ) : filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="bg-slate-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Users className="w-6 h-6 text-slate-400" />
                      </div>
                      <p className="text-slate-900 font-medium">No orders found</p>
                      <p className="text-slate-500 mt-1">Try adjusting your search or create a new order.</p>
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map((booking: any) => (
                    <tr key={booking.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4">
                        <span className="font-mono font-medium text-slate-900">{booking.number}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{booking.guestName}</div>
                        <div className="text-slate-500 text-xs mt-0.5 flex items-center gap-1">
                          <Users className="w-3 h-3" /> {booking.totalPax} Pax
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium text-slate-700">{booking.event}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-slate-700 flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          {new Date(booking.dateTime).toLocaleDateString()}
                        </div>
                        <div className="text-slate-500 text-xs mt-0.5 ml-5.5">
                          {new Date(booking.dateTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-slate-900">
                          {booking.currency} {formatCurrency(parseFloat(booking.totalAmount), booking.currency)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className={`${getStatusColor(booking.status)} capitalize px-2.5 py-0.5`}>
                          {booking.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link to={`/muthowif-booking-detail/${booking.id}`}>
                          <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
                            Details
                            <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageLayout>
  )
}
