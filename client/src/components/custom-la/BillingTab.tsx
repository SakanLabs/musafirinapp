import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchLaBilling, generateLaInvoice, recordLaPayment, generateLaReceipt } from "@/lib/queries/customLa";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2, FileText, Receipt, PlusCircle, CreditCard, Eye } from "lucide-react";

export function BillingTab({ laId }: { laId: number }) {
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  
  const { data: billingResp, isLoading } = useQuery({
    queryKey: ['custom-la-billing', laId],
    queryFn: () => fetchLaBilling(laId)
  });

  const generateInvoiceMutation = useMutation({
    mutationFn: (dueDate?: string) => generateLaInvoice(laId, { dueDate }),
    onSuccess: () => {
      toast.success("Invoice gabungan berhasil diterbitkan");
      queryClient.invalidateQueries({ queryKey: ['custom-la-billing', laId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setIsGenerating(false);
    },
    onError: (err: any) => {
      toast.error(`Gagal menerbitkan invoice: ${err.message}`);
      setIsGenerating(false);
    }
  });

  const recordPaymentMutation = useMutation({
    mutationFn: (data: any) => recordLaPayment(laId, data),
    onSuccess: () => {
      toast.success("Pembayaran berhasil dicatat");
      queryClient.invalidateQueries({ queryKey: ['custom-la-billing', laId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    }
  });
  
  const generateReceiptMutation = useMutation({
    mutationFn: (paymentId: number) => generateLaReceipt(laId, paymentId),
    onSuccess: () => {
      toast.success("Kwitansi berhasil digenerate");
      queryClient.invalidateQueries({ queryKey: ['custom-la-billing', laId] });
    }
  });

  const handleGenerateInvoice = () => {
    setIsGenerating(true);
    generateInvoiceMutation.mutate();
  };

  const invoices = billingResp?.data || [];
  
  if (isLoading) return <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-[#e5e7eb] shadow-none">
        <div>
          <h3 className="text-base font-bold text-zinc-950 tracking-tight">Tagihan Gabungan (Consolidated Billing)</h3>
          <p className="text-xs text-zinc-500 mt-1">Kelola invoice dan pembayaran untuk seluruh paket LA ini secara terpusat.</p>
        </div>
        {!invoices.length && (
          <Button 
            onClick={handleGenerateInvoice} 
            disabled={isGenerating}
            className="bg-[#111111] hover:bg-[#242424] text-white flex items-center h-9 px-4 rounded-md font-semibold text-xs transition-colors border border-transparent shadow-none"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin text-white" /> : <FileText className="w-4 h-4 mr-2 text-white" />}
            Terbitkan Invoice Gabungan
          </Button>
        )}
      </div>

      {invoices.map((inv: any) => {
        const totalPaid = inv.payments?.reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0) || 0;
        const balanceDue = Math.max(0, parseFloat(inv.amount) - totalPaid);

        return (
          <Card key={inv.id} className="border border-[#e5e7eb] rounded-xl bg-white shadow-none overflow-hidden">
            <CardHeader className="bg-zinc-50/50 border-b border-[#e5e7eb] px-6 py-4">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm font-bold text-zinc-900 flex items-center tracking-tight">
                  Invoice {inv.number}
                  <Badge 
                    variant="outline" 
                    className={`ml-3 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md ${
                      inv.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50' : 
                      inv.status === 'partially_paid' ? 'bg-amber-50 text-amber-700 border-amber-200/50' : 
                      'bg-zinc-50 text-zinc-500 border-zinc-200/50'
                    }`}
                  >
                    {inv.status}
                  </Badge>
                </CardTitle>
                <div className="space-x-2 flex items-center">
                  {inv.pdfUrl && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => window.open(inv.pdfUrl, '_blank')}
                      className="h-8 text-xs px-3 border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                    >
                      <Eye className="w-3.5 h-3.5 mr-2 text-zinc-500" /> Lihat PDF
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleGenerateInvoice()} 
                    disabled={isGenerating}
                    className="h-8 text-xs px-3 border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                  >
                    {isGenerating ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin text-zinc-500" /> : <FileText className="w-3.5 h-3.5 mr-2 text-zinc-500" />} Perbarui PDF
                  </Button>
                  {balanceDue > 0 && (
                    <PaymentModal onSubmit={(data) => recordPaymentMutation.mutate(data)} isPending={recordPaymentMutation.isPending} />
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              
              <div className="grid grid-cols-3 gap-6 p-5 bg-zinc-50/50 rounded-xl border border-zinc-200/60">
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Total Tagihan</p>
                  <p className="text-xl font-bold text-zinc-900 tracking-tight">{formatCurrency(inv.amount, inv.currency)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Telah Dibayar</p>
                  <p className="text-xl font-bold text-emerald-600 tracking-tight">{formatCurrency(totalPaid, inv.currency)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Sisa Tagihan</p>
                  <p className="text-xl font-bold text-rose-600 tracking-tight">{formatCurrency(balanceDue, inv.currency)}</p>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-sm text-zinc-900 mb-4 border-b pb-3 tracking-tight">Riwayat Pembayaran & Kwitansi</h4>
                {inv.payments?.length > 0 ? (
                  <div className="overflow-hidden border border-zinc-200 rounded-lg">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-zinc-50 border-b border-zinc-200">
                          <th className="text-left font-bold text-zinc-700 py-2.5 px-3 uppercase tracking-wider">Tanggal</th>
                          <th className="text-left font-bold text-zinc-700 py-2.5 px-3 uppercase tracking-wider">Metode</th>
                          <th className="text-right font-bold text-zinc-700 py-2.5 px-3 uppercase tracking-wider">Jumlah</th>
                          <th className="text-right font-bold text-zinc-700 py-2.5 px-3 uppercase tracking-wider">Kwitansi (PDF)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inv.payments.map((p: any) => {
                          const receipt = inv.receipts?.find((r: any) => r.paymentId === p.id);
                          return (
                            <tr key={p.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/55 transition-colors">
                              <td className="py-2.5 px-3 font-medium text-zinc-800">{formatDate(p.paymentDate)}</td>
                              <td className="py-2.5 px-3 text-zinc-600">{p.paymentMethod}</td>
                              <td className="text-right py-2.5 px-3 font-bold text-emerald-600">{formatCurrency(p.amount, p.currency)}</td>
                              <td className="text-right py-2.5 px-3">
                                {receipt?.pdfUrl ? (
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => window.open(receipt.pdfUrl, '_blank')} 
                                    className="h-8 text-xs font-semibold text-zinc-700 hover:text-black hover:bg-zinc-100 px-2.5"
                                  >
                                    <Receipt className="w-3.5 h-3.5 mr-1 text-zinc-500" /> {receipt.number}
                                  </Button>
                                ) : (
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => generateReceiptMutation.mutate(p.id)} 
                                    disabled={generateReceiptMutation.isPending}
                                    className="h-8 text-xs font-semibold px-2.5 border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                                  >
                                    <PlusCircle className="w-3.5 h-3.5 mr-1 text-zinc-500" /> Generate
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-zinc-400 text-xs italic text-center py-4">Belum ada riwayat pembayaran.</p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function PaymentModal({ onSubmit, isPending }: { onSubmit: (data: any) => void, isPending: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Transfer Bank');

  if (!isOpen) {
    return (
      <Button 
        size="sm" 
        className="bg-[#111111] hover:bg-[#242424] text-white flex items-center h-8 px-3.5 rounded-md text-xs font-semibold shadow-none border border-transparent"
        onClick={() => setIsOpen(true)}
      >
        <CreditCard className="w-3.5 h-3.5 mr-2 text-white" /> Bayar / Cicil
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 backdrop-blur-[1px]">
      <div className="bg-white p-6 rounded-xl border border-zinc-200 w-[400px] shadow-none">
        <h3 className="text-base font-bold text-zinc-950 mb-4 tracking-tight">Catat Pembayaran LA</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">Jumlah Dibayar (SAR)</label>
            <input 
              type="number" 
              className="w-full h-10 px-3 border border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] bg-white text-sm focus:outline-none" 
              value={amount} 
              onChange={e => setAmount(e.target.value)} 
              placeholder="0.00" 
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">Metode Pembayaran</label>
            <select 
              className="w-full h-10 px-3 border border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] bg-white text-sm focus:outline-none" 
              value={method} 
              onChange={e => setMethod(e.target.value)}
            >
              <option value="Transfer Bank">Transfer Bank</option>
              <option value="Cash">Cash</option>
              <option value="Kartu Kredit">Kartu Kredit</option>
            </select>
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => setIsOpen(false)}
              className="h-10 px-4 border-zinc-200 hover:bg-zinc-50 font-semibold text-xs rounded-md shadow-none"
            >
              Batal
            </Button>
            <Button 
              onClick={() => {
                if (amount) {
                  onSubmit({ amount, paymentMethod: method });
                  setIsOpen(false);
                }
              }} 
              disabled={isPending || !amount}
              className="bg-[#111111] hover:bg-[#242424] text-white h-10 px-5 rounded-md font-semibold text-xs transition-colors border border-transparent shadow-none"
            >
              {isPending ? "Memproses..." : "Simpan Pembayaran"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
