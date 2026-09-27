import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
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
  DollarSign
} from "lucide-react"
import { authService } from "@/lib/auth"
import { formatCurrency } from "@/lib/utils"
import { useClients } from "@/lib/queries/clients"
import { useCreateManualInvoice, type CreateManualInvoiceItem } from "@/lib/queries/invoices"
import { toast } from "sonner"

export const Route = createFileRoute("/create-manual-invoice")({
  beforeLoad: async () => {
    const isAuthenticated = await authService.isAuthenticated()
    if (!isAuthenticated) {
      throw redirect({ to: "/login" })
    }
  },
  component: CreateManualInvoicePage
})

function CreateManualInvoicePage() {
  const navigate = useNavigate()
  const { data: clients = [] } = useClients()
  const { mutateAsync: createManualInvoice, isPending: isSubmitting } = useCreateManualInvoice()

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

  // Submit invoice
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

    try {
      const res = await createManualInvoice({
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
        }))
      })

      toast.success(`Invoice ${res.data.number} berhasil dibuat!`)
      navigate({ to: "/invoices" })
    } catch (err: any) {
      console.error("Gagal membuat manual invoice:", err)
      toast.error(err.message || "Gagal membuat manual invoice")
    }
  }

  return (
    <PageLayout
      title="Create Manual Invoice"
      subtitle="Buat invoice resmi mandiri tanpa ketergantungan pada data booking hotel, transport, atau visa"
      actions={
        <div className="flex items-center space-x-2.5">
          <Button
            variant="outline"
            onClick={() => navigate({ to: "/invoices" })}
            className="h-9 px-4 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 hover:text-black flex items-center rounded-md font-semibold text-xs bg-white shadow-none"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-[#111111] hover:bg-[#242424] text-white h-9 px-4 rounded-md text-xs font-semibold transition-colors border border-transparent shadow-none"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin text-white" />
                Menerbitkan...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2 text-white/80" />
                Terbitkan Invoice
              </>
            )}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-4 md:p-6">
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

              <div className="pt-4 border-t border-gray-100 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-zinc-700">Subtotal</span>
                  <span className="font-semibold text-zinc-900">{formatCurrency(grandTotal, currency)}</span>
                </div>
                <div className="flex items-center justify-between text-base pt-2 border-t border-zinc-150">
                  <span className="font-extrabold text-[#111111]">Grand Total</span>
                  <span className="font-extrabold text-[#111111] text-lg">
                    {formatCurrency(grandTotal, currency)}
                  </span>
                </div>
              </div>

              <div className="pt-5">
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="w-full bg-[#111111] hover:bg-[#242424] text-white h-11 rounded-lg text-xs font-semibold transition-colors border border-transparent shadow-none"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin text-white" />
                      Menerbitkan Invoice...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2 text-white/80" />
                      Terbitkan & Unduh Invoice
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>

          {/* Info Card */}
          <div className="border border-blue-100 bg-blue-50/50 rounded-xl p-4 text-xs text-blue-900 space-y-1.5">
            <p className="font-semibold flex items-center">
              <FileText className="h-3.5 w-3.5 mr-1.5 text-blue-700" /> Format Resmi Musafirin
            </p>
            <p className="text-blue-700/90 text-[11px] leading-relaxed">
              Invoice manual akan otomatis diberikan nomor format <strong>INV-MAN-YYYY-XXXX</strong>, dilengkapi kop resmi PT Musafirin Berkah Berkelanjutan, rincian pembayaran rekening BSI, dan PDF siap diunduh serta dikirim ke klien via WhatsApp.
            </p>
          </div>
        </div>
      </div>
    </PageLayout>
  )
}
