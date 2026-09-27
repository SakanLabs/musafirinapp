import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
import { useState } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import {
  Users,
  Calendar,
  MapPin,
  Save,
  ArrowLeft,
  Loader2,
  Tag,
  AlignLeft,
  Banknote
} from "lucide-react"
import { authService } from "@/lib/auth"
import { useCreateMuthowifBooking } from "@/lib/queries/muthowifBookings"
import { useClients } from "@/lib/queries"

export const Route = createFileRoute("/create-muthowif-booking")({
  beforeLoad: async () => {
    const isAuthenticated = await authService.isAuthenticated()

    if (!isAuthenticated) {
      throw redirect({ to: "/login" })
    }
  },
  component: CreateMuthowifBookingPage
})

function CreateMuthowifBookingPage() {
  const navigate = useNavigate()
  const createBookingMutation = useCreateMuthowifBooking()
  const { data: clients = [], isLoading: isClientsLoading } = useClients()

  const [formData, setFormData] = useState({
    clientId: "",
    guestName: "",
    dateTime: "",
    events: ["Umrah"],
    totalPax: 1,
    meetingPoint: "",
    totalAmount: 0,
    notes: "",
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleClientChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const clientId = e.target.value
    setFormData(prev => ({ ...prev, clientId }))
    
    if (clientId) {
      const selectedClient = clients.find(c => c.id.toString() === clientId)
      if (selectedClient && !formData.guestName) {
        setFormData(prev => ({ ...prev, guestName: selectedClient.name }))
      }
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.clientId) newErrors.clientId = "Client is required"
    if (!formData.guestName) newErrors.guestName = "Guest name is required"
    if (!formData.dateTime) newErrors.dateTime = "Date and time is required"
    if (!formData.meetingPoint) newErrors.meetingPoint = "Meeting point is required"
    if (formData.totalPax < 1) newErrors.totalPax = "Total pax must be at least 1"
    if (formData.totalAmount < 0) newErrors.totalAmount = "Amount cannot be negative"
    if (formData.events.length === 0) newErrors.events = "At least one event is required"
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      toast.error("Please fill in all required fields correctly")
      return
    }

    try {
      const result = await createBookingMutation.mutateAsync({
        clientId: parseInt(formData.clientId),
        guestName: formData.guestName,
        dateTime: formData.dateTime,
        events: formData.events,
        totalPax: formData.totalPax,
        meetingPoint: formData.meetingPoint,
        totalAmount: formData.totalAmount,
        notes: formData.notes,
      })
      
      toast.success("Muthowif booking created successfully")
      navigate({ to: `/muthowif-booking-detail/${result.id}` })
    } catch (error) {
      console.error("Failed to create muthowif booking:", error)
      toast.error("Failed to create muthowif booking")
    }
  }

  return (
    <PageLayout title="Create Muthowif Booking">
      <div className="max-w-4xl mx-auto pb-12">
        <div className="flex items-center gap-4 mb-6 md:mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate({ to: "/muthowif-bookings" })}
            className="rounded-full hover:bg-slate-100"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">New Muthowif Booking</h1>
            <p className="text-sm md:text-base text-slate-500 mt-1">Fill in the details to create a new muthowif booking order.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8">
          {/* Client & Event Section */}
          <Card className="p-4 md:p-6 border-slate-200 shadow-sm bg-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -z-10 opacity-50"></div>
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 bg-indigo-100 rounded-lg text-indigo-700">
                <Users className="w-5 h-5" />
              </div>
              <h2 className="text-lg md:text-xl font-bold text-slate-800">Client & Event Details</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Select Client <span className="text-red-500">*</span></label>
                <select
                  className={`flex h-10 w-full rounded-md border ${errors.clientId ? 'border-red-500' : 'border-slate-300'} bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50`}
                  value={formData.clientId}
                  onChange={handleClientChange}
                  disabled={isClientsLoading}
                >
                  <option value="">Select a client</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.name} {client.companyName ? `(${client.companyName})` : ''}
                    </option>
                  ))}
                </select>
                {errors.clientId && <p className="text-red-500 text-xs mt-1">{errors.clientId}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Event Type <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  {['Umrah', 'Makkah City Tour', 'Madinah City Tour'].map(evt => (
                    <label key={evt} className="flex items-center space-x-2 border border-slate-200 p-2 rounded-md hover:bg-slate-50 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={formData.events.includes(evt)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData(prev => ({ ...prev, events: [...prev.events, evt] }))
                          } else {
                            setFormData(prev => ({ ...prev, events: prev.events.filter(e => e !== evt) }))
                          }
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <span className="text-sm text-slate-700">{evt}</span>
                    </label>
                  ))}
                </div>
                {errors.events && <p className="text-red-500 text-xs mt-1">{errors.events}</p>}
              </div>
            </div>
          </Card>

          {/* Guest & Schedule Section */}
          <Card className="p-4 md:p-6 border-slate-200 shadow-sm bg-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-sky-50 rounded-bl-full -z-10 opacity-50"></div>
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 bg-sky-100 rounded-lg text-sky-700">
                <Calendar className="w-5 h-5" />
              </div>
              <h2 className="text-lg md:text-xl font-bold text-slate-800">Guest & Schedule</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Guest Name <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Users className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Guest Leader Name"
                    className={`pl-9 ${errors.guestName ? 'border-red-500' : ''}`}
                    value={formData.guestName}
                    onChange={(e) => setFormData(prev => ({ ...prev, guestName: e.target.value }))}
                  />
                </div>
                {errors.guestName && <p className="text-red-500 text-xs mt-1">{errors.guestName}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Total Pax <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Users className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    type="number"
                    min="1"
                    placeholder="Number of guests"
                    className={`pl-9 ${errors.totalPax ? 'border-red-500' : ''}`}
                    value={formData.totalPax}
                    onChange={(e) => setFormData(prev => ({ ...prev, totalPax: parseInt(e.target.value) || 1 }))}
                  />
                </div>
                {errors.totalPax && <p className="text-red-500 text-xs mt-1">{errors.totalPax}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Date and Time <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    type="datetime-local"
                    className={`pl-9 ${errors.dateTime ? 'border-red-500' : ''}`}
                    value={formData.dateTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, dateTime: e.target.value }))}
                  />
                </div>
                {errors.dateTime && <p className="text-red-500 text-xs mt-1">{errors.dateTime}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Meeting Point <span className="text-red-500">*</span></label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="E.g. Hotel Lobby"
                    className={`pl-9 ${errors.meetingPoint ? 'border-red-500' : ''}`}
                    value={formData.meetingPoint}
                    onChange={(e) => setFormData(prev => ({ ...prev, meetingPoint: e.target.value }))}
                  />
                </div>
                {errors.meetingPoint && <p className="text-red-500 text-xs mt-1">{errors.meetingPoint}</p>}
              </div>
            </div>
          </Card>

          {/* Pricing & Notes */}
          <Card className="p-4 md:p-6 border-slate-200 shadow-sm bg-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -z-10 opacity-50"></div>
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 bg-emerald-100 rounded-lg text-emerald-700">
                <Banknote className="w-5 h-5" />
              </div>
              <h2 className="text-lg md:text-xl font-bold text-slate-800">Pricing & Notes</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Total Amount (SAR) <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-semibold text-slate-500">SAR</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className={`pl-12 ${errors.totalAmount ? 'border-red-500' : ''}`}
                    value={formData.totalAmount}
                    onChange={(e) => setFormData(prev => ({ ...prev, totalAmount: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                {errors.totalAmount && <p className="text-red-500 text-xs mt-1">{errors.totalAmount}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Additional Notes</label>
                <div className="relative">
                  <AlignLeft className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <textarea
                    className="flex min-h-[80px] w-full rounded-md border border-slate-300 bg-transparent pl-9 pr-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Any special requests or instructions..."
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </Card>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-6 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate({ to: "/muthowif-bookings" })}
              className="w-full sm:w-auto hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createBookingMutation.isPending}
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
            >
              {createBookingMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Create Booking
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </PageLayout>
  )
}
