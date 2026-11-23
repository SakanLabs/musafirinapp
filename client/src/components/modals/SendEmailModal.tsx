import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail } from "lucide-react";

interface SendEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  documentLabel: string;
  recipientName?: string;
  defaultEmail?: string;
  isSending?: boolean;
  onConfirm: (params: { email: string; updateClientEmail: boolean }) => Promise<void> | void;
}

export function SendEmailModal({
  isOpen,
  onClose,
  title,
  documentLabel,
  recipientName,
  defaultEmail = "",
  isSending = false,
  onConfirm,
}: SendEmailModalProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [updateClientEmail, setUpdateClientEmail] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setEmail(defaultEmail || "");
      setUpdateClientEmail(false);
      setError("");
    }
  }, [isOpen, defaultEmail]);

  const normalizedInitial = (defaultEmail || "").trim().toLowerCase();
  const normalizedCurrent = email.trim().toLowerCase();
  const isEmailChanged = normalizedCurrent !== normalizedInitial;

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (error) setError("");
    if (value.trim().toLowerCase() !== normalizedInitial) {
      setUpdateClientEmail(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Masukkan alamat email tujuan yang valid.");
      return;
    }
    await onConfirm({
      email: trimmed,
      updateClientEmail: isEmailChanged ? updateClientEmail : false,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSending ? () => {} : onClose}
      title={title}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-3 text-xs space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-zinc-600">Dokumen</span>
            <span className="font-semibold text-zinc-900 font-mono">{documentLabel}</span>
          </div>
          {recipientName && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-zinc-600">Penerima</span>
              <span className="font-semibold text-zinc-900">{recipientName}</span>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="send-email-recipient" className="text-xs font-semibold text-zinc-800">
            Alamat Email Tujuan
          </Label>
          <Input
            id="send-email-recipient"
            type="email"
            value={email}
            onChange={(e) => handleEmailChange(e.target.value)}
            placeholder="nama@travel.com"
            disabled={isSending}
            autoFocus
            className="h-10 border-zinc-300 focus-visible:ring-[#111111]"
          />
          {error ? (
            <p className="text-xs font-medium text-red-600">{error}</p>
          ) : (
            <p className="text-xs text-zinc-600">
              Anda dapat mengubah alamat email tujuan sebelum dokumen dikirim.
            </p>
          )}
        </div>

        {isEmailChanged && (
          <label
            htmlFor="update-client-email-checkbox"
            className="flex items-start gap-2.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 cursor-pointer select-none"
          >
            <input
              id="update-client-email-checkbox"
              type="checkbox"
              checked={updateClientEmail}
              onChange={(e) => setUpdateClientEmail(e.target.checked)}
              disabled={isSending}
              className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-[#111111] cursor-pointer"
            />
            <span className="text-xs text-zinc-700 leading-relaxed">
              Simpan perubahan email ini ke data client agar pengiriman berikutnya otomatis memakai email baru.
            </span>
          </label>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSending}
            className="h-9 px-4 text-xs font-semibold border-zinc-300 text-zinc-700 cursor-pointer"
          >
            Batal
          </Button>
          <Button
            type="submit"
            disabled={isSending}
            className="h-9 px-4 text-xs font-semibold bg-[#111111] hover:bg-zinc-800 text-white cursor-pointer"
          >
            {isSending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Mengirim...
              </>
            ) : (
              <>
                <Mail className="h-3.5 w-3.5 mr-1.5" />
                Kirim Email
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
