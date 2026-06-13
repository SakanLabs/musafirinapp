import { createFileRoute, Link, useParams } from "@tanstack/react-router"
import { useState } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { useQuery } from '@tanstack/react-query'
import { apiClient } from "@/lib/api"
import {
  FileText,
  CreditCard,
  Ticket,
  ArrowLeft,
  Users,
  MapPin,
  Calendar,
  UserCheck,
  Check,
  Loader2
} from "lucide-react"
import { 
  useMuthowifBooking, 
  useAssignMuthowifBooking,
  useCreateMuthowifInvoice,
  useCreateMuthowifReceipt,
  useCreateMuthowifVoucher
} from "@/lib/queries/muthowifBookings"
import { formatCurrency } from "@/lib/utils"

export const Route = createFileRoute("/muthowif-booking-detail/$id")({
  component: MuthowifBookingDetailPage
})

function MuthowifBookingDetailPage() {
  const { id } = Route.useParams()
  const numericId = parseInt(id)
  
  const { data: booking, isLoading } = useMuthowifBooking(numericId)
  const assignMutation = useAssignMuthowifBooking()
  const invoiceMutation = useCreateMuthowifInvoice()
  const receiptMutation = useCreateMuthowifReceipt()
  const voucherMutation = useCreateMuthowifVoucher()

  // Quick fetch for available muthowifs
  const { data: muthowifs = [] } = useQuery({
    queryKey: ['muthowifs'],
    queryFn: async () => {
      const { data } = await apiClient.get('/api/muthowifs')
      return data
    }
  })

  const [selectedMuthowif, setSelectedMuthowif] = useState("")

  if (isLoading) {
    return (
      <PageLayout title="Booking Details">
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      </PageLayout>
    )
  }

  if (!booking) {
    return (
      <PageLayout title="Booking Not Found">
        <div className="text-center py-12">
          <p className="text-slate-500 mb-4">The booking you are looking for does not exist.</p>
          <Link to="/muthowif-bookings">
            <Button>Go Back</Button>
          </Link>
        </div>
      </PageLayout>
    )
  }

  const handleAssign = async () => {
    if (!selectedMuthowif) {
      toast.error("Please select a muthowif")
      return
    }
    
    try {
      await assignMutation.mutateAsync({
        id: numericId,
        muthowifId: parseInt(selectedMuthowif)
      })
      toast.success("Muthowif assigned successfully")
      setSelectedMuthowif("")
    } catch (error) {
      toast.error("Failed to assign muthowif")
    }
  }

  const handleCreateInvoice = async () => {
    try {
      const issueDate = new Date().toISOString()
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 7)
      
      await invoiceMutation.mutateAsync({
        id: numericId,
        payload: {
          amount: booking.totalAmount,
          issueDate,
          dueDate: dueDate.toISOString()
        }
      })
      toast.success("Invoice generated successfully")
    } catch (error) {
      toast.error("Failed to generate invoice")
    }
  }

  const handleCreateReceipt = async (invoiceId?: number) => {
    try {
      // Create a full payment receipt for simplicity, or link to invoice
      await receiptMutation.mutateAsync({
        id: numericId,
        payload: {
          invoiceId,
          paidAmount: booking.totalAmount,
          balanceDue: 0,
          payerName: booking.guestName
        }
      })
      toast.success("Receipt generated successfully")
    } catch (error) {
      toast.error("Failed to generate receipt")
    }
  }

  const handleCreateVoucher = async () => {
    try {
      await voucherMutation.mutateAsync(numericId)
      toast.success("Voucher generated successfully")
    } catch (error) {
      toast.error("Failed to generate voucher")
    }
  }

  return (
    <PageLayout title={`Booking ${booking.number}`}>
      <div className="max-w-5xl mx-auto pb-12">
        <div className="flex items-center gap-4 mb-6 md:mb-8">
          <Link to="/muthowif-bookings">
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-100">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">{booking.number}</h1>
              <Badge variant="outline" className="capitalize">{booking.status}</Badge>
            </div>
            <p className="text-sm text-slate-500 mt-1">Created on {new Date(booking.createdAt).toLocaleDateString()}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Booking Info */}
            <Card className="p-4 md:p-6 border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Booking Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <div>
                  <div className="text-sm text-slate-500 mb-1">Event Type</div>
                  <div className="font-semibold text-slate-900">{booking.event}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-500 mb-1">Date & Time</div>
                  <div className="font-semibold text-slate-900 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    {new Date(booking.dateTime).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-500 mb-1">Guest Name</div>
                  <div className="font-semibold text-slate-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-400" />
                    {booking.guestName} ({booking.totalPax} Pax)
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-500 mb-1">Meeting Point</div>
                  <div className="font-semibold text-slate-900 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    {booking.meetingPoint}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <div className="text-sm text-slate-500 mb-1">Total Amount</div>
                  <div className="font-bold text-xl text-emerald-600">
                    {booking.currency} {formatCurrency(parseFloat(booking.totalAmount), booking.currency)}
                  </div>
                </div>
                {booking.notes && (
                  <div className="md:col-span-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="text-sm font-semibold text-slate-700 mb-1">Notes</div>
                    <div className="text-sm text-slate-600 whitespace-pre-wrap">{booking.notes}</div>
                  </div>
                )}
              </div>
            </Card>

            {/* Document Flow */}
            <Card className="p-4 md:p-6 border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Transaction Documents</h2>
              
              <div className="space-y-4">
                {/* Invoices */}
                <div className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-indigo-500" />
                      <h3 className="font-semibold text-slate-900">Invoices</h3>
                    </div>
                    <Button size="sm" variant="outline" onClick={handleCreateInvoice} disabled={invoiceMutation.isPending}>
                      {invoiceMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />} Generate
                    </Button>
                  </div>
                  {booking.invoices?.length > 0 ? (
                    <div className="space-y-2">
                      {booking.invoices.map((inv: any) => (
                        <div key={inv.id} className="flex items-center justify-between bg-slate-50 p-2 rounded text-sm">
                          <span className="font-mono">{inv.number}</span>
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">{inv.status}</Badge>
                            {inv.status !== 'paid' && (
                              <Button size="sm" onClick={() => handleCreateReceipt(inv.id)}>Pay</Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No invoices generated yet.</p>
                  )}
                </div>

                {/* Receipts */}
                <div className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-emerald-500" />
                      <h3 className="font-semibold text-slate-900">Receipts</h3>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleCreateReceipt()} disabled={receiptMutation.isPending}>
                      {receiptMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />} Generate
                    </Button>
                  </div>
                  {booking.receipts?.length > 0 ? (
                    <div className="space-y-2">
                      {booking.receipts.map((rec: any) => (
                        <div key={rec.id} className="flex items-center justify-between bg-slate-50 p-2 rounded text-sm">
                          <span className="font-mono">{rec.number}</span>
                          <span className="font-semibold">{booking.currency} {parseFloat(rec.paidAmount).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No receipts generated yet.</p>
                  )}
                </div>

                {/* Vouchers */}
                <div className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Ticket className="w-5 h-5 text-amber-500" />
                      <h3 className="font-semibold text-slate-900">Vouchers</h3>
                    </div>
                    <Button size="sm" variant="outline" onClick={handleCreateVoucher} disabled={voucherMutation.isPending}>
                      {voucherMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />} Generate
                    </Button>
                  </div>
                  {booking.vouchers?.length > 0 ? (
                    <div className="space-y-2">
                      {booking.vouchers.map((v: any) => (
                        <div key={v.id} className="flex items-center justify-between bg-slate-50 p-2 rounded text-sm">
                          <span className="font-mono">{v.number}</span>
                          <span className="text-slate-500">{new Date(v.issueDate).toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No vouchers generated yet.</p>
                  )}
                </div>
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            {/* Assignment Section */}
            <Card className="p-4 md:p-6 border-slate-200 bg-white">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-indigo-500" />
                Muthowif Assignment
              </h2>
              
              {booking.assignedMuthowif ? (
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                      <Check className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">{booking.assignedMuthowif.name}</div>
                      <div className="text-xs text-slate-500">{booking.assignedMuthowif.phone}</div>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-emerald-200/50">
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Re-assign Muthowif</label>
                    <div className="flex gap-2">
                      <select 
                        className="flex-1 h-9 rounded-md border border-slate-300 px-3 text-sm"
                        value={selectedMuthowif}
                        onChange={(e) => setSelectedMuthowif(e.target.value)}
                      >
                        <option value="">Select Muthowif</option>
                        {muthowifs.map((m: any) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                      <Button size="sm" onClick={handleAssign} disabled={assignMutation.isPending || !selectedMuthowif}>
                        Update
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-slate-500">No muthowif has been assigned to this order yet.</p>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Select Muthowif</label>
                    <select 
                      className="w-full h-10 rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={selectedMuthowif}
                      onChange={(e) => setSelectedMuthowif(e.target.value)}
                    >
                      <option value="">-- Choose a Muthowif --</option>
                      {muthowifs.map((m: any) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={handleAssign} 
                    disabled={assignMutation.isPending || !selectedMuthowif}
                  >
                    {assignMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Assign Now
                  </Button>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </PageLayout>
  )
}
