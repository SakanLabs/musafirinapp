import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Plus, Trash2, Save, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageLayout } from "@/components/layout/PageLayout";
import { authService } from "@/lib/auth";
import { useClients } from "@/lib/queries/clients";
import { useCreateTransportationBooking } from "@/lib/queries/transportationBookings";

export const Route = createFileRoute("/create-transportation-booking")({
  beforeLoad: async () => {
    const isAuthenticated = await authService.isAuthenticated();
    if (!isAuthenticated) {
      throw redirect({ to: "/login" });
    }
  },
  component: CreateTransportationBookingPage,
});

interface TransportationRoute {
  id: string;
  pickupDate: string;
  pickupTime: string;
  origin: string;
  destination: string;
  vehicleType: string;
  price: string;
  notes: string;
}

function CreateTransportationBookingPage() {
  const navigate = useNavigate();
  const { data: clients = [], isLoading: isClientsLoading } = useClients();
  const createTransportationBooking = useCreateTransportationBooking();
  const [selectedClientId, setSelectedClientId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    notes: "",
  });

  const [routes, setRoutes] = useState<TransportationRoute[]>([
    {
      id: "1",
      pickupDate: "",
      pickupTime: "",
      origin: "",
      destination: "",
      vehicleType: "",
      price: "",
      notes: "",
    },
  ]);

  const vehicleTypes = [
    { value: "sedan", label: "Sedan" },
    { value: "suv", label: "SUV" },
    { value: "van", label: "Van" },
    { value: "bus", label: "Bus" },
    { value: "minibus", label: "Minibus" },
  ];

  // Effect to validate selected client
  useEffect(() => {
    if (!selectedClientId) {
      return;
    }

    const clientExists = clients.some(client => client.id.toString() === selectedClientId);

    if (!clientExists) {
      setSelectedClientId("");
      setFormData(prev => ({
        ...prev,
        customerName: "",
        customerEmail: "",
        customerPhone: ""
      }));
    }
  }, [clients, selectedClientId]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ""
      }));
    }
  };

  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    
    if (!clientId) {
      setFormData(prev => ({
        ...prev,
        customerName: "",
        customerEmail: "",
        customerPhone: ""
      }));
      return;
    }

    const selectedClient = clients.find(client => client.id.toString() === clientId);
    if (selectedClient) {
      setFormData(prev => ({
        ...prev,
        customerName: selectedClient.name,
        customerPhone: selectedClient.phone || "",
        customerEmail: selectedClient.email || "",
      }));
      
      // Clear client-related errors
      setErrors(prev => ({
        ...prev,
        client: "",
        customerName: "",
        customerEmail: "",
        customerPhone: ""
      }));
    }
  };

  const handleRouteChange = (routeId: string, field: string, value: string) => {
    setRoutes(prev => prev.map(route => 
      route.id === routeId 
        ? { ...route, [field]: value }
        : route
    ));
  };

  const addRoute = () => {
    const newRoute: TransportationRoute = {
      id: Date.now().toString(),
      pickupDate: "",
      pickupTime: "",
      origin: "",
      destination: "",
      vehicleType: "",
      price: "",
      notes: "",
    };
    setRoutes(prev => [...prev, newRoute]);
  };

  const removeRoute = (routeId: string) => {
    if (routes.length > 1) {
      setRoutes(prev => prev.filter(route => route.id !== routeId));
    }
  };

  const calculateTotalPrice = () => {
    return routes.reduce((total, route) => {
      const price = parseFloat(route.price) || 0;
      return total + price;
    }, 0);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Validate client selection
    if (!selectedClientId) {
      newErrors.client = 'Silakan pilih client atau buat client baru';
    }

    // Validate customer information
    if (!formData.customerName.trim()) {
      newErrors.customerName = 'Nama customer harus diisi';
    }
    if (!formData.customerPhone.trim()) {
      newErrors.customerPhone = 'Nomor telepon harus diisi';
    }
    if (formData.customerEmail && !/\S+@\S+\.\S+/.test(formData.customerEmail)) {
      newErrors.customerEmail = 'Format email tidak valid';
    }

    // Validate routes
    if (routes.length === 0) {
      newErrors.routes = 'Minimal harus ada satu rute';
    }

    routes.forEach((route, index) => {
      if (!route.origin.trim()) {
        newErrors[`route_${index}_origin`] = 'Lokasi asal harus diisi';
      }
      if (!route.destination.trim()) {
        newErrors[`route_${index}_destination`] = 'Lokasi tujuan harus diisi';
      }
      if (!route.pickupDate) {
        newErrors[`route_${index}_pickupDate`] = 'Tanggal harus diisi';
      }
      if (!route.pickupTime) {
        newErrors[`route_${index}_pickupTime`] = 'Waktu harus diisi';
      }
      if (!route.vehicleType.trim()) {
        newErrors[`route_${index}_vehicleType`] = 'Jenis kendaraan harus diisi';
      }
      if (!route.price || parseFloat(route.price) <= 0) {
        newErrors[`route_${index}_price`] = 'Harga harus lebih dari 0';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    const bookingData = {
      customerName: formData.customerName,
      customerPhone: formData.customerPhone,
      customerEmail: formData.customerEmail,
      notes: formData.notes,
      routes: routes.map(route => ({
        pickupDate: route.pickupDate,
        pickupTime: route.pickupTime,
        origin: route.origin,
        destination: route.destination,
        vehicleType: route.vehicleType,
        price: parseFloat(route.price) || 0,
        notes: route.notes,
      })),
      totalAmount: calculateTotalPrice(),
      currency: "SAR",
      status: "pending" as const,
    };

    createTransportationBooking.mutate(bookingData, {
      onSuccess: () => {
        alert("Pemesanan transportasi berhasil dibuat!");
        navigate({ to: "/transportation-bookings" });
      },
      onError: (error) => {
        console.error("Error creating booking:", error);
        alert("Gagal membuat pemesanan. Silakan coba lagi.");
      },
    });
  };

  return (
    <PageLayout title="Buat Pemesanan Transportasi">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/transportation-bookings" })}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Kembali
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Buat Pemesanan Transportasi</h1>
              <p className="text-gray-600">Isi form di bawah untuk membuat pemesanan baru</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Information */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Informasi Customer</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="clientSelect">Client</Label>
                <div className="flex flex-col gap-2 md:flex-row md:items-center">
                  <select
                    id="clientSelect"
                    value={selectedClientId}
                    onChange={(e) => handleClientSelect(e.target.value)}
                    className="w-full flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isClientsLoading && clients.length === 0}
                  >
                    <option value="">
                      {isClientsLoading && clients.length === 0
                        ? "Loading clients..."
                        : "Pilih client atau isi manual"}
                    </option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id.toString()}>
                        {client.name} • {client.email}
                      </option>
                    ))}
                  </select>
                  <Button 
                    type="button"
                    variant="outline"
                    onClick={() => navigate({ to: "/clients/create", search: { redirectTo: "/create-transportation-booking" } })}
                  >
                    Client Baru
                  </Button>
                </div>
                {selectedClientId && (
                  <p className="text-xs text-gray-500 mt-2">
                    Detail customer diisi otomatis dari client yang dipilih.
                  </p>
                )}
                {!isClientsLoading && clients.length === 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    Tidak ada client ditemukan. Buat client baru untuk melanjutkan.
                  </p>
                )}
                {errors.client && (
                  <p className="text-red-500 text-sm mt-2">{errors.client}</p>
                )}
              </div>
              <div>
                <Label htmlFor="customerName">Nama Customer *</Label>
                <Input
                  id="customerName"
                  value={formData.customerName}
                  onChange={(e) => handleInputChange("customerName", e.target.value)}
                  placeholder="Masukkan nama customer"
                  required
                  readOnly={!!selectedClientId}
                  className={errors.customerName ? "border-red-500" : ""}
                />
                {errors.customerName && (
                  <p className="text-red-500 text-sm mt-1">{errors.customerName}</p>
                )}
              </div>
              <div>
                <Label htmlFor="customerPhone">Nomor Telepon *</Label>
                <Input
                  id="customerPhone"
                  value={formData.customerPhone}
                  onChange={(e) => handleInputChange("customerPhone", e.target.value)}
                  placeholder="Contoh: +62812345678"
                  required
                  readOnly={!!selectedClientId}
                  className={errors.customerPhone ? "border-red-500" : ""}
                />
                {errors.customerPhone && (
                  <p className="text-red-500 text-sm mt-1">{errors.customerPhone}</p>
                )}
              </div>
              <div>
                <Label htmlFor="customerEmail">Email</Label>
                <Input
                  id="customerEmail"
                  type="email"
                  value={formData.customerEmail}
                  onChange={(e) => handleInputChange("customerEmail", e.target.value)}
                  placeholder="customer@email.com"
                  readOnly={!!selectedClientId}
                  className={errors.customerEmail ? "border-red-500" : ""}
                />
                {errors.customerEmail && (
                  <p className="text-red-500 text-sm mt-1">{errors.customerEmail}</p>
                )}
              </div>
              <div>
                <Label htmlFor="notes">Catatan</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange("notes", e.target.value)}
                  placeholder="Catatan tambahan untuk pemesanan"
                  rows={3}
                />
              </div>
            </div>
          </Card>

          {/* Transportation Routes */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Rute Transportasi</h2>
              <Button
                type="button"
                variant="outline"
                onClick={addRoute}
                className="flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Tambah Rute</span>
              </Button>
            </div>

            <div className="space-y-6">
              {routes.map((route, index) => (
                <div key={route.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-md font-medium text-gray-900">
                      Rute {index + 1}
                    </h3>
                    {routes.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeRoute(route.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor={`pickupDate-${route.id}`}>Tanggal Penjemputan *</Label>
                      <Input
                        id={`pickupDate-${route.id}`}
                        type="date"
                        value={route.pickupDate}
                        onChange={(e) => handleRouteChange(route.id, "pickupDate", e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor={`pickupTime-${route.id}`}>Jam Penjemputan *</Label>
                      <Input
                        id={`pickupTime-${route.id}`}
                        type="time"
                        value={route.pickupTime}
                        onChange={(e) => handleRouteChange(route.id, "pickupTime", e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor={`vehicleType-${route.id}`}>Jenis Kendaraan *</Label>
                      <select
                        id={`vehicleType-${route.id}`}
                        value={route.vehicleType}
                        onChange={(e) => handleRouteChange(route.id, "vehicleType", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">Pilih jenis kendaraan</option>
                        {vehicleTypes.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor={`origin-${route.id}`}>Lokasi Asal *</Label>
                      <Input
                        id={`origin-${route.id}`}
                        value={route.origin}
                        onChange={(e) => handleRouteChange(route.id, "origin", e.target.value)}
                        placeholder="Contoh: Hotel Madinah"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor={`destination-${route.id}`}>Lokasi Tujuan *</Label>
                      <Input
                        id={`destination-${route.id}`}
                        value={route.destination}
                        onChange={(e) => handleRouteChange(route.id, "destination", e.target.value)}
                        placeholder="Contoh: Bandara Jeddah"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor={`price-${route.id}`}>Harga (SAR) *</Label>
                      <Input
                        id={`price-${route.id}`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={route.price}
                        onChange={(e) => handleRouteChange(route.id, "price", e.target.value)}
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <Label htmlFor={`routeNotes-${route.id}`}>Catatan Rute</Label>
                    <Textarea
                      id={`routeNotes-${route.id}`}
                      value={route.notes}
                      onChange={(e) => handleRouteChange(route.id, "notes", e.target.value)}
                      placeholder="Catatan khusus untuk rute ini"
                      rows={2}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Summary */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Ringkasan</h2>
            <div className="flex items-center justify-between text-lg">
              <span className="font-medium">Total Harga:</span>
              <span className="font-bold text-blue-600">
                {calculateTotalPrice().toFixed(2)} SAR
              </span>
            </div>
            <div className="text-sm text-gray-600 mt-2">
              {routes.length} rute transportasi
            </div>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate({ to: "/transportation-bookings" })}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={createTransportationBooking.isPending}
              className="flex items-center space-x-2"
            >
              <Save className="h-4 w-4" />
              <span>{createTransportationBooking.isPending ? "Menyimpan..." : "Simpan Pemesanan"}</span>
            </Button>
          </div>
        </form>
      </div>
    </PageLayout>
  );
}
