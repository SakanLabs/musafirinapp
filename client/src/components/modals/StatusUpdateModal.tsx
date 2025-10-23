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
    icon: <Clock className="h-4 w-4" />, 
    color: 'bg-gray-100 text-gray-800' 
  },
  { 
    value: 'submitted', 
    label: 'Submitted', 
    icon: <CheckCircle className="h-4 w-4" />, 
    color: 'bg-blue-100 text-blue-800' 
  },
  { 
    value: 'paid', 
    label: 'Paid', 
    icon: <CreditCard className="h-4 w-4" />, 
    color: 'bg-green-100 text-green-800' 
  },
  { 
    value: 'cancelled', 
    label: 'Cancelled', 
    icon: <XCircle className="h-4 w-4" />, 
    color: 'bg-red-100 text-red-800' 
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
      title="Update Service Order Status"
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
            disabled={isLoading || selectedStatus === currentStatus}
            className="min-w-[100px]"
          >
            {isLoading ? 'Updating...' : 'Update Status'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Current Status
          </label>
          <div className="mb-4">
            {statusOptions.map((option) => {
              if (option.value === currentStatus) {
                return (
                  <Badge key={option.value} className={option.color}>
                    {option.icon}
                    <span className="ml-2">{option.label}</span>
                  </Badge>
                );
              }
              return null;
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Select New Status
          </label>
          <div className="space-y-2">
            {statusOptions.map((option) => (
              <label
                key={option.value}
                className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedStatus === option.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
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
                <div className="flex items-center">
                  {option.icon}
                  <span className="ml-2 font-medium">{option.label}</span>
                </div>
              </label>
            ))}
          </div>
        </div>
        
        {selectedStatus !== currentStatus && (
          <div className="bg-yellow-50 p-3 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> Changing the status will update the service order immediately.
            </p>
          </div>
        )}
      </form>
    </Modal>
  );
}