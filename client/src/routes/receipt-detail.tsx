import { createFileRoute } from "@tanstack/react-router";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useReceipt } from "@/lib/queries/receipts";
import { Download, FileText, Loader2, MessageCircle, Building2, User, Banknote } from "lucide-react";

export const Route = createFileRoute("/receipt-detail")({
  validateSearch: (search: Record<string, unknown>) => {
    let id = typeof search.id === "string" ? search.id : search.id !== undefined ? String(search.id) : "";
    if (id.startsWith('"') && id.endsWith('"')) {
      id = id.slice(1, -1);
    }
    try {
      const decoded = decodeURIComponent(id);
      if (decoded !== id) id = decoded;
    } catch {
      // ignore
    }
    id = id.replace(/^"+|"+$/g, "");
    return { id };
  },
  component: ReceiptDetailPage,
});

function ReceiptDetailPage() {
  const { id } = Route.useSearch();
  const { data: receipt, isLoading, error } = useReceipt(id);

  const handleDownload = () => {
    if (!receipt) return;
    const API_BASE_URL = import.meta.env.VITE_API_URL || window.location.origin.replace(':5173', ':3000');
    window.open(`${API_BASE_URL}/api/receipts/${receipt.id}/download`, "_blank");
  };

  const handleShareWhatsApp = () => {
    if (!receipt) return;
    const API_BASE_URL = import.meta.env.VITE_API_URL || window.location.origin.replace(':5173', ':3000');
    const pdfUrl = `${API_BASE_URL}/api/receipts/${receipt.id}/download`;
    const message = [
      `Assalamu'alaikum *${receipt.payerName || receipt.clientName}* 🙏`,
      ``,
      `Pembayaran Anda sudah kami terima, berikut detail kwitansinya:`,
      `🧳 No. Kwitansi: *${receipt.number}*`,
      `💰 Jumlah Diterima: *${formatCurrency(receipt.paidAmount, receipt.currency)}*`,
      `📅 Tanggal: ${formatDate(receipt.issueDate)}`,
      ``,
      `Silakan download kwitansi PDF di sini:`,
      `${pdfUrl}`,
      ``,
      `Terima kasih atas kepercayaannya ❤️`,
    ].join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  if (!id) {
    return (
      <PageLayout title="Receipt Detail" subtitle="Missing receipt ID">
        <div className="text-center text-red-600 p-8">Receipt ID is required</div>
      </PageLayout>
    );
  }

  if (isLoading) {
    return (
      <PageLayout title="Loading Receipt..." subtitle="Fetching receipt details">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </PageLayout>
    );
  }

  if (error || !receipt) {
    return (
      <PageLayout title="Error" subtitle="Failed to load receipt">
        <div className="text-center text-red-600 p-8">{error instanceof Error ? error.message : "Receipt not found"}</div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={`Receipt ${receipt.number}`}
      subtitle="View receipt details"
      actions={
        <div className="flex space-x-3">
          <Button variant="outline" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
          <Button variant="outline" onClick={handleShareWhatsApp} className="text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700">
            <MessageCircle className="h-4 w-4 mr-2" />
            Kirim via WA
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Receipt Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <span>Receipt Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-gray-500 text-sm">Receipt Number</span>
                <p className="font-semibold">{receipt.number}</p>
              </div>
              <div>
                <span className="text-gray-500 text-sm">Issue Date</span>
                <p className="font-semibold">{formatDate(receipt.issueDate)}</p>
              </div>
              <div>
                <span className="text-gray-500 text-sm">Total Amount</span>
                <p className="font-semibold text-gray-700">
                  {formatCurrency(receipt.totalAmount, receipt.currency)}
                </p>
              </div>
              <div>
                <span className="text-gray-500 text-sm">Paid Amount</span>
                <p className="font-semibold text-green-600">
                  {formatCurrency(receipt.paidAmount, receipt.currency)}
                </p>
              </div>
              <div>
                <span className="text-gray-500 text-sm">Balance Due</span>
                <p className="font-semibold text-red-600">
                  {formatCurrency(receipt.balanceDue, receipt.currency)}
                </p>
              </div>
              <div>
                <span className="text-gray-500 text-sm">Payment Method</span>
                <p className="font-semibold capitalize">
                  {receipt.meta?.payment?.method || "-"}
                </p>
              </div>
            </div>
            {receipt.notes && (
              <div className="pt-4 border-t border-gray-100">
                <span className="text-gray-500 text-sm">Notes</span>
                <p className="text-gray-700">{receipt.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment & Client Details */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5 text-blue-600" />
                <span>Payer Details</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-gray-500 text-sm">Name</span>
                <p className="font-semibold">{receipt.payerName || receipt.clientName}</p>
              </div>
              {receipt.payerEmail && (
                <div>
                  <span className="text-gray-500 text-sm">Email</span>
                  <p className="font-semibold">{receipt.payerEmail}</p>
                </div>
              )}
              {receipt.payerPhone && (
                <div>
                  <span className="text-gray-500 text-sm">Phone</span>
                  <p className="font-semibold">{receipt.payerPhone}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                <span>Booking Info</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-gray-500 text-sm">Booking Code</span>
                <p className="font-semibold">{receipt.bookingCode || "N/A"}</p>
              </div>
              <div>
                <span className="text-gray-500 text-sm">Hotel</span>
                <p className="font-semibold">{receipt.hotelName || "N/A"}</p>
              </div>
              {receipt.invoiceNumber && (
                <div>
                  <span className="text-gray-500 text-sm">Related Invoice</span>
                  <p className="font-semibold text-blue-600">{receipt.invoiceNumber}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageLayout>
  );
}

export default ReceiptDetailPage;
