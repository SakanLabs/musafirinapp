import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
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
import { useTransportRoutes } from "@/lib/queries/master";
import { apiClient } from "@/lib/api";

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
  const { data: masterRoutes = [], isLoading: isMasterRoutesLoading } = useTransportRoutes();
  const createTransportationBooking = useCreateTransportationBooking();
  const [selectedClientId, setSelectedClientId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    notes: "",
  });

  const [routeMode, setRouteMode] = useState<'perRoute' | 'fullTrip'>('perRoute');
  const [fullTripPrice, setFullTripPrice] = useState<string>("");
  // Tambahan field untuk Full Trip
  const [fullTripDepartureDate, setFullTripDepartureDate] = useState<string>("");
  const [fullTripDeparturePlace, setFullTripDeparturePlace] = useState<string>("");
  const [fullTripReturnDate, setFullTripReturnDate] = useState<string>("");
  const [fullTripReturnPlace, setFullTripReturnPlace] = useState<string>("");

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
    { value: "staria", label: "Staria" },
    { value: "hiace", label: "Hiace" },
    { value: "gmc", label: "GMC" },
    { value: "coaster", label: "Coaster" },
    { value: "bus", label: "Bus" },
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

  const handleMasterRouteSelection = (routeId: string, masterRouteId: string) => {
    if (!masterRouteId) return;
    const selectedMaster = masterRoutes.find(r => r.id.toString() === masterRouteId);
    if (selectedMaster) {
      setRoutes(prev => prev.map(route =>
        route.id === routeId
          ? {
              ...route,
              origin: selectedMaster.originLocation,
              destination: selectedMaster.destinationLocation,
            }
          : route
      ));
      toast.info('Origin & Destination diisi. Silakan pilih Tanggal dan Jenis Kendaraan, lalu klik tombol ⚡ untuk Auto-Fill harga.', { id: `master-${routeId}` });
    }
  };

  const autoFillTransportPricing = async (routeId: string) => {
    const routeIndex = routes.findIndex(r => r.id === routeId);
    if (routeIndex === -1) return;
    
    const route = routes[routeIndex];
    if (!route.origin || !route.destination || !route.pickupDate || !route.vehicleType) {
      toast.error('Silakan lengkapi Lokasi Asal, Tujuan, Tanggal, dan Jenis Kendaraan terlebih dahulu.');
      return;
    }

    const matchedMaster = masterRoutes.find(r => 
      r.originLocation.toLowerCase() === route.origin.toLowerCase() && 
      r.destinationLocation.toLowerCase() === route.destination.toLowerCase()
    );

    if (!matchedMaster) {
      toast.error('Master Route tidak ditemukan untuk Lokasi Asal dan Tujuan ini.');
      return;
    }

    const toastId = toast.loading('Mengambil harga dari Master Data...');
    
    try {
      const response = await apiClient.get<any>(`/api/master/transport-routes/${matchedMaster.id}/pricing`);
      const periods = Array.isArray(response) ? response : (response as any).data || [];
      
      const pickupTime = new Date(route.pickupDate);
      
      const activePeriod = periods.find((p: any) => {
        const start = new Date(p.startDate);
        const end = new Date(p.endDate);
        return p.vehicleType.toLowerCase() === route.vehicleType.toLowerCase() && 
               p.isActive &&
               start <= pickupTime && 
               end >= pickupTime;
      });

      if (!activePeriod) {
        toast.error(`Tidak ada harga Master/Musim aktif untuk jenis kendaraan ${route.vehicleType} pada tanggal tersebut.`, { id: toastId });
        return;
      }

      setRoutes(prev => prev.map(r => 
        r.id === routeId 
          ? { ...r, price: String(activePeriod.sellingPrice) } 
          : r
      ));
      
      toast.success('Harga otomatis diisi dari Master Data!', { id: toastId });

    } catch (e) {
      toast.error('Gagal mengambil harga otomatis.', { id: toastId });
    }
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
    if (routeMode === 'fullTrip') {
      return parseFloat(fullTripPrice) || 0;
    }
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

    if (routeMode === 'perRoute') {
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
    } else {
      // Validasi Full Trip: wajib total harga dan detail keberangkatan/kepulangan
      if (!fullTripPrice || parseFloat(fullTripPrice) <= 0) {
        newErrors.fullTripPrice = 'Total harga Full Trip harus lebih dari 0';
      }
      if (!fullTripDepartureDate) {
        newErrors.fullTripDepartureDate = 'Tanggal keberangkatan harus diisi';
      }
      if (!fullTripDeparturePlace.trim()) {
        newErrors.fullTripDeparturePlace = 'Tempat keberangkatan harus diisi';
      }
      if (!fullTripReturnDate) {
        newErrors.fullTripReturnDate = 'Tanggal kepulangan harus diisi';
      }
      if (!fullTripReturnPlace.trim()) {
        newErrors.fullTripReturnPlace = 'Tempat kepulangan harus diisi';
      }
    }

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
      notes: routeMode === 'fullTrip'
        ? [
          formData.notes,
          'Detail Full Trip:',
          `Keberangkatan: ${fullTripDepartureDate} • ${fullTripDeparturePlace}`,
          `Kepulangan: ${fullTripReturnDate} • ${fullTripReturnPlace}`,
        ].filter(Boolean).join('\n')
        : formData.notes,
      routes: routeMode === 'perRoute' ? routes.map(route => ({
        pickupDate: route.pickupDate,
        pickupTime: route.pickupTime,
        origin: route.origin,
        destination: route.destination,
        vehicleType: route.vehicleType,
        price: parseFloat(route.price) || 0,
        notes: route.notes,
      })) : [],
      totalAmount: calculateTotalPrice(),
      currency: "SAR",
      status: "pending" as const,
    };

    createTransportationBooking.mutate(bookingData, {
      onSuccess: () => {
        toast.success("Pemesanan transportasi berhasil dibuat!");
        navigate({ to: "/transportation-bookings" });
      },
      onError: (error) => {
        console.error("Error creating booking:", error);
        const msg = error instanceof Error ? error.message : "Gagal membuat pemesanan";
        toast.error(msg);
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
              className="h-9 px-4 border-[#e5e7eb] text-zinc-700 hover:bg-zinc-50 hover:text-black flex items-center rounded-md font-medium text-xs shadow-none"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Kembali
            </Button>
            <div>
              <h1 className="text-xl font-bold text-zinc-950 tracking-tight">Buat Pemesanan Transportasi</h1>
              <p className="text-xs text-zinc-500 mt-1">Isi form di bawah untuk membuat pemesanan baru</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Information */}
          <Card className="p-6 border border-[#e5e7eb] rounded-xl bg-white shadow-none">
            <h2 className="text-sm font-bold text-zinc-900 mb-6 tracking-tight">Informasi Customer</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <Label htmlFor="clientSelect" className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">Client *</Label>
                <div className="flex flex-col gap-2 md:flex-row md:items-center">
                  <select
                    id="clientSelect"
                    value={selectedClientId}
                    onChange={(e) => handleClientSelect(e.target.value)}
                    className="w-full flex-1 h-10 px-3 border border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] bg-white text-sm text-zinc-800"
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
                    className="h-10 px-4 border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-black font-semibold text-sm rounded-md shadow-none flex items-center transition-colors"
                  >
                    Client Baru
                  </Button>
                </div>
                {selectedClientId && (
                  <p className="text-xs text-zinc-400 mt-2 font-medium">
                    Detail customer diisi otomatis dari client yang dipilih.
                  </p>
                )}
                {!isClientsLoading && clients.length === 0 && (
                  <p className="text-xs text-zinc-400 mt-2 font-medium">
                    Tidak ada client ditemukan. Buat client baru untuk melanjutkan.
                  </p>
                )}
                {errors.client && (
                  <p className="text-red-500 text-sm mt-2">{errors.client}</p>
                )}
              </div>
              <div>
                <Label htmlFor="customerName" className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">Nama Customer *</Label>
                <Input
                  id="customerName"
                  value={formData.customerName}
                  onChange={(e) => handleInputChange("customerName", e.target.value)}
                  placeholder="Masukkan nama customer"
                  required
                  readOnly={!!selectedClientId}
                  className={`h-10 border-[#e5e7eb] rounded-md focus-visible:ring-[#111111] focus-visible:border-[#111111] ${errors.customerName ? "border-red-500" : ""}`}
                />
                {errors.customerName && (
                  <p className="text-red-500 text-sm mt-1">{errors.customerName}</p>
                )}
              </div>
              <div>
                <Label htmlFor="customerPhone" className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">Nomor Telepon *</Label>
                <Input
                  id="customerPhone"
                  value={formData.customerPhone}
                  onChange={(e) => handleInputChange("customerPhone", e.target.value)}
                  placeholder="Contoh: +62812345678"
                  required
                  readOnly={!!selectedClientId}
                  className={`h-10 border-[#e5e7eb] rounded-md focus-visible:ring-[#111111] focus-visible:border-[#111111] ${errors.customerPhone ? "border-red-500" : ""}`}
                />
                {errors.customerPhone && (
                  <p className="text-red-500 text-sm mt-1">{errors.customerPhone}</p>
                )}
              </div>
              <div>
                <Label htmlFor="customerEmail" className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">Email</Label>
                <Input
                  id="customerEmail"
                  type="email"
                  value={formData.customerEmail}
                  onChange={(e) => handleInputChange("customerEmail", e.target.value)}
                  placeholder="customer@email.com"
                  readOnly={!!selectedClientId}
                  className={`h-10 border-[#e5e7eb] rounded-md focus-visible:ring-[#111111] focus-visible:border-[#111111] ${errors.customerEmail ? "border-red-500" : ""}`}
                />
                {errors.customerEmail && (
                  <p className="text-red-500 text-sm mt-1">{errors.customerEmail}</p>
                )}
              </div>
              <div>
                <Label htmlFor="notes" className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">Catatan</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange("notes", e.target.value)}
                  placeholder="Catatan tambahan untuk pemesanan"
                  rows={3}
                  className="p-3 border border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] bg-white text-sm focus:outline-none"
                />
              </div>
            </div>
          </Card>

          {/* Transportation Routes */}
          <Card className="p-6 border border-[#e5e7eb] rounded-xl bg-white shadow-none">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-bold text-zinc-900 tracking-tight">Rute Transportasi</h2>
              {routeMode === 'perRoute' && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={addRoute}
                  className="h-9 px-4 border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-black flex items-center rounded-md font-medium text-xs shadow-none"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  <span>Tambah Rute</span>
                </Button>
              )}
            </div>

            {/* Route mode selector */}
            <div className="mb-6">
              <Label htmlFor="routeMode" className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">Tipe Rute</Label>
              <select
                id="routeMode"
                value={routeMode}
                onChange={(e) => setRouteMode(e.target.value as 'perRoute' | 'fullTrip')}
                className="w-full h-10 px-3 border border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] bg-white text-sm text-zinc-800"
              >
                <option value="perRoute">Per Rute (detail 1-1)</option>
                <option value="fullTrip">Full Trip (tanpa input rute 1-1)</option>
              </select>
            </div>

            <div className="space-y-6">
              {routeMode === 'perRoute' ? (
                routes.map((route, index) => (
                  <div key={route.id} className="border border-gray-200 rounded-xl p-6 bg-white space-y-4">
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                      <h3 className="text-sm font-bold text-zinc-950">
                        Rute {index + 1}
                      </h3>
                      {routes.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeRoute(route.id)}
                          className="h-8 w-8 p-0 border-[#e5e7eb] text-red-600 hover:bg-red-50 rounded-md flex items-center justify-center transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="bg-zinc-50/50 border border-zinc-200/60 p-4 rounded-xl space-y-1">
                      <Label htmlFor={`masterRoute-${route.id}`} className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">Pilih dari Master Data (Opsional)</Label>
                      <select
                        id={`masterRoute-${route.id}`}
                        onChange={(e) => handleMasterRouteSelection(route.id, e.target.value)}
                        className="w-full h-10 px-3 border border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] bg-white text-sm text-zinc-800"
                        disabled={isMasterRoutesLoading}
                      >
                        <option value="">-- Isi Manual --</option>
                        {masterRoutes.map((mr) => (
                          <option key={mr.id} value={mr.id.toString()}>
                            {mr.originLocation} → {mr.destinationLocation}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
                      <div>
                        <Label htmlFor={`pickupDate-${route.id}`} className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">Tanggal Penjemputan *</Label>
                        <Input
                          id={`pickupDate-${route.id}`}
                          type="date"
                          value={route.pickupDate}
                          onChange={(e) => handleRouteChange(route.id, "pickupDate", e.target.value)}
                          className="h-10 border-[#e5e7eb] rounded-md focus-visible:ring-[#111111] focus-visible:border-[#111111]"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor={`pickupTime-${route.id}`} className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">Jam Penjemputan *</Label>
                        <Input
                          id={`pickupTime-${route.id}`}
                          type="time"
                          value={route.pickupTime}
                          onChange={(e) => handleRouteChange(route.id, "pickupTime", e.target.value)}
                          className="h-10 border-[#e5e7eb] rounded-md focus-visible:ring-[#111111] focus-visible:border-[#111111]"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor={`vehicleType-${route.id}`} className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">Jenis Kendaraan *</Label>
                        <select
                          id={`vehicleType-${route.id}`}
                          value={route.vehicleType}
                          onChange={(e) => handleRouteChange(route.id, "vehicleType", e.target.value)}
                          className="w-full h-10 px-3 border border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] bg-white text-sm text-zinc-800"
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
                        <Label htmlFor={`origin-${route.id}`} className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">Lokasi Asal *</Label>
                        <Input
                          id={`origin-${route.id}`}
                          value={route.origin}
                          onChange={(e) => handleRouteChange(route.id, "origin", e.target.value)}
                          placeholder="Contoh: Hotel Madinah"
                          className="h-10 border-[#e5e7eb] rounded-md focus-visible:ring-[#111111] focus-visible:border-[#111111]"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor={`destination-${route.id}`} className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">Lokasi Tujuan *</Label>
                        <Input
                          id={`destination-${route.id}`}
                          value={route.destination}
                          onChange={(e) => handleRouteChange(route.id, "destination", e.target.value)}
                          placeholder="Contoh: Bandara Jeddah"
                          className="h-10 border-[#e5e7eb] rounded-md focus-visible:ring-[#111111] focus-visible:border-[#111111]"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor={`price-${route.id}`} className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">Harga (SAR) *</Label>
                        <div className="flex space-x-2 mt-1">
                          <Input
                            id={`price-${route.id}`}
                            type="number"
                            step="0.01"
                            min="0"
                            value={route.price}
                            onChange={(e) => handleRouteChange(route.id, "price", e.target.value)}
                            placeholder="0.00"
                            className="flex-1 h-10 border-[#e5e7eb] rounded-md focus-visible:ring-[#111111] focus-visible:border-[#111111]"
                            required
                          />
                          <Button 
                            type="button" 
                            variant="secondary" 
                            onClick={() => autoFillTransportPricing(route.id)}
                            title="Auto-Fill dari Master Data"
                            className="h-10 px-3 border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800 shadow-none rounded-md"
                          >
                            ⚡
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <Label htmlFor={`routeNotes-${route.id}`} className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">Catatan Rute</Label>
                      <textarea
                        id={`routeNotes-${route.id}`}
                        value={route.notes}
                        onChange={(e) => handleRouteChange(route.id, "notes", e.target.value)}
                        placeholder="Catatan khusus untuk rute ini"
                        rows={2}
                        className="w-full p-3 border border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] bg-white text-sm focus:outline-none"
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="border border-gray-200 rounded-xl p-6 bg-white space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="fullTripPrice" className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">Total Harga Full Trip (SAR) *</Label>
                      <Input
                        id="fullTripPrice"
                        type="number"
                        step="0.01"
                        min="0"
                        value={fullTripPrice}
                        onChange={(e) => setFullTripPrice(e.target.value)}
                        placeholder="0.00"
                        required
                        className={`h-10 border-[#e5e7eb] rounded-md focus-visible:ring-[#111111] focus-visible:border-[#111111] ${errors.fullTripPrice ? "border-red-500" : ""}`}
                      />
                      {errors.fullTripPrice && (
                        <p className="text-red-500 text-sm mt-1">{errors.fullTripPrice}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="fullTripDepartureDate" className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">Tanggal Keberangkatan *</Label>
                      <Input
                        id="fullTripDepartureDate"
                        type="date"
                        value={fullTripDepartureDate}
                        onChange={(e) => setFullTripDepartureDate(e.target.value)}
                        required
                        className={`h-10 border-[#e5e7eb] rounded-md focus-visible:ring-[#111111] focus-visible:border-[#111111] ${errors.fullTripDepartureDate ? "border-red-500" : ""}`}
                      />
                      {errors.fullTripDepartureDate && (
                        <p className="text-red-500 text-sm mt-1">{errors.fullTripDepartureDate}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="fullTripDeparturePlace" className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">Tempat Keberangkatan *</Label>
                      <Input
                        id="fullTripDeparturePlace"
                        type="text"
                        placeholder="Contoh: Hotel Madinah"
                        value={fullTripDeparturePlace}
                        onChange={(e) => setFullTripDeparturePlace(e.target.value)}
                        required
                        className={`h-10 border-[#e5e7eb] rounded-md focus-visible:ring-[#111111] focus-visible:border-[#111111] ${errors.fullTripDeparturePlace ? "border-red-500" : ""}`}
                      />
                      {errors.fullTripDeparturePlace && (
                        <p className="text-red-500 text-sm mt-1">{errors.fullTripDeparturePlace}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="fullTripReturnDate" className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">Tanggal Kepulangan *</Label>
                      <Input
                        id="fullTripReturnDate"
                        type="date"
                        value={fullTripReturnDate}
                        onChange={(e) => setFullTripReturnDate(e.target.value)}
                        required
                        className={`h-10 border-[#e5e7eb] rounded-md focus-visible:ring-[#111111] focus-visible:border-[#111111] ${errors.fullTripReturnDate ? "border-red-500" : ""}`}
                      />
                      {errors.fullTripReturnDate && (
                        <p className="text-red-500 text-sm mt-1">{errors.fullTripReturnDate}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="fullTripReturnPlace" className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">Tempat Kepulangan *</Label>
                      <Input
                        id="fullTripReturnPlace"
                        type="text"
                        placeholder="Contoh: Bandara Jeddah"
                        value={fullTripReturnPlace}
                        onChange={(e) => setFullTripReturnPlace(e.target.value)}
                        required
                        className={`h-10 border-[#e5e7eb] rounded-md focus-visible:ring-[#111111] focus-visible:border-[#111111] ${errors.fullTripReturnPlace ? "border-red-500" : ""}`}
                      />
                      {errors.fullTripReturnPlace && (
                        <p className="text-red-500 text-sm mt-1">{errors.fullTripReturnPlace}</p>
                      )}
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="fullTripNotes" className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">Deskripsi / Catatan Full Trip</Label>
                      <textarea
                        id="fullTripNotes"
                        value={formData.notes}
                        onChange={(e) => handleInputChange("notes", e.target.value)}
                        placeholder="Contoh: Antar-jemput selama perjalanan umrah, inkl. semua transfer"
                        rows={3}
                        className="w-full p-3 border border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] bg-white text-sm focus:outline-none"
                      />
                      <p className="text-[11px] text-zinc-400 mt-2 font-medium">Tidak perlu menambah rute satu per satu. Sistem akan mencatat sebagai pemesanan Full Trip.</p>
                    </div>
                  </div>

                  {/* Ringkasan Full Trip */}
                  <div className="mt-4 bg-zinc-50 p-4 border border-zinc-200/60 rounded-xl space-y-1 text-xs text-zinc-600 font-semibold uppercase tracking-wider">
                    <p className="text-zinc-700 tracking-tight">
                      Keberangkatan: <span className="text-zinc-900 normal-case">{fullTripDepartureDate || '-'} • {fullTripDeparturePlace || '-'}</span>
                    </p>
                    <p className="text-zinc-700 tracking-tight mt-1">
                      Kepulangan: <span className="text-zinc-900 normal-case">{fullTripReturnDate || '-'} • {fullTripReturnPlace || '-'}</span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Summary */}
          <Card className="p-6 border border-[#e5e7eb] rounded-xl bg-white shadow-none">
            <h2 className="text-sm font-bold text-zinc-900 mb-4 tracking-tight">Ringkasan</h2>
            <div className="flex justify-between items-center text-xs font-semibold text-zinc-600 uppercase tracking-wider">
              <span>Total Harga:</span>
              <span className="font-bold text-zinc-950 text-lg">
                {calculateTotalPrice().toFixed(2)} SAR
              </span>
            </div>
            <div className="text-xs text-zinc-400 font-semibold uppercase tracking-wider mt-2">
              {routeMode === 'perRoute' ? `${routes.length} rute transportasi` : '1 paket full trip'}
            </div>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate({ to: "/transportation-bookings" })}
              className="h-10 px-5 border-zinc-200 hover:bg-zinc-50 font-medium text-sm rounded-md shadow-none"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={createTransportationBooking.isPending}
              className="bg-[#111111] hover:bg-[#242424] text-white h-10 px-6 rounded-md font-semibold text-sm transition-colors border border-transparent shadow-none"
            >
              {createTransportationBooking.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin text-white" />
              ) : (
                <Save className="h-4 w-4 mr-2 text-white" />
              )}
              <span>{createTransportationBooking.isPending ? "Menyimpan..." : "Simpan Pemesanan"}</span>
            </Button>
          </div>
        </form>
      </div>
    </PageLayout>
  );
}
