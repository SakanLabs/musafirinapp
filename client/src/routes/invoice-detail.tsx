import { useState, useEffect } from "react";
import { toast } from "sonner";
import { createFileRoute } from "@tanstack/react-router";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useInvoice, usePayInvoice, type Invoice } from "@/lib/queries/invoices";
import { useReceiptsByBooking, useGenerateReceipt } from "@/lib/queries/receipts";
import { useRegenerateInvoice } from "@/lib/queries/bookings";
import { authService } from "@/lib/auth";
import { FileText, Download, Banknote, CalendarDays, Loader2, Info, MessageCircle, ArrowLeft, RefreshCw } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/invoice-detail")({
  validateSearch: (search: Record<string, unknown>) => {
    let id =
      typeof search.id === "string"
        ? search.id
        : search.id !== undefined
          ? String(search.id)
          : "";
    // Handle quoted ids like '"6"' and percent-encoded quotes like '%226%22'
    if (id.startsWith('"') && id.endsWith('"')) {
      id = id.slice(1, -1);
    }
    try {
      const decoded = decodeURIComponent(id);
      if (decoded !== id) id = decoded;
    } catch {
      // ignore decode errors
    }
    id = id.replace(/^"+|"+$/g, "");
    return { id };
  },
  component: InvoiceDetailPage,
});

function getInvoiceStatusColor(status: Invoice["status"]) {
  switch (status?.toLowerCase()) {
    case "paid":
      return "bg-emerald-50 text-emerald-700 border-emerald-200/50";
    case "pending":
    case "sent":
      return "bg-amber-50 text-amber-700 border-amber-200/50";
    case "overdue":
      return "bg-rose-50 text-rose-700 border-rose-200/50";
    case "cancelled":
    case "draft":
    default:
      return "bg-zinc-50 text-zinc-700 border-zinc-200/60";
  }
}

function getPaymentStatusColor(status?: "unpaid" | "partial" | "paid" | "overdue") {
  switch (status?.toLowerCase()) {
    case "paid":
      return "bg-emerald-50 text-emerald-700 border-emerald-200/50";
    case "partial":
      return "bg-amber-50 text-amber-700 border-amber-200/50";
    case "unpaid":
    case "overdue":
      return "bg-rose-50 text-rose-700 border-rose-200/50";
    default:
      return "bg-zinc-50 text-zinc-700 border-zinc-200/60";
  }
}

type PaymentEntry = {
  method: string;
  amount: number;
  date: string;
  status: string;
  reference?: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object";
}

function coerceNumber(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function getRemainingBalance(meta: unknown): number {
  if (!isRecord(meta)) return 0;
  const rb = (meta as Record<string, unknown>)["remainingBalance"];
  return coerceNumber(rb);
}

function getPayments(meta: unknown): PaymentEntry[] {
  if (!isRecord(meta)) return [];
  const raw = (meta as Record<string, unknown>)["payments"];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p): PaymentEntry | null => {
      if (!isRecord(p)) return null;
      const r = p as Record<string, unknown>;
      const methodVal = r["method"];
      const amountVal = r["amount"];
      const dateVal = r["date"];
      const statusVal = r["status"];
      const referenceVal = r["reference"];

      const method = typeof methodVal === "string" ? methodVal : "";
      const amount = coerceNumber(amountVal);
      const date = typeof dateVal === "string" ? dateVal : new Date().toISOString();
      const status = typeof statusVal === "string" ? statusVal : "completed";
      const reference = typeof referenceVal === "string" ? referenceVal : undefined;

      if (!method) return null;
      return { method, amount, date, status, reference };
    })
    .filter((p): p is PaymentEntry => !!p);
}

function InvoiceDetailPage() {
  const navigate = useNavigate();
  const { id } = Route.useSearch();
  const { data: invoice, isLoading, error } = useInvoice(id);
  const payInvoiceMutation = usePayInvoice();
  const regenerateInvoiceMutation = useRegenerateInvoice();

  const [payForm, setPayForm] = useState({
    method: "cash" as "bank_transfer" | "deposit" | "cash",
    amount: "",
    referenceNumber: "",
    description: "",
  });

  // Admin check
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let mounted = true;
    authService.isAdmin().then(v => { if (mounted) setIsAdmin(v) }).catch(() => setIsAdmin(false));
    return () => { mounted = false };
  }, []);

  // Receipts by booking & generate mutation
  const bookingIdStr = invoice ? invoice.bookingId.toString() : "";
  const { data: receiptsForBooking = [] } = useReceiptsByBooking(bookingIdStr);
  const generateReceiptMutation = useGenerateReceipt();

  const handleDownload = () => {
    if (!invoice) return;
    const API_BASE_URL = import.meta.env.VITE_API_URL || window.location.origin.replace(':5173', ':3000');
    window.open(`${API_BASE_URL}/api/invoices/by-number/${invoice.number}`, "_blank");
  };

  const handleShareWhatsApp = () => {
    if (!invoice) return;
    const API_BASE_URL = import.meta.env.VITE_API_URL || window.location.origin.replace(':5173', ':3000');
    const pdfUrl = `${API_BASE_URL}/api/invoices/by-number/${invoice.number}`;
    const message = [
      `Assalamu'alaikum *${invoice.clientName}* 🙏`,
      ``,
      `Berikut kami kirimkan invoice untuk pemesanan Anda:`,
      ``,
      `🏨 ${invoice.hotelName}, ${invoice.city}`,
      `📝 No. Invoice: *${invoice.number}*`,
      `💰 Total: *${formatCurrency(invoice.amount, invoice.currency)}*`,
      `📅 Jatuh Tempo: ${formatDate(invoice.dueDate)}`,
      ``,
      `Silakan download invoice PDF di sini:`,
      `${pdfUrl}`,
      ``,
      `Jika ada pertanyaan, jangan ragu untuk menghubungi kami. Terima kasih ❤️`,
    ].join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleGenerateReceipt = async () => {
    if (!invoice) return;
    try {
      const receipt = await generateReceiptMutation.mutateAsync(invoice.bookingId);
      toast.success(`Receipt generated successfully: ${receipt.number}`);
    } catch (err: any) {
      console.error('Failed to generate receipt:', err);
      toast.error(err?.message || 'Failed to generate receipt');
    }
  };

  const handleSubmitPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;
    const amt = parseFloat(payForm.amount);
    if (isNaN(amt) || amt <= 0) {
      toast.warning("Enter a valid payment amount");
      return;
    }
    try {
      await payInvoiceMutation.mutateAsync({
        id: invoice.id.toString(),
        method: payForm.method,
        amount: amt,
        referenceNumber: payForm.referenceNumber || undefined,
        description: payForm.description || undefined,
      });
      setPayForm({
        method: "cash",
        amount: "",
        referenceNumber: "",
        description: "",
      });
      toast.success("Payment recorded successfully");
    } catch (err) {
      console.error("Failed to record payment:", err);
      const msg = err instanceof Error ? err.message : "An unexpected error occurred";
      toast.error(msg);
    }
  };

  if (!id) {
    return (
      <PageLayout title="Invoice Detail" subtitle="Missing invoice ID">
        <div className="text-center text-red-600 p-8">Invoice ID is required</div>
      </PageLayout>
    );
  }

  if (isLoading) {
    return (
      <PageLayout title="Loading Invoice..." subtitle="Fetching invoice details">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
        </div>
      </PageLayout>
    );
  }

  if (error && error instanceof Error) {
    return (
      <PageLayout title="Error" subtitle="Failed to load invoice">
        <div className="text-center text-red-600 p-8">{error.message}</div>
      </PageLayout>
    );
  }

  if (!invoice) {
    return (
      <PageLayout title="Error" subtitle="Failed to load invoice">
        <div className="text-center text-red-600 p-8">Invoice not found</div>
      </PageLayout>
    );
  }

  const remainingBalance = getRemainingBalance(invoice.bookingMeta);
  const payments = getPayments(invoice.bookingMeta);

  return (
    <PageLayout
      title={`Invoice ${invoice.number}`}
      subtitle="Invoice details, payment, and summary"
    >
      <div className="space-y-6">
        {/* Header Actions toolbar dock */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
          <div className="flex items-center space-x-3 flex-wrap gap-y-2">
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/invoices" })}
              className="h-9 px-4 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 hover:text-black flex items-center rounded-md font-medium text-xs bg-white shadow-none"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Kembali ke Registrasi
            </Button>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getInvoiceStatusColor(invoice.status)}`}>
              {invoice.status}
            </span>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <Button 
              variant="outline" 
              onClick={handleDownload}
              className="h-9 px-3.5 border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-[#111111] flex items-center rounded-md text-xs font-semibold transition-colors bg-white shadow-none"
            >
              <Download className="h-4 w-4 mr-2 text-zinc-500" />
              Download PDF
            </Button>
            {isAdmin && (
              <Button 
                variant="outline" 
                onClick={async () => {
                  if (!invoice) return;
                  try {
                    await regenerateInvoiceMutation.mutateAsync({
                      bookingId: invoice.bookingId.toString(),
                      dueDate: new Date(invoice.dueDate).toISOString().split('T')[0],
                    });
                    toast.success("Invoice regenerated successfully");
                  } catch (err: any) {
                    toast.error(err?.message || "Failed to regenerate invoice");
                  }
                }}
                disabled={regenerateInvoiceMutation.isPending}
                className="h-9 px-3.5 border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-[#111111] flex items-center rounded-md text-xs font-semibold transition-colors bg-white shadow-none"
              >
                {regenerateInvoiceMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin text-zinc-500" /> : <RefreshCw className="h-4 w-4 mr-2 text-zinc-500" />}
                Regenerate
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={handleShareWhatsApp}
              className="h-9 px-3.5 border-emerald-250 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 flex items-center rounded-md text-xs font-semibold transition-colors bg-white shadow-none"
            >
              <MessageCircle className="h-4 w-4 mr-2 text-emerald-500" />
              Kirim via WhatsApp
            </Button>
            {isAdmin && invoice.status === 'paid' && (receiptsForBooking?.length ?? 0) === 0 && (
              <Button
                onClick={handleGenerateReceipt}
                disabled={generateReceiptMutation.isPending}
                className="bg-[#111111] hover:bg-[#242424] text-white h-9 px-4 rounded-md text-xs font-semibold transition-colors border border-transparent shadow-none"
              >
                {generateReceiptMutation.isPending ? (<><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Generating...</>) : 'Generate Receipt'}
              </Button>
            )}
            {isAdmin && (receiptsForBooking?.length ?? 0) > 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  const r = receiptsForBooking[0];
                  const API_BASE_URL = import.meta.env.VITE_API_URL || window.location.origin.replace(':5173', ':3000');
                  window.open(`${API_BASE_URL}/api/receipts/${r.id}/download`, '_blank');
                }}
                className="h-9 px-3.5 border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-[#111111] flex items-center rounded-md text-xs font-semibold transition-colors bg-white shadow-none"
              >
                <Download className="h-4 w-4 mr-2 text-zinc-500" />
                Download Receipt
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Details Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Invoice Summary */}
            <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none p-4 md:p-6">
              <h2 className="text-sm font-bold text-[#111111] uppercase tracking-wider mb-6 pb-2 border-b border-gray-100 flex items-center space-x-2">
                <FileText className="h-4.5 w-4.5 text-zinc-700" />
                <span>Invoice Summary</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-5 gap-x-8">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Invoice Number</label>
                  <p className="text-sm font-semibold text-[#111111]">{invoice.number}</p>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Status</label>
                  <div className="mt-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getInvoiceStatusColor(invoice.status)}`}>
                      {invoice.status}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Amount</label>
                  <p className="text-sm font-semibold text-[#111111]">
                    {formatCurrency(invoice.amount, invoice.currency)}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Currency</label>
                  <p className="text-sm font-semibold text-[#111111]">{invoice.currency}</p>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Issue Date</label>
                  <p className="text-sm font-semibold text-[#111111]">{formatDate(invoice.issueDate)}</p>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Due Date</label>
                  <p className="text-sm font-semibold text-[#111111]">{formatDate(invoice.dueDate)}</p>
                </div>
              </div>
            </div>

            {/* Booking Summary */}
            <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none p-4 md:p-6">
              <h2 className="text-sm font-bold text-[#111111] uppercase tracking-wider mb-6 pb-2 border-b border-gray-100 flex items-center space-x-2">
                <CalendarDays className="h-4.5 w-4.5 text-zinc-700" />
                <span>Booking Details</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-5 gap-x-8">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Booking Code</label>
                  <p className="text-sm font-semibold text-[#111111]">{invoice.bookingCode}</p>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Hotel Name</label>
                  <p className="text-sm font-semibold text-[#111111]">{invoice.hotelName || "-"}</p>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">City</label>
                  <p className="text-sm font-semibold text-[#111111]">{invoice.city || "-"}</p>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Payment Status</label>
                  <div className="mt-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getPaymentStatusColor(invoice.bookingPaymentStatus)}`}>
                      {invoice.bookingPaymentStatus || "unknown"}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Remaining Balance</label>
                  <p className="text-sm font-semibold text-[#111111]">
                    {formatCurrency(remainingBalance.toString(), "SAR")}
                  </p>
                </div>
              </div>
            </div>

            {/* Payments History */}
            <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none p-4 md:p-6">
              <h2 className="text-sm font-bold text-[#111111] uppercase tracking-wider mb-6 pb-2 border-b border-gray-100 flex items-center space-x-2">
                <Info className="h-4.5 w-4.5 text-zinc-700" />
                <span>Payments History</span>
              </h2>
              {payments.length === 0 ? (
                <p className="text-xs text-zinc-500 italic py-2">Belum ada data pembayaran untuk invoice ini.</p>
              ) : (
                <div className="space-y-2.5">
                  {payments.map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between border border-[#e5e7eb] rounded-lg p-3.5 bg-white transition-all hover:border-[#111111]/30">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-emerald-50 rounded-lg">
                          <Banknote className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#111111]">
                            {p.method.toUpperCase()} • {formatCurrency(p.amount.toString(), "SAR")}
                          </div>
                          <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mt-0.5">
                            {new Date(p.date).toLocaleString()} • Ref: {p.reference || "-"}
                          </div>
                        </div>
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border bg-emerald-50 text-emerald-700 border-emerald-200/50">
                        {p.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Record Payment Sidebar */}
          <div className="space-y-6">
            <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none p-4 md:p-6">
              <h2 className="text-sm font-bold text-[#111111] uppercase tracking-wider mb-6 pb-2 border-b border-gray-100 flex items-center space-x-2">
                <Banknote className="h-4.5 w-4.5 text-zinc-700" />
                <span>Record Payment</span>
              </h2>
              <form onSubmit={handleSubmitPay} className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="payMethod" className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Payment Method</label>
                  <select
                    id="payMethod"
                    value={payForm.method}
                    onChange={(e) =>
                      setPayForm((prev) => ({
                        ...prev,
                        method: e.target.value as "bank_transfer" | "deposit" | "cash",
                      }))
                    }
                    className="w-full h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:outline-none focus:border-[#111111] focus:ring-1 focus:ring-[#111111]"
                  >
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="deposit">Deposit</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label htmlFor="payAmount" className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Amount (SAR) *</label>
                  <Input
                    id="payAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={payForm.amount}
                    onChange={(e) => setPayForm((prev) => ({ ...prev, amount: e.target.value }))}
                    required
                    className="h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="payReference" className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Reference Number</label>
                  <Input
                    id="payReference"
                    value={payForm.referenceNumber}
                    onChange={(e) => setPayForm((prev) => ({ ...prev, referenceNumber: e.target.value }))}
                    placeholder="Optional reference"
                    className="h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="payDescription" className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Description Notes</label>
                  <Input
                    id="payDescription"
                    value={payForm.description}
                    onChange={(e) => setPayForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Optional description"
                    className="h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <Button 
                    type="submit" 
                    disabled={payInvoiceMutation.isPending}
                    className="w-full bg-[#111111] hover:bg-[#242424] text-white h-10 rounded-lg text-sm font-semibold transition-colors border border-transparent shadow-none"
                  >
                    {payInvoiceMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin text-white" />
                        Recording...
                      </>
                    ) : (
                      "Record Payment"
                    )}
                  </Button>
                </div>
              </form>

              <div className="mt-4 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider leading-relaxed">
                Payments are only allowed when an invoice exists. Surplus payments via bank transfer or cash will be credited to the client's deposit automatically.
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

export default InvoiceDetailPage;


