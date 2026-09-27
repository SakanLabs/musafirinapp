import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AgentPageLayout } from "@/components/layout/AgentPageLayout";
import { useState } from "react";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Building2,
  Car,
  UserCheck,
  Plane,
  FileText,
  Package,
  ArrowLeft,
  ArrowRight,
  Send,
  Save,
  Loader2,
  Check,
} from "lucide-react";

export const Route = createFileRoute("/agent/create-request")({
  component: CreateRequestPage,
});

const serviceTypes = [
  { value: "hotel", label: "Hotel", description: "Request booking hotel di Makkah, Madinah, atau kota lainnya", icon: Building2, color: "bg-blue-50 text-blue-600 border-blue-200" },
  { value: "transportation", label: "Transportasi", description: "Request kendaraan antar jemput airport, antar kota, atau ziarah", icon: Car, color: "bg-green-50 text-green-600 border-green-200" },
  { value: "muthowif", label: "Muthowif", description: "Request pendamping Umrah, City Tour, atau Manasik", icon: UserCheck, color: "bg-purple-50 text-purple-600 border-purple-200" },
  { value: "visa", label: "Visa Umrah", description: "Request pembuatan visa Umrah untuk jamaah", icon: Plane, color: "bg-amber-50 text-amber-600 border-amber-200" },
  { value: "siskopatuh", label: "Siskopatuh", description: "Request pendaftaran Siskopatuh untuk rombongan", icon: FileText, color: "bg-cyan-50 text-cyan-600 border-cyan-200" },
  { value: "custom_la", label: "Paket LA", description: "Request paket lengkap (hotel + transport + muthowif + visa)", icon: Package, color: "bg-rose-50 text-rose-600 border-rose-200" },
];

function CreateRequestPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Select Service, 2: Fill Details, 3: Review
  const [selectedService, setSelectedService] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<any>({
    title: "",
    description: "",
    meta: {},
  });

  const [masterHotels, setMasterHotels] = useState<any[]>([]);
  const [masterTransport, setMasterTransport] = useState<any[]>([]);
  const [masterMuthowif, setMasterMuthowif] = useState<any[]>([]);
  const [hotelPrices, setHotelPrices] = useState<any[]>([]);

  // Fetch master data on mount
  useState(() => {
    const fetchMasterData = async () => {
      try {
        const [h, t, m] = await Promise.all([
          apiClient.get<any[]>("/api/master/hotels"),
          apiClient.get<any[]>("/api/master/transportation-routes"),
          apiClient.get<any[]>("/api/master/services")
        ]);
        if (Array.isArray(h)) setMasterHotels(h);
        if (Array.isArray(t)) setMasterTransport(t);
        if (Array.isArray(m)) setMasterMuthowif(m.filter(x => x.category === 'Muthowif'));
      } catch (err) {
        console.error("Failed to load master data", err);
      }
    };
    fetchMasterData();
  });

  // Calculate pricing whenever meta changes
  const calculateTotal = async (metaObj: any, service: string) => {
    let total = 0;
    
    if (service === "hotel" && metaObj.preferredHotelName) {
      const hotel = masterHotels.find(h => h.name === metaObj.preferredHotelName);
      if (hotel) {
        try {
          const pricing = await apiClient.get<any[]>(`/api/master/hotels/${hotel.id}/pricing`);
          // Use the first active pricing period for simplicity if agentPrice exists
          if (pricing && pricing.length > 0) {
            setHotelPrices(pricing);
            const pax = metaObj.totalPax || 1;
            // E.g., agent price * pax (or room count if we had it)
            // Just for estimated total:
            const p = pricing[0];
            total = parseFloat(p.agentPrice || "0") * pax; 
          }
        } catch (e) {
          // ignore
        }
      }
    } else if (service === "transportation" && metaObj.destinationLocation) {
      // Very simplified: match by route name or from-to
      const route = masterTransport.find(r => r.name.toLowerCase().includes(metaObj.destinationLocation.toLowerCase()) || (r.fromLocation === metaObj.pickupLocation && r.toLocation === metaObj.destinationLocation));
      if (route) {
        try {
          const pricing = await apiClient.get<any[]>(`/api/master/transportation-routes/${route.id}/pricing`);
          if (pricing && pricing.length > 0) {
            total = parseFloat(pricing[0].agentPrice || "0");
          }
        } catch (e) { }
      }
    } else if (service === "muthowif" && metaObj.events && metaObj.events.length > 0) {
      total = metaObj.events.reduce((acc: number, eventName: string) => {
        const serv = masterMuthowif.find(m => m.name === eventName);
        return acc + (serv ? parseFloat(serv.price || "0") : 0);
      }, 0);
      // multiply by totalPax if needed, but muthowif is usually per group or unitType
    }

    if (total > 0) {
      setFormData((prev: any) => ({ ...prev, meta: { ...prev.meta, agentPrice: total } }));
    } else {
      setFormData((prev: any) => ({ ...prev, meta: { ...prev.meta, agentPrice: undefined } }));
    }
  };

  const updateMeta = (key: string, value: any) => {
    const newMeta = { ...formData.meta, [key]: value };
    setFormData({ ...formData, meta: newMeta });
    calculateTotal(newMeta, selectedService);
  };

  const handleSubmit = async (asDraft: boolean = false) => {
    if (!selectedService) {
      toast.error("Pilih jenis layanan terlebih dahulu");
      return;
    }
    if (!formData.title) {
      toast.error("Judul request wajib diisi");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.post<any>("/api/agent-requests", {
        serviceType: selectedService,
        title: formData.title,
        description: formData.description || null,
        meta: formData.meta,
        submitNow: !asDraft,
      });

      if (res.success) {
        toast.success(asDraft ? "Request disimpan sebagai draft" : "Request berhasil dikirim!");
        navigate({ to: "/agent/request/$requestId", params: { requestId: res.data.id.toString() } });
      } else {
        toast.error(res.error || "Gagal membuat request");
      }
    } catch (error) {
      toast.error("Gagal membuat request");
    } finally {
      setSubmitting(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center gap-2 mb-6">
      {[
        { num: 1, label: "Pilih Layanan" },
        { num: 2, label: "Isi Detail" },
        { num: 3, label: "Review" },
      ].map((s, i) => (
        <div key={s.num} className="flex items-center gap-2">
          <div
            className={`h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold ${
              step >= s.num
                ? "bg-[#111111] text-white"
                : "bg-[#f5f5f5] text-gray-400"
            }`}
          >
            {step > s.num ? <Check className="h-3.5 w-3.5" /> : s.num}
          </div>
          <span className={`text-xs font-medium hidden sm:inline ${step >= s.num ? "text-[#111111]" : "text-gray-400"}`}>
            {s.label}
          </span>
          {i < 2 && <div className={`w-8 h-[2px] ${step > s.num ? "bg-[#111111]" : "bg-[#e5e7eb]"}`} />}
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-[#111111]">Pilih Jenis Layanan</h3>
        <p className="text-xs text-gray-500 mt-1">Pilih layanan yang Anda butuhkan untuk jamaah</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {serviceTypes.map((svc) => (
          <Card
            key={svc.value}
            className={`p-4 cursor-pointer transition-all border-2 rounded-lg shadow-none hover:shadow-sm ${
              selectedService === svc.value
                ? "border-[#111111] bg-[#f8f9fa]"
                : "border-[#e5e7eb] hover:border-gray-300"
            }`}
            onClick={() => setSelectedService(svc.value)}
          >
            <div className="flex items-start gap-3">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${svc.color.split(' ')[0]}`}>
                <svc.icon className={`h-5 w-5 ${svc.color.split(' ')[1]}`} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#111111]">{svc.label}</p>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{svc.description}</p>
              </div>
            </div>
            {selectedService === svc.value && (
              <div className="mt-3 flex items-center gap-1.5">
                <div className="h-4 w-4 rounded-full bg-[#111111] flex items-center justify-center">
                  <Check className="h-2.5 w-2.5 text-white" />
                </div>
                <span className="text-[10px] font-bold text-[#111111]">Terpilih</span>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );

  const renderServiceSpecificFields = () => {
    const meta = formData.meta || {};

    switch (selectedService) {
      case "hotel":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Kota</Label>
                <select
                  value={meta.city || ""}
                  onChange={(e) => updateMeta("city", e.target.value)}
                  className="mt-1.5 w-full h-9 px-3 text-sm border border-[#e5e7eb] rounded-md bg-white focus:ring-1 focus:ring-[#111111] outline-none"
                >
                  <option value="">Pilih Kota</option>
                  <option value="Makkah">Makkah</option>
                  <option value="Madinah">Madinah</option>
                  <option value="Jeddah">Jeddah</option>
                  <option value="Thaif">Thaif</option>
                </select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700">Tipe Request</Label>
                <select
                  value={meta.requestType || ""}
                  onChange={(e) => updateMeta("requestType", e.target.value)}
                  className="mt-1.5 w-full h-9 px-3 text-sm border border-[#e5e7eb] rounded-md bg-white focus:ring-1 focus:ring-[#111111] outline-none"
                >
                  <option value="">Pilih Tipe</option>
                  <option value="individual">Individual / FIT</option>
                  <option value="group">Group / Rombongan</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Check-in</Label>
                <Input type="date" value={meta.checkIn || ""} onChange={(e) => updateMeta("checkIn", e.target.value)} className="mt-1.5 h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700">Check-out</Label>
                <Input type="date" value={meta.checkOut || ""} onChange={(e) => updateMeta("checkOut", e.target.value)} className="mt-1.5 h-9 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Jumlah Tamu (Pax)</Label>
                <Input type="number" min="1" value={meta.totalPax || ""} onChange={(e) => updateMeta("totalPax", parseInt(e.target.value) || 0)} className="mt-1.5 h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700">Bintang Hotel</Label>
                <select
                  value={meta.hotelStarPreference || ""}
                  onChange={(e) => updateMeta("hotelStarPreference", parseInt(e.target.value))}
                  className="mt-1.5 w-full h-9 px-3 text-sm border border-[#e5e7eb] rounded-md bg-white focus:ring-1 focus:ring-[#111111] outline-none"
                >
                  <option value="">Pilih</option>
                  <option value="3">⭐⭐⭐ Bintang 3</option>
                  <option value="4">⭐⭐⭐⭐ Bintang 4</option>
                  <option value="5">⭐⭐⭐⭐⭐ Bintang 5</option>
                </select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700">Meal Plan</Label>
                <select
                  value={meta.mealPlan || ""}
                  onChange={(e) => updateMeta("mealPlan", e.target.value)}
                  className="mt-1.5 w-full h-9 px-3 text-sm border border-[#e5e7eb] rounded-md bg-white focus:ring-1 focus:ring-[#111111] outline-none"
                >
                  <option value="">Pilih</option>
                  <option value="Room Only">Room Only</option>
                  <option value="Breakfast">Breakfast</option>
                  <option value="Half Board">Half Board</option>
                  <option value="Full Board">Full Board</option>
                </select>
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700">Nama Hotel Preferensi (opsional)</Label>
              <Input 
                list="master-hotels"
                value={meta.preferredHotelName || ""} 
                onChange={(e) => updateMeta("preferredHotelName", e.target.value)} 
                placeholder="Ketik untuk mencari hotel..." 
                className="mt-1.5 h-9 text-sm" 
              />
              <datalist id="master-hotels">
                {masterHotels.map(h => <option key={h.id} value={h.name} />)}
              </datalist>
            </div>
            
            {meta.agentPrice !== undefined && meta.agentPrice > 0 && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-md">
                <p className="text-xs text-blue-600 font-semibold mb-1">Estimasi Harga Master (Agent Price)</p>
                <p className="text-lg font-bold text-blue-900">SAR {meta.agentPrice.toLocaleString("id-ID")}</p>
                <p className="text-[10px] text-blue-500 mt-0.5">Harga dikalkulasi otomatis berdasarkan master data hotel dan pax.</p>
              </div>
            )}
          </div>
        );

      case "transportation":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Lokasi Jemput</Label>
                <Input list="transport-from" value={meta.pickupLocation || ""} onChange={(e) => updateMeta("pickupLocation", e.target.value)} placeholder="Contoh: Jeddah Airport" className="mt-1.5 h-9 text-sm" />
                <datalist id="transport-from">
                  {masterTransport.map(t => <option key={t.id + 'f'} value={t.fromLocation} />)}
                </datalist>
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700">Tujuan</Label>
                <Input list="transport-to" value={meta.destinationLocation || ""} onChange={(e) => updateMeta("destinationLocation", e.target.value)} placeholder="Contoh: Hotel Makkah" className="mt-1.5 h-9 text-sm" />
                <datalist id="transport-to">
                  {masterTransport.map(t => <option key={t.id + 't'} value={t.toLocation} />)}
                </datalist>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Tanggal & Waktu</Label>
                <Input type="datetime-local" value={meta.pickupDateTime || ""} onChange={(e) => updateMeta("pickupDateTime", e.target.value)} className="mt-1.5 h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700">Jumlah Penumpang</Label>
                <Input type="number" min="1" value={meta.totalPax || ""} onChange={(e) => updateMeta("totalPax", parseInt(e.target.value) || 0)} className="mt-1.5 h-9 text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700">Jenis Kendaraan</Label>
              <select
                value={meta.vehicleType || ""}
                onChange={(e) => updateMeta("vehicleType", e.target.value)}
                className="mt-1.5 w-full h-9 px-3 text-sm border border-[#e5e7eb] rounded-md bg-white focus:ring-1 focus:ring-[#111111] outline-none"
              >
                <option value="">Pilih</option>
                <option value="sedan">Sedan</option>
                <option value="suv">SUV</option>
                <option value="van">Van</option>
                <option value="hiace">Hiace</option>
                <option value="coaster">Coaster</option>
                <option value="bus">Bus</option>
              </select>
            </div>
            
            {meta.agentPrice !== undefined && meta.agentPrice > 0 && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-md">
                <p className="text-xs text-blue-600 font-semibold mb-1">Estimasi Harga Master (Agent Price)</p>
                <p className="text-lg font-bold text-blue-900">SAR {meta.agentPrice.toLocaleString("id-ID")}</p>
                <p className="text-[10px] text-blue-500 mt-0.5">Harga dikalkulasi otomatis berdasarkan rute transport yang dipilih.</p>
              </div>
            )}
          </div>
        );

      case "muthowif":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Tanggal & Waktu</Label>
                <Input type="datetime-local" value={meta.dateTime || ""} onChange={(e) => updateMeta("dateTime", e.target.value)} className="mt-1.5 h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700">Jumlah Jamaah (Pax)</Label>
                <Input type="number" min="1" value={meta.totalPax || ""} onChange={(e) => updateMeta("totalPax", parseInt(e.target.value) || 0)} className="mt-1.5 h-9 text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700">Acara</Label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {(masterMuthowif.length > 0 ? masterMuthowif.map(m => m.name) : ["Umrah", "Makkah City Tour", "Madinah City Tour"]).map((event: string) => (
                  <button
                    key={event}
                    type="button"
                    onClick={() => {
                      const events = meta.events || [];
                      updateMeta("events", events.includes(event) ? events.filter((e: string) => e !== event) : [...events, event]);
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
                      (meta.events || []).includes(event)
                        ? "bg-purple-100 border-purple-200 text-purple-700"
                        : "bg-white border-[#e5e7eb] text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {event}
                  </button>
                ))}
              </div>
            </div>
            
            {meta.agentPrice !== undefined && meta.agentPrice > 0 && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-md">
                <p className="text-xs text-blue-600 font-semibold mb-1">Estimasi Harga Master (Agent Price)</p>
                <p className="text-lg font-bold text-blue-900">SAR {meta.agentPrice.toLocaleString("id-ID")}</p>
                <p className="text-[10px] text-blue-500 mt-0.5">Harga dikalkulasi otomatis dari layanan muthowif/manasik terpilih.</p>
              </div>
            )}
            
            <div>
              <Label className="text-xs font-semibold text-gray-700">Titik Pertemuan</Label>
              <Input value={meta.meetingPoint || ""} onChange={(e) => updateMeta("meetingPoint", e.target.value)} placeholder="Contoh: Lobby Hotel" className="mt-1.5 h-9 text-sm" />
            </div>
          </div>
        );

      case "visa":
      case "siskopatuh":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Jumlah Orang</Label>
                <Input type="number" min="1" value={meta.totalPeople || ""} onChange={(e) => updateMeta("totalPeople", parseInt(e.target.value) || 0)} className="mt-1.5 h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700">Nama Ketua Rombongan</Label>
                <Input value={meta.groupLeaderName || ""} onChange={(e) => updateMeta("groupLeaderName", e.target.value)} className="mt-1.5 h-9 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Tanggal Keberangkatan</Label>
                <Input type="date" value={meta.departureDate || ""} onChange={(e) => updateMeta("departureDate", e.target.value)} className="mt-1.5 h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700">Tanggal Kepulangan</Label>
                <Input type="date" value={meta.returnDate || ""} onChange={(e) => updateMeta("returnDate", e.target.value)} className="mt-1.5 h-9 text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700">No. HP Ketua Rombongan</Label>
              <Input value={meta.groupLeaderPhone || ""} onChange={(e) => updateMeta("groupLeaderPhone", e.target.value)} placeholder="+62..." className="mt-1.5 h-9 text-sm" />
            </div>
          </div>
        );

      case "custom_la":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Jumlah Jamaah (Pax)</Label>
                <Input type="number" min="1" value={meta.totalPax || ""} onChange={(e) => updateMeta("totalPax", parseInt(e.target.value) || 0)} className="mt-1.5 h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700">Durasi Perjalanan</Label>
                <Input value={meta.duration || ""} onChange={(e) => updateMeta("duration", e.target.value)} placeholder="Contoh: 9 Hari 8 Malam" className="mt-1.5 h-9 text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700">Layanan yang dibutuhkan</Label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {[
                  { key: "needHotel", label: "Hotel" },
                  { key: "needTransport", label: "Transportasi" },
                  { key: "needMuthowif", label: "Muthowif" },
                  { key: "needVisa", label: "Visa" },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => updateMeta(item.key, !meta[item.key])}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                      meta[item.key]
                        ? "bg-[#111111] text-white border-[#111111]"
                        : "bg-white text-gray-600 border-[#e5e7eb] hover:border-gray-300"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-[#111111]">Detail Request — {serviceTypes.find(s => s.value === selectedService)?.label}</h3>
        <p className="text-xs text-gray-500 mt-1">Isi detail kebutuhan layanan Anda</p>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-xs font-semibold text-gray-700">Judul Request *</Label>
          <Input
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Contoh: Hotel Makkah 4 malam untuk 10 pax"
            className="mt-1.5 h-9 text-sm"
          />
        </div>

        {/* Service-specific fields */}
        {renderServiceSpecificFields()}

        <div>
          <Label className="text-xs font-semibold text-gray-700">Catatan / Special Request</Label>
          <textarea
            value={formData.description || ""}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Catatan tambahan atau permintaan khusus..."
            rows={3}
            className="mt-1.5 w-full px-3 py-2 text-sm border border-[#e5e7eb] rounded-md bg-white focus:ring-1 focus:ring-[#111111] outline-none resize-none"
          />
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => {
    const svc = serviceTypes.find(s => s.value === selectedService);
    const meta = formData.meta || {};

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-bold text-[#111111]">Review Request</h3>
          <p className="text-xs text-gray-500 mt-1">Pastikan semua informasi sudah benar sebelum mengirim</p>
        </div>

        <Card className="p-5 border border-[#e5e7eb] rounded-lg shadow-none space-y-4">
          <div className="flex items-center gap-3">
            {svc && <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${svc.color.split(' ')[0]}`}>
              <svc.icon className={`h-5 w-5 ${svc.color.split(' ')[1]}`} />
            </div>}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Layanan</p>
              <p className="text-sm font-bold text-[#111111]">{svc?.label}</p>
            </div>
          </div>

          <div className="border-t border-[#e5e7eb] pt-4 space-y-3">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Judul</p>
              <p className="text-sm text-[#111111] font-medium">{formData.title || "-"}</p>
            </div>

            {formData.description && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Catatan</p>
                <p className="text-xs text-gray-600">{formData.description}</p>
              </div>
            )}

            {/* Show meta details */}
            {Object.entries(meta).filter(([_, v]) => v).length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Detail</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(meta).filter(([_, v]) => v && typeof v !== 'object').map(([key, value]) => (
                    <div key={key} className="text-xs">
                      <span className="text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}: </span>
                      <span className="text-[#111111] font-medium">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  };

  return (
    <AgentPageLayout title="Buat Request Baru" subtitle="Buat permintaan layanan baru" showBackButton>
      <div className="max-w-3xl mx-auto">
        {renderStepIndicator()}

        <Card className="p-6 border border-[#e5e7eb] rounded-lg shadow-none">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-4 border-t border-[#e5e7eb]">
            <div>
              {step > 1 && (
                <Button variant="outline" size="sm" onClick={() => setStep(step - 1)} className="h-9 px-4 text-xs font-semibold border-[#e5e7eb] rounded-md">
                  <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                  Kembali
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {step === 3 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSubmit(true)}
                  disabled={submitting}
                  className="h-9 px-4 text-xs font-semibold border-[#e5e7eb] rounded-md"
                >
                  {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                  Simpan Draft
                </Button>
              )}
              {step < 3 ? (
                <Button
                  size="sm"
                  onClick={() => {
                    if (step === 1 && !selectedService) {
                      toast.error("Pilih jenis layanan terlebih dahulu");
                      return;
                    }
                    if (step === 2 && !formData.title) {
                      toast.error("Judul request wajib diisi");
                      return;
                    }
                    setStep(step + 1);
                  }}
                  className="h-9 px-4 text-xs font-semibold bg-[#111111] hover:bg-[#242424] text-white rounded-md"
                >
                  Lanjut
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => handleSubmit(false)}
                  disabled={submitting}
                  className="h-9 px-4 text-xs font-semibold bg-[#111111] hover:bg-[#242424] text-white rounded-md"
                >
                  {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
                  Kirim Request
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </AgentPageLayout>
  );
}
