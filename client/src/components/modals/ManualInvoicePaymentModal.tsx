import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { CreditCard, Wallet, Banknote, Building2, CheckCircle2, AlertCircle, Loader2, Mail, MessageCircle } from 'lucide-react';
import { fetchExchangeRate, fetchUsdExchangeRate } from '@/lib/exchange-rate';

export type PaymentMethod = 'bank_transfer' | 'deposit' | 'cash';

interface ManualInvoicePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceNumber: string;
  totalAmount: number;
  paidAmount: number;
  remainingBalance: number;
  currency?: string;
  clientName?: string;
  clientDepositBalance?: number;
  paymentTerms?: Array<{
    termNumber: number;
    label: string;
    percentage: number;
    amount: number;
    dueDate: string;
    notes?: string;
    idrAmount?: number;
    exchangeRate?: number;
  }>;
  existingPaymentsCount?: number;
  onSubmit: (data: {
    amount: number;
    method: PaymentMethod;
    referenceNumber?: string;
    description?: string;
    autoGenerateReceipt: boolean;
    sendEmail?: boolean;
    sendWhatsApp?: boolean;
    idrAmount?: number;
    exchangeRate?: number;
  }) => Promise<void>;
  isLoading?: boolean;
}

export function ManualInvoicePaymentModal({
  isOpen,
  onClose,
  invoiceNumber,
  totalAmount,
  paidAmount,
  remainingBalance,
  currency = 'SAR',
  clientName,
  clientDepositBalance = 0,
  paymentTerms,
  existingPaymentsCount = 0,
  onSubmit,
  isLoading = false,
}: ManualInvoicePaymentModalProps) {
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer');
  const [amount, setAmount] = useState<string>('');
  const [exchangeRate, setExchangeRate] = useState<string>('');
  const [idrAmount, setIdrAmount] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [description, setDescription] = useState('');
  const [autoGenerateReceipt, setAutoGenerateReceipt] = useState(true);
  const [sendEmail, setSendEmail] = useState(false);
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [error, setError] = useState('');

  const scheduledTerm = paymentTerms && paymentTerms.length > existingPaymentsCount
    ? paymentTerms[existingPaymentsCount]
    : null;

  useEffect(() => {
    if (isOpen) {
      setMethod('bank_transfer');
      setReferenceNumber('');
      setAutoGenerateReceipt(true);
      setSendEmail(false);
      setSendWhatsApp(false);
      setError('');

      const curr = (currency || 'SAR').toUpperCase();
      if (curr === 'IDR') {
        setExchangeRate('');
        setIdrAmount('');
        if (scheduledTerm) {
          const suggested = Math.min(remainingBalance, scheduledTerm.amount || 0);
          setAmount(suggested > 0 ? String(suggested) : '');
          setDescription(scheduledTerm.label || (paidAmount === 0 ? 'Pembayaran Uang Muka (DP)' : 'Pembayaran Pelunasan'));
        } else {
          setAmount('');
          setDescription(paidAmount === 0 ? 'Pembayaran Uang Muka (DP)' : 'Pembayaran Pelunasan');
        }
      } else {
        const ratePromise = curr === 'USD' ? fetchUsdExchangeRate() : fetchExchangeRate();
        ratePromise.then(rateRes => {
          const fetchedRate = (rateRes as any)?.data?.rate || (rateRes as any)?.rate;
          const defaultRate = curr === 'USD' ? 16500 : 4805;
          const liveRate = fetchedRate && fetchedRate > 0 ? Math.round(fetchedRate) : defaultRate;

          if (scheduledTerm) {
            const suggested = Math.min(remainingBalance, scheduledTerm.amount || 0);
            setAmount(suggested > 0 ? String(suggested) : '');
            setDescription(scheduledTerm.label || (paidAmount === 0 ? 'Pembayaran Uang Muka (DP)' : 'Pembayaran Pelunasan'));
            
            if (scheduledTerm.idrAmount && scheduledTerm.idrAmount > 0) {
              setIdrAmount(String(scheduledTerm.idrAmount));
              if (scheduledTerm.exchangeRate) {
                setExchangeRate(String(scheduledTerm.exchangeRate));
              } else if (suggested > 0) {
                setExchangeRate(String(Math.round((scheduledTerm.idrAmount / suggested) * 100) / 100));
              }
            } else {
              setExchangeRate(String(liveRate));
              if (suggested > 0) {
                setIdrAmount(String(Math.round(suggested * liveRate)));
              } else {
                setIdrAmount('');
              }
            }
          } else {
            setAmount('');
            setDescription(paidAmount === 0 ? 'Pembayaran Uang Muka (DP)' : 'Pembayaran Pelunasan');
            setExchangeRate(String(liveRate));
            setIdrAmount('');
          }
        }).catch(() => {
          if (scheduledTerm) {
            const suggested = Math.min(remainingBalance, scheduledTerm.amount || 0);
            setAmount(suggested > 0 ? String(suggested) : '');
            setDescription(scheduledTerm.label || (paidAmount === 0 ? 'Pembayaran Uang Muka (DP)' : 'Pembayaran Pelunasan'));
          }
        });
      }
    }
  }, [isOpen, remainingBalance, paidAmount, scheduledTerm, currency]);

  const numAmount = parseFloat(amount) || 0;
  const isDepositInsufficient = method === 'deposit' && numAmount > clientDepositBalance;
  const nextRemaining = Math.max(0, Math.round((remainingBalance - numAmount) * 100) / 100);
  const isNextPaidFull = numAmount > 0 && nextRemaining <= 0;

  const handleAmountChange = (newAmtStr: string) => {
    setAmount(newAmtStr);
    const amtNum = parseFloat(newAmtStr) || 0;
    const rateNum = parseFloat(exchangeRate) || 0;
    if (amtNum > 0 && rateNum > 0) {
      setIdrAmount(String(Math.round(amtNum * rateNum)));
    } else {
      setIdrAmount('');
    }
  };

  const handleIdrChange = (newIdrStr: string) => {
    setIdrAmount(newIdrStr);
    const idrNum = parseFloat(newIdrStr) || 0;
    const amtNum = parseFloat(amount) || 0;
    if (idrNum > 0 && amtNum > 0) {
      const calcRate = Math.round((idrNum / amtNum) * 100) / 100;
      setExchangeRate(String(calcRate));
    }
  };

  const handleRateChange = (newRateStr: string) => {
    setExchangeRate(newRateStr);
    const rateNum = parseFloat(newRateStr) || 0;
    const amtNum = parseFloat(amount) || 0;
    if (rateNum > 0 && amtNum > 0) {
      setIdrAmount(String(Math.round(amtNum * rateNum)));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!numAmount || numAmount <= 0) {
      setError('Nominal pembayaran harus lebih besar dari 0');
      return;
    }

    if (numAmount > remainingBalance) {
      setError(`Nominal pembayaran melebihi sisa tagihan (${formatCurrency(remainingBalance, currency)})`);
      return;
    }

    if (isDepositInsufficient) {
      setError(`Saldo deposit klien tidak mencukupi (Tersedia: ${formatCurrency(clientDepositBalance, 'SAR')})`);
      return;
    }

    try {
      await onSubmit({
        amount: numAmount,
        method,
        referenceNumber: referenceNumber.trim() || undefined,
        description: description.trim() || undefined,
        autoGenerateReceipt,
        sendEmail,
        sendWhatsApp,
        idrAmount: parseFloat(idrAmount) || undefined,
        exchangeRate: parseFloat(exchangeRate) || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Gagal memproses pembayaran');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Terima Pembayaran Invoice Manual"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Invoice Summary Header */}
        <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-3.5 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-zinc-500 font-medium">No. Invoice:</span>
            <span className="font-mono font-semibold text-zinc-800">{invoiceNumber}</span>
          </div>
          {clientName && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-500 font-medium">Klien:</span>
              <span className="font-semibold text-zinc-800">{clientName}</span>
            </div>
          )}
          <div className="border-t border-zinc-200/60 pt-2 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-[10px] uppercase font-bold text-zinc-400">Total</div>
              <div className="text-xs font-bold text-zinc-800">{formatCurrency(totalAmount, currency)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-zinc-400">Dibayar</div>
              <div className="text-xs font-bold text-emerald-600">{formatCurrency(paidAmount, currency)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-zinc-400">Sisa Tagihan</div>
              <div className="text-xs font-bold text-rose-600">{formatCurrency(remainingBalance, currency)}</div>
            </div>
          </div>
        </div>

        {/* Payment Method Selector */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">
            Metode Pembayaran
          </Label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setMethod('bank_transfer')}
              className={`p-2.5 rounded-xl border text-left transition-all flex flex-col items-center justify-center text-center gap-1.5 ${
                method === 'bank_transfer'
                  ? 'border-zinc-900 bg-zinc-900 text-white shadow-sm'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span className="text-xs font-semibold">Transfer Bank</span>
            </button>

            <button
              type="button"
              onClick={() => setMethod('deposit')}
              className={`p-2.5 rounded-xl border text-left transition-all flex flex-col items-center justify-center text-center gap-1.5 relative ${
                method === 'deposit'
                  ? 'border-zinc-900 bg-zinc-900 text-white shadow-sm'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span className="text-xs font-semibold">Saldo Deposit</span>
              {clientDepositBalance > 0 && (
                <span className={`text-[9px] font-mono px-1 rounded ${method === 'deposit' ? 'bg-zinc-800 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
                  SAR {clientDepositBalance.toLocaleString()}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setMethod('cash')}
              className={`p-2.5 rounded-xl border text-left transition-all flex flex-col items-center justify-center text-center gap-1.5 ${
                method === 'cash'
                  ? 'border-zinc-900 bg-zinc-900 text-white shadow-sm'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              <Banknote className="w-4 h-4" />
              <span className="text-xs font-semibold">Tunai / Cash</span>
            </button>
          </div>
        </div>

        {/* Deposit balance indicator */}
        {method === 'deposit' && (
          <div className={`p-2.5 rounded-lg text-xs flex items-center justify-between border ${
            clientDepositBalance >= numAmount && clientDepositBalance > 0
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
              : 'bg-amber-50/70 border-amber-200 text-amber-800'
          }`}>
            <span className="font-medium">Saldo Deposit Klien Tersedia:</span>
            <span className="font-bold font-mono">{formatCurrency(clientDepositBalance, 'SAR')}</span>
          </div>
        )}

        {/* Next Scheduled Termin Banner */}
        {scheduledTerm && (
          <div className="p-3 rounded-xl bg-sky-50/80 border border-sky-200/90 text-xs text-sky-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="font-bold flex items-center gap-1.5 text-sky-900">
                <span className="px-1.5 py-0.5 rounded bg-sky-200/70 text-[10px] font-bold uppercase tracking-wider">
                  Target Jadwal
                </span>
                <span>{scheduledTerm.label}</span>
              </div>
              <div className="text-[11px] text-sky-700 mt-0.5">
                Kewajiban: <strong className="font-mono">{formatCurrency(scheduledTerm.amount, currency)}</strong> ({scheduledTerm.percentage}%)
                {scheduledTerm.dueDate && <span> • Jatuh Tempo: {scheduledTerm.dueDate}</span>}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const suggested = Math.min(remainingBalance, scheduledTerm.amount || 0);
                if (suggested > 0) {
                  setAmount(String(suggested));
                  if (scheduledTerm.idrAmount && scheduledTerm.idrAmount > 0) {
                    setIdrAmount(String(scheduledTerm.idrAmount));
                    if (scheduledTerm.exchangeRate) {
                      setExchangeRate(String(scheduledTerm.exchangeRate));
                    } else {
                      setExchangeRate(String(Math.round((scheduledTerm.idrAmount / suggested) * 100) / 100));
                    }
                  } else {
                    const r = parseFloat(exchangeRate) || 0;
                    if (r > 0) setIdrAmount(String(Math.round(suggested * r)));
                  }
                }
                setDescription(scheduledTerm.label);
              }}
              className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold text-[11px] transition-colors whitespace-nowrap self-start sm:self-center"
            >
              Isi Sesuai Jadwal
            </button>
          </div>
        )}

        {/* Amount Input */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <Label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">
              Nominal Pembayaran ({currency})
            </Label>
            <button
              type="button"
              onClick={() => {
                setAmount(remainingBalance.toString());
                const r = parseFloat(exchangeRate) || 0;
                if (r > 0) setIdrAmount(String(Math.round(remainingBalance * r)));
              }}
              className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 underline"
            >
              Bayar Lunas ({formatCurrency(remainingBalance, currency)})
            </button>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-zinc-400">
              {currency}
            </span>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              max={remainingBalance}
              placeholder="0.00"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              className="pl-14 text-sm font-mono font-bold"
              required
            />
          </div>
        </div>

        {/* Locked IDR and Exchange Rate Inputs */}
        {(currency === 'SAR' || currency === 'USD') && (
          <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/90 space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-[10px] uppercase font-bold text-zinc-600 tracking-wider">
                    Nominal Diterima (IDR)
                  </Label>
                  <span className="text-[10px] text-zinc-400 font-mono">Terkunci</span>
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">
                    Rp
                  </span>
                  <Input
                    type="number"
                    placeholder="Contoh: 34600000"
                    value={idrAmount}
                    onChange={(e) => handleIdrChange(e.target.value)}
                    className="pl-9 h-9 text-xs font-mono font-bold bg-white"
                  />
                </div>
                {idrAmount && !isNaN(parseFloat(idrAmount)) && (
                  <span className="text-[10px] text-zinc-600 font-mono block mt-1">
                    Rp {new Intl.NumberFormat('id-ID').format(parseFloat(idrAmount))}
                  </span>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-[10px] uppercase font-bold text-zinc-600 tracking-wider">
                    Kurs Pembayaran (IDR / {currency})
                  </Label>
                  <span className="text-[10px] text-zinc-400 font-mono">1 {currency} =</span>
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">
                    Rp
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder={currency === 'USD' ? "Contoh: 16500" : "Contoh: 4733.24"}
                    value={exchangeRate}
                    onChange={(e) => handleRateChange(e.target.value)}
                    className="pl-9 h-9 text-xs font-mono font-bold bg-white"
                  />
                </div>
                {exchangeRate && !isNaN(parseFloat(exchangeRate)) && (
                  <span className="text-[10px] text-zinc-400 block mt-1">
                    1 {currency} = Rp {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(parseFloat(exchangeRate))}
                  </span>
                )}
              </div>
            </div>

            <div className="text-[11px] text-emerald-800 bg-emerald-50/80 border border-emerald-200/90 rounded-lg p-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>
                Nominal IDR & Kurs ini akan <strong>dikunci permanen</strong> pada invoice dan kwitansi resmi (tidak berubah jika kurs harian berubah).
              </span>
            </div>
          </div>
        )}

        {/* Live Calculation Preview */}
        {numAmount > 0 && (
          <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-200 text-xs space-y-1.5">
            <div className="flex justify-between text-zinc-600">
              <span>Sisa Tagihan Setelah Pembayaran Ini:</span>
              <span className={`font-mono font-bold ${nextRemaining <= 0 ? 'text-emerald-600' : 'text-zinc-800'}`}>
                {formatCurrency(nextRemaining, currency)}
              </span>
            </div>
            {isNextPaidFull && (
              <div className="flex items-center gap-1.5 text-emerald-700 font-semibold pt-1 border-t border-zinc-200/60">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Status invoice akan menjadi LUNAS setelah pembayaran ini</span>
              </div>
            )}
          </div>
        )}

        {/* Reference Number */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-zinc-700">
            No. Referensi / Bukti Transfer <span className="text-zinc-400 font-normal">(opsional)</span>
          </Label>
          <Input
            placeholder="Contoh: TRF-BCA-987263 / Ref No Bank"
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            className="text-xs"
          />
        </div>

        {/* Description / Notes */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-zinc-700">
            Keterangan / Catatan Pembayaran
          </Label>
          <Input
            placeholder="Contoh: Pembayaran Termin 1 / Pelunasan"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="text-xs"
          />
        </div>

        {/* Auto-generate Receipt Checkbox */}
        <div className="flex items-center space-x-2 pt-1">
          <input
            type="checkbox"
            id="autoGenerateReceipt"
            checked={autoGenerateReceipt}
            onChange={(e) => setAutoGenerateReceipt(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
          />
          <label htmlFor="autoGenerateReceipt" className="text-xs text-zinc-700 font-medium cursor-pointer">
            Terbitkan Kwitansi Resmi (PDF) otomatis untuk pembayaran ini
          </label>
        </div>

        {/* Notification Delivery Options */}
        <div className="bg-zinc-50 border border-zinc-200/80 rounded-lg p-3 space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
            Kirim Konfirmasi Pembayaran (Opsional)
          </label>
          <div className="space-y-1.5">
            <label className="flex items-center space-x-2.5 cursor-pointer text-xs font-medium text-zinc-700 hover:text-zinc-950">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
              />
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-zinc-400" />
                <span>Kirim konfirmasi via <strong>Email</strong></span>
              </span>
            </label>
            <label className="flex items-center space-x-2.5 cursor-pointer text-xs font-medium text-zinc-700 hover:text-zinc-950">
              <input
                type="checkbox"
                checked={sendWhatsApp}
                onChange={(e) => setSendWhatsApp(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
              />
              <span className="flex items-center gap-1.5">
                <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                <span>Kirim konfirmasi via <strong>WhatsApp</strong></span>
              </span>
            </label>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Modal Buttons */}
        <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="text-xs h-9 px-4 font-semibold"
          >
            Batal
          </Button>
          <Button
            type="submit"
            disabled={isLoading || isDepositInsufficient || numAmount <= 0}
            className="bg-[#111111] hover:bg-[#242424] text-white text-xs h-9 px-5 font-semibold shadow-none flex items-center gap-1.5"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Memproses...</span>
              </>
            ) : (
              <>
                <CreditCard className="w-3.5 h-3.5" />
                <span>Konfirmasi Pembayaran</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
