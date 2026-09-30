import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { CreditCard, Wallet, Banknote, Building2, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

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
  onSubmit: (data: {
    amount: number;
    method: PaymentMethod;
    referenceNumber?: string;
    description?: string;
    autoGenerateReceipt: boolean;
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
  onSubmit,
  isLoading = false,
}: ManualInvoicePaymentModalProps) {
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer');
  const [amount, setAmount] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [description, setDescription] = useState('');
  const [autoGenerateReceipt, setAutoGenerateReceipt] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setMethod('bank_transfer');
      setReferenceNumber('');
      setDescription(paidAmount === 0 ? 'Pembayaran Uang Muka (DP)' : 'Pembayaran Pelunasan');
      setAutoGenerateReceipt(true);
      setError('');
    }
  }, [isOpen, remainingBalance, paidAmount]);

  const numAmount = parseFloat(amount) || 0;
  const isDepositInsufficient = method === 'deposit' && numAmount > clientDepositBalance;
  const nextRemaining = Math.max(0, Math.round((remainingBalance - numAmount) * 100) / 100);
  const isNextPaidFull = numAmount > 0 && nextRemaining <= 0;

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

        {/* Amount Input */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <Label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">
              Nominal Pembayaran ({currency})
            </Label>
            <button
              type="button"
              onClick={() => setAmount(remainingBalance.toString())}
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
              onChange={(e) => setAmount(e.target.value)}
              className="pl-14 text-sm font-mono font-bold"
              required
            />
          </div>
        </div>

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
