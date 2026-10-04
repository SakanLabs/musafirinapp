import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import {
  Bell,
  Mail,
  MessageCircle,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
  Ticket,
  DollarSign,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useBookingNotifications,
  useSendBookingNotification,
  useRetryNotification,
  type NotificationLog,
} from '@/lib/queries/notifications';
import { formatOperationalDate } from '@/lib/date';

interface BookingNotificationCardProps {
  bookingId: number;
  bookingCode: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  hasVoucher: boolean;
  voucherNumber?: string;
  paymentStatus: string;
}

export function BookingNotificationCard({
  bookingId,
  bookingCode,
  clientName,
  clientEmail,
  clientPhone,
  hasVoucher,
  voucherNumber,
  paymentStatus,
}: BookingNotificationCardProps) {
  const { data: logs = [], isLoading, refetch, isFetching } = useBookingNotifications(bookingId);
  const sendMutation = useSendBookingNotification();
  const retryMutation = useRetryNotification();

  // Confirmation modal state
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'payment_confirmation' | 'voucher';
    sendEmail: boolean;
    sendWhatsApp: boolean;
    isResend: boolean;
    lastSentDate?: string;
  }>({
    isOpen: false,
    type: 'payment_confirmation',
    sendEmail: true,
    sendWhatsApp: true,
    isResend: false,
  });

  // Find latest log for each (type, channel)
  const latestLogs = {
    paymentEmail: logs.find((l) => l.type === 'payment_confirmation' && l.channel === 'email'),
    paymentWhatsApp: logs.find((l) => l.type === 'payment_confirmation' && l.channel === 'whatsapp'),
    voucherEmail: logs.find((l) => l.type === 'voucher' && l.channel === 'email'),
    voucherWhatsApp: logs.find((l) => l.type === 'voucher' && l.channel === 'whatsapp'),
  };

  const handleOpenSendModal = (type: 'payment_confirmation' | 'voucher') => {
    const isEmailSent = type === 'payment_confirmation'
      ? latestLogs.paymentEmail?.status === 'sent'
      : latestLogs.voucherEmail?.status === 'sent';

    const isWhatsAppSent = type === 'payment_confirmation'
      ? latestLogs.paymentWhatsApp?.status === 'sent'
      : latestLogs.voucherWhatsApp?.status === 'sent';

    const isResend = isEmailSent || isWhatsAppSent;
    const lastSentDate = (type === 'payment_confirmation'
      ? (latestLogs.paymentWhatsApp?.sentAt || latestLogs.paymentEmail?.sentAt)
      : (latestLogs.voucherWhatsApp?.sentAt || latestLogs.voucherEmail?.sentAt)
    );

    setModalState({
      isOpen: true,
      type,
      sendEmail: true,
      sendWhatsApp: true,
      isResend,
      lastSentDate: lastSentDate ? formatOperationalDate(lastSentDate, 'datetime') : undefined,
    });
  };

  const handleConfirmSend = async () => {
    const channels: ('email' | 'whatsapp')[] = [];
    if (modalState.sendEmail) channels.push('email');
    if (modalState.sendWhatsApp) channels.push('whatsapp');

    if (channels.length === 0) {
      toast.error('Pilih minimal satu saluran pengiriman (Email atau WhatsApp)');
      return;
    }

    try {
      const res = await sendMutation.mutateAsync({
        bookingId,
        type: modalState.type,
        channels,
        forceResend: modalState.isResend,
      });

      setModalState((prev) => ({ ...prev, isOpen: false }));

      const sentCount = res.data?.results?.filter((r: any) => r.status === 'sent').length || 0;
      const failedCount = res.data?.results?.filter((r: any) => r.status === 'failed').length || 0;

      if (sentCount > 0 && failedCount === 0) {
        toast.success(`Notifikasi ${modalState.type === 'payment_confirmation' ? 'pembayaran' : 'voucher'} berhasil dikirim`);
      } else if (sentCount > 0 && failedCount > 0) {
        toast.warning(`Sebagian notifikasi terkirim (${sentCount} berhasil, ${failedCount} gagal)`);
      } else if (failedCount > 0) {
        toast.error(`Pengiriman notifikasi gagal`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Gagal mengirim notifikasi');
    }
  };

  const handleRetry = async (log: NotificationLog) => {
    try {
      await retryMutation.mutateAsync({ logId: log.id, bookingId });
      toast.success(`Mencoba kirim ulang via ${log.channel === 'email' ? 'Email' : 'WhatsApp'}...`);
    } catch (err: any) {
      toast.error(err?.message || 'Gagal mengirim ulang');
    }
  };

  const renderStatusBadge = (log?: NotificationLog) => {
    if (!log) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-500 border border-zinc-200">
          Belum Dikirim
        </span>
      );
    }
    if (log.status === 'sent') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          ✓ Terkirim
        </span>
      );
    }
    if (log.status === 'failed') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
          ✕ Gagal
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
        Sedang Proses
      </span>
    );
  };

  return (
    <>
      <Card className="border border-[#e5e7eb] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] bg-white overflow-hidden">
        <CardHeader className="border-b border-[#e5e7eb] px-5 py-3.5 bg-zinc-50/50 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
            <Bell className="h-4 w-4 text-zinc-600" />
            Notifikasi Klien (Email &amp; WhatsApp)
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-700"
            title="Muat ulang status"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>

        <CardContent className="p-5 space-y-5 text-xs">
          {/* SECTION 1: Konfirmasi Pembayaran */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-zinc-900">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                <span>Konfirmasi Pembayaran</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenSendModal('payment_confirmation')}
                disabled={sendMutation.isPending}
                className="h-7 text-[11px] px-2.5 border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-semibold"
              >
                <Send className="h-3 w-3 mr-1" />
                {latestLogs.paymentEmail?.status === 'sent' || latestLogs.paymentWhatsApp?.status === 'sent'
                  ? 'Kirim Ulang'
                  : 'Kirim Sekarang'}
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-zinc-50/60 p-3 rounded-lg border border-zinc-200/60">
              {/* Email channel */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-zinc-600">
                    <Mail className="h-3 w-3 text-zinc-400" /> Email
                  </span>
                  {renderStatusBadge(latestLogs.paymentEmail)}
                </div>
                <div className="text-[10px] text-zinc-500 truncate">
                  {latestLogs.paymentEmail?.recipient || clientEmail || 'Tidak ada email'}
                </div>
                {latestLogs.paymentEmail?.sentAt && (
                  <div className="text-[9px] text-zinc-400">
                    Terkirim: {formatOperationalDate(latestLogs.paymentEmail.sentAt, 'datetime')}
                  </div>
                )}
                {latestLogs.paymentEmail?.status === 'failed' && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[9px] text-rose-600 truncate max-w-[130px]" title={latestLogs.paymentEmail.errorMessage || ''}>
                      {latestLogs.paymentEmail.errorMessage || 'Gagal'}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRetry(latestLogs.paymentEmail!)}
                      disabled={retryMutation.isPending}
                      className="h-5 px-1.5 text-[9px] text-rose-700 hover:bg-rose-50 font-bold"
                    >
                      Retry Email
                    </Button>
                  </div>
                )}
              </div>

              {/* WhatsApp channel */}
              <div className="space-y-1 sm:border-l sm:border-zinc-200 sm:pl-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-zinc-600">
                    <MessageCircle className="h-3 w-3 text-emerald-600" /> WhatsApp
                  </span>
                  {renderStatusBadge(latestLogs.paymentWhatsApp)}
                </div>
                <div className="text-[10px] text-zinc-500 truncate">
                  {latestLogs.paymentWhatsApp?.recipient || clientPhone || 'Tidak ada telepon'}
                </div>
                {latestLogs.paymentWhatsApp?.sentAt && (
                  <div className="text-[9px] text-zinc-400">
                    Terkirim: {formatOperationalDate(latestLogs.paymentWhatsApp.sentAt, 'datetime')}
                  </div>
                )}
                {latestLogs.paymentWhatsApp?.status === 'failed' && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[9px] text-rose-600 truncate max-w-[130px]" title={latestLogs.paymentWhatsApp.errorMessage || ''}>
                      {latestLogs.paymentWhatsApp.errorMessage || 'Gagal'}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRetry(latestLogs.paymentWhatsApp!)}
                      disabled={retryMutation.isPending}
                      className="h-5 px-1.5 text-[9px] text-rose-700 hover:bg-rose-50 font-bold"
                    >
                      Retry WA
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 2: Pengiriman Voucher */}
          <div className="space-y-2.5 pt-3 border-t border-zinc-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-zinc-900">
                <Ticket className="h-4 w-4 text-blue-600" />
                <span>Pengiriman Voucher Hotel</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenSendModal('voucher')}
                disabled={!hasVoucher || sendMutation.isPending}
                className="h-7 text-[11px] px-2.5 border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-semibold"
                title={!hasVoucher ? 'Generate voucher terlebih dahulu sebelum mengirim' : ''}
              >
                <Send className="h-3 w-3 mr-1" />
                {latestLogs.voucherEmail?.status === 'sent' || latestLogs.voucherWhatsApp?.status === 'sent'
                  ? 'Kirim Ulang Voucher'
                  : 'Kirim Voucher'}
              </Button>
            </div>

            {!hasVoucher && (
              <div className="text-[10px] text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                ⚠ Voucher belum dibuat untuk booking ini. Generate voucher terlebih dahulu sebelum dapat mengirimkannya ke klien.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-zinc-50/60 p-3 rounded-lg border border-zinc-200/60">
              {/* Email channel */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-zinc-600">
                    <Mail className="h-3 w-3 text-zinc-400" /> Email
                  </span>
                  {renderStatusBadge(latestLogs.voucherEmail)}
                </div>
                <div className="text-[10px] text-zinc-500 truncate">
                  {latestLogs.voucherEmail?.recipient || clientEmail || 'Tidak ada email'}
                </div>
                {latestLogs.voucherEmail?.sentAt && (
                  <div className="text-[9px] text-zinc-400">
                    Terkirim: {formatOperationalDate(latestLogs.voucherEmail.sentAt, 'datetime')}
                  </div>
                )}
                {latestLogs.voucherEmail?.status === 'failed' && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[9px] text-rose-600 truncate max-w-[130px]" title={latestLogs.voucherEmail.errorMessage || ''}>
                      {latestLogs.voucherEmail.errorMessage || 'Gagal'}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRetry(latestLogs.voucherEmail!)}
                      disabled={retryMutation.isPending}
                      className="h-5 px-1.5 text-[9px] text-rose-700 hover:bg-rose-50 font-bold"
                    >
                      Retry Email
                    </Button>
                  </div>
                )}
              </div>

              {/* WhatsApp channel */}
              <div className="space-y-1 sm:border-l sm:border-zinc-200 sm:pl-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-zinc-600">
                    <MessageCircle className="h-3 w-3 text-emerald-600" /> WhatsApp
                  </span>
                  {renderStatusBadge(latestLogs.voucherWhatsApp)}
                </div>
                <div className="text-[10px] text-zinc-500 truncate">
                  {latestLogs.voucherWhatsApp?.recipient || clientPhone || 'Tidak ada telepon'}
                </div>
                {latestLogs.voucherWhatsApp?.sentAt && (
                  <div className="text-[9px] text-zinc-400">
                    Terkirim: {formatOperationalDate(latestLogs.voucherWhatsApp.sentAt, 'datetime')}
                  </div>
                )}
                {latestLogs.voucherWhatsApp?.status === 'failed' && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[9px] text-rose-600 truncate max-w-[130px]" title={latestLogs.voucherWhatsApp.errorMessage || ''}>
                      {latestLogs.voucherWhatsApp.errorMessage || 'Gagal'}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRetry(latestLogs.voucherWhatsApp!)}
                      disabled={retryMutation.isPending}
                      className="h-5 px-1.5 text-[9px] text-rose-700 hover:bg-rose-50 font-bold"
                    >
                      Retry WA
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CONFIRMATION / SEND MODAL */}
      <Modal
        isOpen={modalState.isOpen}
        onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
        title={
          modalState.type === 'payment_confirmation'
            ? 'Kirim Konfirmasi Pembayaran'
            : 'Kirim Voucher Hotel'
        }
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
              disabled={sendMutation.isPending}
            >
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmSend}
              disabled={sendMutation.isPending || (!modalState.sendEmail && !modalState.sendWhatsApp)}
              className="bg-[#111111] hover:bg-zinc-800 text-white font-semibold"
            >
              {sendMutation.isPending ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Mengirim...
                </>
              ) : modalState.isResend ? (
                'Konfirmasi & Kirim Ulang'
              ) : (
                'Kirim Notifikasi'
              )}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-1 text-xs">
          {/* Warning banner if this is a resend */}
          {modalState.isResend && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <span>Peringatan Kirim Ulang</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Notifikasi ini sudah pernah berhasil dikirim pada{' '}
                <strong>{modalState.lastSentDate || 'waktu sebelumnya'}</strong>.
                Kirim ulang hanya jika klien meminta kembali untuk menghindari duplikasi pesan.
              </p>
            </div>
          )}

          <div>
            <div className="font-semibold text-zinc-900 mb-1">Tujuan Penerima:</div>
            <div className="bg-zinc-50 p-2.5 rounded-lg border border-zinc-200 space-y-1 text-zinc-700">
              <div>Klien / Tamu: <strong>{clientName}</strong></div>
              <div>Email: <strong>{clientEmail || '(belum ada email)'}</strong></div>
              <div>No. WhatsApp: <strong>{clientPhone || '(belum ada nomor HP)'}</strong></div>
            </div>
          </div>

          <div>
            <div className="font-semibold text-zinc-900 mb-2">Pilih Saluran Notifikasi:</div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={modalState.sendEmail}
                  onChange={(e) => setModalState((prev) => ({ ...prev, sendEmail: e.target.checked }))}
                  className="h-4 w-4 rounded border-zinc-300 text-[#111111] accent-[#111111]"
                  disabled={!clientEmail}
                />
                <div className="flex-1">
                  <div className="font-semibold text-zinc-800 flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5 text-zinc-500" />
                    <span>Email</span>
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    Template HTML resmi Musafirin
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={modalState.sendWhatsApp}
                  onChange={(e) => setModalState((prev) => ({ ...prev, sendWhatsApp: e.target.checked }))}
                  className="h-4 w-4 rounded border-zinc-300 text-[#111111] accent-[#111111]"
                  disabled={!clientPhone}
                />
                <div className="flex-1">
                  <div className="font-semibold text-zinc-800 flex items-center gap-1">
                    <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                    <span>WhatsApp</span>
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    Pesan instan via WhatsApp API (Kirimdev)
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
