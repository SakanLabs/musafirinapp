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
      <div className="flex justify-between items-center bg-white p-4 rounded-lg border shadow-sm">
        <div>
          <h3 className="text-lg font-bold">Tagihan Gabungan (Consolidated Billing)</h3>
          <p className="text-sm text-gray-500">Kelola invoice dan pembayaran untuk seluruh paket LA ini secara terpusat.</p>
        </div>
        {!invoices.length && (
          <Button onClick={handleGenerateInvoice} disabled={isGenerating}>
            {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
            Terbitkan Invoice Gabungan
          </Button>
        )}
      </div>

      {invoices.map((inv: any) => {
        const totalPaid = inv.payments?.reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0) || 0;
        const balanceDue = Math.max(0, parseFloat(inv.amount) - totalPaid);

        return (
          <Card key={inv.id}>
            <CardHeader className="bg-gray-50 border-b">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg flex items-center">
                  Invoice {inv.number}
                  <Badge className="ml-3" variant={inv.status === 'paid' ? 'default' : inv.status === 'partially_paid' ? 'secondary' : 'outline'}>
                    {inv.status}
                  </Badge>
                </CardTitle>
                <div className="space-x-2 flex items-center">
                  {inv.pdfUrl && (
                    <Button variant="outline" size="sm" onClick={() => window.open(inv.pdfUrl, '_blank')}>
                      <Eye className="w-4 h-4 mr-2" /> Lihat PDF
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => handleGenerateInvoice()} disabled={isGenerating}>
                    {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />} Perbarui PDF
                  </Button>
                  {balanceDue > 0 && (
                    <PaymentModal onSubmit={(data) => recordPaymentMutation.mutate(data)} isPending={recordPaymentMutation.isPending} />
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              
              <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg border">
                <div>
                  <p className="text-sm text-gray-500">Total Tagihan</p>
                  <p className="text-xl font-bold">{formatCurrency(inv.amount, inv.currency)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Telah Dibayar</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(totalPaid, inv.currency)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Sisa Tagihan</p>
                  <p className="text-xl font-bold text-red-600">{formatCurrency(balanceDue, inv.currency)}</p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3 border-b pb-2">Riwayat Pembayaran & Kwitansi</h4>
                {inv.payments?.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="text-left py-2 px-2">Tanggal</th>
                        <th className="text-left py-2 px-2">Metode</th>
                        <th className="text-right py-2 px-2">Jumlah</th>
                        <th className="text-right py-2 px-2">Kwitansi (PDF)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inv.payments.map((p: any) => {
                        const receipt = inv.receipts?.find((r: any) => r.paymentId === p.id);
                        return (
                          <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="py-2 px-2">{formatDate(p.paymentDate)}</td>
                            <td className="py-2 px-2">{p.paymentMethod}</td>
                            <td className="text-right py-2 px-2 font-medium text-green-600">{formatCurrency(p.amount, p.currency)}</td>
                            <td className="text-right py-2 px-2">
                              {receipt?.pdfUrl ? (
                                <Button variant="ghost" size="sm" onClick={() => window.open(receipt.pdfUrl, '_blank')} className="text-blue-600">
                                  <Receipt className="w-4 h-4 mr-1" /> {receipt.number}
                                </Button>
                              ) : (
                                <Button variant="outline" size="sm" onClick={() => generateReceiptMutation.mutate(p.id)} disabled={generateReceiptMutation.isPending}>
                                  <PlusCircle className="w-4 h-4 mr-1" /> Generate
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-gray-500 text-sm italic">Belum ada riwayat pembayaran.</p>
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
      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setIsOpen(true)}>
        <CreditCard className="w-4 h-4 mr-2" /> Bayar / Cicil
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-[400px]">
        <h3 className="text-lg font-bold mb-4">Catat Pembayaran LA</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Jumlah Dibayar (SAR)</label>
            <input type="number" className="w-full border rounded p-2" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Metode Pembayaran</label>
            <select className="w-full border rounded p-2" value={method} onChange={e => setMethod(e.target.value)}>
              <option value="Transfer Bank">Transfer Bank</option>
              <option value="Cash">Cash</option>
              <option value="Kartu Kredit">Kartu Kredit</option>
            </select>
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setIsOpen(false)}>Batal</Button>
            <Button onClick={() => {
              if (amount) {
                onSubmit({ amount, paymentMethod: method });
                setIsOpen(false);
              }
            }} disabled={isPending || !amount}>
              {isPending ? "Memproses..." : "Simpan Pembayaran"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
