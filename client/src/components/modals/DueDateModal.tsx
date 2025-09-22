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
        <>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="min-w-[100px]"
          >
            {isLoading ? 'Generating...' : 'Generate Invoice'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Calendar className="h-4 w-4 inline mr-2" />
            Due Date
          </label>
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => {
              setDueDate(e.target.value);
              setError('');
            }}
            className="w-full"
            min={new Date().toISOString().split('T')[0]}
            required
          />
          {error && (
            <div className="flex items-center mt-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 mr-1" />
              {error}
            </div>
          )}
        </div>
        
        <div className="bg-blue-50 p-3 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> The invoice will be generated with the selected due date. 
            You can change this later if needed.
          </p>
        </div>
      </form>
    </Modal>
  );
}