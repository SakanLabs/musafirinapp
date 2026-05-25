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
      subtitle="Detail tanda terima dan kwitansi pembayaran transaksi"
      actions={
        <div className="flex items-center space-x-2.5">
          <Button 
            variant="outline" 
            onClick={handleDownload}
            className="h-9 px-4 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 hover:text-black flex items-center rounded-md font-semibold text-xs bg-white shadow-none"
          >
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
          <Button 
            variant="outline" 
            onClick={handleShareWhatsApp} 
            className="h-9 px-4 border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 flex items-center rounded-md font-semibold text-xs bg-white shadow-none"
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Kirim via WhatsApp
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Receipt Details */}
        <div className="md:col-span-2 border border-[#e5e7eb] rounded-xl bg-white shadow-none p-6">
          <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-zinc-100">
            <FileText className="h-5 w-5 text-zinc-500" />
            <div>
              <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider">Receipt Information</h3>
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mt-0.5">Rincian administrasi kwitansi pembayaran</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
            <div>
              <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Nomor Kwitansi</span>
              <p className="text-sm font-bold text-zinc-800 tracking-tight">{receipt.number}</p>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Tanggal Terbit</span>
              <p className="text-sm font-bold text-zinc-800 tracking-tight">{formatDate(receipt.issueDate)}</p>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Total Tagihan</span>
              <p className="text-sm font-bold text-zinc-800 tracking-tight">
                {formatCurrency(receipt.totalAmount, receipt.currency)}
              </p>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Jumlah Dibayar</span>
              <div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-200/50 bg-emerald-50 text-emerald-700">
                  {formatCurrency(receipt.paidAmount, receipt.currency)}
                </span>
              </div>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Sisa Tagihan</span>
              <div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  parseFloat(receipt.balanceDue) > 0 
                    ? 'border-rose-200/50 bg-rose-50 text-rose-700' 
                    : 'border-emerald-200/50 bg-emerald-50 text-emerald-700'
                }`}>
                  {formatCurrency(receipt.balanceDue, receipt.currency)}
                </span>
              </div>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Metode Pembayaran</span>
              <p className="text-sm font-bold text-zinc-800 tracking-tight capitalize">
                {receipt.meta?.payment?.method?.replace('_', ' ') || receipt.method || "-"}
              </p>
            </div>
          </div>
          
          {receipt.notes && (
            <div className="pt-5 border-t border-zinc-100 mt-5">
              <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Catatan</span>
              <p className="text-xs font-medium text-zinc-600 bg-zinc-50/50 border border-zinc-100 rounded-lg p-3 leading-relaxed">{receipt.notes}</p>
            </div>
          )}
        </div>

        {/* Payer & Booking info */}
        <div className="space-y-6">
          <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none p-6">
            <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-zinc-100">
              <User className="h-5 w-5 text-zinc-500" />
              <div>
                <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider">Payer Details</h3>
                <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mt-0.5">Identitas pembayar transaksi</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Nama Client</span>
                <p className="text-sm font-bold text-zinc-800 tracking-tight">{receipt.payerName || receipt.clientName}</p>
              </div>
              {receipt.payerEmail && (
                <div>
                  <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Alamat Email</span>
                  <p className="text-xs font-semibold text-zinc-600">{receipt.payerEmail}</p>
                </div>
              )}
              {receipt.payerPhone && (
                <div>
                  <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Nomor Telepon</span>
                  <p className="text-xs font-semibold text-zinc-600">{receipt.payerPhone}</p>
                </div>
              )}
            </div>
          </div>

          <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none p-6">
            <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-zinc-100">
              <Building2 className="h-5 w-5 text-zinc-500" />
              <div>
                <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider">Booking Info</h3>
                <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mt-0.5">Informasi booking dan invoice terkait</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Kode Booking</span>
                <p className="text-sm font-bold text-zinc-800 tracking-tight">{receipt.bookingCode || "N/A"}</p>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Hotel</span>
                <p className="text-sm font-bold text-zinc-800 tracking-tight">{receipt.hotelName || "N/A"}</p>
              </div>
              {receipt.invoiceNumber && (
                <div>
                  <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Invoice Terkait</span>
                  <p className="text-xs font-bold text-zinc-500 tracking-tight">{receipt.invoiceNumber}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

export default ReceiptDetailPage;
