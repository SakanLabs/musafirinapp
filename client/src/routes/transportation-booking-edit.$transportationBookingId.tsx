import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowLeft, Plus, Trash2, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { PageLayout } from "@/components/layout/PageLayout";
import { authService } from "@/lib/auth";
import { useTransportationBooking, useUpdateTransportationBooking } from "@/lib/queries/transportationBookings";

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
      alert("Please fill in all required customer information.");
      return;
    }

    for (const route of routes) {
      if (!route.pickupDateTime || !route.originLocation || !route.destinationLocation) {
        alert("Please fill in all required route information.");
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
      alert('Failed to update transportation booking. Please try again.');
    }
  };

  const totalAmount = routes.reduce((sum, route) => sum + route.price, 0);

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

  return (
    <PageLayout title={`Edit Transportation Booking ${transportationBooking?.number || ''}`}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: `/transportation-booking-detail/${transportationBookingId}` })}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Detail
          </Button>
          <Button type="submit" disabled={updateBookingMutation.isPending}>
            {updateBookingMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {updateBookingMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>

        {/* Customer Information */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Customer Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer Name *
              </label>
              <Input
                type="text"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number *
              </label>
              <Input
                type="tel"
                value={formData.customerPhone}
                onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <Input
                type="email"
                value={formData.customerEmail}
                onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <Input
                type="text"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
              />
            </div>
          </div>
        </Card>

        {/* Transportation Routes */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Transportation Routes</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRoute}
              className="flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Add Route</span>
            </Button>
          </div>

          <div className="space-y-6">
            {routes.map((route, index) => (
              <div key={route.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-md font-medium text-gray-900">
                    Route {index + 1}
                  </h3>
                  {routes.length > 1 && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeRoute(route.id.toString())}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Pickup Date & Time *
                    </label>
                    <Input
                      type="datetime-local"
                      value={route.pickupDateTime}
                      onChange={(e) => updateRoute(route.id, 'pickupDateTime', e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      From Location *
                    </label>
                    <Input
                      type="text"
                      value={route.originLocation}
                      onChange={(e) => updateRoute(route.id, 'originLocation', e.target.value)}
                      placeholder="Origin location"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      To Location *
                    </label>
                    <Input
                      type="text"
                      value={route.destinationLocation}
                      onChange={(e) => updateRoute(route.id, 'destinationLocation', e.target.value)}
                      placeholder="Destination location"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vehicle Type
                    </label>
                    <select
                      value={route.vehicleType}
                      onChange={(e) => updateRoute(route.id, 'vehicleType', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="sedan">Sedan</option>
                      <option value="suv">SUV</option>
                      <option value="van">Van</option>
                      <option value="bus">Bus</option>
                      <option value="minibus">Minibus</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Price (SAR)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={route.price}
                      onChange={(e) => updateRoute(route.id, 'price', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="md:col-span-2 lg:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Route Notes
                    </label>
                    <Input
                      type="text"
                      value={route.notes}
                      onChange={(e) => updateRoute(route.id, 'notes', e.target.value)}
                      placeholder="Additional notes for this route..."
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Summary */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Summary</h2>
          <div className="flex justify-between items-center">
            <span className="text-lg font-medium">Total Amount:</span>
            <span className="text-xl font-bold text-blue-600">
              {totalAmount.toFixed(2)} SAR
            </span>
          </div>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={updateBookingMutation.isPending}>
            {updateBookingMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {updateBookingMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </PageLayout>
  );
}
