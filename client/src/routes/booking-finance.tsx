import { createFileRoute, redirect, Link, useNavigate } from "@tanstack/react-router"
import { useState, useMemo } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { DataTable, Column } from "@/components/ui/data-table"
import { Drawer } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Modal } from "@/components/ui/modal"
import {
  Search,
  Filter,
  X,
  Plus,
  Eye,
  Calendar,
  Building,
  CreditCard,
  CheckCircle2,
  Clock,
  ArrowRight,
  Receipt,
  FileText,
  DollarSign,
  TrendingUp,
  Percent,
  AlertCircle,
  Loader2,
  Share2,
  ChevronRight
} from "lucide-react"
import { authService } from "@/lib/auth"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useBookings, usePayBooking, type Booking } from "@/lib/queries"
import { useReceiptsByBooking, useGenerateReceipt } from "@/lib/queries/receipts"
import { toast } from "sonner"

export const Route = createFileRoute("/booking-finance")({
  beforeLoad: async () => {
    const isAuthenticated = await authService.isAuthenticated()
    if (!isAuthenticated) {
      throw redirect({ to: "/login" })
    }
  },
  component: BookingFinancePage
})

interface PaymentDetail {
  method: string
  amount: number
  date: string
  status: string
  reference?: string
  description?: string
}

function parsePayments(meta: unknown): PaymentDetail[] {
  if (!meta || typeof meta !== "object") return []
  const payments = (meta as Record<string, unknown>)["payments"]
  if (!Array.isArray(payments)) return []
  return payments
    .map((p): PaymentDetail | null => {
      if (!p || typeof p !== "object") return null
      const method = String(p.method || "")
      const amount = typeof p.amount === "number" ? p.amount : parseFloat(String(p.amount)) || 0
      const date = String(p.date || new Date().toISOString())
      const status = String(p.status || "completed")
      const reference = p.reference ? String(p.reference) : undefined
      const description = p.description ? String(p.description) : undefined
      if (!method && amount <= 0) return null
      return { method, amount, date, status, reference, description }
    })
    .filter((p): p is PaymentDetail => !!p)
}

function BookingFinancePage() {
  const navigate = useNavigate()
  const { data: bookings = [], isLoading, error } = useBookings()
  const payBookingMutation = usePayBooking()
  const generateReceiptMutation = useGenerateReceipt()

  // Filters State
  const [searchQuery, setSearchQuery] = useState("")
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all")
  const [bookingStatusFilter, setBookingStatusFilter] = useState("all")

  // Active tracking drawer
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Payment modal state
  const [isPayModalOpen, setIsPayModalOpen] = useState(false)
  const [bookingToPay, setBookingToPay] = useState<Booking | null>(null)
  const [payForm, setPayForm] = useState({
    method: "bank_transfer" as "bank_transfer" | "deposit" | "cash",
    amount: "",
    referenceNumber: "",
    description: ""
  })

  // Receipts for selected booking
  const selectedBookingIdStr = selectedBooking ? selectedBooking.id.toString() : ""
  const { data: bookingReceipts = [] } = useReceiptsByBooking(selectedBookingIdStr)

  // Filtered Bookings
  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const idStr = b.id.toString()
        const idMatch = `#${idStr}`.includes(q) || idStr.includes(q)
        const codeMatch = b.code ? b.code.toLowerCase().includes(q) : false
        const clientMatch = b.clientName ? b.clientName.toLowerCase().includes(q) : false
        const phoneMatch = b.clientPhone ? b.clientPhone.toLowerCase().includes(q) : false
        const hotelMatch = b.hotelName ? b.hotelName.toLowerCase().includes(q) : false

        if (!idMatch && !codeMatch && !clientMatch && !phoneMatch && !hotelMatch) {
          return false
        }
      }

      // Payment Status
      if (paymentStatusFilter !== "all") {
        if (b.paymentStatus?.toLowerCase() !== paymentStatusFilter.toLowerCase()) {
          return false
        }
      }

      // Booking Status
      if (bookingStatusFilter !== "all") {
        if (b.bookingStatus?.toLowerCase() !== bookingStatusFilter.toLowerCase()) {
          return false
        }
      }

      return true
    })
  }, [bookings, searchQuery, paymentStatusFilter, bookingStatusFilter])

  // Executive Stats Calculation (Confirmed Bookings)
  const confirmedBookings = useMemo(
    () => bookings.filter(b => b.bookingStatus?.toLowerCase() === "confirmed"),
    [bookings]
  )

  const stats = useMemo(() => {
    let totalContract = 0
    let totalPaid = 0
    let totalRemaining = 0
    let fullyPaidCount = 0
    let partialCount = 0
    let unpaidCount = 0

    confirmedBookings.forEach(b => {
      const contract = Number(b.totalAmount) || 0
      totalContract += contract

      const payments = parsePayments(b.meta)
      const paid = payments.reduce((sum, p) => sum + p.amount, 0)
      totalPaid += paid

      const remaining = Math.max(contract - paid, 0)
      totalRemaining += remaining

      if (b.paymentStatus === "paid" || remaining === 0) {
        fullyPaidCount++
      } else if (paid > 0) {
        partialCount++
      } else {
        unpaidCount++
      }
    })

    const collectionRate = totalContract > 0 ? (totalPaid / totalContract) * 100 : 0

    return {
      totalContract,
      totalPaid,
      totalRemaining,
      collectionRate,
      fullyPaidCount,
      partialCount,
      unpaidCount
    }
  }, [confirmedBookings])

  const hasActiveFilters = Boolean(
    searchQuery.trim() || paymentStatusFilter !== "all" || bookingStatusFilter !== "all"
  )

  const clearFilters = () => {
    setSearchQuery("")
    setPaymentStatusFilter("all")
    setBookingStatusFilter("all")
  }

  // Open drawer helper
  const handleOpenDrawer = (booking: Booking) => {
    setSelectedBooking(booking)
    setIsDrawerOpen(true)
  }

  // Open payment modal
  const handleOpenPayModal = (booking: Booking) => {
    const total = Number(booking.totalAmount) || 0
    const payments = parsePayments(booking.meta)
    const paid = payments.reduce((sum, p) => sum + p.amount, 0)
    const remaining = Math.max(total - paid, 0)

    setBookingToPay(booking)
    setPayForm({
      method: "bank_transfer",
      amount: remaining > 0 ? remaining.toString() : "",
      referenceNumber: "",
      description: paid === 0 ? "Pembayaran Uang Muka (DP)" : `Pembayaran Termin ke-${payments.length + 1}`
    })
    setIsPayModalOpen(true)
  }

  // Submit payment
  const handleRecordPayment = async () => {
    if (!bookingToPay) return
    const amountNum = parseFloat(payForm.amount)
    if (!amountNum || isNaN(amountNum) || amountNum <= 0) {
      toast.error("Nominal pembayaran harus lebih dari 0")
      return
    }

    try {
      await payBookingMutation.mutateAsync({
        id: bookingToPay.id.toString(),
        method: payForm.method,
        amount: amountNum,
        referenceNumber: payForm.referenceNumber.trim() || undefined,
        description: payForm.description.trim() || undefined
      })

      toast.success("Pembayaran berhasil dicatat!")
      setIsPayModalOpen(false)

      // Refresh selected booking in drawer if open
      if (selectedBooking && selectedBooking.id === bookingToPay.id) {
        // Updated through queryClient
        const refreshed = bookings.find(b => b.id === bookingToPay.id)
        if (refreshed) setSelectedBooking(refreshed)
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal mencatat pembayaran")
    }
  }

  // Generate Receipt
  const handleCreateReceipt = async (bookingId: number) => {
    try {
      const receipt = await generateReceiptMutation.mutateAsync(bookingId)
      toast.success(`Kwitansi ${receipt.number} berhasil diterbitkan!`)
    } catch (err: any) {
      toast.error(err.message || "Gagal membuat kwitansi")
    }
  }

  // Helper status color
  const getPayBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "paid":
        return "bg-emerald-50 text-emerald-700 border-emerald-200"
      case "partial":
        return "bg-amber-50 text-amber-700 border-amber-200"
      case "overdue":
        return "bg-rose-50 text-rose-700 border-rose-200"
      default:
        return "bg-zinc-100 text-zinc-700 border-zinc-200"
    }
  }

  // Columns definition
  const columns: Column<Booking>[] = [
    {
      key: "code",
      header: "Booking / Tamu",
      render: (b) => (
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs font-bold text-zinc-950">#{b.id}</span>
            {b.code && (
              <span className="font-mono text-[10px] text-zinc-500 font-semibold bg-zinc-100 px-1.5 py-0.5 rounded">
                {b.code}
              </span>
            )}
          </div>
          <div className="font-semibold text-xs text-zinc-900 mt-1">{b.clientName || "N/A Guest"}</div>
          <div className="text-[11px] text-zinc-400">{b.clientPhone || "No WhatsApp"}</div>
        </div>
      ),
      sortable: true
    },
    {
      key: "hotelName",
      header: "Hotel & Jadwal",
      render: (b) => (
        <div>
          <div className="text-xs font-semibold text-zinc-900 flex items-center gap-1">
            <Building className="h-3 w-3 text-zinc-400 shrink-0" />
            {b.hotelName}
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">
            {formatDate(b.checkIn)} - {formatDate(b.checkOut)}
          </div>
          <div className="text-[10px] text-zinc-400 mt-0.5 uppercase tracking-wider">{b.city}</div>
        </div>
      ),
      sortable: true
    },
    {
      key: "totalAmount",
      header: "Total Nilai",
      render: (b) => (
        <span className="font-bold text-xs text-zinc-950">
          {formatCurrency(b.totalAmount.toString(), "SAR")}
        </span>
      ),
      sortable: true,
      width: "w-28"
    },
    {
      key: "paidAmount",
      header: "Realisasi Terbayar",
      render: (b) => {
        const total = Number(b.totalAmount) || 0
        const payments = parsePayments(b.meta)
        const paid = payments.reduce((sum, p) => sum + p.amount, 0)
        const pct = total > 0 ? Math.min(Math.round((paid / total) * 100), 100) : 0

        return (
          <div className="space-y-1.5 w-36">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-emerald-700">{formatCurrency(paid.toString(), "SAR")}</span>
              <span className="text-[10px] font-bold text-zinc-500">{pct}%</span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  pct === 100 ? "bg-emerald-600" : pct > 0 ? "bg-amber-500" : "bg-zinc-300"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="text-[10px] text-zinc-400">
              {payments.length > 0 ? `${payments.length}x pembayaran` : "Belum ada pembayaran"}
            </div>
          </div>
        )
      },
      width: "w-36"
    },
    {
      key: "remainingBalance",
      header: "Sisa Piutang",
      render: (b) => {
        const total = Number(b.totalAmount) || 0
        const payments = parsePayments(b.meta)
        const paid = payments.reduce((sum, p) => sum + p.amount, 0)
        const remaining = Math.max(total - paid, 0)

        return (
          <div>
            <span
              className={`font-bold text-xs ${
                remaining > 0 ? "text-rose-600" : "text-emerald-700 font-semibold"
              }`}
            >
              {remaining > 0 ? formatCurrency(remaining.toString(), "SAR") : "Lunas ✓"}
            </span>
          </div>
        )
      },
      width: "w-28"
    },
    {
      key: "paymentStatus",
      header: "Status",
      render: (b) => (
        <div className="flex flex-col gap-1 items-start">
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${getPayBadge(
              b.paymentStatus
            )}`}
          >
            {b.paymentStatus}
          </span>
          <span className="text-[10px] text-zinc-400 capitalize">{b.bookingStatus}</span>
        </div>
      ),
      sortable: true,
      width: "w-24"
    },
    {
      key: "actions",
      header: "Aksi",
      render: (b) => (
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenDrawer(b)}
            className="h-8 px-2.5 border-[#e5e7eb] text-zinc-700 hover:bg-zinc-50 hover:text-black rounded-md text-xs font-semibold shadow-none flex items-center gap-1"
            title="Tracking Rincian Termin"
          >
            <Eye className="h-3.5 w-3.5" />
            Tracking
          </Button>
          <Button
            size="sm"
            onClick={() => handleOpenPayModal(b)}
            className="h-8 px-2.5 bg-[#111111] hover:bg-[#242424] text-white rounded-md text-xs font-semibold shadow-none flex items-center gap-1"
            title="Catat Pembayaran Baru"
          >
            <Plus className="h-3 w-3" />
            Bayar
          </Button>
        </div>
      ),
      width: "w-36"
    }
  ]

  if (isLoading) {
    return (
      <PageLayout title="Laporan Keuangan Booking" subtitle="Tracking transaksi & cicilan pembayaran hotel">
        <div className="flex flex-col items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-[#111111] mb-2" />
          <p className="text-xs text-zinc-500 font-medium">Memuat data rekapitulasi keuangan...</p>
        </div>
      </PageLayout>
    )
  }

  if (error) {
    return (
      <PageLayout title="Laporan Keuangan Booking" subtitle="Tracking transaksi & cicilan pembayaran hotel">
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
          Gagal memuat data keuangan: {error.message}
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="Laporan Keuangan per Bookingan"
      subtitle="Monitoring realisasi pembayaran, uang muka (DP), cicilan termin, dan sisa piutang pemesanan"
      actions={
        <div className="flex items-center space-x-2">
          <Link to="/bookings">
            <Button
              variant="outline"
              className="h-9 px-3.5 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 text-xs font-semibold rounded-md shadow-none"
            >
              <Calendar className="h-3.5 w-3.5 mr-1.5" />
              Kelola Booking
            </Button>
          </Link>
          <Link to="/invoices">
            <Button
              variant="outline"
              className="h-9 px-3.5 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 text-xs font-semibold rounded-md shadow-none"
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Daftar Invoices
            </Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-6 pb-12">
        {/* Executive Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border border-[#e5e7eb] rounded-xl bg-white p-5 shadow-none hover:border-[#111111]/30 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Total Kontrak (Confirmed)
                </p>
                <p className="text-2xl font-bold text-[#111111] tracking-tight">
                  {formatCurrency(stats.totalContract.toString(), "SAR")}
                </p>
              </div>
              <div className="bg-zinc-50 p-2 rounded-lg border border-zinc-200/40">
                <CreditCard className="h-5 w-5 text-zinc-700" />
              </div>
            </div>
            <p className="text-[11px] text-zinc-500 mt-2">Dari {confirmedBookings.length} pemesanan confirmed</p>
          </div>

          <div className="border border-[#e5e7eb] rounded-xl bg-white p-5 shadow-none hover:border-[#111111]/30 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Realisasi Terbayar
                </p>
                <p className="text-2xl font-bold text-emerald-600 tracking-tight">
                  {formatCurrency(stats.totalPaid.toString(), "SAR")}
                </p>
              </div>
              <div className="bg-emerald-50/60 p-2 rounded-lg border border-emerald-100">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
            <p className="text-[11px] text-emerald-700 font-medium mt-2">
              Tingkat Pelunasan: {stats.collectionRate.toFixed(1)}%
            </p>
          </div>

          <div className="border border-[#e5e7eb] rounded-xl bg-white p-5 shadow-none hover:border-[#111111]/30 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Sisa Piutang (Outstanding)
                </p>
                <p className="text-2xl font-bold text-rose-600 tracking-tight">
                  {formatCurrency(stats.totalRemaining.toString(), "SAR")}
                </p>
              </div>
              <div className="bg-rose-50/60 p-2 rounded-lg border border-rose-100">
                <AlertCircle className="h-5 w-5 text-rose-600" />
              </div>
            </div>
            <p className="text-[11px] text-rose-700 font-medium mt-2">
              {stats.unpaidCount + stats.partialCount} booking belum lunas
            </p>
          </div>

          <div className="border border-[#e5e7eb] rounded-xl bg-white p-5 shadow-none hover:border-[#111111]/30 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Status Pelunasan
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xl font-bold text-emerald-700">{stats.fullyPaidCount} Lunas</span>
                  <span className="text-sm font-semibold text-amber-600">/ {stats.partialCount} Termin</span>
                </div>
              </div>
              <div className="bg-zinc-50 p-2 rounded-lg border border-zinc-200/40">
                <Percent className="h-5 w-5 text-zinc-700" />
              </div>
            </div>
            <p className="text-[11px] text-zinc-500 mt-2">{stats.unpaidCount} booking belum ada pembayaran</p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="border border-[#e5e7eb] rounded-xl bg-white p-4 shadow-none">
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
              <Input
                placeholder="Cari ID, kode booking, tamu, no. telepon, hotel..."
                className="pl-9 h-10 border-[#e5e7eb] rounded-lg bg-white text-sm focus-visible:ring-0 focus-visible:border-[#111111] shadow-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
              {/* Payment Status */}
              <select
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value)}
                className="h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-xs font-medium text-zinc-700 focus:outline-none focus:border-[#111111] transition-colors"
              >
                <option value="all">Status Bayar: Semua</option>
                <option value="unpaid">Belum Bayar (Unpaid)</option>
                <option value="partial">Cicilan/Termin (Partial)</option>
                <option value="paid">Lunas (Paid)</option>
                <option value="overdue">Jatuh Tempo (Overdue)</option>
              </select>

              {/* Booking Status */}
              <select
                value={bookingStatusFilter}
                onChange={(e) => setBookingStatusFilter(e.target.value)}
                className="h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-xs font-medium text-zinc-700 focus:outline-none focus:border-[#111111] transition-colors"
              >
                <option value="all">Status Booking: Semua</option>
                <option value="confirmed">Confirmed Only</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
              </select>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  onClick={clearFilters}
                  className="h-10 px-3 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 text-xs font-semibold rounded-lg flex items-center shadow-none"
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Reset
                </Button>
              )}
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
            <div>
              Menampilkan <span className="font-semibold text-zinc-900">{filteredBookings.length}</span> dari{" "}
              <span className="font-semibold text-zinc-900">{bookings.length}</span> booking
              {hasActiveFilters && <span className="ml-2 text-zinc-400 italic">(filter aktif)</span>}
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-[11px] text-zinc-500 hover:text-zinc-900 underline"
              >
                Hapus semua filter
              </button>
            )}
          </div>
        </div>

        {/* Master Table */}
        <div className="bg-white border border-[#e5e7eb] rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <DataTable
            data={filteredBookings}
            columns={columns}
            noCard={true}
            emptyMessage={
              hasActiveFilters
                ? "Tidak ada data keuangan yang cocok dengan filter pencarian."
                : "Belum ada data pemesanan terdaftar di sistem."
            }
          />
        </div>
      </div>

      {/* Drawer: Detail Tracking Termin & Pembayaran */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={`Tracking Pembayaran: #${selectedBooking?.id} (${selectedBooking?.code || "No Code"})`}
        size="lg"
      >
        {selectedBooking && (
          <div className="space-y-6 text-xs">
            {/* Header Card */}
            <Card className="p-4 border border-[#e5e7eb] rounded-xl shadow-none bg-zinc-50/50 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Klien / Tamu</span>
                  <p className="text-sm font-bold text-zinc-950 mt-0.5">{selectedBooking.clientName}</p>
                  <p className="text-xs text-zinc-500">{selectedBooking.clientPhone || "-"}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Hotel & Kota</span>
                  <p className="text-xs font-semibold text-zinc-900 mt-0.5">{selectedBooking.hotelName}</p>
                  <p className="text-[11px] text-zinc-500">
                    {formatDate(selectedBooking.checkIn)} - {formatDate(selectedBooking.checkOut)}
                  </p>
                </div>
              </div>

              {/* Balance Summary Card */}
              {(() => {
                const total = Number(selectedBooking.totalAmount) || 0
                const payments = parsePayments(selectedBooking.meta)
                const paid = payments.reduce((sum, p) => sum + p.amount, 0)
                const remaining = Math.max(total - paid, 0)
                const pct = total > 0 ? Math.min(Math.round((paid / total) * 100), 100) : 0

                return (
                  <div className="p-3 bg-white rounded-lg border border-zinc-200 space-y-2">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <span className="text-[10px] font-bold text-zinc-400 uppercase">Total Tagihan</span>
                        <p className="text-sm font-bold text-zinc-950">{formatCurrency(total.toString(), "SAR")}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-emerald-600 uppercase">Sudah Bayar</span>
                        <p className="text-sm font-bold text-emerald-600">{formatCurrency(paid.toString(), "SAR")}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-rose-600 uppercase">Sisa Tagihan</span>
                        <p className="text-sm font-bold text-rose-600">{formatCurrency(remaining.toString(), "SAR")}</p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-zinc-100">
                      <div className="flex justify-between text-[11px] mb-1 font-semibold">
                        <span className="text-zinc-600">Progress Pembayaran</span>
                        <span className={pct === 100 ? "text-emerald-700 font-bold" : "text-amber-700 font-bold"}>
                          {pct}% {pct === 100 ? "Lunas" : "Sebagian"}
                        </span>
                      </div>
                      <div className="w-full bg-zinc-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            pct === 100 ? "bg-emerald-600" : pct > 0 ? "bg-amber-500" : "bg-zinc-300"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })()}
            </Card>

            {/* Quick Action: Catat Pembayaran Baru */}
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Riwayat Cicilan & Termin</h4>
              <Button
                size="sm"
                onClick={() => handleOpenPayModal(selectedBooking)}
                className="bg-[#111111] hover:bg-[#242424] text-white text-xs font-semibold h-8 px-3 rounded-md flex items-center gap-1.5 shadow-none"
              >
                <Plus className="h-3.5 w-3.5" />
                Catat Pembayaran
              </Button>
            </div>

            {/* Timeline of Payments */}
            {(() => {
              const payments = parsePayments(selectedBooking.meta)
              if (payments.length === 0) {
                return (
                  <div className="p-8 text-center bg-zinc-50 rounded-xl border border-dashed border-zinc-200 text-zinc-400">
                    <Clock className="h-6 w-6 mx-auto mb-2 text-zinc-300" />
                    <p className="font-medium text-xs">Belum ada riwayat pembayaran yang dicatat untuk booking ini.</p>
                    <p className="text-[11px] text-zinc-400 mt-1">Klik tombol di atas untuk mencatat pembayaran DP atau termin pertama.</p>
                  </div>
                )
              }

              return (
                <div className="space-y-3">
                  {payments.map((p, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border border-zinc-200 bg-white shadow-none space-y-2 hover:border-zinc-300 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-zinc-100 text-zinc-800 border border-zinc-200">
                            {idx === 0 ? "Termin 1 (DP)" : `Termin ke-${idx + 1}`}
                          </span>
                          <span className="text-[11px] font-medium text-zinc-500 capitalize">{p.method.replace("_", " ")}</span>
                        </div>
                        <span className="text-sm font-extrabold text-emerald-700">
                          {formatCurrency(p.amount.toString(), "SAR")}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-500 pt-2 border-t border-zinc-100">
                        <div>
                          <span className="text-zinc-400">Tanggal:</span> {formatDate(p.date)}
                        </div>
                        {p.reference && (
                          <div>
                            <span className="text-zinc-400">Ref:</span> <span className="font-mono text-zinc-800 font-semibold">{p.reference}</span>
                          </div>
                        )}
                      </div>

                      {p.description && (
                        <div className="text-[11px] text-zinc-700 bg-zinc-50 px-2.5 py-1.5 rounded-md border border-zinc-150">
                          <span className="font-semibold text-zinc-500">Keterangan:</span> {p.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            })()}

            {/* Related Invoices and Receipts */}
            <div className="pt-4 border-t border-zinc-200 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Kwitansi & Dokumen Resmi</h4>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCreateReceipt(selectedBooking.id)}
                  disabled={generateReceiptMutation.isPending}
                  className="h-8 px-3 text-xs font-semibold rounded-md border-zinc-300 shadow-none flex items-center gap-1.5"
                >
                  {generateReceiptMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Receipt className="h-3.5 w-3.5" />
                  )}
                  Terbitkan Kwitansi Baru
                </Button>
              </div>

              {bookingReceipts.length === 0 ? (
                <p className="text-zinc-400 text-xs italic">Belum ada kwitansi yang diterbitkan.</p>
              ) : (
                <div className="space-y-2">
                  {bookingReceipts.map((rcpt) => (
                    <div
                      key={rcpt.id}
                      className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-mono font-bold text-xs text-zinc-900">{rcpt.number}</div>
                        <div className="text-[10px] text-zinc-500">
                          Diterbitkan: {formatDate(rcpt.issueDate)} • Nominal: {formatCurrency(rcpt.amount, rcpt.currency)}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(rcpt.pdfUrl || `/api/receipts/${rcpt.id}/download`, "_blank")}
                        className="h-7 px-2.5 text-xs font-semibold text-zinc-700 hover:text-black hover:bg-zinc-200"
                      >
                        Buka PDF &rarr;
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* Modal: Catat Pembayaran Baru */}
      <Modal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        title="Catat Pembayaran / Termin"
      >
        {bookingToPay && (
          <div className="space-y-4 text-xs font-medium text-zinc-700">
            {/* Header info */}
            <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 space-y-1">
              <p className="font-bold text-zinc-950 text-sm">{bookingToPay.clientName}</p>
              <p className="text-zinc-500">Booking: #{bookingToPay.id} ({bookingToPay.code}) • {bookingToPay.hotelName}</p>
              {(() => {
                const total = Number(bookingToPay.totalAmount) || 0
                const payments = parsePayments(bookingToPay.meta)
                const paid = payments.reduce((sum, p) => sum + p.amount, 0)
                const remaining = Math.max(total - paid, 0)
                return (
                  <div className="flex justify-between pt-1.5 border-t border-zinc-200 text-xs font-bold">
                    <span>Sisa Tagihan Belum Lunas:</span>
                    <span className="text-rose-600">{formatCurrency(remaining.toString(), "SAR")}</span>
                  </div>
                )
              })()}
            </div>

            {/* Form */}
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Metode Pembayaran *
                </label>
                <select
                  value={payForm.method}
                  onChange={(e) => setPayForm({ ...payForm, method: e.target.value as any })}
                  className="w-full h-9 px-3 border border-[#e5e7eb] rounded-md text-xs font-medium text-zinc-900 bg-white focus:outline-none focus:border-[#111111]"
                >
                  <option value="bank_transfer">Transfer Bank (BSI / Mandiri / dll)</option>
                  <option value="cash">Tunai / Cash (SAR)</option>
                  <option value="deposit">Potong Saldo Deposit Client</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                    Nominal Pembayaran (SAR) *
                  </label>
                  {/* Quick percentage helper buttons */}
                  {(() => {
                    const total = Number(bookingToPay.totalAmount) || 0
                    const payments = parsePayments(bookingToPay.meta)
                    const paid = payments.reduce((sum, p) => sum + p.amount, 0)
                    const remaining = Math.max(total - paid, 0)
                    return (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setPayForm({ ...payForm, amount: (total * 0.3).toFixed(2), description: "Pembayaran DP 30%" })}
                          className="text-[10px] font-semibold text-zinc-600 hover:text-black bg-zinc-100 hover:bg-zinc-200 px-1.5 py-0.5 rounded"
                        >
                          DP 30%
                        </button>
                        <button
                          type="button"
                          onClick={() => setPayForm({ ...payForm, amount: (total * 0.5).toFixed(2), description: "Pembayaran 50%" })}
                          className="text-[10px] font-semibold text-zinc-600 hover:text-black bg-zinc-100 hover:bg-zinc-200 px-1.5 py-0.5 rounded"
                        >
                          50%
                        </button>
                        <button
                          type="button"
                          onClick={() => setPayForm({ ...payForm, amount: remaining.toFixed(2), description: "Pelunasan Sisa Pembayaran" })}
                          className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded"
                        >
                          Lunasi Sisa
                        </button>
                      </div>
                    )
                  })()}
                </div>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={payForm.amount}
                  onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                  className="h-9 border-[#e5e7eb] rounded-md text-xs font-semibold focus-visible:ring-[#111111] shadow-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Nomor Referensi / Bukti Transfer (Opsional)
                </label>
                <Input
                  placeholder="Contoh: TRX-BSI-9849204"
                  value={payForm.referenceNumber}
                  onChange={(e) => setPayForm({ ...payForm, referenceNumber: e.target.value })}
                  className="h-9 border-[#e5e7eb] rounded-md text-xs font-medium focus-visible:ring-[#111111] shadow-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Keterangan / Catatan Termin (Opsional)
                </label>
                <Input
                  placeholder="Contoh: Pembayaran Uang Muka (DP) 30% via BSI"
                  value={payForm.description}
                  onChange={(e) => setPayForm({ ...payForm, description: e.target.value })}
                  className="h-9 border-[#e5e7eb] rounded-md text-xs font-medium focus-visible:ring-[#111111] shadow-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-2 pt-3 border-t border-zinc-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPayModalOpen(false)}
                className="text-xs h-9 border-[#e5e7eb] shadow-none"
              >
                Batal
              </Button>
              <Button
                size="sm"
                onClick={handleRecordPayment}
                disabled={payBookingMutation.isPending}
                className="bg-[#111111] hover:bg-[#242424] text-white text-xs h-9 px-4 rounded-md font-semibold shadow-none flex items-center gap-1.5"
              >
                {payBookingMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Simpan Pembayaran
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </PageLayout>
  )
}
