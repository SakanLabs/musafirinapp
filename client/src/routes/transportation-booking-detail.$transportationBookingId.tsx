import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, Edit, FileText, Receipt, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageLayout } from "@/components/layout/PageLayout";
import { formatCurrency, formatDate } from "@/lib/utils";
import { authService } from "@/lib/auth";
import { useTransportationBooking, useDeleteTransportationBooking, useGenerateTransportationInvoice, useGenerateTransportationReceipt, useTransportationInvoice } from "@/lib/queries/transportationBookings";
import { DueDateModal } from "@/components/modals/DueDateModal";
import { useState } from "react";
// Helper functions
const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case 'confirmed':
      return 'default';
    case 'pending':
      return 'secondary';
    case 'cancelled':
      return 'destructive';
    case 'completed':
      return 'default';
    default:
      return 'secondary';
  }
};

export const Route = createFileRoute("/transportation-booking-detail/$transportationBookingId")({
  beforeLoad: async () => {
    const isAuthenticated = await authService.isAuthenticated();
    if (!isAuthenticated) {
      throw redirect({ to: "/login" });
    }
  },
  component: TransportationBookingDetailPage,
});

function TransportationBookingDetailPage() {
  const navigate = useNavigate();
  const params = Route.useParams();
  const transportationBookingId = params.transportationBookingId;

  // Fetch transportation booking data from API
  const { data: transportationBooking, isLoading, error } = useTransportationBooking(transportationBookingId);
  const deleteBookingMutation = useDeleteTransportationBooking();
  const generateInvoiceMutation = useGenerateTransportationInvoice();
  const generateReceiptMutation = useGenerateTransportationReceipt();
  const { data: existingInvoice } = useTransportationInvoice(transportationBookingId);

  const [isDueDateModalOpen, setIsDueDateModalOpen] = useState(false);

  const getVehicleTypeLabel = (type: string) => {
    switch (type) {
      case "sedan":
        return "Sedan";
      case "suv":
        return "SUV";
      case "van":
        return "Van";
      case "bus":
        return "Bus";
      default:
        return type;
    }
  };

  const handleEdit = () => {
    navigate({ to: `/transportation-booking-edit/${transportationBookingId}` });
  };

  const handleDelete = async () => {
    if (!transportationBooking) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete transportation booking ${transportationBooking.number}? This action cannot be undone.`
    );

    if (confirmed) {
      try {
        await deleteBookingMutation.mutateAsync(transportationBookingId);
        toast.success('Transportation booking deleted successfully!');
        navigate({ to: '/transportation-bookings' });
      } catch (error) {
        console.error('Error deleting transportation booking:', error);
        const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
        toast.error(msg);
      }
    }
  };

  const handleGenerateInvoice = () => {
    setIsDueDateModalOpen(true);
  };

  const handleDueDateSubmit = async (dueDate: string) => {
    if (!transportationBooking) return;

    try {
      await generateInvoiceMutation.mutateAsync({
        bookingId: transportationBookingId,
        dueDate,
        forceRegenerate: !!existingInvoice
      });
      setIsDueDateModalOpen(false);

      const message = existingInvoice
        ? "Invoice berhasil digenerate ulang! Anda akan diarahkan ke halaman invoices."
        : "Invoice berhasil digenerate! Anda akan diarahkan ke halaman invoices.";

      toast.success(message);

      navigate({ to: '/invoices' });
    } catch (error) {
      console.error('Error generating invoice:', error);
      const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
      toast.error(msg);
    }
  };

  const handleGenerateReceipt = async () => {
    if (!transportationBooking) return;

    try {
      const resp = await generateReceiptMutation.mutateAsync(transportationBookingId);
      toast.success('Receipt generated successfully!');
      // Assuming Resp could be shaped like { id, number } or direct object
      const receiptNumber = (resp as any).number || (resp as any).data?.number;
      if (receiptNumber) {
        window.open(`http://localhost:3000/api/transportation/receipt/${receiptNumber}`, '_blank');
      }
    } catch (error) {
      console.error('Error generating receipt:', error);
      const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
      toast.error(msg);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <PageLayout title="Loading...">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading transportation booking...</span>
        </div>
      </PageLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <PageLayout title="Error">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-red-600 mb-4">Failed to load transportation booking</p>
            <Button onClick={() => navigate({ to: "/transportation-bookings" })}>
              Back to Transportation Bookings
            </Button>
          </div>
        </div>
      </PageLayout>
    );
  }

  // No data state
  if (!transportationBooking) {
    return (
      <PageLayout title="Not Found">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-gray-600 mb-4">Transportation booking not found</p>
            <Button onClick={() => navigate({ to: "/transportation-bookings" })}>
              Back to Transportation Bookings
            </Button>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title={`Transportation Booking ${transportationBooking.number}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: '/transportation-bookings' })}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Transportation Bookings
            </Button>
            <Badge variant={getStatusBadgeVariant(transportationBooking.status)}>
              {transportationBooking.status}
            </Badge>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={handleGenerateInvoice}>
              <FileText className="h-4 w-4 mr-2" />
              {existingInvoice ? "Generate Ulang Invoice" : "Generate Invoice"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleGenerateReceipt}>
              <Receipt className="h-4 w-4 mr-2" />
              Generate Receipt
            </Button>
            <Button variant="outline" size="sm" onClick={handleEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        {/* Customer Information */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Customer Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <p className="mt-1 text-sm text-gray-900">{transportationBooking.customerName}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <p className="mt-1 text-sm text-gray-900">{transportationBooking.customerPhone}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <p className="mt-1 text-sm text-gray-900">{transportationBooking.customerEmail}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Booking Date</label>
              <p className="mt-1 text-sm text-gray-900">{formatDate(transportationBooking.createdAt)}</p>
            </div>
          </div>
          {transportationBooking.notes && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">Notes</label>
              <p className="mt-1 text-sm text-gray-900">{transportationBooking.notes}</p>
            </div>
          )}
        </Card>

        {/* Transportation Routes */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Transportation Routes</h2>
          <div className="space-y-6">
            {transportationBooking.routes && transportationBooking.routes.length > 0 ? (
              transportationBooking.routes.map((route, index) => (
                <div key={route.id} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="text-md font-medium text-gray-900 mb-4">
                    Route {index + 1}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Pickup Date & Time</label>
                      <p className="mt-1 text-sm text-gray-900">{formatDate(route.pickupDateTime)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">From</label>
                      <p className="mt-1 text-sm text-gray-900">{route.originLocation}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">To</label>
                      <p className="mt-1 text-sm text-gray-900">{route.destinationLocation}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Vehicle Type</label>
                      <p className="mt-1 text-sm text-gray-900">{getVehicleTypeLabel(route.vehicleType)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Price</label>
                      <p className="mt-1 text-sm text-gray-900">{formatCurrency(route.price, transportationBooking.currency)}</p>
                    </div>
                    {route.notes && (
                      <div className="md:col-span-2 lg:col-span-3">
                        <label className="block text-sm font-medium text-gray-700">Route Notes</label>
                        <p className="mt-1 text-sm text-gray-900">{route.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">No routes found for this transportation booking.</p>
              </div>
            )}
          </div>
        </Card>

        {/* Summary */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Summary</h2>
          <div className="flex justify-between items-center">
            <span className="text-lg font-medium">Total Amount:</span>
            <span className="text-xl font-bold text-blue-600">
              {formatCurrency(transportationBooking.totalAmount, transportationBooking.currency)}
            </span>
          </div>
        </Card>
      </div>

      <DueDateModal
        isOpen={isDueDateModalOpen}
        onClose={() => setIsDueDateModalOpen(false)}
        onSubmit={handleDueDateSubmit}
        isLoading={generateInvoiceMutation.isPending}
      />
    </PageLayout>
  );
}