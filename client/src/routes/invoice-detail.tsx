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
import { authService } from "@/lib/auth";
import { FileText, Download, Banknote, CalendarDays, Loader2, Info } from "lucide-react";

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
  switch (status) {
    case "paid":
      return "bg-green-100 text-green-800";
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "overdue":
      return "bg-red-100 text-red-800";
    case "cancelled":
      return "bg-gray-100 text-gray-800";
    case "draft":
    case "sent":
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function getPaymentStatusColor(status?: "unpaid" | "partial" | "paid" | "overdue") {
  switch (status) {
    case "paid":
      return "bg-green-100 text-green-800";
    case "partial":
      return "bg-yellow-100 text-yellow-800";
    case "unpaid":
    case "overdue":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
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
  const { id } = Route.useSearch();
  const { data: invoice, isLoading, error } = useInvoice(id);
  const payInvoiceMutation = usePayInvoice();

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
    window.open(`http://localhost:3000/api/invoices/by-number/${invoice.number}`, "_blank");
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
          <Loader2 className="h-8 w-8 animate-spin" />
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
      actions={
        <div className="flex space-x-3">
          <Button variant="outline" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
          {isAdmin && invoice.status === 'paid' && (receiptsForBooking?.length ?? 0) === 0 && (
            <Button
              onClick={handleGenerateReceipt}
              disabled={generateReceiptMutation.isPending}
              title="Generate receipt for this booking (requires paid invoice)"
            >
              {generateReceiptMutation.isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>) : 'Generate Receipt'}
            </Button>
          )}
          {isAdmin && (receiptsForBooking?.length ?? 0) > 0 && (
            <Button
              variant="secondary"
              onClick={() => {
                const r = receiptsForBooking[0];
                window.open(`http://localhost:3000/api/receipts/${r.id}/download`, '_blank');
              }}
              title="Download existing receipt"
            >
              Download Receipt
            </Button>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Invoice Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <span>Invoice Summary</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-500 text-sm">Number</span>
                  <p className="font-semibold">{invoice.number}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Status</span>
                  <div className="mt-1">
                    <Badge className={getInvoiceStatusColor(invoice.status)}>
                      {invoice.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Amount</span>
                  <p className="font-semibold">
                    {formatCurrency(invoice.amount, invoice.currency)}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Currency</span>
                  <p className="font-semibold">{invoice.currency}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Issue Date</span>
                  <p className="font-semibold">{formatDate(invoice.issueDate)}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Due Date</span>
                  <p className="font-semibold">{formatDate(invoice.dueDate)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Booking Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CalendarDays className="h-5 w-5 text-blue-600" />
                <span>Booking Summary</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-500 text-sm">Booking Code</span>
                  <p className="font-semibold">{invoice.bookingCode}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Hotel</span>
                  <p className="font-semibold">{invoice.hotelName}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">City</span>
                  <p className="font-semibold">{invoice.city}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Payment Status</span>
                  <div className="mt-1">
                    <Badge className={getPaymentStatusColor(invoice.bookingPaymentStatus)}>
                      {invoice.bookingPaymentStatus || "unknown"}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Remaining Balance</span>
                  <p className="font-semibold">
                    {formatCurrency(remainingBalance.toString(), "SAR")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payments History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Info className="h-5 w-5 text-blue-600" />
                <span>Payments History</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <p className="text-gray-600">No payments recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {payments.map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between border rounded-md p-3">
                      <div className="flex items-center space-x-3">
                        <Banknote className="h-4 w-4 text-green-600" />
                        <div>
                          <div className="text-sm font-semibold">
                            {p.method.toUpperCase()} • {formatCurrency(p.amount.toString(), "SAR")}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(p.date).toLocaleString()} • Ref: {p.reference || "-"}
                          </div>
                        </div>
                      </div>
                      <Badge className="bg-green-100 text-green-800">{p.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Payment Form */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Banknote className="h-5 w-5 text-blue-600" />
                <span>Record Payment</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitPay} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="payMethod">Method</Label>
                  <select
                    id="payMethod"
                    value={payForm.method}
                    onChange={(e) =>
                      setPayForm((prev) => ({
                        ...prev,
                        method: e.target.value as "bank_transfer" | "deposit" | "cash",
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="deposit">Deposit</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payAmount">Amount (SAR)</Label>
                  <Input
                    id="payAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={payForm.amount}
                    onChange={(e) => setPayForm((prev) => ({ ...prev, amount: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payReference">Reference</Label>
                  <Input
                    id="payReference"
                    value={payForm.referenceNumber}
                    onChange={(e) => setPayForm((prev) => ({ ...prev, referenceNumber: e.target.value }))}
                    placeholder="Optional reference"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payDescription">Description</Label>
                  <Input
                    id="payDescription"
                    value={payForm.description}
                    onChange={(e) => setPayForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Optional description"
                  />
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={payInvoiceMutation.isPending}>
                    {payInvoiceMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Recording...
                      </>
                    ) : (
                      "Record Payment"
                    )}
                  </Button>
                </div>
              </form>

              <div className="mt-4 text-xs text-gray-500">
                Payments are only allowed when an invoice exists. Surplus payments via bank transfer or cash will be credited to the client's deposit automatically.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageLayout>
  );
}

export default InvoiceDetailPage;
