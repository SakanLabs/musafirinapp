import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar, AlertCircle } from 'lucide-react';

interface DueDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (dueDate: string) => void;
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
    onSubmit(dueDate);
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
        
        <div className="bg-zinc-50 border border-zinc-100 p-3 rounded-lg">
          <p className="text-xs text-zinc-600 leading-relaxed">
            <strong>Note:</strong> The invoice will be generated with the selected due date. 
            You can change this later if needed.
          </p>
        </div>
      </form>
    </Modal>
  );
}