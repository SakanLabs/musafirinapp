import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, CreditCard, XCircle } from 'lucide-react';
import type { ServiceOrderStatus } from '@/lib/queries/serviceOrders';

interface StatusUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (status: ServiceOrderStatus) => void;
  currentStatus: ServiceOrderStatus;
  isLoading?: boolean;
}

const statusOptions: { value: ServiceOrderStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { 
    value: 'draft', 
    label: 'Draft', 
    icon: <Clock className="h-3.5 w-3.5" />, 
    color: 'bg-zinc-100 text-zinc-800 border-zinc-200/50' 
  },
  { 
    value: 'submitted', 
    label: 'Submitted', 
    icon: <CheckCircle className="h-3.5 w-3.5" />, 
    color: 'bg-amber-50 text-amber-700 border-amber-200/30' 
  },
  { 
    value: 'paid', 
    label: 'Paid', 
    icon: <CreditCard className="h-3.5 w-3.5" />, 
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200/30' 
  },
  { 
    value: 'cancelled', 
    label: 'Cancelled', 
    icon: <XCircle className="h-3.5 w-3.5" />, 
    color: 'bg-rose-50 text-rose-700 border-rose-200/30' 
  },
];

export function StatusUpdateModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  currentStatus,
  isLoading = false 
}: StatusUpdateModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<ServiceOrderStatus>(currentStatus);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(selectedStatus);
  };

  const handleClose = () => {
    setSelectedStatus(currentStatus);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Update Visa Status"
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
            disabled={isLoading || selectedStatus === currentStatus}
            className="h-9 px-4 bg-[#111111] hover:bg-[#242424] text-white font-semibold text-xs rounded-md transition-colors border border-transparent shadow-sm min-w-[120px]"
          >
            {isLoading ? 'Updating...' : 'Update Status'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 block">
            Current Status
          </label>
          <div>
            {statusOptions.map((option) => {
              if (option.value === currentStatus) {
                return (
                  <Badge key={option.value} variant="outline" className={`text-[10px] font-semibold py-1 px-3 rounded-md shadow-none capitalize flex items-center w-fit border ${option.color}`}>
                    {option.icon}
                    <span className="ml-1.5">{option.label}</span>
                  </Badge>
                );
              }
              return null;
            })}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 block">
            Select New Status
          </label>
          <div className="space-y-2">
            {statusOptions.map((option) => (
              <label
                key={option.value}
                className={`flex items-center p-3.5 border rounded-xl cursor-pointer transition-all ${
                  selectedStatus === option.value
                    ? 'border-[#111111] bg-gray-50/50 ring-1 ring-[#111111]'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="status"
                  value={option.value}
                  checked={selectedStatus === option.value}
                  onChange={(e) => setSelectedStatus(e.target.value as ServiceOrderStatus)}
                  className="sr-only"
                />
                <div className="flex items-center text-gray-700">
                  <span className={`p-1 rounded-md bg-white border ${
                    selectedStatus === option.value ? 'text-[#111111] border-[#111111] bg-gray-105' : 'text-gray-400 border-gray-200'
                  }`}>
                    {option.icon}
                  </span>
                  <span className={`ml-2.5 text-xs font-semibold ${
                    selectedStatus === option.value ? 'text-[#111111]' : 'text-gray-600'
                  }`}>{option.label}</span>
                </div>
              </label>
            ))}
          </div>
        </div>
        
        {selectedStatus !== currentStatus && (
          <div className="bg-amber-50/30 border border-amber-200/50 p-3 rounded-lg">
            <p className="text-xs text-amber-800 leading-relaxed">
              <strong>Note:</strong> Changing the status will update the service order immediately.
            </p>
          </div>
        )}
      </form>
    </Modal>
  );
}