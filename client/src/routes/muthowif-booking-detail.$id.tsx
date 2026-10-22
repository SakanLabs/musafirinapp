import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { authService } from "@/lib/auth"
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
  Loader2,
  Receipt,
  Trash2,
  Building2,
  Wallet,
  Banknote,
  CheckCircle2,
  Layers,
  Eye,
  MessageCircle,
  UserX,
  Repeat
} from "lucide-react"
import {
  useMuthowifBooking,
  useMuthowifBilling,
  useAssignMuthowifBooking,
  useCreateMuthowifInvoice,
  useCreateMuthowifVoucher,
  usePayMuthowifBooking,
  useDeleteMuthowifPayment,
  useUpdateMuthowifStatus,
  useDeleteMuthowifBooking,
  type MuthowifBookingStatus,
  type MuthowifPaymentMethod
} from "@/lib/queries/muthowifBookings"
import { formatCurrency, formatDate } from "@/lib/utils"
import { formatOperationalDate } from "@/lib/date"
import { DueDateModal } from "@/components/modals/DueDateModal"
import { TransportationPaymentModal } from "@/components/modals/TransportationPaymentModal"
import { MuthowifBookingAssignModal } from "@/components/modals/MuthowifBookingAssignModal"

const STATUS_OPTIONS: { value: MuthowifBookingStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Terkirim',
  partially_paid: 'Sebagian',
  paid: 'Lunas',
  overdue: 'Jatuh Tempo',
  cancelled: 'Dibatalkan',
}

const getStatusBadgeStyle = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'confirmed':
    case 'completed':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
    case 'pending':
      return 'bg-amber-50 text-amber-700 border-amber-200/60'
    case 'cancelled':
      return 'bg-rose-50 text-rose-700 border-rose-200/60'
    default:
      return 'bg-zinc-50 text-zinc-700 border-zinc-200/60'
  }
}

const getPaymentBadgeStyle = (status?: string) =>
  status === 'paid'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
    : status === 'partial'
      ? 'bg-amber-50 text-amber-700 border-amber-200/60'
      : 'bg-zinc-50 text-zinc-600 border-zinc-200/60'

const getPaymentLabel = (status?: string) =>
  status === 'paid' ? 'Lunas' : status === 'partial' ? 'Sebagian' : 'Belum Bayar'

const openPdf = (kind: 'invoice' | 'receipt' | 'voucher', number: string) => {
  window.open(`/api/muthowif-bookings/${kind}/${encodeURIComponent(number.trim())}?view=true`, '_blank')
}

export const Route = createFileRoute("/muthowif-booking-detail/$id")({
  beforeLoad: async () => {
    const isAuthenticated = await authService.isAuthenticated()
    if (!isAuthenticated) {
      throw redirect({ to: "/login" })
    }
  },
  component: MuthowifBookingDetailPage
})

function MuthowifBookingDetailPage() {
  const { id } = Route.useParams()
  const numericId = parseInt(id)
  const navigate = useNavigate()

  const { data: booking, isLoading } = useMuthowifBooking(numericId)
  const { data: billingData } = useMuthowifBilling(numericId)
  const assignMutation = useAssignMuthowifBooking()
  const invoiceMutation = useCreateMuthowifInvoice()
  const voucherMutation = useCreateMuthowifVoucher()
  const payMutation = usePayMuthowifBooking()
  const deletePaymentMutation = useDeleteMuthowifPayment()
  const statusMutation = useUpdateMuthowifStatus()
  const deleteBookingMutation = useDeleteMuthowifBooking()

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [isDueDateModalOpen, setIsDueDateModalOpen] = useState(false)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)

  if (isLoading) {
    return (
      <PageLayout title="Booking Details">
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
        </div>
      </PageLayout>
    )
  }

  if (!booking) {
    return (
      <PageLayout title="Booking Not Found">
        <div className="text-center py-12">
          <p className="text-zinc-500 mb-4 text-sm">Booking muthowif tidak ditemukan.</p>
          <Link to="/muthowif-bookings">
            <Button>Kembali</Button>
          </Link>
        </div>
      </PageLayout>
    )
  }

  const billingSummary = billingData?.summary
  const invoice = billingData?.invoice || null
  const currency = billingSummary?.currency || booking.currency || 'SAR'
  const totalAmount = billingSummary?.totalAmount ?? parseFloat(booking.totalAmount)
  const paidAmount = billingSummary?.paidAmount || 0
  const remainingBalance = billingSummary?.remainingBalance ?? totalAmount
  const paymentPercent = totalAmount > 0 ? Math.min(100, Math.round((paidAmount / totalAmount) * 100)) : 0
  const events: string[] = Array.isArray(booking.events) ? booking.events : []

  const handleStatusChange = async (status: MuthowifBookingStatus) => {
    if (status === booking.status) return
    if (status === 'cancelled' && !window.confirm('Batalkan booking ini? Booking yang dibatalkan tidak akan muncul di Upcoming Arrivals.')) {
      return
    }
    try {
      await statusMutation.mutateAsync({ id: numericId, status })
      toast.success('Status booking diperbarui')
    } catch (error: any) {
      toast.error(error?.message || 'Gagal memperbarui status')
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(`Hapus booking muthowif ${booking.number}? Tindakan ini tidak bisa dibatalkan.`)) return
    try {
      await deleteBookingMutation.mutateAsync(numericId)
      toast.success('Booking muthowif berhasil dihapus')
      navigate({ to: '/muthowif-bookings' })
    } catch (error: any) {
      toast.error(error?.message || 'Gagal menghapus booking')
    }
  }

  const assignedMuthowif = booking.assignedMuthowif

  const handleUnassign = async () => {
    if (!assignedMuthowif) return
    if (!window.confirm(`Lepas ${assignedMuthowif.name} dari booking ini?`)) return
    try {
      await assignMutation.mutateAsync({ id: numericId, muthowifId: null })
      toast.success("Penugasan muthowif dilepas")
    } catch (error: any) {
      toast.error(error?.message || "Gagal melepas penugasan")
    }
  }

  // Prefilled WhatsApp brief so the admin can hand the task to the muthowif in one click
  const buildTaskWhatsAppUrl = () => {
    if (!assignedMuthowif?.phone) return null
    const lines = [
      `Assalamu'alaikum ${assignedMuthowif.name},`,
      ``,
      `Berikut penugasan muthowif:`,
      `No. Booking: ${booking.number}`,
      `Agenda: ${events.join(', ') || '-'}`,
      `Jadwal: ${formatOperationalDate(booking.dateTime, 'datetime')} (Waktu Saudi)`,
      `Meeting Point: ${booking.meetingPoint}`,
      `Tamu: ${booking.guestName} (${booking.totalPax} Pax)`,
      ...(booking.notes ? [`Catatan: ${booking.notes}`] : []),
      ``,
      `Mohon konfirmasi. Jazakallahu khairan.`,
    ]
    return `https://wa.me/${String(assignedMuthowif.phone).replace(/\D/g, '')}?text=${encodeURIComponent(lines.join('\n'))}`
  }
  const taskWhatsAppUrl = buildTaskWhatsAppUrl()

  const handleDueDateSubmit = async (dueDate: string, options?: { sendEmail?: boolean; sendWhatsApp?: boolean }) => {
    try {
      const result = await invoiceMutation.mutateAsync({
        id: numericId,
        payload: {
          amount: booking.totalAmount,
          dueDate,
          sendEmail: options?.sendEmail,
          sendWhatsApp: options?.sendWhatsApp,
        }
      })
      setIsDueDateModalOpen(false)
      toast.success(invoice ? "Invoice berhasil digenerate ulang!" : "Invoice berhasil digenerate!")
      if (result?.number) openPdf('invoice', result.number)
    } catch (error: any) {
      toast.error(error?.message || "Gagal membuat invoice")
    }
  }

  const handleRecordPayment = async (data: {
    amount: number
    method: MuthowifPaymentMethod
    referenceNumber?: string
    description?: string
    autoGenerateReceipt: boolean
    sendEmail?: boolean
    sendWhatsApp?: boolean
  }) => {
    try {
      const res = await payMutation.mutateAsync({ id: numericId, ...data })
      toast.success('Pembayaran berhasil dicatat!')
      if (res?.receipt?.number) openPdf('receipt', res.receipt.number)
    } catch (err: any) {
      toast.error(err?.message || 'Gagal memproses pembayaran')
      throw err
    }
  }

  const handleDeletePayment = async (paymentId: number, amount: number) => {
    if (!window.confirm(`Yakin ingin membatalkan/menghapus pembayaran sebesar ${formatCurrency(amount, currency)} ini? Sisa tagihan akan diperbarui otomatis.`)) {
      return
    }
    try {
      await deletePaymentMutation.mutateAsync({ id: numericId, paymentId })
      toast.success('Pembayaran berhasil dibatalkan/dihapus')
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menghapus pembayaran')
    }
  }

  const handleCreateVoucher = async () => {
    try {
      const voucher = await voucherMutation.mutateAsync(numericId)
      toast.success("Voucher berhasil diterbitkan")
      if (voucher?.number) openPdf('voucher', voucher.number)
    } catch (error: any) {
      toast.error(error?.message || "Gagal menerbitkan voucher")
    }
  }

  return (
    <PageLayout title={`Booking ${booking.number}`}>
      <div className="space-y-6 pb-12">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
          <div className="flex items-center space-x-3 flex-wrap gap-y-2">
            <Button
              variant="outline"
              onClick={() => navigate({ to: '/muthowif-bookings' })}
              className="h-9 px-4 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 hover:text-black flex items-center rounded-md font-medium text-xs bg-white shadow-none"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Kembali
            </Button>
            <h1 className="text-lg font-bold text-[#111111] font-mono">{booking.number}</h1>
            <select
              value={booking.status}
              onChange={(e) => handleStatusChange(e.target.value as MuthowifBookingStatus)}
              disabled={statusMutation.isPending}
              title="Ubah status booking"
              className={`h-7 pl-2.5 pr-7 rounded-md text-[10px] font-bold uppercase tracking-wider border cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#111111] disabled:opacity-60 ${getStatusBadgeStyle(booking.status)}`}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {billingSummary && (
              <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getPaymentBadgeStyle(billingSummary.paymentStatus)}`}>
                {getPaymentLabel(billingSummary.paymentStatus)}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setIsAssignModalOpen(true)}
              className={`h-9 px-3.5 flex items-center rounded-md text-xs font-semibold shadow-none ${
                assignedMuthowif
                  ? 'border-zinc-200 text-zinc-700 hover:bg-zinc-50 bg-white'
                  : 'border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100'
              }`}
            >
              <UserCheck className="h-4 w-4 mr-2" />
              {assignedMuthowif ? 'Ganti Muthowif' : 'Tugaskan Muthowif'}
            </Button>
            {remainingBalance > 0 && (
              <Button
                onClick={() => setIsPaymentModalOpen(true)}
                disabled={payMutation.isPending}
                className="bg-[#111111] hover:bg-[#242424] text-white h-9 px-3.5 rounded-md text-xs font-semibold flex items-center space-x-1.5 border border-transparent shadow-none"
              >
                <CreditCard className="h-4 w-4 mr-1 text-white/90" />
                <span>Terima Pembayaran</span>
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setIsDueDateModalOpen(true)}
              className="h-9 px-3.5 border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-[#111111] flex items-center rounded-md text-xs font-semibold bg-white shadow-none"
            >
              <FileText className="h-4 w-4 mr-2 text-zinc-500" />
              {invoice ? "Generate Ulang Invoice" : "Generate Invoice"}
            </Button>
            <Button
              variant="outline"
              onClick={handleCreateVoucher}
              disabled={voucherMutation.isPending}
              className="h-9 px-3.5 border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-[#111111] flex items-center rounded-md text-xs font-semibold bg-white shadow-none"
            >
              {voucherMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Ticket className="h-4 w-4 mr-2 text-zinc-500" />}
              Terbitkan Voucher
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleteBookingMutation.isPending}
              className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/60 h-9 px-4 rounded-md text-xs font-semibold shadow-none"
            >
              <Trash2 className="h-4 w-4 mr-2 text-rose-500" />
              Hapus
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Booking Info */}
            <div className="border border-[#e5e7eb] rounded-xl bg-white p-6">
              <h2 className="text-sm font-bold text-[#111111] uppercase tracking-wider mb-6 pb-2 border-b border-gray-100">
                Detail Booking
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-5 gap-x-8">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Layanan / Agenda</label>
                  <p className="text-sm font-semibold text-[#111111]">{events.join(', ') || '-'}</p>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Jadwal (Waktu Saudi)</label>
                  <p className="text-sm font-semibold text-[#111111] flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-zinc-400" />
                    {formatOperationalDate(booking.dateTime, 'datetime')}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Nama Tamu</label>
                  <p className="text-sm font-semibold text-[#111111] flex items-center gap-2">
                    <Users className="w-4 h-4 text-zinc-400" />
                    {booking.guestName} ({booking.totalPax} Pax)
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Meeting Point</label>
                  <p className="text-sm font-semibold text-[#111111] flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-zinc-400" />
                    {booking.meetingPoint}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Klien</label>
                  <p className="text-sm font-semibold text-[#111111]">{billingData?.client?.name || '-'}</p>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Tanggal Dibuat</label>
                  <p className="text-sm font-semibold text-[#111111]">{formatDate(booking.createdAt)}</p>
                </div>
              </div>
              {booking.notes && (
                <div className="mt-6 pt-4 border-t border-gray-100/80 space-y-1">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Catatan</label>
                  <p className="text-sm font-medium text-zinc-700 whitespace-pre-wrap">{booking.notes}</p>
                </div>
              )}
            </div>

            {/* Billing & Payments */}
            <Card className="border border-[#e5e7eb] rounded-xl bg-white shadow-none overflow-hidden">
              <CardHeader className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/40 flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider">Tagihan & Pembayaran</h3>
                    {billingSummary && (
                      <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-wider ${getPaymentBadgeStyle(billingSummary.paymentStatus)}`}>
                        {getPaymentLabel(billingSummary.paymentStatus)}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500">Kelola termin pembayaran, unduh invoice, dan kwitansi resmi booking muthowif.</p>
                </div>
                {remainingBalance > 0 && (
                  <Button
                    size="sm"
                    onClick={() => setIsPaymentModalOpen(true)}
                    disabled={payMutation.isPending}
                    className="h-8 px-3.5 bg-[#111111] hover:bg-[#242424] text-white font-semibold text-xs rounded-md shadow-none flex items-center space-x-1.5"
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    <span>Terima Pembayaran</span>
                  </Button>
                )}
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-zinc-50/70 rounded-xl border border-zinc-200/70">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Total Tagihan</span>
                    <p className="text-xl font-bold font-mono text-zinc-900">{formatCurrency(totalAmount, currency)}</p>
                    <p className="text-[11px] font-mono text-zinc-400">{booking.totalPax} Pax</p>
                  </div>
                  <div className="space-y-1 border-t md:border-t-0 md:border-l border-zinc-200/60 pt-3 md:pt-0 md:pl-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Telah Dibayar</span>
                    <p className="text-xl font-bold font-mono text-emerald-600">{formatCurrency(paidAmount, currency)}</p>
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{paymentPercent}% Terbayar</span>
                    </div>
                  </div>
                  <div className="space-y-1 border-t md:border-t-0 md:border-l border-zinc-200/60 pt-3 md:pt-0 md:pl-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Sisa Tagihan</span>
                    <p className={`text-xl font-bold font-mono ${remainingBalance === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {formatCurrency(remainingBalance, currency)}
                    </p>
                    <p className="text-[11px] text-zinc-400">{remainingBalance === 0 ? 'Semua tagihan lunas' : 'Menunggu pelunasan'}</p>
                  </div>
                </div>

                {/* Invoice */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-600 border-b border-zinc-100 pb-2">Invoice</h4>
                  {invoice ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 px-4 py-3 text-xs">
                      <div className="flex items-center gap-3 flex-wrap">
                        <FileText className="w-4 h-4 text-zinc-500" />
                        <span className="font-mono font-semibold text-zinc-900">{invoice.number}</span>
                        <Badge variant="outline" className="text-[10px] font-bold uppercase">
                          {INVOICE_STATUS_LABELS[invoice.status] || invoice.status}
                        </Badge>
                        <span className="text-zinc-500">Jatuh tempo: {formatDate(invoice.dueDate)}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openPdf('invoice', invoice.number)}
                        className="h-7 text-[11px] px-2.5 font-medium border-zinc-200 text-zinc-700"
                      >
                        <Eye className="w-3 h-3 mr-1 text-zinc-500" />
                        Lihat PDF
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500">
                      Belum ada invoice. Klik <strong>"Generate Invoice"</strong>, atau langsung terima pembayaran (invoice dibuat otomatis).
                    </p>
                  )}
                </div>

                {/* Payment history */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-600">Riwayat Pembayaran & Kwitansi Resmi</h4>
                    <span className="text-xs text-zinc-400 font-medium">{billingData?.payments?.length || 0} transaksi tercatat</span>
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
                          {billingData.payments.map((p) => (
                            <tr key={p.id} className="hover:bg-zinc-50/60 transition-colors">
                              <td className="py-3 px-4 font-mono text-zinc-700">{formatDate(p.paidAt)}</td>
                              <td className="py-3 px-4">
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-medium text-[11px] bg-zinc-100 text-zinc-700">
                                  {p.method === 'bank_transfer' ? (
                                    <><Building2 className="w-3 h-3 text-zinc-500" /><span>Transfer Bank</span></>
                                  ) : p.method === 'deposit' ? (
                                    <><Wallet className="w-3 h-3 text-emerald-600" /><span>Saldo Deposit</span></>
                                  ) : (
                                    <><Banknote className="w-3 h-3 text-zinc-500" /><span>{p.method === 'cash' ? 'Tunai' : p.method || '-'}</span></>
                                  )}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {p.terminLabel && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                                      {p.terminLabel}
                                    </span>
                                  )}
                                  {p.isFromMergedInvoice && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
                                      <Layers className="w-3 h-3" />
                                      Tagihan Gabungan {p.meta?.mergedInvoiceNumber || ''}
                                    </span>
                                  )}
                                  <span className="font-mono text-zinc-800">{p.referenceNumber || '-'}</span>
                                </div>
                                {p.meta?.description && (
                                  <div className="text-[11px] text-zinc-500 mt-0.5">{p.meta.description}</div>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 text-sm">
                                {formatCurrency(p.amount, currency)}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end space-x-2">
                                  {p.receiptNumber ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openPdf('receipt', p.receiptNumber!)}
                                      className="h-7 text-[11px] px-2.5 font-medium border-zinc-200 text-zinc-700 hover:bg-zinc-50 inline-flex items-center space-x-1"
                                      title="Lihat Kwitansi PDF"
                                    >
                                      <Receipt className="w-3 h-3 text-zinc-500" />
                                      <span>{p.receiptNumber}</span>
                                    </Button>
                                  ) : (
                                    <span className="text-zinc-400 text-[11px] italic mr-1">-</span>
                                  )}
                                  {!p.isFromMergedInvoice && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeletePayment(p.id, parseFloat(p.amount))}
                                      disabled={deletePaymentMutation.isPending}
                                      className="h-7 w-7 p-0 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded"
                                      title="Batalkan / Hapus Pembayaran Ini"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 border border-dashed border-zinc-200 rounded-lg bg-zinc-50/40">
                      <CreditCard className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                      <p className="text-xs text-zinc-500 font-medium">Belum ada pembayaran yang dicatat untuk booking ini.</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Klik <strong>"Terima Pembayaran"</strong> untuk mencatat DP atau pelunasan dan otomatis membuat Kwitansi resmi.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Vouchers */}
            <div className="border border-[#e5e7eb] rounded-xl bg-white p-6">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                <h2 className="text-sm font-bold text-[#111111] uppercase tracking-wider flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-zinc-500" />
                  Voucher
                </h2>
              </div>
              {booking.vouchers?.length > 0 ? (
                <div className="space-y-2">
                  {booking.vouchers.map((v: any) => (
                    <div key={v.id} className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-2.5 text-xs">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-semibold text-zinc-900">{v.number}</span>
                        <span className="text-zinc-500">{formatDate(v.issueDate)}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openPdf('voucher', v.number)}
                        className="h-7 text-[11px] px-2.5 font-medium border-zinc-200 text-zinc-700"
                      >
                        <Eye className="w-3 h-3 mr-1 text-zinc-500" />
                        Lihat PDF
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-500">Belum ada voucher. Klik <strong>"Terbitkan Voucher"</strong> setelah booking siap.</p>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {/* Assignment Section */}
            <div className="border border-[#e5e7eb] rounded-xl bg-white p-6">
              <h2 className="text-sm font-bold text-[#111111] uppercase tracking-wider mb-4 pb-2 border-b border-gray-100 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-zinc-500" />
                Penugasan Muthowif
              </h2>

              {assignedMuthowif ? (
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-lg flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 shrink-0">
                      <Check className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-zinc-900 text-sm truncate">{assignedMuthowif.name}</div>
                      {assignedMuthowif.phone && (
                        <a
                          href={`https://wa.me/${String(assignedMuthowif.phone).replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-emerald-700 hover:underline"
                        >
                          {assignedMuthowif.phone}
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {taskWhatsAppUrl && (
                      <a href={taskWhatsAppUrl} target="_blank" rel="noreferrer" className="block">
                        <Button className="w-full h-9 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-none">
                          <MessageCircle className="w-4 h-4 mr-2" />
                          Kirim Detail Tugas via WhatsApp
                        </Button>
                      </a>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setIsAssignModalOpen(true)}
                        className="h-9 text-xs font-semibold border-zinc-200 shadow-none"
                      >
                        <Repeat className="w-3.5 h-3.5 mr-1.5" />
                        Ganti
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleUnassign}
                        disabled={assignMutation.isPending}
                        className="h-9 text-xs font-semibold border-rose-200 text-rose-600 hover:bg-rose-50 shadow-none"
                      >
                        <UserX className="w-3.5 h-3.5 mr-1.5" />
                        Lepas
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                    Belum ada muthowif yang ditugaskan untuk booking ini.
                  </p>
                  <Button className="w-full h-9 text-xs font-semibold" onClick={() => setIsAssignModalOpen(true)}>
                    <UserCheck className="w-4 h-4 mr-2" />
                    Pilih & Tugaskan Muthowif
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <MuthowifBookingAssignModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        bookingId={numericId}
        bookingNumber={booking.number}
        bookingDateTime={booking.dateTime}
        currentMuthowifId={booking.assignedMuthowifId}
      />

      <DueDateModal
        isOpen={isDueDateModalOpen}
        onClose={() => setIsDueDateModalOpen(false)}
        onSubmit={handleDueDateSubmit}
        isLoading={invoiceMutation.isPending}
      />

      <TransportationPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Penerimaan Pembayaran Muthowif"
        installmentDescription="Pembayaran Termin Muthowif"
        bookingNumber={booking.number}
        totalAmount={totalAmount}
        paidAmount={paidAmount}
        remainingBalance={remainingBalance}
        currency={currency}
        clientName={billingData?.client?.name || booking.guestName}
        clientDepositBalance={billingSummary?.clientDepositBalance || 0}
        onSubmit={handleRecordPayment}
        isLoading={payMutation.isPending}
      />
    </PageLayout>
  )
}
