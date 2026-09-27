import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, Edit, FileText, Receipt, Trash2, Loader2, Package } from "lucide-react";
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
const getStatusBadgeStyle = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'confirmed':
    case 'completed':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200/60';
    case 'pending':
      return 'bg-amber-50 text-amber-700 border-amber-200/60';
    case 'cancelled':
      return 'bg-rose-50 text-rose-700 border-rose-200/60';
    default:
      return 'bg-zinc-50 text-zinc-700 border-zinc-200/60';
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
      case "sedan": return "Sedan";
      case "staria": return "Staria";
      case "hiace": return "Hiace";
      case "gmc": return "GMC";
      case "coaster": return "Coaster";
      case "bus": return "Bus";
      default: return type;
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
      const result = await generateInvoiceMutation.mutateAsync({
        bookingId: transportationBookingId,
        dueDate,
        forceRegenerate: !!existingInvoice
      });
      setIsDueDateModalOpen(false);

      const message = existingInvoice
        ? "Invoice berhasil digenerate ulang!"
        : "Invoice berhasil digenerate!";

      toast.success(message);

      // Open the invoice PDF
      if (result?.number) {
        const invoiceNumber = result.number.trim();
        window.open(`/api/transportation/invoice/${encodeURIComponent(invoiceNumber)}`, '_blank');
      }
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
        window.open(`/api/transportation/receipt/${receiptNumber}`, '_blank');
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
          <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
          <span className="ml-2 text-zinc-500 text-sm">Loading transportation booking...</span>
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
            <p className="text-red-600 text-sm mb-4">Failed to load transportation booking</p>
            <Button 
              onClick={() => navigate({ to: "/transportation-bookings" })}
              className="bg-[#111111] hover:bg-[#242424] text-white h-9 px-4 rounded-md text-xs font-semibold"
            >
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
            <p className="text-zinc-500 text-sm mb-4">Transportation booking not found</p>
            <Button 
              onClick={() => navigate({ to: "/transportation-bookings" })}
              className="bg-[#111111] hover:bg-[#242424] text-white h-9 px-4 rounded-md text-xs font-semibold"
            >
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
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
          <div className="flex items-center space-x-3 flex-wrap gap-y-2">
            <Button
              variant="outline"
              onClick={() => navigate({ to: '/transportation-bookings' })}
              className="h-9 px-4 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 hover:text-black flex items-center rounded-md font-medium text-xs bg-white shadow-none"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Kembali ke Registrasi
            </Button>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getStatusBadgeStyle(transportationBooking.status)}`}>
              {transportationBooking.status}
            </span>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {(!transportationBooking.customLaRequestId) && (
              <>
                <Button 
                  variant="outline" 
                  onClick={handleGenerateInvoice}
                  className="h-9 px-3.5 border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-[#111111] flex items-center rounded-md text-xs font-semibold transition-colors bg-white shadow-none"
                >
                  <FileText className="h-4 w-4 mr-2 text-zinc-500" />
                  {existingInvoice ? "Generate Ulang Invoice" : "Generate Invoice"}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleGenerateReceipt}
                  className="h-9 px-3.5 border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-[#111111] flex items-center rounded-md text-xs font-semibold transition-colors bg-white shadow-none"
                >
                  <Receipt className="h-4 w-4 mr-2 text-zinc-500" />
                  Generate Kwitansi
                </Button>
              </>
            )}
            <Button 
              onClick={handleEdit}
              className="bg-[#111111] hover:bg-[#242424] text-white h-9 px-4 rounded-md text-xs font-semibold transition-colors border border-transparent shadow-none"
            >
              <Edit className="h-4 w-4 mr-2 text-white/80" />
              Edit Pemesanan
            </Button>
            <Button 
              onClick={handleDelete}
              className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/60 h-9 px-4 rounded-md text-xs font-semibold transition-colors shadow-none"
            >
              <Trash2 className="h-4 w-4 mr-2 text-rose-500" />
              Hapus
            </Button>
          </div>
        </div>

        {/* LA Integration Banner */}
        {transportationBooking.customLaRequestId && (
          <div className="bg-zinc-50 border border-zinc-200/60 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center text-zinc-950">
              <div className="p-2.5 bg-zinc-100 rounded-lg mr-3 shrink-0">
                <Package className="h-5 w-5 text-zinc-700" />
              </div>
              <div>
                <p className="font-bold text-sm text-[#111111]">Bagian dari Land Arrangement</p>
                <p className="text-xs text-zinc-500 mt-0.5">Booking transportasi ini terhubung secara otomatis dengan paket Land Arrangement (LA).</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={() => navigate({ to: `/custom-la-detail/${transportationBooking.customLaRequestId}` })}
              className="h-9 px-4 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 hover:text-black flex items-center rounded-md font-semibold text-xs transition-colors shrink-0 bg-white shadow-none"
            >
              Buka Detail LA
            </Button>
          </div>
        )}

        {/* Customer Information */}
        <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none p-6">
          <h2 className="text-sm font-bold text-[#111111] uppercase tracking-wider mb-6 pb-2 border-b border-gray-100">
            Customer Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-5 gap-x-8">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Customer Name</label>
              <p className="text-sm font-semibold text-[#111111]">{transportationBooking.customerName}</p>
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Phone Number</label>
              <p className="text-sm font-semibold text-[#111111]">{transportationBooking.customerPhone}</p>
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Email Address</label>
              <p className="text-sm font-semibold text-[#111111]">{transportationBooking.customerEmail || "-"}</p>
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Booking Date</label>
              <p className="text-sm font-semibold text-[#111111]">{formatDate(transportationBooking.createdAt)}</p>
            </div>
          </div>
          {transportationBooking.notes && (
            <div className="mt-6 pt-4 border-t border-gray-100/80 space-y-1">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">General Booking Notes</label>
              <p className="text-sm font-medium text-zinc-700 whitespace-pre-wrap">{transportationBooking.notes}</p>
            </div>
          )}
        </div>

        {/* Transportation Routes */}
        <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none p-6">
          <h2 className="text-sm font-bold text-[#111111] uppercase tracking-wider mb-6 pb-2 border-b border-gray-100">
            Transportation Routes
          </h2>
          <div className="space-y-5">
            {transportationBooking.routes && transportationBooking.routes.length > 0 ? (
              transportationBooking.routes.map((route, index) => (
                <div key={route.id} className="border border-[#e5e7eb] rounded-lg p-5 bg-white transition-all hover:border-[#111111]/30">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                    <h3 className="text-xs font-bold text-[#111111] uppercase tracking-wider">
                      Rute Segment #{index + 1}
                    </h3>
                    <span className="text-xs font-bold text-[#111111] bg-zinc-100 px-2 py-0.5 rounded">
                      {getVehicleTypeLabel(route.vehicleType)}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-6">
                    <div className="space-y-0.5">
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Pickup Date & Time</label>
                      <p className="text-xs font-bold text-zinc-800">{formatDate(route.pickupDateTime)}</p>
                    </div>
                    <div className="space-y-0.5">
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Origin Location (From)</label>
                      <p className="text-xs font-bold text-zinc-800">{route.originLocation}</p>
                    </div>
                    <div className="space-y-0.5">
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Destination Location (To)</label>
                      <p className="text-xs font-bold text-zinc-800">{route.destinationLocation}</p>
                    </div>
                    <div className="space-y-0.5">
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Segment Price</label>
                      <p className="text-xs font-bold text-[#111111]">{formatCurrency(route.price, transportationBooking.currency)}</p>
                    </div>
                    {route.notes && (
                      <div className="md:col-span-2 lg:col-span-3 space-y-0.5 pt-2 border-t border-gray-50 mt-1">
                        <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Route Segment Notes</label>
                        <p className="text-xs font-medium text-zinc-600 whitespace-pre-wrap">{route.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 border border-dashed border-[#e5e7eb] rounded-lg">
                <p className="text-xs text-zinc-500 font-medium">No routes found for this transportation booking.</p>
              </div>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none p-6">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-[#111111] uppercase tracking-wider">Grand Total Amount</span>
            <span className="text-xl font-bold text-[#111111] tracking-tight">
              {formatCurrency(transportationBooking.totalAmount, transportationBooking.currency)}
            </span>
          </div>
        </div>
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