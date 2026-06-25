import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { ArrowLeft, Plus, Trash2, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { PageLayout } from "@/components/layout/PageLayout";
import { authService } from "@/lib/auth";
import { useTransportationBooking, useUpdateTransportationBooking } from "@/lib/queries/transportationBookings";
import { TRANSPORT_LOCATIONS } from "@/lib/constants";

export const Route = createFileRoute("/transportation-booking-edit/$transportationBookingId")({
  beforeLoad: async () => {
    const isAuthenticated = await authService.isAuthenticated();
    if (!isAuthenticated) {
      throw redirect({ to: "/login" });
    }
  },
  component: TransportationBookingEditPage,
});

interface RouteData {
  id: number | string;
  pickupDateTime: string;
  originLocation: string;
  destinationLocation: string;
  vehicleType: string;
  price: number;
  notes?: string;
}

function TransportationBookingEditPage() {
  const navigate = useNavigate();
  const params = Route.useParams();
  const transportationBookingId = params.transportationBookingId;

  // Fetch transportation booking data
  const { data: transportationBooking, isLoading, error } = useTransportationBooking(transportationBookingId);
  const updateBookingMutation = useUpdateTransportationBooking();

  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    notes: "",
  });

  const [routes, setRoutes] = useState<RouteData[]>([]);

  // Initialize form data when booking data is loaded
  useEffect(() => {
    if (transportationBooking) {
      setFormData({
        customerName: transportationBooking.customerName || "",
        customerPhone: transportationBooking.customerPhone || "",
        customerEmail: transportationBooking.customerEmail || "",
        notes: transportationBooking.notes || "",
      });

      if (transportationBooking.routes && transportationBooking.routes.length > 0) {
        setRoutes(transportationBooking.routes.map(route => ({
          id: route.id,
          pickupDateTime: route.pickupDateTime.slice(0, 16), // Format for datetime-local input
          originLocation: route.originLocation,
          destinationLocation: route.destinationLocation,
          vehicleType: route.vehicleType,
          price: parseFloat(route.price),
          notes: route.notes || "",
        })));
      } else {
        // Add default route if no routes exist
        setRoutes([{
          id: Date.now().toString(),
          pickupDateTime: "",
          originLocation: "",
          destinationLocation: "",
          vehicleType: "sedan",
          price: 0,
          notes: ""
        }]);
      }
    }
  }, [transportationBooking]);

  const addRoute = () => {
    const newRoute: RouteData = {
      id: Date.now().toString(),
      pickupDateTime: "",
      originLocation: "",
      destinationLocation: "",
      vehicleType: "sedan",
      price: 0,
      notes: ""
    };
    setRoutes([...routes, newRoute]);
  };

  const removeRoute = (routeId: string | number) => {
    if (routes.length > 1) {
      setRoutes(routes.filter(route => route.id.toString() !== routeId.toString()));
    }
  };

  const updateRoute = (routeId: string | number, field: keyof RouteData, value: string | number) => {
    setRoutes(routes.map(route =>
      route.id.toString() === routeId.toString() ? { ...route, [field]: value } : route
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.customerName || !formData.customerPhone) {
      toast.warning("Please fill in all required customer information.");
      return;
    }

    for (const route of routes) {
      if (!route.pickupDateTime || !route.originLocation || !route.destinationLocation) {
        toast.warning("Please fill in all required route information.");
        return;
      }
    }

    try {
      const updateData = {
        id: transportationBookingId,
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        customerEmail: formData.customerEmail || undefined,
        totalAmount: totalAmount,
        currency: 'SAR',
        status: 'pending' as const,
        notes: formData.notes || undefined,
        routes: routes.map(route => ({
          pickupDate: route.pickupDateTime.split('T')[0],
          pickupTime: route.pickupDateTime.split('T')[1],
          origin: route.originLocation,
          destination: route.destinationLocation,
          vehicleType: route.vehicleType,
          price: route.price,
          notes: route.notes || undefined,
        }))
      };

      await updateBookingMutation.mutateAsync(updateData);
      navigate({ to: `/transportation-booking-detail/${transportationBookingId}` });
    } catch (error) {
      console.error('Error updating transportation booking:', error);
      const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
      toast.error(msg);
    }
  };

  const totalAmount = routes.reduce((sum, route) => sum + route.price, 0);

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

  return (
    <PageLayout title={`Edit Transportation Booking ${transportationBooking?.number || ''}`}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: `/transportation-booking-detail/${transportationBookingId}` })}
            className="h-9 px-4 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 hover:text-black flex items-center rounded-md font-medium text-xs bg-white shadow-none"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali ke Detail
          </Button>
          <Button 
            type="submit" 
            disabled={updateBookingMutation.isPending}
            className="bg-[#111111] hover:bg-[#242424] text-white h-9 px-4 rounded-md text-xs font-semibold transition-colors border border-transparent shadow-none"
          >
            {updateBookingMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin text-white" />
            ) : (
              <Save className="h-4 w-4 mr-2 text-white/85" />
            )}
            {updateBookingMutation.isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
          </Button>
        </div>

        {/* Customer Information Card */}
        <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none p-6">
          <h2 className="text-sm font-bold text-[#111111] uppercase tracking-wider mb-6 pb-2 border-b border-gray-100">
            Customer Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6">
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                Customer Name *
              </label>
              <Input
                type="text"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                required
                className="h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                Phone Number *
              </label>
              <Input
                type="tel"
                value={formData.customerPhone}
                onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                required
                className="h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <Input
                type="email"
                value={formData.customerEmail}
                onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                className="h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                General Notes
              </label>
              <Input
                type="text"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
                className="h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none"
              />
            </div>
          </div>
        </div>

        {/* Transportation Routes Card */}
        <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none p-6">
          <div className="flex items-center justify-between mb-6 pb-2 border-b border-gray-100">
            <h2 className="text-sm font-bold text-[#111111] uppercase tracking-wider">
              Transportation Routes
            </h2>
            <Button
              type="button"
              variant="outline"
              onClick={addRoute}
              className="h-9 px-3.5 border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-[#111111] flex items-center rounded-md text-xs font-semibold transition-colors bg-white shadow-none"
            >
              <Plus className="h-4 w-4 mr-2 text-zinc-500" />
              <span>Tambah Rute</span>
            </Button>
          </div>

          <div className="space-y-6">
            {routes.map((route, index) => (
              <div key={route.id} className="border border-[#e5e7eb] rounded-lg p-5 bg-white transition-all hover:border-[#111111]/30">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                  <h3 className="text-xs font-bold text-[#111111] uppercase tracking-wider">
                    Rute Segment #{index + 1}
                  </h3>
                  {routes.length > 1 && (
                    <Button
                      type="button"
                      onClick={() => removeRoute(route.id.toString())}
                      className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/60 h-8 w-8 p-0 rounded-md flex items-center justify-center transition-colors shadow-none"
                    >
                      <Trash2 className="h-4 w-4 text-rose-500" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-6">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                      Pickup Date & Time *
                    </label>
                    <Input
                      type="datetime-local"
                      value={route.pickupDateTime}
                      onChange={(e) => updateRoute(route.id, 'pickupDateTime', e.target.value)}
                      required
                      className="h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                      From Location (Origin) *
                    </label>
                    <select
                      value={route.originLocation}
                      onChange={(e) => updateRoute(route.id, 'originLocation', e.target.value)}
                      required
                      className="w-full h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none"
                    >
                      <option value="">Pilih Lokasi Asal</option>
                      {TRANSPORT_LOCATIONS.map((loc) => (
                        <option key={`origin-${loc}`} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                      To Location (Destination) *
                    </label>
                    <select
                      value={route.destinationLocation}
                      onChange={(e) => updateRoute(route.id, 'destinationLocation', e.target.value)}
                      required
                      className="w-full h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none"
                    >
                      <option value="">Pilih Lokasi Tujuan</option>
                      {TRANSPORT_LOCATIONS.map((loc) => (
                        <option key={`dest-${loc}`} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                      Vehicle Type
                    </label>
                    <select
                      value={route.vehicleType}
                      onChange={(e) => updateRoute(route.id, 'vehicleType', e.target.value)}
                      className="w-full h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:outline-none focus:border-[#111111] focus:ring-1 focus:ring-[#111111]"
                    >
                      <option value="sedan">Sedan</option>
                      <option value="staria">Staria</option>
                      <option value="hiace">Hiace</option>
                      <option value="gmc">GMC</option>
                      <option value="coaster">Coaster</option>
                      <option value="bus">Bus</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                      Price (SAR)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={route.price}
                      onChange={(e) => updateRoute(route.id, 'price', parseFloat(e.target.value) || 0)}
                      className="h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none"
                    />
                  </div>
                  <div className="md:col-span-2 lg:col-span-3">
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                      Route Segment Notes
                    </label>
                    <Input
                      type="text"
                      value={route.notes}
                      onChange={(e) => updateRoute(route.id, 'notes', e.target.value)}
                      placeholder="Additional notes for this route segment..."
                      className="h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary Card */}
        <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none p-6">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-[#111111] uppercase tracking-wider">Grand Total Amount</span>
            <span className="text-xl font-bold text-[#111111] tracking-tight">
              {totalAmount.toFixed(2)} SAR
            </span>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex justify-end pt-2">
          <Button 
            type="submit" 
            disabled={updateBookingMutation.isPending}
            className="bg-[#111111] hover:bg-[#242424] text-white h-10 px-6 rounded-md text-sm font-semibold transition-colors border border-transparent shadow-none"
          >
            {updateBookingMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin text-white" />
            ) : (
              <Save className="h-4 w-4 mr-2 text-white/85" />
            )}
            {updateBookingMutation.isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
          </Button>
        </div>
      </form>
    </PageLayout>
  );
}
