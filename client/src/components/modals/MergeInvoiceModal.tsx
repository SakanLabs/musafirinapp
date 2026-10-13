import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  useMergeInvoicePreview,
  useExecuteMergeInvoice,
  type Invoice,
  type InvoiceSourceType,
  type ExecuteMergeInvoiceResponse,
} from '@/lib/queries/invoices';
import { formatCurrency } from '@/lib/utils';
import {
  Layers,
  ArrowRight,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

interface MergeInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedInvoices: Invoice[];
  onSuccess?: (mergedInvoice: ExecuteMergeInvoiceResponse['data']) => void;
}

// Helper to detect invoice source type from prefix
function getInvoiceSourceType(invoiceNumber: string): InvoiceSourceType {
  if (invoiceNumber.startsWith('TI-')) return 'transportation';
  if (invoiceNumber.startsWith('SOI-') || invoiceNumber.startsWith('SO-INV-')) return 'service_order';
  if (invoiceNumber.startsWith('LA-INV-')) return 'custom_la';
  if (invoiceNumber.startsWith('MBI-')) return 'muthowif';
  if (invoiceNumber.startsWith('INV-AR-')) return 'agent_request';
  if (invoiceNumber.startsWith('INV-MAN-') || invoiceNumber.startsWith('INV-MRG-')) return 'manual';
  return 'hotel';
}

const TYPE_BADGES: Record<string, { label: string; color: string }> = {
  hotel: { label: 'Hotel', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  transportation: { label: 'Transport', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  service_order: { label: 'Service Order', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  custom_la: { label: 'Custom LA', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  muthowif: { label: 'Muthowif', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  agent_request: { label: 'Agent Request', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  manual: { label: 'Manual', color: 'bg-zinc-100 text-zinc-700 border-zinc-200' },
};

export function MergeInvoiceModal({
  isOpen,
  onClose,
  selectedInvoices,
  onSuccess,
}: MergeInvoiceModalProps) {
  // Determine initial currency: if all selected match, use that, otherwise default to SAR
  const initialCurrency = (() => {
    if (selectedInvoices.length === 0) return 'SAR';
    const firstCur = selectedInvoices[0].currency?.toUpperCase() || 'SAR';
    const allSame = selectedInvoices.every((i) => (i.currency?.toUpperCase() || 'SAR') === firstCur);
    return allSame ? firstCur : 'SAR';
  })();

  const [targetCurrency, setTargetCurrency] = useState<'SAR' | 'USD' | 'IDR'>(
    initialCurrency as 'SAR' | 'USD' | 'IDR'
  );

  // Form states
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [title, setTitle] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('');
  const [customDescriptions, setCustomDescriptions] = useState<Record<string, string>>({});
  const [customQuantities, setCustomQuantities] = useState<Record<string, number>>({});

  // Mutations
  const { mutate: fetchPreview, data: previewData, isPending: isPreviewLoading } =
    useMergeInvoicePreview();
  const { mutateAsync: executeMerge, isPending: isExecuting } = useExecuteMergeInvoice();

  // Reset & Prefill whenever modal opens or selectedInvoices change
  useEffect(() => {
    if (isOpen && selectedInvoices.length > 0) {
      const primary = selectedInvoices[0];
      setClientName(primary.clientName || '');
      setClientEmail(primary.clientEmail || '');
      setClientPhone('');
      setClientAddress('');
      setTitle(`Tagihan Gabungan Layanan`);
      setIssueDate(new Date().toISOString().split('T')[0]);

      // Due date: default 7 days from now or the latest source due date
      const d = new Date();
      d.setDate(d.getDate() + 7);
      setDueDate(d.toISOString().split('T')[0]);

      // Notes should not default to listing invoice numbers to keep client invoice clean
      setNotes('');
      setCustomDescriptions({});
      setCustomQuantities({});

      // Determine initial target currency
      const firstCur = (primary.currency || 'SAR').toUpperCase();
      const allSame = selectedInvoices.every((i) => (i.currency || 'SAR').toUpperCase() === firstCur);
      const chosenCur = (allSame ? firstCur : 'SAR') as 'SAR' | 'USD' | 'IDR';
      setTargetCurrency(chosenCur);

      // Fetch initial preview
      fetchPreview({
        invoices: selectedInvoices.map((i) => ({
          id: i.id,
          type: getInvoiceSourceType(i.number),
          number: i.number,
        })),
        targetCurrency: chosenCur,
      });
    }
  }, [isOpen, selectedInvoices, fetchPreview]);

  // Refetch preview whenever target currency changes
  const handleCurrencyChange = (cur: 'SAR' | 'USD' | 'IDR') => {
    setTargetCurrency(cur);
    if (selectedInvoices.length >= 2) {
      fetchPreview({
        invoices: selectedInvoices.map((i) => ({
          id: i.id,
          type: getInvoiceSourceType(i.number),
          number: i.number,
          description: customDescriptions[i.number] || undefined,
          quantity: customQuantities[i.number] || undefined,
        })),
        targetCurrency: cur,
      });
    }
  };

  const hasMultipleCurrencies = selectedInvoices.some(
    (i) => (i.currency || 'SAR').toUpperCase() !== (selectedInvoices[0]?.currency || 'SAR').toUpperCase()
  );

  const previewItems = previewData?.items || [];
  const previewTotal = previewData?.totalAmount || '0.00';
  const warnings = previewData?.warnings || [];
  const uniqueClients = previewData?.uniqueClients || [];

  const handleMergeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientName.trim()) {
      toast.error('Nama client wajib diisi');
      return;
    }
    if (!dueDate) {
      toast.error('Tanggal jatuh tempo wajib diisi');
      return;
    }
    if (selectedInvoices.length < 2) {
      toast.error('Minimal pilih 2 invoice untuk digabungkan');
      return;
    }

    try {
      const result = await executeMerge({
        invoices: selectedInvoices.map((i) => {
          const previewItem = previewItems.find(
            (p) => p.invoiceNumber === i.number || p.invoiceId === i.id
          );
          const finalDesc =
            customDescriptions[i.number] !== undefined
              ? customDescriptions[i.number]
              : previewItem?.description;
          const finalQty =
            customQuantities[i.number] !== undefined
              ? customQuantities[i.number]
              : previewItem?.quantity;

          return {
            id: i.id,
            type: getInvoiceSourceType(i.number),
            number: i.number,
            description: finalDesc?.trim() || undefined,
            quantity: finalQty && Number(finalQty) > 0 ? Number(finalQty) : undefined,
          };
        }),
        targetCurrency,
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim() || undefined,
        clientPhone: clientPhone.trim() || undefined,
        clientAddress: clientAddress.trim() || undefined,
        title: title.trim() || undefined,
        issueDate: issueDate || undefined,
        dueDate,
        notes: notes.trim() || undefined,
      });

      toast.success(result.message || 'Invoice berhasil digabungkan!');
      if (onSuccess) onSuccess(result.data);
      onClose();
    } catch (err: unknown) {
      console.error('Merge execution error:', err);
      const errorObj = err as { response?: { data?: { error?: string } }; message?: string };
      toast.error(errorObj?.response?.data?.error || errorObj?.message || 'Gagal menggabungkan invoice');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Gabungkan Invoice (Merge Invoices)"
      size="xl"
      className="max-h-[90vh] flex flex-col"
    >
      <form onSubmit={handleMergeSubmit} className="space-y-5">
        {/* Subtitle & Instructions */}
        <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-xs text-zinc-600 flex items-start gap-2.5">
          <Layers className="h-4 w-4 text-zinc-700 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-zinc-900">
              Menggabungkan {selectedInvoices.length} invoice menjadi 1 invoice tagihan resmi
            </p>
            <p className="mt-0.5">
              Invoice gabungan akan mendapatkan nomor baru berformat <span className="font-mono font-medium text-zinc-800">INV-MRG-YYYY-XXXXXX</span>. Invoice sumber tetap tersimpan untuk riwayat audit.
            </p>
          </div>
        </div>

        {/* Currency Selector */}
        <div className="border border-zinc-200 rounded-xl p-4 bg-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <Label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                Mata Uang Tagihan Akhir (Target Currency)
              </Label>
              <p className="text-xs text-zinc-500 mt-0.5">
                {hasMultipleCurrencies
                  ? 'Invoice sumber memiliki mata uang berbeda. Kurs akan dihitung otomatis.'
                  : 'Pilih mata uang yang diinginkan untuk invoice hasil penggabungan.'}
              </p>
            </div>
            <div className="inline-flex rounded-lg border border-zinc-200 p-1 bg-zinc-50">
              {(['SAR', 'USD', 'IDR'] as const).map((curr) => (
                <button
                  key={curr}
                  type="button"
                  onClick={() => handleCurrencyChange(curr)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    targetCurrency === curr
                      ? 'bg-zinc-900 text-white shadow-sm'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50'
                  }`}
                >
                  {curr}
                </button>
              ))}
            </div>
          </div>

          {/* Exchange Rates Note */}
          {previewData?.exchangeRates && Object.keys(previewData.exchangeRates).length > 0 && (
            <div className="mt-3 pt-3 border-t border-zinc-100 flex flex-wrap items-center gap-2 text-[11px] text-zinc-600">
              <span className="font-semibold text-zinc-700">Kurs Acuan Terkini:</span>
              {Object.entries(previewData.exchangeRates).map(([pair, rate]) => (
                <span
                  key={pair}
                  className="bg-zinc-100 text-zinc-800 px-2 py-0.5 rounded font-mono border border-zinc-200"
                >
                  1 {pair.split('_TO_')[0]} = {Number(rate).toLocaleString('id-ID')} {pair.split('_TO_')[1]}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Warnings */}
        {(uniqueClients.length > 1 || warnings.length > 0) && (
          <div className="border border-amber-200 bg-amber-50/70 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>Perhatian Sebelum Menggabungkan:</span>
            </div>
            {uniqueClients.length > 1 && (
              <p className="text-xs text-amber-800 pl-6">
                Invoice yang dipilih berasal dari <strong>{uniqueClients.length} client berbeda</strong>: (
                {uniqueClients.join(', ')}). Pastikan Anda mengisi nama client yang tepat di form di bawah.
              </p>
            )}
            {warnings.map((warn, i) => (
              <p key={i} className="text-xs text-amber-800 pl-6">
                • {warn}
              </p>
            ))}
          </div>
        )}

        {/* Selected Invoices Table Breakdown */}
        <div className="border border-zinc-200 rounded-xl overflow-hidden">
          <div className="bg-zinc-50/80 px-4 py-2.5 border-b border-zinc-200 flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
              Daftar Invoice yang Digabungkan ({selectedInvoices.length})
            </span>
            {isPreviewLoading && (
              <span className="flex items-center text-xs text-zinc-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Menghitung konversi...
              </span>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-zinc-200">
            {isPreviewLoading && previewItems.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500">
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-zinc-400" />
                Memuat rincian konversi invoice...
              </div>
            ) : previewItems.length > 0 ? (
              previewItems.map((item, idx) => {
                const badge = TYPE_BADGES[item.type] || TYPE_BADGES.hotel;
                const isConverted = item.originalCurrency !== item.convertedCurrency;
                const currentDesc =
                  customDescriptions[item.invoiceNumber] !== undefined
                    ? customDescriptions[item.invoiceNumber]
                    : item.description || '';

                const currentQty =
                  customQuantities[item.invoiceNumber] !== undefined
                    ? customQuantities[item.invoiceNumber]
                    : item.quantity || 1;

                const convertedTotal = parseFloat(item.convertedAmount) || 0;
                const computedUnitPrice = currentQty > 0 ? convertedTotal / currentQty : convertedTotal;

                return (
                  <div
                    key={item.invoiceNumber || idx}
                    className="p-3.5 hover:bg-zinc-50/60 transition-colors space-y-2.5"
                  >
                    {/* Top Row: Internal Ref & Type + Converted Amount */}
                    <div className="flex items-start justify-between text-xs gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${badge.color}`}
                          >
                            {badge.label}
                          </span>
                          <span className="font-mono text-[10px] text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                            Ref: #{item.invoiceNumber}
                          </span>
                          {item.bookingCode && item.bookingCode !== '-' && (
                            <span className="font-mono text-[10px] text-zinc-500 bg-zinc-50 px-1.5 py-0.5 rounded border border-zinc-200">
                              Booking: {item.bookingCode}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-500 truncate">
                          Klien Asal: <span className="text-zinc-700 font-medium">{item.clientName}</span>
                        </div>
                      </div>

                      {/* Amount & Conversion */}
                      <div className="text-right shrink-0">
                        <div className="font-bold text-zinc-900 text-sm">
                          {formatCurrency(item.convertedAmount, item.convertedCurrency)}
                        </div>
                        {isConverted && (
                          <div className="text-[10px] text-zinc-500 flex items-center justify-end gap-1 mt-0.5">
                            <span>{formatCurrency(item.originalAmount, item.originalCurrency)}</span>
                            <ArrowRight className="h-2.5 w-2.5 text-zinc-400" />
                            <span>Rate: {Number(item.exchangeRate).toLocaleString('id-ID')}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Description Row: What the client actually sees */}
                    <div className="bg-zinc-50/80 rounded-lg p-2.5 border border-zinc-200 space-y-2">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <Label className="text-[11px] font-semibold text-zinc-800">
                            Deskripsi Layanan / Item
                          </Label>
                          <span className="text-[10px] text-zinc-500">
                            (Ditampilkan di Invoice & PDF Klien)
                          </span>
                        </div>
                        <Input
                          value={currentDesc}
                          onChange={(e) => {
                            setCustomDescriptions((prev) => ({
                              ...prev,
                              [item.invoiceNumber]: e.target.value,
                            }));
                          }}
                          placeholder="Masukkan deskripsi layanan yang perlu dibayar klien..."
                          className="h-8 text-xs bg-white text-zinc-900 border-zinc-300 focus:border-zinc-500"
                        />
                      </div>

                      {/* Quantity & Unit Price Breakdown */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-0.5">
                        <div>
                          <Label className="text-[10px] font-semibold text-zinc-700">
                            Qty (Jumlah)
                          </Label>
                          <Input
                            type="number"
                            min={1}
                            value={currentQty}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              setCustomQuantities((prev) => ({
                                ...prev,
                                [item.invoiceNumber]: isNaN(val) || val < 1 ? 1 : val,
                              }));
                            }}
                            className="mt-0.5 h-8 text-xs bg-white text-zinc-900 border-zinc-300 font-semibold text-center"
                          />
                        </div>

                        <div>
                          <Label className="text-[10px] font-semibold text-zinc-700">
                            Harga Satuan ({item.convertedCurrency})
                          </Label>
                          <div className="mt-0.5 h-8 px-2.5 flex items-center justify-end bg-white rounded-md border border-zinc-200 text-xs font-mono font-medium text-zinc-800">
                            {formatCurrency(computedUnitPrice, item.convertedCurrency)}
                          </div>
                        </div>

                        <div>
                          <Label className="text-[10px] font-semibold text-zinc-700">
                            Total Item ({item.convertedCurrency})
                          </Label>
                          <div className="mt-0.5 h-8 px-2.5 flex items-center justify-end bg-zinc-100 rounded-md border border-zinc-200 text-xs font-mono font-bold text-zinc-900">
                            {formatCurrency(item.convertedAmount, item.convertedCurrency)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              // Fallback before preview returns
              selectedInvoices.map((inv) => (
                <div key={inv.number || inv.id} className="p-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold font-mono text-zinc-900">{inv.number}</span>
                    <span className="text-zinc-500 ml-2">{inv.clientName}</span>
                  </div>
                  <div className="font-bold text-zinc-900">
                    {formatCurrency(inv.amount, inv.currency)}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Table Summary Footer */}
          <div className="bg-zinc-50 px-4 py-3 border-t border-zinc-200 flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
              Total Tagihan Hasil Penggabungan:
            </span>
            <div className="text-right">
              <span className="text-base font-extrabold text-zinc-950 font-mono">
                {formatCurrency(previewTotal, targetCurrency)}
              </span>
              <span className="text-[10px] font-semibold text-zinc-500 ml-1.5">
                ({targetCurrency})
              </span>
            </div>
          </div>
        </div>

        {/* Invoice Metadata Form */}
        <div className="border border-zinc-200 rounded-xl p-4 bg-white space-y-4">
          <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
            Informasi Penerima & Tanggal Tagihan
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <Label htmlFor="merge-client-name" className="text-xs font-semibold text-zinc-700">
                Nama Client / Perusahaan <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="merge-client-name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Contoh: PT. Barokah Travel / H. Abdullah"
                className="mt-1 h-9 text-xs"
                required
              />
            </div>

            <div>
              <Label htmlFor="merge-client-email" className="text-xs font-semibold text-zinc-700">
                Email Client (Opsional)
              </Label>
              <Input
                id="merge-client-email"
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="client@example.com"
                className="mt-1 h-9 text-xs"
              />
            </div>

            <div>
              <Label htmlFor="merge-client-phone" className="text-xs font-semibold text-zinc-700">
                No. Telepon / WhatsApp (Opsional)
              </Label>
              <Input
                id="merge-client-phone"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="+62 812-xxxx-xxxx"
                className="mt-1 h-9 text-xs"
              />
            </div>

            <div>
              <Label htmlFor="merge-title" className="text-xs font-semibold text-zinc-700">
                Judul Invoice (Opsional)
              </Label>
              <Input
                id="merge-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Tagihan Gabungan Paket Umroh Ramadhan"
                className="mt-1 h-9 text-xs"
              />
            </div>

            <div>
              <Label htmlFor="merge-issue-date" className="text-xs font-semibold text-zinc-700">
                Tanggal Terbit (Issue Date)
              </Label>
              <Input
                id="merge-issue-date"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="mt-1 h-9 text-xs"
              />
            </div>

            <div>
              <Label htmlFor="merge-due-date" className="text-xs font-semibold text-zinc-700">
                Tanggal Jatuh Tempo (Due Date) <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="merge-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 h-9 text-xs"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="merge-notes" className="text-xs font-semibold text-zinc-700">
              Catatan / Keterangan Tagihan
            </Label>
            <Textarea
              id="merge-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan tambahan untuk klien..."
              rows={2}
              className="mt-1 text-xs"
            />
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-100">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isExecuting}
            className="h-9 px-4 text-xs font-semibold"
          >
            Batal
          </Button>
          <Button
            type="submit"
            disabled={isExecuting || isPreviewLoading || selectedInvoices.length < 2}
            className="h-9 px-5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold shadow-sm"
          >
            {isExecuting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                Menggabungkan...
              </>
            ) : (
              <>
                <Layers className="h-3.5 w-3.5 mr-2" />
                Gabungkan & Terbitkan Invoice ({selectedInvoices.length})
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
