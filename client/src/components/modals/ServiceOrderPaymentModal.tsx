import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { CreditCard, Wallet, Banknote, Building2, CheckCircle2, AlertCircle, Loader2, Mail, MessageCircle } from 'lucide-react';

export type PaymentMethod = 'bank_transfer' | 'deposit' | 'cash';

interface ServiceOrderPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: string;
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
    sendEmail?: boolean;
    sendWhatsApp?: boolean;
  }) => Promise<void>;
  isLoading?: boolean;
}

export function ServiceOrderPaymentModal({
  isOpen,
  onClose,
  orderNumber,
  totalAmount,
  paidAmount,
  remainingBalance,
  currency = 'SAR',
  clientName,
  clientDepositBalance = 0,
  onSubmit,
  isLoading = false,
}: ServiceOrderPaymentModalProps) {
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer');
  const [amount, setAmount] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [description, setDescription] = useState('');
  const [autoGenerateReceipt, setAutoGenerateReceipt] = useState(true);
  const [sendEmail, setSendEmail] = useState(false);
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setMethod('bank_transfer');
      setReferenceNumber('');
      setDescription(paidAmount === 0 ? 'Pembayaran Uang Muka (DP)' : 'Pembayaran Termin');
      setAutoGenerateReceipt(true);
      setSendEmail(false);
      setSendWhatsApp(false);
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
        sendEmail,
        sendWhatsApp,
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
      title="Penerimaan Pembayaran Visa"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Order & Summary Header */}
        <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-3.5 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-zinc-500 font-medium">No. Visa:</span>
            <span className="font-mono font-semibold text-zinc-800">{orderNumber}</span>
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
            <Label htmlFor="payment-amount" className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">
              Nominal Pembayaran ({currency}) *
            </Label>
            {/* Quick helper buttons like hotel */}
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => {
                  const val = (Math.round(totalAmount * 0.3 * 100) / 100).toString();
                  setAmount(val);
                  setDescription('Pembayaran Uang Muka (DP) 30%');
                }}
                className="text-[10px] font-semibold text-zinc-600 hover:text-black bg-zinc-100 hover:bg-zinc-200 px-2 py-0.5 rounded transition-colors"
              >
                DP 30%
              </button>
              <button
                type="button"
                onClick={() => {
                  const val = (Math.round(totalAmount * 0.5 * 100) / 100).toString();
                  setAmount(val);
                  setDescription('Pembayaran Uang Muka (DP) 50%');
                }}
                className="text-[10px] font-semibold text-zinc-600 hover:text-black bg-zinc-100 hover:bg-zinc-200 px-2 py-0.5 rounded transition-colors"
              >
                DP 50%
              </button>
              <button
                type="button"
                onClick={() => {
                  setAmount(remainingBalance.toString());
                  setDescription('Pelunasan Sisa Tagihan');
                }}
                className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded transition-colors"
              >
                Lunasi Sisa
              </button>
            </div>
          </div>
          <Input
            id="payment-amount"
            type="number"
            step="0.01"
            min="0.01"
            max={remainingBalance}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Ketik nominal DP atau klik tombol DP di atas"
            className="font-mono text-base font-semibold h-10 border-zinc-300 focus-visible:ring-zinc-900"
            required
            autoFocus
          />

          {/* Live Preview Simulation Card */}
          {numAmount > 0 && (
            <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-2.5 text-xs space-y-1 mt-1">
              <div className="flex justify-between items-center text-zinc-600">
                <span>Nominal dibayar sekarang:</span>
                <span className="font-mono font-bold text-zinc-900">{formatCurrency(numAmount, currency)}</span>
              </div>
              <div className="flex justify-between items-center text-zinc-600">
                <span>Sisa tagihan setelah pembayaran:</span>
                <span className={`font-mono font-bold ${nextRemaining <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatCurrency(nextRemaining, currency)}
                </span>
              </div>
              <div className="flex justify-between items-center text-zinc-600 pt-1 border-t border-zinc-200/80">
                <span>Status tagihan berikutnya:</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isNextPaidFull 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {isNextPaidFull ? 'Lunas (100%)' : `Belum Lunas / DP (${Math.round(((paidAmount + numAmount) / totalAmount) * 100)}%)`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Reference Number */}
        <div className="space-y-1">
          <Label htmlFor="reference-no" className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">
            No. Referensi / ID Bukti Transfer <span className="text-zinc-400 font-normal lowercase">(opsional)</span>
          </Label>
          <Input
            id="reference-no"
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            placeholder="Contoh: BSI-TRX-102939 / Mandiri-Ref"
            className="text-xs h-9 border-zinc-200"
          />
          <p className="text-[10px] text-zinc-400">
            Isi dengan nomor resi/bukti transaksi bank (bukan nominal pembayaran).
          </p>
        </div>

        {/* Description */}
        <div className="space-y-1">
          <Label htmlFor="description" className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">
            Catatan / Keterangan Pembayaran
          </Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Contoh: Pembayaran Uang Muka (DP) Visa Umrah"
            className="text-xs h-9 border-zinc-200"
          />
        </div>

        {/* Auto Receipt Checkbox */}
        <div className="flex items-center space-x-2 pt-1">
          <input
            type="checkbox"
            id="auto-receipt"
            checked={autoGenerateReceipt}
            onChange={(e) => setAutoGenerateReceipt(e.target.checked)}
            className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 h-4 w-4"
          />
          <Label htmlFor="auto-receipt" className="text-xs text-zinc-700 font-medium cursor-pointer">
            Otomatis terbitkan Kwitansi PDF untuk pembayaran ini
          </Label>
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
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-2 pt-3 border-t border-zinc-100">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="h-9 px-4 text-xs font-medium"
          >
            Batal
          </Button>
          <Button
            type="submit"
            disabled={isLoading || !numAmount || numAmount <= 0 || isDepositInsufficient}
            className="h-9 px-5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold shadow-none flex items-center space-x-1.5"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Memproses...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Catat Pembayaran</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
