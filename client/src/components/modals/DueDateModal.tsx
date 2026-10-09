import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar, AlertCircle, Mail, MessageCircle } from 'lucide-react';

interface DueDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (dueDate: string, options?: { sendEmail?: boolean; sendWhatsApp?: boolean }) => void;
  isLoading?: boolean;
}

export function DueDateModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  isLoading = false 
}: DueDateModalProps) {
  const [dueDate, setDueDate] = useState(() => {
    // Default to 7 days from now
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split('T')[0];
  });
  const [sendEmail, setSendEmail] = useState(false);
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate due date
    if (!dueDate) {
      setError('Due date is required');
      return;
    }

    const selectedDate = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      setError('Due date cannot be in the past');
      return;
    }

    setError('');
    onSubmit(dueDate, { sendEmail, sendWhatsApp });
  };

  const handleClose = () => {
    setError('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Set Invoice Due Date"
      size="sm"
      footer={
        <div className="flex justify-end space-x-2.5 w-full">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
            className="h-9 px-4 border-[#e5e7eb] hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-md"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="h-9 px-4 bg-[#111111] hover:bg-[#242424] text-white font-semibold text-xs rounded-md transition-colors border border-transparent shadow-sm min-w-[120px]"
          >
            {isLoading ? 'Generating...' : 'Generate Invoice'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 flex items-center">
            <Calendar className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
            <span>Due Date</span>
          </label>
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => {
              setDueDate(e.target.value);
              setError('');
            }}
            className="h-10 px-3 border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] bg-white font-mono w-full"
            min={new Date().toISOString().split('T')[0]}
            required
          />
          {error && (
            <div className="flex items-center mt-2 text-xs font-semibold text-red-600">
              <AlertCircle className="h-3.5 w-3.5 mr-1" />
              <span>{error}</span>
            </div>
          )}
        </div>
        
        {/* Notification Delivery Options */}
        <div className="bg-zinc-50 border border-zinc-200/80 rounded-lg p-3 space-y-2.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
            Kirim Otomatis ke Klien (Opsional)
          </label>
          <div className="space-y-2">
            <label className="flex items-center space-x-2.5 cursor-pointer text-xs font-medium text-zinc-700 hover:text-zinc-950">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
              />
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-zinc-400" />
                <span>Kirim invoice via <strong>Email</strong></span>
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
                <span>Kirim invoice via <strong>WhatsApp</strong></span>
              </span>
            </label>
          </div>
        </div>

        <div className="bg-zinc-50/60 border border-zinc-100 p-2.5 rounded-lg">
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            Invoice akan diterbitkan dengan tanggal jatuh tempo yang dipilih dan langsung tersimpan di sistem.
          </p>
        </div>
      </form>
    </Modal>
  );
}