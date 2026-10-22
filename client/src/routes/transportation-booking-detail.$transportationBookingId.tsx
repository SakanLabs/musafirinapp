import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { 
  ArrowLeft, Edit, FileText, Receipt, Trash2, Loader2, Package,
  CreditCard, Wallet, Banknote, Building2, CheckCircle2,
  Truck, Save, X, AlertTriangle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageLayout } from "@/components/layout/PageLayout";
import { formatCurrency, formatDate } from "@/lib/utils";
import { formatOperationalDate } from "@/lib/date";
import { authService } from "@/lib/auth";
import { 
  useTransportationBooking, 
  useDeleteTransportationBooking, 
  useGenerateTransportationInvoice, 
  useGenerateTransportationReceipt, 
  useTransportationInvoice,
  useTransportationBookingBilling,
  usePayTransportationBooking,
  useDeleteTransportationPayment,
  useUpdateTransportationOperations,
  type TransportationBooking,
  type TransportationPaymentMethod
} from "@/lib/queries/transportationBookings";
import { DueDateModal } from "@/components/modals/DueDateModal";
import { TransportationPaymentModal } from "@/components/modals/TransportationPaymentModal";
import { useState } from "react";
// Helper functions
const STATUS_OPTIONS: { value: TransportationBooking['status']; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

type DriverDraft = { driverName: string; driverPhone: string; vehiclePlateNumber: string };

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

  // Billing & Payment queries and mutations
  const { data: billingData } = useTransportationBookingBilling(transportationBookingId);
  const payMutation = usePayTransportationBooking();
  const deletePaymentMutation = useDeleteTransportationPayment();

  // Operational data: booking status and driver/vehicle per route
  const updateOperationsMutation = useUpdateTransportationOperations();
  const [isEditingDrivers, setIsEditingDrivers] = useState(false);
  const [driverDrafts, setDriverDrafts] = useState<Record<number, DriverDraft>>({});

  const handleStatusChange = async (status: TransportationBooking['status']) => {
    if (!transportationBooking || status === transportationBooking.status) return;
    if (status === 'cancelled' && !window.confirm(`Batalkan booking ${transportationBooking.number}? Booking tidak akan tampil lagi di Upcoming Arrivals.`)) {
      return;
    }
    try {
      await updateOperationsMutation.mutateAsync({ id: transportationBookingId, status });
      toast.success(`Status booking diubah menjadi ${status}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengubah status booking');
    }
  };

  const startEditingDrivers = () => {
    const drafts: Record<number, DriverDraft> = {};
    (transportationBooking?.routes || []).forEach((route) => {
      drafts[route.id] = {
        driverName: route.driverName || '',
        driverPhone: route.driverPhone || '',
        vehiclePlateNumber: route.vehiclePlateNumber || '',
      };
    });
    setDriverDrafts(drafts);
    setIsEditingDrivers(true);
  };

  const updateDriverDraft = (routeId: number, field: keyof DriverDraft, value: string) => {
    setDriverDrafts((prev) => ({ ...prev, [routeId]: { ...prev[routeId]!, [field]: value } }));
  };

  // Same driver for every segment is the common case, so allow copying the first one down
  const copyFirstDriverToAll = () => {
    const routes = transportationBooking?.routes || [];
    const first = routes[0] && driverDrafts[routes[0].id];
    if (!first) return;
    setDriverDrafts(Object.fromEntries(routes.map((route) => [route.id, { ...first }])));
  };

  const saveDrivers = async () => {
    try {
      await updateOperationsMutation.mutateAsync({
        id: transportationBookingId,
        routes: Object.entries(driverDrafts).map(([routeId, draft]) => ({ id: Number(routeId), ...draft })),
      });
      toast.success('Driver & kendaraan berhasil disimpan');
      setIsEditingDrivers(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan driver & kendaraan');
    }
  };

  const [isDueDateModalOpen, setIsDueDateModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const billingSummary = billingData?.summary;
  const paymentPercent = billingSummary && billingSummary.totalAmount > 0
    ? Math.min(100, Math.round((billingSummary.paidAmount / billingSummary.totalAmount) * 100))
    : 0;

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

  const handleDueDateSubmit = async (dueDate: string, options?: { sendEmail?: boolean; sendWhatsApp?: boolean }) => {
    if (!transportationBooking) return;

    try {
      const result = await generateInvoiceMutation.mutateAsync({
        bookingId: transportationBookingId,
        dueDate,
        forceRegenerate: !!existingInvoice,
        sendEmail: options?.sendEmail,
        sendWhatsApp: options?.sendWhatsApp,
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
      const receiptNumber = (resp as any).number || (resp as any).data?.number;
      if (receiptNumber) {
        window.open(`/api/transportation/receipt/${encodeURIComponent(receiptNumber.trim())}`, '_blank');
      }
    } catch (error) {
      console.error('Error generating receipt:', error);
      const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
      toast.error(msg);
    }
  };

  const handleRecordPayment = async (data: {
    amount: number;
    method: TransportationPaymentMethod;
    referenceNumber?: string;
    description?: string;
    autoGenerateReceipt: boolean;
    sendEmail?: boolean;
    sendWhatsApp?: boolean;
  }) => {
    try {
      const res = await payMutation.mutateAsync({
        bookingId: transportationBookingId,
        ...data,
      });
      toast.success('Pembayaran berhasil dicatat!');
      if (res?.receipt?.number) {
        window.open(`/api/transportation/receipt/${encodeURIComponent(res.receipt.number.trim())}`, '_blank');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Gagal memproses pembayaran');
      throw err;
    }
  };

  const handleDeletePayment = async (paymentId: number, amount: number) => {
    const currency = billingSummary?.currency || transportationBooking?.currency || 'SAR';
    if (!window.confirm(`Yakin ingin membatalkan/menghapus pembayaran sebesar ${formatCurrency(amount, currency)} ini? Sisa tagihan dan status akan diperbarui otomatis.`)) {
      return;
    }
    try {
      await deletePaymentMutation.mutateAsync({
        bookingId: transportationBookingId,
        paymentId,
      });
      toast.success('Pembayaran berhasil dibatalkan/dihapus');
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menghapus pembayaran');
    }
  };

  const handleDownloadReceipt = (receiptNumber: string) => {
    window.open(`/api/transportation/receipt/${encodeURIComponent(receiptNumber.trim())}`, '_blank');
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
            <select
              value={transportationBooking.status}
              onChange={(e) => handleStatusChange(e.target.value as TransportationBooking['status'])}
              disabled={updateOperationsMutation.isPending}
              title="Ubah status booking"
              className={`h-7 pl-2.5 pr-7 rounded-md text-[10px] font-bold uppercase tracking-wider border cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#111111] disabled:opacity-60 ${getStatusBadgeStyle(transportationBooking.status)}`}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {billingSummary && (
              <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                billingSummary.paymentStatus === 'paid'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                  : billingSummary.paymentStatus === 'partial'
                    ? 'bg-amber-50 text-amber-700 border-amber-200/60'
                    : 'bg-zinc-50 text-zinc-600 border-zinc-200/60'
              }`}>
                {billingSummary.paymentStatus === 'paid' ? 'Lunas' : billingSummary.paymentStatus === 'partial' ? 'Sebagian' : 'Belum Bayar'}
              </span>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {billingSummary && billingSummary.remainingBalance > 0 && (
              <Button
                onClick={() => setIsPaymentModalOpen(true)}
                disabled={payMutation.isPending}
                className="bg-[#111111] hover:bg-[#242424] text-white h-9 px-3.5 rounded-md text-xs font-semibold flex items-center space-x-1.5 border border-transparent shadow-none"
              >
                <CreditCard className="h-4 w-4 mr-1 text-white/90" />
                <span>Terima Pembayaran</span>
              </Button>
            )}
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
          <div className="flex flex-wrap items-center justify-between gap-2 mb-6 pb-2 border-b border-gray-100">
            <h2 className="text-sm font-bold text-[#111111] uppercase tracking-wider">
              Transportation Routes
            </h2>
            {(transportationBooking.routes?.length || 0) > 0 && (
              isEditingDrivers ? (
                <div className="flex items-center gap-2">
                  {(transportationBooking.routes?.length || 0) > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={copyFirstDriverToAll}
                      className="h-8 px-2.5 text-xs font-semibold text-zinc-600 hover:text-black"
                    >
                      Samakan dengan Segment #1
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditingDrivers(false)}
                    disabled={updateOperationsMutation.isPending}
                    className="h-8 px-3 border-[#e5e7eb] text-zinc-700 text-xs font-semibold bg-white shadow-none"
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    Batal
                  </Button>
                  <Button
                    type="button"
                    onClick={saveDrivers}
                    disabled={updateOperationsMutation.isPending}
                    className="h-8 px-3 bg-[#111111] hover:bg-[#242424] text-white text-xs font-semibold shadow-none"
                  >
                    {updateOperationsMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                    Simpan
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={startEditingDrivers}
                  className="h-8 px-3 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 hover:text-black text-xs font-semibold bg-white shadow-none"
                >
                  <Truck className="h-3.5 w-3.5 mr-1.5" />
                  Atur Driver & Kendaraan
                </Button>
              )
            )}
          </div>
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
                      <p className="text-xs font-bold text-zinc-800">{formatOperationalDate(route.pickupDateTime, 'datetime')} WAS</p>
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
                    {/* Operational assignment: driver & vehicle */}
                    <div className="md:col-span-2 lg:col-span-3 pt-3 border-t border-gray-100 mt-1">
                      {isEditingDrivers && driverDrafts[route.id] ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Nama Driver</label>
                            <Input
                              value={driverDrafts[route.id]!.driverName}
                              onChange={(e) => updateDriverDraft(route.id, 'driverName', e.target.value)}
                              placeholder="Nama driver"
                              className="h-9 text-xs border-[#e5e7eb] shadow-none"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">No. HP Driver</label>
                            <Input
                              value={driverDrafts[route.id]!.driverPhone}
                              onChange={(e) => updateDriverDraft(route.id, 'driverPhone', e.target.value)}
                              placeholder="+966..."
                              inputMode="tel"
                              className="h-9 text-xs border-[#e5e7eb] shadow-none"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Nomor Kendaraan</label>
                            <Input
                              value={driverDrafts[route.id]!.vehiclePlateNumber}
                              onChange={(e) => updateDriverDraft(route.id, 'vehiclePlateNumber', e.target.value.toUpperCase())}
                              placeholder="Plat nomor"
                              className="h-9 text-xs border-[#e5e7eb] shadow-none uppercase"
                            />
                          </div>
                        </div>
                      ) : route.driverName ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-y-3 gap-x-6">
                          <div className="space-y-0.5">
                            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Nama Driver</label>
                            <p className="text-xs font-bold text-zinc-800">{route.driverName}</p>
                          </div>
                          <div className="space-y-0.5">
                            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">No. HP Driver</label>
                            {route.driverPhone ? (
                              <a
                                href={`https://wa.me/${route.driverPhone.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-bold text-emerald-700 hover:underline"
                              >
                                {route.driverPhone}
                              </a>
                            ) : (
                              <p className="text-xs font-medium text-zinc-400">-</p>
                            )}
                          </div>
                          <div className="space-y-0.5">
                            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Nomor Kendaraan</label>
                            <p className="text-xs font-bold text-zinc-800 font-mono">{route.vehiclePlateNumber || '-'}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                          <AlertTriangle className="h-3 w-3" />
                          Driver & kendaraan belum diatur
                        </div>
                      )}
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

        {/* Billing & Payment History */}
        <Card className="border border-[#e5e7eb] rounded-xl bg-white shadow-none overflow-hidden">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 bg-white p-6">
            <div className="space-y-1">
              <div className="flex items-center space-x-3">
                <CardTitle className="text-sm font-bold text-[#111111] uppercase tracking-wider">
                  Informasi Tagihan & Pembayaran
                </CardTitle>
                {billingSummary && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      billingSummary.paymentStatus === 'paid'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : billingSummary.paymentStatus === 'partial'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                    }`}
                  >
                    {billingSummary.paymentStatus === 'paid' ? 'Lunas' : billingSummary.paymentStatus === 'partial' ? 'Cicilan' : 'Belum Bayar'}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-zinc-500">
                Kelola termin pembayaran, unduh invoice resmi, dan pantau status pelunasan booking transportasi.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateInvoice}
                disabled={generateInvoiceMutation.isPending}
                className="h-8 px-3 text-xs font-semibold border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-md shadow-none"
              >
                <FileText className="h-3.5 w-3.5 mr-1.5 text-zinc-400" />
                <span>{existingInvoice ? "Generate Ulang Invoice" : "Terbitkan Invoice"}</span>
              </Button>

              {billingSummary && billingSummary.remainingBalance > 0 && (
                <Button
                  size="sm"
                  onClick={() => setIsPaymentModalOpen(true)}
                  disabled={payMutation.isPending}
                  className="h-8 px-3.5 bg-[#111111] hover:bg-[#242424] text-white font-semibold text-xs rounded-md shadow-none flex items-center space-x-1.5 border border-transparent"
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  <span>Terima Pembayaran</span>
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            {/* 3 Summary Stat Boxes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-zinc-50/70 rounded-xl border border-zinc-200/70">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Total Tagihan</span>
                <p className="text-xl font-bold font-mono text-zinc-900">
                  {formatCurrency(billingSummary?.totalAmount || transportationBooking.totalAmount, billingSummary?.currency || transportationBooking.currency || 'SAR')}
                </p>
                <p className="text-[11px] font-mono text-zinc-400">
                  {transportationBooking.routes?.length || transportationBooking.routeCount || 0} Rute Perjalanan
                </p>
              </div>

              <div className="space-y-1 border-t md:border-t-0 md:border-l border-zinc-200/60 pt-3 md:pt-0 md:pl-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Telah Dibayar</span>
                <p className="text-xl font-bold font-mono text-emerald-600">
                  {formatCurrency(billingSummary?.paidAmount || 0, billingSummary?.currency || transportationBooking.currency || 'SAR')}
                </p>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{paymentPercent}% Terbayar</span>
                </div>
              </div>

              <div className="space-y-1 border-t md:border-t-0 md:border-l border-zinc-200/60 pt-3 md:pt-0 md:pl-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Sisa Tagihan</span>
                <p className={`text-xl font-bold font-mono ${
                  (billingSummary?.remainingBalance || 0) === 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {formatCurrency(billingSummary?.remainingBalance ?? transportationBooking.totalAmount, billingSummary?.currency || transportationBooking.currency || 'SAR')}
                </p>
                <p className="text-[11px] text-zinc-400">
                  {(billingSummary?.remainingBalance || 0) === 0 ? 'Semua tagihan lunas' : 'Menunggu pelunasan'}
                </p>
              </div>
            </div>

            {/* Riwayat Pembayaran & Kwitansi */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-600">
                  Riwayat Pembayaran & Kwitansi Resmi
                </h4>
                <span className="text-xs text-zinc-400 font-medium">
                  {billingData?.payments?.length || 0} transaksi tercatat
                </span>
              </div>

              {billingData?.payments && billingData.payments.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-zinc-200">
                  <table className="w-full text-xs">
                    <thead className="bg-zinc-50 border-b border-zinc-200">
                      <tr>
                        <th className="text-left font-bold text-zinc-600 py-2.5 px-4 uppercase tracking-wider">Tanggal</th>
                        <th className="text-left font-bold text-zinc-600 py-2.5 px-4 uppercase tracking-wider">Metode</th>
                        <th className="text-left font-bold text-zinc-600 py-2.5 px-4 uppercase tracking-wider">No. Referensi / Catatan</th>
                        <th className="text-right font-bold text-zinc-600 py-2.5 px-4 uppercase tracking-wider">Nominal</th>
                        <th className="text-right font-bold text-zinc-600 py-2.5 px-4 uppercase tracking-wider">Kwitansi (PDF)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {billingData.payments.map((p) => {
                        const receiptNumber = p.receiptNumber || billingData.receipts?.find(r => 
                          (r.meta?.paymentId && r.meta.paymentId === p.id) ||
                          (r.meta?.referenceNumber && r.meta.referenceNumber === p.referenceNumber) ||
                          (r.meta?.termin && r.meta.termin === p.termin) ||
                          (parseFloat(r.paidAmount) === parseFloat(p.amount))
                        )?.number || (billingData.receipts?.length === 1 && billingData.payments.length === 1 ? billingData.receipts[0]?.number : null);

                        return (
                          <tr key={p.id} className="hover:bg-zinc-50/60 transition-colors">
                            <td className="py-3 px-4 font-mono text-zinc-700">
                              {formatDate(p.paidAt)}
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-medium text-[11px] bg-zinc-100 text-zinc-700">
                                {p.method === 'bank_transfer' ? (
                                  <>
                                    <Building2 className="w-3 h-3 text-zinc-500" />
                                    <span>Transfer Bank</span>
                                  </>
                                ) : p.method === 'deposit' ? (
                                  <>
                                    <Wallet className="w-3 h-3 text-emerald-600" />
                                    <span>Saldo Deposit</span>
                                  </>
                                ) : (
                                  <>
                                    <Banknote className="w-3 h-3 text-zinc-500" />
                                    <span>Tunai</span>
                                  </>
                                )}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {p.terminLabel ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                                    {p.terminLabel}
                                  </span>
                                ) : null}
                                <span className="font-mono text-zinc-800">{p.referenceNumber || '-'}</span>
                              </div>
                              {p.meta?.description && (
                                <div className="text-[11px] text-zinc-500 mt-0.5">{p.meta.description}</div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 text-sm">
                              {formatCurrency(p.amount, billingSummary?.currency || transportationBooking.currency || 'SAR')}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end space-x-2">
                                {receiptNumber ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDownloadReceipt(receiptNumber)}
                                    className="h-7 text-[11px] px-2.5 font-medium border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 inline-flex items-center space-x-1"
                                    title="Download Kwitansi PDF"
                                  >
                                    <Receipt className="w-3 h-3 text-zinc-500" />
                                    <span>{receiptNumber}</span>
                                  </Button>
                                ) : (
                                  <span className="text-zinc-400 text-[11px] italic mr-1">-</span>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeletePayment(p.id, parseFloat(p.amount))}
                                  disabled={deletePaymentMutation.isPending}
                                  className="h-7 w-7 p-0 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded"
                                  title="Batalkan / Hapus Pembayaran Ini"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 border border-dashed border-zinc-200 rounded-lg bg-zinc-50/40">
                  <CreditCard className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                  <p className="text-xs text-zinc-500 font-medium">Belum ada pembayaran yang dicatat untuk pemesanan ini.</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Klik tombol <strong>"Terima Pembayaran"</strong> untuk mencatat DP atau pelunasan dan otomatis membuat Kwitansi resmi.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <DueDateModal
        isOpen={isDueDateModalOpen}
        onClose={() => setIsDueDateModalOpen(false)}
        onSubmit={handleDueDateSubmit}
        isLoading={generateInvoiceMutation.isPending}
      />

      <TransportationPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        bookingNumber={transportationBooking.number}
        totalAmount={billingSummary?.totalAmount || parseFloat(transportationBooking.totalAmount)}
        paidAmount={billingSummary?.paidAmount || 0}
        remainingBalance={billingSummary?.remainingBalance ?? parseFloat(transportationBooking.totalAmount)}
        currency={billingSummary?.currency || transportationBooking.currency || 'SAR'}
        clientName={billingData?.client?.name || transportationBooking.customerName}
        clientDepositBalance={billingSummary?.clientDepositBalance || 0}
        onSubmit={handleRecordPayment}
        isLoading={payMutation.isPending}
      />
    </PageLayout>
  );
}