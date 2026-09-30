import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import {
  FileText,
  Save,
  ArrowLeft,
  Loader2,
  User,
  Plus,
  Trash2,
  Receipt,
  Calendar,
  DollarSign,
  CreditCard,
  Download,
  CheckCircle2,
  MessageCircle,
  ExternalLink,
  Info,
  AlertTriangle
} from "lucide-react"
import { authService } from "@/lib/auth"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useClients } from "@/lib/queries/clients"
import {
  useCreateManualInvoice,
  useManualInvoice,
  useUpdateManualInvoice,
  usePayManualInvoice,
  useDeleteManualInvoicePayment,
  type CreateManualInvoiceItem,
  type ManualInvoicePaymentTerm
} from "@/lib/queries/invoices"
import { ManualInvoicePaymentModal, type PaymentMethod } from "@/components/modals/ManualInvoicePaymentModal"
import { CalendarClock } from "lucide-react"
import { fetchExchangeRate, formatSarWithIdr, formatIdr } from "@/lib/exchange-rate"
import { toast } from "sonner"

export const Route = createFileRoute("/create-manual-invoice")({
  validateSearch: (search: Record<string, unknown>) => {
    let id =
      typeof search.id === "string"
        ? search.id
        : search.id !== undefined
          ? String(search.id)
          : "";
    if (id.startsWith('"') && id.endsWith('"')) id = id.slice(1, -1);
    id = id.replace(/^"+|"+$/g, "");
    return { id: id || undefined };
  },
  beforeLoad: async () => {
    const isAuthenticated = await authService.isAuthenticated()
    if (!isAuthenticated) {
      throw redirect({ to: "/login" })
    }
  },
  component: CreateManualInvoicePage
})

function getInvoiceStatusColor(status?: string) {
  switch (status?.toLowerCase()) {
    case 'paid':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200/50'
    case 'partial':
    case 'partially_paid':
      return 'bg-amber-50 text-amber-700 border-amber-200/50'
    case 'pending':
    case 'sent':
      return 'bg-blue-50 text-blue-700 border-blue-200/50'
    case 'overdue':
      return 'bg-rose-50 text-rose-700 border-rose-200/50'
    default:
      return 'bg-zinc-50 text-zinc-700 border-zinc-200/60'
  }
}

function CreateManualInvoicePage() {
  const navigate = useNavigate()
  const { id } = Route.useSearch()
  const isEditMode = !!id
  const API_BASE_URL = import.meta.env.VITE_API_URL || window.location.origin.replace(':5173', ':3000');

  const { data: clients = [] } = useClients()
  const { mutateAsync: createManualInvoice, isPending: isSubmittingCreate } = useCreateManualInvoice()
  const { mutateAsync: updateManualInvoice, isPending: isSubmittingUpdate } = useUpdateManualInvoice()
  const { data: invoiceData, isLoading: isInvoiceLoading, refetch: refetchInvoice } = useManualInvoice(id)
  const payManualInvoiceMutation = usePayManualInvoice()
  const deletePaymentMutation = useDeleteManualInvoicePayment()

  // Exchange rate for SAR to IDR conversion display
  const { data: exchangeRateData } = useQuery({
    queryKey: ['exchangeRate'],
    queryFn: fetchExchangeRate,
    staleTime: 5 * 60 * 1000,
  })
  const currentRate = exchangeRateData?.data?.rate || null

  // Form State
  const [selectedClientId, setSelectedClientId] = useState<string>("")
  const [clientName, setClientName] = useState<string>("")
  const [clientEmail, setClientEmail] = useState<string>("")
  const [clientPhone, setClientPhone] = useState<string>("")
  const [clientAddress, setClientAddress] = useState<string>("")
  const [isNewClientMode, setIsNewClientMode] = useState<boolean>(false)

  const [title, setTitle] = useState<string>("")
  const [currency, setCurrency] = useState<string>("SAR")
  const [issueDate, setIssueDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState<string>(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  )
  const [notes, setNotes] = useState<string>("")

  // Line items state
  const [items, setItems] = useState<CreateManualInvoiceItem[]>([
    { description: "", quantity: 1, unitPrice: 0, notes: "" }
  ])

  // Payment Terms Schedule State (Policy Default: 3 termin: 60% - 20% - 20%)
  const [paymentTerms, setPaymentTerms] = useState<ManualInvoicePaymentTerm[]>([
    { termNumber: 1, label: "Termin #1 (Uang Muka / DP)", percentage: 60, amount: 0, dueDate: new Date().toISOString().split('T')[0] },
    { termNumber: 2, label: "Termin #2", percentage: 20, amount: 0, dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
    { termNumber: 3, label: "Termin #3 (Pelunasan)", percentage: 20, amount: 0, dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
  ])
  const [isTermsManuallyCustomized, setIsTermsManuallyCustomized] = useState(false)

  // Payment modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)

  // Populate data when in edit mode
  useEffect(() => {
    if (invoiceData) {
      setSelectedClientId(invoiceData.clientId ? invoiceData.clientId.toString() : "")
      setClientName(invoiceData.clientName || "")
      setClientEmail(invoiceData.clientEmail || "")
      setClientPhone(invoiceData.clientPhone || "")
      setClientAddress(invoiceData.clientAddress || "")
      setTitle(invoiceData.title || "")
      setCurrency(invoiceData.currency || "SAR")
      if (invoiceData.issueDate) {
        setIssueDate(new Date(invoiceData.issueDate).toISOString().split('T')[0])
      }
      if (invoiceData.dueDate) {
        setDueDate(new Date(invoiceData.dueDate).toISOString().split('T')[0])
      }
      setNotes(invoiceData.notes || "")
      if (Array.isArray(invoiceData.items) && invoiceData.items.length > 0) {
        setItems(invoiceData.items.map((i: any) => ({
          description: i.description || "",
          quantity: Number(i.quantity) || 1,
          unitPrice: Number(i.unitPrice) || 0,
          notes: i.notes || "",
        })))
      }
      if (Array.isArray(invoiceData.paymentTerms) && invoiceData.paymentTerms.length > 0) {
        setPaymentTerms(invoiceData.paymentTerms.map((t: any, idx: number) => ({
          termNumber: t.termNumber || idx + 1,
          label: t.label || `Termin #${idx + 1}`,
          percentage: Number(t.percentage) || 0,
          amount: Number(t.amount) || 0,
          dueDate: t.dueDate ? new Date(t.dueDate).toISOString().split('T')[0] : (invoiceData.dueDate ? new Date(invoiceData.dueDate).toISOString().split('T')[0] : ""),
          notes: t.notes || "",
        })))
        setIsTermsManuallyCustomized(true)
      }
    }
  }, [invoiceData])

  // Client selection handler
  const handleClientSelect = (clientIdStr: string) => {
    setSelectedClientId(clientIdStr)
    if (!clientIdStr) {
      setClientName("")
      setClientEmail("")
      setClientPhone("")
      setClientAddress("")
      return
    }
    const found = clients.find(c => c.id.toString() === clientIdStr)
    if (found) {
      setClientName(found.name || "")
      setClientEmail(found.email || "")
      setClientPhone(found.phone || "")
      setClientAddress(found.address || "")
    }
  }

  // Add Item row
  const handleAddItem = () => {
    setItems(prev => [...prev, { description: "", quantity: 1, unitPrice: 0, notes: "" }])
  }

  // Update item field
  const handleUpdateItem = (index: number, field: keyof CreateManualInvoiceItem, value: any) => {
    setItems(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  // Remove item row
  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      toast.warning("Invoice minimal harus memiliki 1 item")
      return
    }
    setItems(prev => prev.filter((_, idx) => idx !== index))
  }

  // Calculations
  const grandTotal = items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0
    const price = Number(item.unitPrice) || 0
    return sum + (qty * price)
  }, 0)

  // Auto-calculate payment term amounts when grandTotal or dates change
  useEffect(() => {
    if (!isTermsManuallyCustomized && (!invoiceData?.paymentTerms || invoiceData.paymentTerms.length === 0)) {
      setPaymentTerms(prev => {
        const t1Amt = Math.round(grandTotal * ((prev[0]?.percentage || 60) / 100) * 100) / 100
        const t2Amt = Math.round(grandTotal * ((prev[1]?.percentage || 20) / 100) * 100) / 100
        const t3Amt = Math.round((grandTotal - t1Amt - t2Amt) * 100) / 100
        return [
          { ...prev[0], termNumber: 1, label: prev[0]?.label || "Termin #1 (Uang Muka / DP)", percentage: prev[0]?.percentage || 60, amount: t1Amt, dueDate: issueDate },
          { ...prev[1], termNumber: 2, label: prev[1]?.label || "Termin #2", percentage: prev[1]?.percentage || 20, amount: t2Amt, dueDate: prev[1]?.dueDate || dueDate },
          { ...prev[2], termNumber: 3, label: prev[2]?.label || "Termin #3 (Pelunasan)", percentage: prev[2]?.percentage || 20, amount: t3Amt, dueDate: dueDate },
        ]
      })
    }
  }, [grandTotal, issueDate, dueDate, isTermsManuallyCustomized, invoiceData?.paymentTerms])

  // Payment terms action handlers
  const handleApplyPreset = (preset: '3_terms' | '2_terms' | 'full') => {
    setIsTermsManuallyCustomized(true)
    if (preset === '3_terms') {
      const t1 = Math.round(grandTotal * 0.60 * 100) / 100
      const t2 = Math.round(grandTotal * 0.20 * 100) / 100
      const t3 = Math.round((grandTotal - t1 - t2) * 100) / 100
      setPaymentTerms([
        { termNumber: 1, label: "Termin #1 (Uang Muka / DP)", percentage: 60, amount: t1, dueDate: issueDate },
        { termNumber: 2, label: "Termin #2", percentage: 20, amount: t2, dueDate: dueDate },
        { termNumber: 3, label: "Termin #3 (Pelunasan)", percentage: 20, amount: t3, dueDate: dueDate },
      ])
      toast.success("Diterapkan: 3 Termin (60% - 20% - 20%)")
    } else if (preset === '2_terms') {
      const t1 = Math.round(grandTotal * 0.50 * 100) / 100
      const t2 = Math.round((grandTotal - t1) * 100) / 100
      setPaymentTerms([
        { termNumber: 1, label: "Termin #1 (Uang Muka / DP)", percentage: 50, amount: t1, dueDate: issueDate },
        { termNumber: 2, label: "Termin #2 (Pelunasan)", percentage: 50, amount: t2, dueDate: dueDate },
      ])
      toast.success("Diterapkan: 2 Termin (50% - 50%)")
    } else if (preset === 'full') {
      setPaymentTerms([
        { termNumber: 1, label: "Pelunasan (Lunas Penuh)", percentage: 100, amount: grandTotal, dueDate: dueDate },
      ])
      toast.success("Diterapkan: 1 Termin (100% Penuh)")
    }
  }

  const handleAddTerm = () => {
    setIsTermsManuallyCustomized(true)
    setPaymentTerms(prev => {
      const nextNum = prev.length + 1
      const totalPctNow = prev.reduce((s, t) => s + (Number(t.percentage) || 0), 0)
      const remainingPct = Math.max(0, Math.round((100 - totalPctNow) * 10) / 10)
      const amt = Math.round((remainingPct / 100) * grandTotal * 100) / 100
      return [
        ...prev,
        {
          termNumber: nextNum,
          label: `Termin #${nextNum} (Pelunasan)`,
          percentage: remainingPct,
          amount: amt,
          dueDate: dueDate,
        }
      ]
    })
  }

  const handleRemoveTerm = (index: number) => {
    if (paymentTerms.length <= 1) return
    setIsTermsManuallyCustomized(true)
    setPaymentTerms(prev => {
      const filtered = prev.filter((_, i) => i !== index)
      return filtered.map((t, i) => ({
        ...t,
        termNumber: i + 1,
        label: t.label || `Termin #${i + 1}`,
      }))
    })
  }

  const handleUpdateTerm = (index: number, field: keyof ManualInvoicePaymentTerm, val: any) => {
    setIsTermsManuallyCustomized(true)
    setPaymentTerms(prev => {
      const next = [...prev]
      const current = { ...next[index], [field]: val }
      if (field === 'percentage') {
        const pct = parseFloat(val) || 0
        current.percentage = pct
        current.amount = Math.round((pct / 100) * grandTotal * 100) / 100
      } else if (field === 'amount') {
        const amt = parseFloat(val) || 0
        current.amount = amt
        current.percentage = grandTotal > 0 ? Math.round((amt / grandTotal) * 1000) / 10 : 0
      }
      next[index] = current
      return next
    })
  }

  const handleAutoBalanceTerms = () => {
    if (paymentTerms.length === 0) return
    const totalWithoutLast = paymentTerms.slice(0, -1).reduce((s, t) => s + (Number(t.percentage) || 0), 0)
    const balancedLastPct = Math.max(0, Math.round((100 - totalWithoutLast) * 10) / 10)
    setPaymentTerms(prev => {
      const next = [...prev]
      const lastIdx = next.length - 1
      const amt = Math.round((balancedLastPct / 100) * grandTotal * 100) / 100
      next[lastIdx] = {
        ...next[lastIdx],
        percentage: balancedLastPct,
        amount: amt,
      }
      return next
    })
    toast.success("Persentase termin terakhir telah diseimbangkan menjadi 100%")
  }

  // Edit Mode summary numbers
  const totalInvoiceAmount = isEditMode
    ? parseFloat(invoiceData?.amount || String(grandTotal))
    : grandTotal
  const paidInvoiceAmount = isEditMode
    ? parseFloat(invoiceData?.paidAmount || "0")
    : 0
  const remainingInvoiceBalance = Math.max(0, totalInvoiceAmount - paidInvoiceAmount)
  const paymentPercent = totalInvoiceAmount > 0
    ? Math.min(100, Math.round((paidInvoiceAmount / totalInvoiceAmount) * 100))
    : 0

  // Record payment handler
  const handleRecordPayment = async (data: {
    amount: number;
    method: PaymentMethod;
    referenceNumber?: string;
    description?: string;
    autoGenerateReceipt: boolean;
  }) => {
    if (!id) return;
    try {
      const res = await payManualInvoiceMutation.mutateAsync({
        manualInvoiceId: id,
        amount: data.amount,
        method: data.method,
        referenceNumber: data.referenceNumber,
        description: data.description,
        autoGenerateReceipt: data.autoGenerateReceipt,
      })
      toast.success(res.message || "Pembayaran berhasil dicatat")
      refetchInvoice()
    } catch (err: any) {
      toast.error(err?.message || "Gagal mencatat pembayaran")
      throw err
    }
  }

  // Delete payment handler
  const handleDeletePayment = async (paymentId: number) => {
    if (!id) return;
    const ok = window.confirm("Yakin ingin membatalkan/menghapus transaksi pembayaran ini? Saldo dan status invoice akan dikembalikan.");
    if (!ok) return;

    try {
      await deletePaymentMutation.mutateAsync({
        manualInvoiceId: id,
        paymentId,
      });
      toast.success("Pembayaran berhasil dibatalkan");
      refetchInvoice();
    } catch (err: any) {
      toast.error(err?.message || "Gagal menghapus pembayaran");
    }
  }

  // WhatsApp share handler
  const handleShareWhatsApp = () => {
    if (!invoiceData) return;
    const pdfUrl = `${API_BASE_URL}/api/invoices/by-number/${invoiceData.number}`;
    const msg = [
      `Assalamu'alaikum *${invoiceData.clientName}* 🙏`,
      ``,
      `Berikut kami kirimkan invoice untuk Anda:`,
      invoiceData.title ? `📌 *${invoiceData.title}*` : null,
      `📝 No. Invoice: *${invoiceData.number}*`,
      `💰 Total: *${formatCurrency(invoiceData.amount, invoiceData.currency)}*`,
      paidInvoiceAmount > 0 ? `✅ Telah Dibayar: *${formatCurrency(paidInvoiceAmount, invoiceData.currency)}*` : null,
      remainingInvoiceBalance > 0 ? `⏳ Sisa Tagihan: *${formatCurrency(remainingInvoiceBalance, invoiceData.currency)}*` : `✨ Status: *LUNAS*`,
      `📅 Jatuh Tempo: ${formatDate(invoiceData.dueDate)}`,
      ``,
      `Download PDF Resmi: ${pdfUrl}`,
      ``,
      `Jika ada pertanyaan, silakan hubungi kami. Terima kasih ❤️`,
    ].filter(Boolean).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  }

  // Submit invoice (Create or Update)
  const handleSubmit = async () => {
    const trimmedName = clientName.trim()
    if (!trimmedName) {
      toast.error("Nama client wajib diisi")
      return
    }
    if (!dueDate) {
      toast.error("Jatuh tempo (due date) wajib diisi")
      return
    }
    if (items.length === 0) {
      toast.error("Tambahkan minimal 1 item layanan/produk")
      return
    }
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (!item.description.trim()) {
        toast.error(`Deskripsi item baris ke-${i + 1} belum diisi`)
        return
      }
      if (item.quantity <= 0) {
        toast.error(`Kuantitas item baris ke-${i + 1} harus lebih dari 0`)
        return
      }
      if (item.unitPrice < 0) {
        toast.error(`Harga satuan baris ke-${i + 1} tidak boleh negatif`)
        return
      }
    }

    const payload = {
      clientId: selectedClientId ? parseInt(selectedClientId) : null,
      clientName: trimmedName,
      clientEmail: clientEmail.trim() || undefined,
      clientPhone: clientPhone.trim() || undefined,
      clientAddress: clientAddress.trim() || undefined,
      title: title.trim() || undefined,
      currency,
      issueDate: issueDate || undefined,
      dueDate,
      notes: notes.trim() || undefined,
      items: items.map(item => ({
        description: item.description.trim(),
        quantity: Number(item.quantity) || 1,
        unitPrice: Number(item.unitPrice) || 0,
        total: (Number(item.quantity) || 1) * (Number(item.unitPrice) || 0),
        notes: item.notes?.trim() || undefined
      })),
      paymentTerms: paymentTerms.map((t, idx) => ({
        termNumber: idx + 1,
        label: t.label.trim() || `Termin #${idx + 1}`,
        percentage: Number(t.percentage) || 0,
        amount: Number(t.amount) || 0,
        dueDate: t.dueDate || dueDate,
        notes: t.notes?.trim() || undefined,
      }))
    }

    try {
      if (isEditMode) {
        const res = await updateManualInvoice({
          id: id!,
          data: payload
        })
        toast.success(res.message || `Invoice ${invoiceData?.number} berhasil diperbarui!`)
        refetchInvoice()
      } else {
        const res = await createManualInvoice(payload)
        toast.success(`Invoice ${res.data.number} berhasil dibuat!`)
        navigate({ to: "/invoices" })
      }
    } catch (err: any) {
      console.error("Gagal memproses manual invoice:", err)
      toast.error(err.message || "Gagal memproses manual invoice")
    }
  }

  const isSubmitting = isSubmittingCreate || isSubmittingUpdate

  if (isEditMode && isInvoiceLoading) {
    return (
      <PageLayout title="Memuat Invoice..." subtitle="Mengambil data invoice manual">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title={isEditMode ? `Edit Manual Invoice: ${invoiceData?.number || id}` : "Create Manual Invoice"}
      subtitle={
        isEditMode
          ? "Perbarui rincian invoice, kelola item tagihan, dan kelola pembayaran serta kwitansi resmi"
          : "Buat invoice resmi mandiri tanpa ketergantungan pada data booking hotel, transport, atau visa"
      }
      actions={
        <div className="flex items-center space-x-2.5 flex-wrap gap-y-2">
          <Button
            variant="outline"
            onClick={() => navigate({ to: "/invoices" })}
            className="h-9 px-4 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 hover:text-black flex items-center rounded-md font-semibold text-xs bg-white shadow-none"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali
          </Button>

          {isEditMode && invoiceData && (
            <>
              {/* Download PDF */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`${API_BASE_URL}/api/invoices/by-number/${invoiceData.number}`, '_blank')}
                className="h-9 px-3.5 border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-black rounded-md flex items-center text-xs font-semibold bg-white shadow-none"
                title="Download PDF Invoice"
              >
                <Download className="h-3.5 w-3.5 mr-1.5 text-zinc-500" />
                <span>Download PDF</span>
              </Button>

              {/* Share WhatsApp */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleShareWhatsApp}
                className="h-9 px-3.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-md flex items-center text-xs font-semibold bg-white shadow-none"
                title="Kirim via WhatsApp"
              >
                <MessageCircle className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
                <span>WhatsApp</span>
              </Button>

              {/* Terima Pembayaran Button */}
              {remainingInvoiceBalance > 0 && (
                <Button
                  size="sm"
                  onClick={() => setIsPaymentModalOpen(true)}
                  disabled={payManualInvoiceMutation.isPending}
                  className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-md transition-colors flex items-center space-x-1.5 shadow-none border border-transparent"
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  <span>Terima Pembayaran</span>
                </Button>
              )}
            </>
          )}

          {/* Submit / Save Button */}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-[#111111] hover:bg-[#242424] text-white h-9 px-4 rounded-md text-xs font-semibold transition-colors border border-transparent shadow-none flex items-center"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin text-white" />
                {isEditMode ? "Menyimpan..." : "Menerbitkan..."}
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2 text-white/80" />
                {isEditMode ? "Simpan Perubahan" : "Terbitkan Invoice"}
              </>
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-6 p-4 md:p-6">
        {/* EDIT MODE: Status & Billing Summary Card */}
        {isEditMode && invoiceData && (
          <Card className="border border-zinc-200 bg-white rounded-xl shadow-none overflow-hidden">
            <div className="p-5 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center space-x-3">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Status Invoice:</span>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border ${getInvoiceStatusColor(invoiceData.status)}`}>
                  {invoiceData.status}
                </span>
                <span className="text-xs text-zinc-400 font-mono">• {invoiceData.number}</span>
              </div>

              {remainingInvoiceBalance > 0 && (
                <Button
                  size="sm"
                  onClick={() => setIsPaymentModalOpen(true)}
                  disabled={payManualInvoiceMutation.isPending}
                  className="h-8 px-4 bg-[#111111] hover:bg-[#242424] text-white font-semibold text-xs rounded-md shadow-none flex items-center space-x-1.5 border border-transparent self-start sm:self-auto"
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  <span>Terima Pembayaran</span>
                </Button>
              )}
            </div>

            <div className="p-5 space-y-5">
              {/* 3 Summary Stat Boxes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-zinc-50/70 rounded-xl border border-zinc-200/70">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Total Tagihan</span>
                  <p className="text-xl font-bold font-mono text-zinc-900">
                    {formatCurrency(totalInvoiceAmount, currency)}
                  </p>
                  {currency === 'SAR' && currentRate ? (
                    <p className="text-[11px] font-mono text-zinc-400">
                      ≈ {formatIdr(Math.round(totalInvoiceAmount * currentRate))}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1 border-t md:border-t-0 md:border-l border-zinc-200/60 pt-3 md:pt-0 md:pl-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Telah Dibayar</span>
                  <p className="text-xl font-bold font-mono text-emerald-600">
                    {formatCurrency(paidInvoiceAmount, currency)}
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{paymentPercent}% Terbayar</span>
                  </div>
                </div>

                <div className="space-y-1 border-t md:border-t-0 md:border-l border-zinc-200/60 pt-3 md:pt-0 md:pl-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Sisa Tagihan</span>
                  <p className={`text-xl font-bold font-mono ${remainingInvoiceBalance === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {formatCurrency(remainingInvoiceBalance, currency)}
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    {remainingInvoiceBalance === 0 ? 'Semua tagihan lunas' : 'Menunggu pelunasan'}
                  </p>
                </div>
              </div>

              {/* Riwayat Pembayaran & Kwitansi Resmi */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                    Riwayat Pembayaran & Kwitansi Resmi
                  </h4>
                  <span className="text-xs text-zinc-400 font-medium">
                    {invoiceData.payments?.length || 0} transaksi tercatat
                  </span>
                </div>

                {invoiceData.payments && invoiceData.payments.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border border-zinc-200">
                    <table className="w-full text-xs">
                      <thead className="bg-zinc-50 border-b border-zinc-200">
                        <tr>
                          <th className="text-left font-bold text-zinc-600 py-2.5 px-4 uppercase tracking-wider">Tanggal</th>
                          <th className="text-left font-bold text-zinc-600 py-2.5 px-4 uppercase tracking-wider">Metode</th>
                          <th className="text-left font-bold text-zinc-600 py-2.5 px-4 uppercase tracking-wider">No. Referensi / Catatan</th>
                          <th className="text-right font-bold text-zinc-600 py-2.5 px-4 uppercase tracking-wider">Nominal</th>
                          <th className="text-right font-bold text-zinc-600 py-2.5 px-4 uppercase tracking-wider">Kwitansi (PDF)</th>
                          <th className="text-center font-bold text-zinc-600 py-2.5 px-4 uppercase tracking-wider">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 bg-white">
                        {invoiceData.payments.map((p) => {
                          const receiptNumber = p.meta?.receiptNumber || invoiceData.receipts?.find(r => r.paymentId === p.id)?.number;
                          return (
                            <tr key={p.id} className="hover:bg-zinc-50/70 transition-colors">
                              <td className="py-3 px-4 font-medium text-zinc-800">
                                {formatDate(p.paidAt)}
                              </td>
                              <td className="py-3 px-4">
                                <span className="capitalize font-semibold text-zinc-700">
                                  {p.method === 'deposit' ? 'Saldo Deposit' : p.method === 'cash' ? 'Tunai' : 'Transfer Bank'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-zinc-600">
                                <div className="space-y-0.5">
                                  {p.meta?.terminLabel && (
                                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 mr-1.5">
                                      {p.meta.terminLabel}
                                    </span>
                                  )}
                                  <span className="font-mono text-[11px] font-medium">{p.referenceNumber || '-'}</span>
                                  {p.meta?.description && (
                                    <div className="text-[11px] text-zinc-400">{p.meta.description}</div>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                                {formatCurrency(p.amount, p.currency || currency)}
                              </td>
                              <td className="py-3 px-4 text-right">
                                {receiptNumber ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => window.open(`${API_BASE_URL}/api/receipts/by-number/${receiptNumber}`, '_blank')}
                                    className="h-7 px-2.5 text-[11px] border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded font-semibold inline-flex items-center gap-1 shadow-none"
                                  >
                                    <Download className="w-3 h-3" />
                                    <span>{receiptNumber}</span>
                                  </Button>
                                ) : (
                                  <span className="text-zinc-400 text-[11px]">-</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleDeletePayment(p.id)}
                                  disabled={deletePaymentMutation.isPending}
                                  className="text-zinc-400 hover:text-rose-600 transition-colors p-1"
                                  title="Batalkan pembayaran ini"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-6 px-4 bg-zinc-50 rounded-lg border border-dashed border-zinc-200">
                    <p className="text-xs text-zinc-500 font-medium">Belum ada pembayaran yang dicatat untuk invoice ini.</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">Gunakan tombol "Terima Pembayaran" di atas untuk memasukkan pembayaran termin atau pelunasan.</p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Invoice Edit/Create Form Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form (Left 2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Client Information Card */}
            <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none p-5">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                <div className="flex items-center space-x-2">
                  <User className="h-4.5 w-4.5 text-zinc-700" />
                  <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider">Informasi Client</h3>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsNewClientMode(prev => !prev)
                    if (!isNewClientMode) {
                      setSelectedClientId("")
                    }
                  }}
                  className="text-xs font-medium text-zinc-600 hover:text-[#111111]"
                >
                  {isNewClientMode ? "Pilih dari Client Terdaftar" : "+ Input Client Baru"}
                </Button>
              </div>

              <div className="space-y-4">
                {!isNewClientMode && (
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                      Pilih Client Terdaftar
                    </label>
                    <select
                      value={selectedClientId}
                      onChange={(e) => handleClientSelect(e.target.value)}
                      className="w-full h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:outline-none focus:border-[#111111] focus:ring-1 focus:ring-[#111111]"
                    >
                      <option value="">Pilih Client Existing...</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id.toString()}>
                          {c.name} {c.email ? `(${c.email})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                      Nama Client / Perusahaan <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      placeholder="Contoh: PT Berkah Wisata Mandiri"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                      Email Client
                    </label>
                    <Input
                      type="email"
                      placeholder="finance@berkahwisata.com"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      className="h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                      No. Telepon / WhatsApp
                    </label>
                    <Input
                      placeholder="+62 812 3456 7890"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      className="h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                      Alamat Lengkap
                    </label>
                    <Input
                      placeholder="Jl. Thamrin No. 12, Jakarta"
                      value={clientAddress}
                      onChange={(e) => setClientAddress(e.target.value)}
                      className="h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Invoice Details Card */}
            <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none p-5">
              <div className="flex items-center space-x-2 mb-4 pb-3 border-b border-gray-100">
                <Calendar className="h-4.5 w-4.5 text-zinc-700" />
                <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider">Detail Invoice</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Judul / Perihal Invoice
                  </label>
                  <Input
                    placeholder="Contoh: Paket Layanan Land Arrangement Umrah Private Mei 2025"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                      Mata Uang
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:outline-none focus:border-[#111111] focus:ring-1 focus:ring-[#111111]"
                    >
                      <option value="SAR">SAR (Saudi Riyal)</option>
                      <option value="IDR">IDR (Indonesian Rupiah)</option>
                      <option value="USD">USD (US Dollar)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                      Tanggal Terbit
                    </label>
                    <Input
                      type="date"
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                      className="h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                      Jatuh Tempo <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Catatan / Syarat Ketentuan Tambahan
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Catatan tambahan yang akan dicetak di invoice (opsional)..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full p-3 border border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:outline-none focus:border-[#111111] focus:ring-1 focus:ring-[#111111]"
                  />
                </div>
              </div>
            </div>

            {/* Line Items Table Card */}
            <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none p-5">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                <div className="flex items-center space-x-2">
                  <Receipt className="h-4.5 w-4.5 text-zinc-700" />
                  <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider">Item Layanan / Tagihan</h3>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddItem}
                  className="h-8 px-3 border-[#e5e7eb] text-zinc-700 hover:bg-zinc-50 hover:text-black flex items-center rounded-md font-semibold text-xs bg-white shadow-none"
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Tambah Baris
                </Button>
              </div>

              <div className="space-y-4">
                {items.map((item, index) => {
                  const subtotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)
                  return (
                    <div
                      key={index}
                      className="p-3.5 rounded-lg border border-zinc-200/80 bg-zinc-50/40 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                          Item #{index + 1}
                        </span>
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="text-zinc-400 hover:text-rose-600 transition-colors p-1"
                            title="Hapus baris"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                        <div className="md:col-span-5">
                          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                            Deskripsi Layanan / Produk <span className="text-rose-500">*</span>
                          </label>
                          <Input
                            placeholder="Deskripsi item (contoh: Tiket Kereta Cepat Haramain Makkah-Madinah)"
                            value={item.description}
                            onChange={(e) => handleUpdateItem(index, "description", e.target.value)}
                            className="h-9 px-3 border border-[#e5e7eb] rounded-md bg-white text-xs font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                            Qty
                          </label>
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            value={item.quantity}
                            onChange={(e) => handleUpdateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                            className="h-9 px-3 border border-[#e5e7eb] rounded-md bg-white text-xs font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none text-right"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                            Harga Satuan ({currency})
                          </label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => handleUpdateItem(index, "unitPrice", parseFloat(e.target.value) || 0)}
                            className="h-9 px-3 border border-[#e5e7eb] rounded-md bg-white text-xs font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none text-right"
                          />
                        </div>

                        <div className="md:col-span-3">
                          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                            Subtotal
                          </label>
                          <div className="h-9 px-3 border border-zinc-200 rounded-md bg-zinc-100 flex items-center justify-end text-xs font-bold text-zinc-900">
                            {formatCurrency(subtotal, currency)}
                          </div>
                        </div>
                      </div>

                      <div>
                        <Input
                          placeholder="Catatan kecil / spesifikasi item (opsional)"
                          value={item.notes || ""}
                          onChange={(e) => handleUpdateItem(index, "notes", e.target.value)}
                          className="h-8 px-2.5 border border-dashed border-zinc-200 rounded-md bg-white text-[11px] text-zinc-600 focus:border-[#111111] shadow-none"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Payment Schedule (Termin) Card */}
            <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none p-5 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                <div className="flex items-center space-x-2">
                  <CalendarClock className="h-4.5 w-4.5 text-zinc-700" />
                  <div>
                    <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider">
                      Jadwal & Termin Pembayaran
                    </h3>
                    <p className="text-[11px] text-zinc-400">
                      Pengaturan termin fleksibel (Default: Termin 1 60%, Termin 2 20%, Termin 3 20%)
                    </p>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mr-1">Preset:</span>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('3_terms')}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-md border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-800 transition-colors"
                  >
                    3 Termin (60/20/20)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('2_terms')}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-md border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-800 transition-colors"
                  >
                    2 Termin (50/50)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('full')}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-md border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-800 transition-colors"
                  >
                    1x Lunas
                  </button>
                  <button
                    type="button"
                    onClick={handleAddTerm}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-md border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Tambah Termin
                  </button>
                </div>
              </div>

              {/* Status & Validation Banner */}
              {(() => {
                const totalPct = Math.round(paymentTerms.reduce((sum, t) => sum + (Number(t.percentage) || 0), 0) * 10) / 10;
                const isBalanced = Math.abs(totalPct - 100) < 0.1;
                return (
                  <div className={`p-3 rounded-lg flex items-center justify-between text-xs ${
                    isBalanced 
                      ? 'bg-emerald-50/80 border border-emerald-200 text-emerald-800' 
                      : 'bg-amber-50 border border-amber-200 text-amber-900'
                  }`}>
                    <div className="flex items-center gap-2">
                      {isBalanced ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      )}
                      <div>
                        <span className="font-bold">Total Alokasi Termin: {totalPct}%</span>
                        {!isBalanced && (
                          <span className="ml-1 text-[11px] text-amber-700">
                            (Kurang/Lebih {Math.round((100 - totalPct) * 10) / 10}%. Total termin harus berjumlah 100%)
                          </span>
                        )}
                      </div>
                    </div>
                    {!isBalanced && paymentTerms.length > 0 && (
                      <button
                        type="button"
                        onClick={handleAutoBalanceTerms}
                        className="text-[11px] font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 px-2 py-1 rounded transition-colors"
                      >
                        Seimbangkan Otomatis
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Terms Table / Rows */}
              <div className="space-y-3">
                {paymentTerms.map((term, index) => {
                  const estIdr = currency === 'SAR' && currentRate ? Math.round(term.amount * currentRate) : null;
                  return (
                    <div
                      key={index}
                      className="border border-zinc-200/80 rounded-lg p-3 bg-zinc-50/50 hover:bg-white hover:border-zinc-300 transition-all space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#111111] text-white">
                            Termin #{term.termNumber || index + 1}
                          </span>
                          <span className="text-xs font-semibold text-zinc-700">
                            {index === 0 ? "Uang Muka / Termin Pertama" : index === paymentTerms.length - 1 ? "Pelunasan Akhir" : `Termin Ke-${index + 1}`}
                          </span>
                        </div>
                        {paymentTerms.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTerm(index)}
                            className="text-zinc-400 hover:text-rose-600 transition-colors p-1"
                            title="Hapus termin ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                        <div className="md:col-span-4">
                          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                            Label Termin
                          </label>
                          <Input
                            placeholder={`Contoh: Termin #${index + 1}`}
                            value={term.label}
                            onChange={(e) => handleUpdateTerm(index, "label", e.target.value)}
                            className="h-9 px-3 border border-[#e5e7eb] rounded-md bg-white text-xs font-medium text-zinc-950 focus:border-[#111111] shadow-none"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                            Porsi (%)
                          </label>
                          <div className="relative">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              value={term.percentage}
                              onChange={(e) => handleUpdateTerm(index, "percentage", e.target.value)}
                              className="h-9 px-3 pr-7 border border-[#e5e7eb] rounded-md bg-white text-xs font-medium text-zinc-950 focus:border-[#111111] shadow-none text-right font-mono"
                            />
                            <span className="absolute right-2.5 top-2.5 text-xs text-zinc-400 pointer-events-none">%</span>
                          </div>
                        </div>

                        <div className="md:col-span-3">
                          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                            Nominal ({currency})
                          </label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={term.amount}
                            onChange={(e) => handleUpdateTerm(index, "amount", e.target.value)}
                            className="h-9 px-3 border border-[#e5e7eb] rounded-md bg-white text-xs font-bold text-zinc-950 focus:border-[#111111] shadow-none text-right font-mono"
                          />
                          {estIdr ? (
                            <span className="block text-[10px] font-mono text-zinc-400 text-right mt-0.5">
                              ≈ {formatIdr(estIdr)}
                            </span>
                          ) : null}
                        </div>

                        <div className="md:col-span-3">
                          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                            Jatuh Tempo
                          </label>
                          <Input
                            type="date"
                            value={term.dueDate || ""}
                            onChange={(e) => handleUpdateTerm(index, "dueDate", e.target.value)}
                            className="h-9 px-2 border border-[#e5e7eb] rounded-md bg-white text-xs font-medium text-zinc-950 focus:border-[#111111] shadow-none"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sidebar Summary (Right 1 col) */}
          <div className="space-y-6">
            <Card className="border border-[#e5e7eb] rounded-xl bg-white shadow-none p-5">
              <div className="flex items-center space-x-2 mb-4 pb-3 border-b border-gray-100">
                <DollarSign className="h-4.5 w-4.5 text-zinc-700" />
                <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider">Ringkasan Tagihan</h3>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="flex items-center justify-between text-zinc-600">
                  <span>Total Item</span>
                  <span className="font-semibold text-zinc-900">{items.length} item</span>
                </div>
                <div className="flex items-center justify-between text-zinc-600">
                  <span>Mata Uang</span>
                  <span className="font-semibold text-zinc-900">{currency}</span>
                </div>
                <div className="flex items-center justify-between text-zinc-600">
                  <span>Tanggal Terbit</span>
                  <span className="font-semibold text-zinc-900">{issueDate}</span>
                </div>
                <div className="flex items-center justify-between text-zinc-600">
                  <span>Jatuh Tempo</span>
                  <span className="font-semibold text-rose-600">{dueDate}</span>
                </div>

                {/* Termin Breakdown */}
                {paymentTerms.length > 0 && (
                  <div className="pt-3 border-t border-gray-100 space-y-1.5">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                      Alokasi Termin ({paymentTerms.length} Tahap)
                    </span>
                    {paymentTerms.map((t, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-600 truncate max-w-[130px]" title={t.label}>
                          {t.label || `Termin #${idx + 1}`} ({t.percentage}%)
                        </span>
                        <span className="font-mono font-medium text-zinc-800">
                          {formatCurrency(t.amount, currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-4 border-t border-gray-100 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-zinc-700">Subtotal Item</span>
                    <span className="font-semibold text-zinc-900">{formatCurrency(grandTotal, currency)}</span>
                  </div>
                  <div className="flex items-center justify-between text-base pt-2 border-t border-zinc-150">
                    <span className="font-extrabold text-[#111111]">Grand Total</span>
                    <div className="text-right">
                      <span className="font-extrabold text-[#111111] text-lg block">
                        {formatCurrency(grandTotal, currency)}
                      </span>
                      {currency === 'SAR' && currentRate ? (
                        <span className="text-[11px] font-mono text-zinc-500 block">
                          ≈ {formatIdr(Math.round(grandTotal * currentRate))}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="pt-5 space-y-2.5">
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="w-full bg-[#111111] hover:bg-[#242424] text-white h-11 rounded-lg text-xs font-semibold transition-colors border border-transparent shadow-none"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin text-white" />
                        {isEditMode ? "Menyimpan Perubahan..." : "Menerbitkan Invoice..."}
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2 text-white/80" />
                        {isEditMode ? "Simpan Perubahan Invoice" : "Terbitkan & Unduh Invoice"}
                      </>
                    )}
                  </Button>

                  {isEditMode && remainingInvoiceBalance > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsPaymentModalOpen(true)}
                      disabled={payManualInvoiceMutation.isPending}
                      className="w-full border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 h-10 rounded-lg text-xs font-bold transition-colors shadow-none flex items-center justify-center gap-1.5"
                    >
                      <CreditCard className="w-4 h-4 text-emerald-600" />
                      <span>Terima Pembayaran (Sisa: {formatCurrency(remainingInvoiceBalance, currency)})</span>
                    </Button>
                  )}
                </div>
              </div>
            </Card>

            {/* Info Card */}
            <div className="border border-blue-100 bg-blue-50/50 rounded-xl p-4 text-xs text-blue-900 space-y-1.5">
              <p className="font-semibold flex items-center">
                <FileText className="h-3.5 w-3.5 mr-1.5 text-blue-700" /> Format Resmi Musafirin
              </p>
              <p className="text-blue-700/90 text-[11px] leading-relaxed">
                Invoice manual dilengkapi kop resmi PT Musafirin Berkah Berkelanjutan, rincian pembayaran rekening BSI, dan PDF siap diunduh serta dikirim ke klien via WhatsApp. Pembayaran yang diterima otomatis dapat diterbitkan Kwitansi Resmi resmi (PDF).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {isEditMode && invoiceData && (
        <ManualInvoicePaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          invoiceNumber={invoiceData.number}
          totalAmount={totalInvoiceAmount}
          paidAmount={paidInvoiceAmount}
          remainingBalance={remainingInvoiceBalance}
          currency={invoiceData.currency || currency}
          clientName={invoiceData.clientName}
          clientDepositBalance={invoiceData.summary?.clientDepositBalance || 0}
          onSubmit={handleRecordPayment}
          isLoading={payManualInvoiceMutation.isPending}
          paymentTerms={invoiceData.paymentTerms || paymentTerms}
          existingPaymentsCount={invoiceData.payments?.length || 0}
        />
      )}
    </PageLayout>
  )
}
