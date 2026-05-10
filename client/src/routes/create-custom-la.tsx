import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { 
  Users,
  Calendar,
  Save,
  ArrowLeft,
  Loader2,
  Package,
  DollarSign
} from "lucide-react"
import { authService } from "@/lib/auth"
import { useCreateCustomLaRequest, useHotels, useTransportRoutes } from "@/lib/queries"
import { useClients } from "@/lib/queries"
import { apiClient } from "@/lib/api"
import { toast } from "sonner"

export const Route = createFileRoute("/create-custom-la")({ 
  beforeLoad: async () => {
    const isAuthenticated = await authService.isAuthenticated()
    
    if (!isAuthenticated) {
      throw redirect({ to: "/login" })
    }
  },
  component: CreateCustomLaPage
})

function CreateCustomLaPage() {
  const navigate = useNavigate()
  const createLaMutation = useCreateCustomLaRequest()
  const { data: clients = [], isLoading: isClientsLoading } = useClients()
  const { data: hotels = [], isLoading: isHotelsLoading } = useHotels()
  const { data: transportRoutes = [], isLoading: isTransportLoading } = useTransportRoutes()
  
  const [formData, setFormData] = useState({
    clientId: 0,
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    travelName: "",
    totalPax: 1,
    makkahHotelId: 0,
    makkahHotelTotal: 0,
    makkahNights: 0,
    makkahDoubleQty: 0,
    makkahDoublePrice: 0,
    makkahTripleQty: 0,
    makkahTriplePrice: 0,
    makkahQuadQty: 0,
    makkahQuadPrice: 0,
    madinahHotelId: 0,
    madinahHotelTotal: 0,
    madinahNights: 0,
    madinahDoubleQty: 0,
    madinahDoublePrice: 0,
    madinahTripleQty: 0,
    madinahTriplePrice: 0,
    madinahQuadQty: 0,
    madinahQuadPrice: 0,
    transportRouteId: 0,
    totalTransport: 0,
    includeVisa: false,
    visaTotal: 0,
    handlingAirport: 0,
    handlingHotel: 0,
    muthowif: 0,
    muthowifahRaudhah: 0,
    tiketMuseum: 0,
    biayaTakTerduga: 0,
    tipDriver: 0,
    keretaCepat: 0,
    profitType: "percentage",
    profitValue: 0,
    kedatangan: "",
    keberangkatan: "",
    notes: ""
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const makkahRoomsTotalPerNight = (formData.makkahDoubleQty * formData.makkahDoublePrice) + 
                                     (formData.makkahTripleQty * formData.makkahTriplePrice) + 
                                     (formData.makkahQuadQty * formData.makkahQuadPrice);
    const makkahTotal = makkahRoomsTotalPerNight * formData.makkahNights;
    
    if (makkahTotal >= 0 && (makkahRoomsTotalPerNight > 0 || formData.makkahNights > 0)) {
      setFormData(prev => ({ ...prev, makkahHotelTotal: makkahTotal }));
    }
  }, [formData.makkahDoubleQty, formData.makkahDoublePrice, formData.makkahTripleQty, formData.makkahTriplePrice, formData.makkahQuadQty, formData.makkahQuadPrice, formData.makkahNights]);

  useEffect(() => {
    const madinahRoomsTotalPerNight = (formData.madinahDoubleQty * formData.madinahDoublePrice) + 
                                      (formData.madinahTripleQty * formData.madinahTriplePrice) + 
                                      (formData.madinahQuadQty * formData.madinahQuadPrice);
    const madinahTotal = madinahRoomsTotalPerNight * formData.madinahNights;
    
    if (madinahTotal >= 0 && (madinahRoomsTotalPerNight > 0 || formData.madinahNights > 0)) {
      setFormData(prev => ({ ...prev, madinahHotelTotal: madinahTotal }));
    }
  }, [formData.madinahDoubleQty, formData.madinahDoublePrice, formData.madinahTripleQty, formData.madinahTriplePrice, formData.madinahQuadQty, formData.madinahQuadPrice, formData.madinahNights]);

  const getDuration = (start: string, end: string) => {
    if (!start || !end) return null;
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return null;
    
    const diffTime = endDate.getTime() - startDate.getTime();
    if (diffTime < 0) return null;

    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    return { nights: diffDays, days: diffDays + 1 };
  };

  const duration = getDuration(formData.kedatangan, formData.keberangkatan);

  const calculateRooms = (pax: number) => {
    let quad = Math.floor(pax / 4);
    let remainder = pax % 4;
    let triple = 0;
    let double = 0;
    
    if (remainder === 3) triple = 1;
    else if (remainder === 2) double = 1;
    else if (remainder === 1) {
      if (quad > 0) {
        quad -= 1;
        triple = 1;
        double = 1;
      } else {
        double = 1;
      }
    }
    return { quad, triple, double };
  };

  const handlePaxChange = (pax: number) => {
    const { quad, triple, double } = calculateRooms(pax);
    setFormData(prev => ({
      ...prev,
      totalPax: pax,
      makkahQuadQty: quad,
      makkahTripleQty: triple,
      makkahDoubleQty: double,
      madinahQuadQty: quad,
      madinahTripleQty: triple,
      madinahDoubleQty: double,
    }));
    if (errors["totalPax"]) {
      setErrors(prev => ({ ...prev, totalPax: "" }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.clientId) newErrors.clientId = "Client harus dipilih"
    if (!formData.customerName.trim()) newErrors.customerName = "Nama PIC harus diisi"
    if (formData.totalPax < 1) newErrors.totalPax = "Jumlah jamaah minimal 1"
    
    if (duration) {
      const totalNights = formData.makkahNights + formData.madinahNights;
      if (totalNights > duration.nights) {
        newErrors.nights = `Total malam Makkah & Madinah (${totalNights}) melebihi durasi tour (${duration.nights} malam)`;
        toast.error(newErrors.nights);
      }
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const fixedServicesTotal = 
    formData.totalTransport + 
    formData.muthowif + 
    formData.muthowifahRaudhah + 
    formData.biayaTakTerduga +
    formData.tipDriver;

  const perPaxServicesTotal = 
    formData.keretaCepat +
    formData.handlingAirport + 
    formData.handlingHotel + 
    formData.tiketMuseum + 
    (formData.includeVisa ? formData.visaTotal : 0);

  const subTotal = 
    formData.makkahHotelTotal + 
    formData.madinahHotelTotal + 
    fixedServicesTotal +
    (perPaxServicesTotal * formData.totalPax);

  const profitAmount = formData.profitType === "percentage" 
    ? subTotal * (formData.profitValue / 100)
    : formData.profitValue;

  const grandTotal = subTotal + profitAmount;
  const perPaxPrice = formData.totalPax > 0 ? grandTotal / formData.totalPax : 0;

  const nonHotelTotal = grandTotal - formData.makkahHotelTotal - formData.madinahHotelTotal;
  const nonHotelPerPax = formData.totalPax > 0 ? nonHotelTotal / formData.totalPax : 0;
  
  const makkahDoublePerPax = (formData.makkahDoublePrice * formData.makkahNights) / 2;
  const madinahDoublePerPax = (formData.madinahDoublePrice * formData.madinahNights) / 2;
  const priceDouble = nonHotelPerPax + makkahDoublePerPax + madinahDoublePerPax;

  const makkahTriplePerPax = (formData.makkahTriplePrice * formData.makkahNights) / 3;
  const madinahTriplePerPax = (formData.madinahTriplePrice * formData.madinahNights) / 3;
  const priceTriple = nonHotelPerPax + makkahTriplePerPax + madinahTriplePerPax;

  const makkahQuadPerPax = (formData.makkahQuadPrice * formData.makkahNights) / 4;
  const madinahQuadPerPax = (formData.madinahQuadPrice * formData.madinahNights) / 4;
  const priceQuad = nonHotelPerPax + makkahQuadPerPax + madinahQuadPerPax;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    try {
      await createLaMutation.mutateAsync({
        clientId: formData.clientId,
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        customerEmail: formData.customerEmail,
        travelName: formData.travelName,
        totalPax: formData.totalPax,
        totalAmountSAR: grandTotal,
        meta: {
          tanggalKedatangan: formData.kedatangan,
          tanggalKeberangkatan: formData.keberangkatan,
          profitType: formData.profitType,
          profitValue: formData.profitValue,
          notes: formData.notes,
          rooms: {
            makkah: { 
              nights: formData.makkahNights,
              doubleQty: formData.makkahDoubleQty, doublePrice: formData.makkahDoublePrice,
              tripleQty: formData.makkahTripleQty, triplePrice: formData.makkahTriplePrice,
              quadQty: formData.makkahQuadQty, quadPrice: formData.makkahQuadPrice 
            },
            madinah: { 
              nights: formData.madinahNights,
              doubleQty: formData.madinahDoubleQty, doublePrice: formData.madinahDoublePrice,
              tripleQty: formData.madinahTripleQty, triplePrice: formData.madinahTriplePrice,
              quadQty: formData.madinahQuadQty, quadPrice: formData.madinahQuadPrice 
            }
          },
          handlingDetails: {
            handlingAirport: formData.handlingAirport,
            handlingHotel: formData.handlingHotel,
            muthowif: formData.muthowif,
            muthowifahRaudhah: formData.muthowifahRaudhah,
            tiketMuseum: formData.tiketMuseum,
            biayaTakTerduga: formData.biayaTakTerduga,
            tipDriver: formData.tipDriver,
            keretaCepat: formData.keretaCepat,
          },
          totals: {
            totalPax: formData.totalPax,
            makkahHotelId: formData.makkahHotelId,
            madinahHotelId: formData.madinahHotelId,
            transportRouteId: formData.transportRouteId,
            makkahHotelTotal: formData.makkahHotelTotal,
            madinahHotelTotal: formData.madinahHotelTotal,
            totalTransport: formData.totalTransport,
            includeVisa: formData.includeVisa,
            visaTotal: formData.visaTotal * formData.totalPax,
            additionalServicesTotal: fixedServicesTotal + (perPaxServicesTotal * formData.totalPax) - formData.totalTransport - (formData.includeVisa ? formData.visaTotal * formData.totalPax : 0),
            subTotalHandling: fixedServicesTotal + (perPaxServicesTotal * formData.totalPax),
            profit: profitAmount,
            grandTotal: grandTotal,
            perPaxPrice: perPaxPrice,
            priceDouble,
            priceTriple,
            priceQuad
          }
        }
      })
      
      toast.success("Permintaan LA berhasil dibuat!")
      navigate({ to: "/custom-la-requests" })
    } catch (error) {
      console.error("Error creating custom LA:", error)
      toast.error("Gagal membuat permintaan LA.")
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }))
    }
  }

  const handleClientChange = (clientId: string) => {
    const id = parseInt(clientId)
    const client = clients.find(c => c.id === id)
    
    if (client) {
      setFormData(prev => ({
        ...prev,
        clientId: id,
        customerName: client.name || prev.customerName,
        customerPhone: client.phone || prev.customerPhone,
        customerEmail: client.email || prev.customerEmail,
      }))
    } else {
      setFormData(prev => ({ ...prev, clientId: id }))
    }
  }

  const handleHotelChange = async (city: 'makkah' | 'madinah', hotelId: string) => {
    const id = parseInt(hotelId);
    setFormData(prev => ({ ...prev, [`${city}HotelId`]: id }));
    
    if (!id) return;
    
    try {
      const response = await apiClient.get<any[]>(`/api/master/hotels/${id}/pricing`);
      if (response && response.length > 0) {
        // Gunakan lowest sellingPrice sebagai baseline untuk Quad, lalu increment untuk Triple dan Double
        const minPrice = Math.min(...response.map(p => parseFloat(p.sellingPrice || '0')));
        setFormData(prev => ({ 
          ...prev, 
          [`${city}QuadPrice`]: minPrice,
          [`${city}TriplePrice`]: minPrice + 50,
          [`${city}DoublePrice`]: minPrice + 100 
        }));
      }
    } catch (e) {
      console.error(`Failed to fetch ${city} hotel pricing:`, e);
    }
  }

  const handleTransportChange = async (routeId: string) => {
    const id = parseInt(routeId);
    setFormData(prev => ({ ...prev, transportRouteId: id }));
    
    if (!id) return;
    
    try {
      const response = await apiClient.get<any[]>(`/api/master/transport-routes/${id}/pricing`);
      if (response && response.length > 0) {
        const minPrice = Math.min(...response.map(p => parseFloat(p.sellingPrice || '0')));
        setFormData(prev => ({ ...prev, totalTransport: minPrice }));
      }
    } catch (e) {
      console.error("Failed to fetch transport pricing:", e);
    }
  }

  const handleVisaToggle = (checked: boolean) => {
    setFormData(prev => ({ 
      ...prev, 
      includeVisa: checked,
      // Default Visa estimate: 650 SAR
      visaTotal: checked ? 650 * prev.totalPax : 0
    }));
  }

  return (
    <PageLayout title="Buat Permintaan LA Custom Secara Manual">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: "/custom-la-requests" })}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Kembali
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Buat Permintaan LA (Manual)</h1>
              <p className="text-gray-600">Buat record permintaan LA untuk di-quote dan diterbitkan invoicenya</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Users className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold">Informasi Client / Pemesan</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pilih Client Terdaftar *
                </label>
                <select
                  value={formData.clientId}
                  onChange={(e) => handleClientChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isClientsLoading}
                >
                  <option value="">Pilih Client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
                {errors.clientId && <p className="text-red-500 text-sm mt-1">{errors.clientId}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama PIC / Travel *
                </label>
                <Input
                  value={formData.customerName}
                  onChange={(e) => handleInputChange("customerName", e.target.value)}
                  placeholder="Nama PIC"
                />
                {errors.customerName && <p className="text-red-500 text-sm mt-1">{errors.customerName}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  No. WhatsApp
                </label>
                <Input
                  value={formData.customerPhone}
                  onChange={(e) => handleInputChange("customerPhone", e.target.value)}
                  placeholder="0812..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <Input
                  value={formData.customerEmail}
                  type="email"
                  onChange={(e) => handleInputChange("customerEmail", e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Package className="h-5 w-5 text-purple-600" />
              <h2 className="text-lg font-semibold">Komponen Biaya & Jadwal</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tanggal Kedatangan
                </label>
                <Input
                  type="date"
                  value={formData.kedatangan}
                  onChange={(e) => handleInputChange("kedatangan", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tanggal Keberangkatan
                </label>
                <Input
                  type="date"
                  value={formData.keberangkatan}
                  onChange={(e) => handleInputChange("keberangkatan", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Jamaah *
                </label>
                <Input
                  type="number"
                  min="1"
                  value={formData.totalPax}
                  onChange={(e) => handlePaxChange(parseInt(e.target.value) || 1)}
                />
              </div>
            </div>
            {duration && (
              <div className="mb-6 space-y-1">
                <div className="px-3 py-2 bg-blue-50 text-blue-700 rounded-md text-sm font-medium inline-block">
                  Total Durasi: {duration.days} Hari {duration.nights} Malam
                </div>
                {errors.nights && <p className="text-red-500 text-sm">{errors.nights}</p>}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="col-span-1 md:col-span-2">
                <div className="flex gap-3 mb-2">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Pilih Hotel Makkah
                    </label>
                    <select
                      value={formData.makkahHotelId}
                      onChange={(e) => handleHotelChange('makkah', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isHotelsLoading}
                    >
                      <option value="">-- Pilih Hotel Makkah --</option>
                      {hotels.filter(h => h.city === 'Makkah').map(hotel => (
                        <option key={hotel.id} value={hotel.id}>{hotel.name} {hotel.starRating ? `(${hotel.starRating}★)` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-24">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Total Malam</label>
                    <Input type="number" min="0" value={formData.makkahNights} onChange={(e) => handleInputChange("makkahNights", parseInt(e.target.value) || 0)} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Qty Double</label>
                    <Input type="number" min="0" value={formData.makkahDoubleQty} onChange={(e) => handleInputChange("makkahDoubleQty", parseInt(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Harga Double (SAR)</label>
                    <Input type="number" min="0" value={formData.makkahDoublePrice} onChange={(e) => handleInputChange("makkahDoublePrice", parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Sub Total Double</label>
                    <Input disabled className="bg-gray-50 font-semibold" value={(formData.makkahDoubleQty * formData.makkahDoublePrice * formData.makkahNights).toLocaleString('en-US')} />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Qty Triple</label>
                    <Input type="number" min="0" value={formData.makkahTripleQty} onChange={(e) => handleInputChange("makkahTripleQty", parseInt(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Harga Triple (SAR)</label>
                    <Input type="number" min="0" value={formData.makkahTriplePrice} onChange={(e) => handleInputChange("makkahTriplePrice", parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Sub Total Triple</label>
                    <Input disabled className="bg-gray-50 font-semibold" value={(formData.makkahTripleQty * formData.makkahTriplePrice * formData.makkahNights).toLocaleString('en-US')} />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Qty Quad</label>
                    <Input type="number" min="0" value={formData.makkahQuadQty} onChange={(e) => handleInputChange("makkahQuadQty", parseInt(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Harga Quad (SAR)</label>
                    <Input type="number" min="0" value={formData.makkahQuadPrice} onChange={(e) => handleInputChange("makkahQuadPrice", parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Sub Total Quad</label>
                    <Input disabled className="bg-gray-50 font-semibold" value={(formData.makkahQuadQty * formData.makkahQuadPrice * formData.makkahNights).toLocaleString('en-US')} />
                  </div>
                </div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Total Harga Makkah (SAR)</label>
                <Input
                  type="number"
                  min="0"
                  value={formData.makkahHotelTotal}
                  onChange={(e) => handleInputChange("makkahHotelTotal", parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="col-span-1 md:col-span-2">
                <div className="flex gap-3 mb-2">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Pilih Hotel Madinah
                    </label>
                    <select
                      value={formData.madinahHotelId}
                      onChange={(e) => handleHotelChange('madinah', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isHotelsLoading}
                    >
                      <option value="">-- Pilih Hotel Madinah --</option>
                      {hotels.filter(h => h.city === 'Madinah').map(hotel => (
                        <option key={hotel.id} value={hotel.id}>{hotel.name} {hotel.starRating ? `(${hotel.starRating}★)` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-24">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Total Malam</label>
                    <Input type="number" min="0" value={formData.madinahNights} onChange={(e) => handleInputChange("madinahNights", parseInt(e.target.value) || 0)} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Qty Double</label>
                    <Input type="number" min="0" value={formData.madinahDoubleQty} onChange={(e) => handleInputChange("madinahDoubleQty", parseInt(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Harga Double (SAR)</label>
                    <Input type="number" min="0" value={formData.madinahDoublePrice} onChange={(e) => handleInputChange("madinahDoublePrice", parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Sub Total Double</label>
                    <Input disabled className="bg-gray-50 font-semibold" value={(formData.madinahDoubleQty * formData.madinahDoublePrice * formData.madinahNights).toLocaleString('en-US')} />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Qty Triple</label>
                    <Input type="number" min="0" value={formData.madinahTripleQty} onChange={(e) => handleInputChange("madinahTripleQty", parseInt(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Harga Triple (SAR)</label>
                    <Input type="number" min="0" value={formData.madinahTriplePrice} onChange={(e) => handleInputChange("madinahTriplePrice", parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Sub Total Triple</label>
                    <Input disabled className="bg-gray-50 font-semibold" value={(formData.madinahTripleQty * formData.madinahTriplePrice * formData.madinahNights).toLocaleString('en-US')} />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Qty Quad</label>
                    <Input type="number" min="0" value={formData.madinahQuadQty} onChange={(e) => handleInputChange("madinahQuadQty", parseInt(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Harga Quad (SAR)</label>
                    <Input type="number" min="0" value={formData.madinahQuadPrice} onChange={(e) => handleInputChange("madinahQuadPrice", parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Sub Total Quad</label>
                    <Input disabled className="bg-gray-50 font-semibold" value={(formData.madinahQuadQty * formData.madinahQuadPrice * formData.madinahNights).toLocaleString('en-US')} />
                  </div>
                </div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Total Harga Madinah (SAR)</label>
                <Input
                  type="number"
                  min="0"
                  value={formData.madinahHotelTotal}
                  onChange={(e) => handleInputChange("madinahHotelTotal", parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pilih Moda Transportasi (Termasuk Kereta)
                </label>
                <select
                  value={formData.transportRouteId}
                  onChange={(e) => handleTransportChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                  disabled={isTransportLoading}
                >
                  <option value="">-- Pilih Transportasi --</option>
                  {transportRoutes.map(route => (
                    <option key={route.id} value={route.id}>{route.originLocation} ➔ {route.destinationLocation}</option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Total Transportasi (SAR) - Fixed</label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.totalTransport}
                      onChange={(e) => handleInputChange("totalTransport", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Kereta Cepat (SAR) - Per Pax</label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.keretaCepat}
                      onChange={(e) => handleInputChange("keretaCepat", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>

              <div className="col-span-1 md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Visa Umroh
                </label>
                <div className="flex items-center space-x-2 mb-2 h-[38px]">
                  <input
                    type="checkbox"
                    id="includeVisa"
                    checked={formData.includeVisa}
                    onChange={(e) => handleVisaToggle(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="includeVisa" className="text-sm text-gray-700">Termasuk Visa</label>
                </div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Visa (SAR) - Per Pax</label>
                <Input
                  type="number"
                  min="0"
                  value={formData.visaTotal}
                  onChange={(e) => handleInputChange("visaTotal", parseFloat(e.target.value) || 0)}
                  disabled={!formData.includeVisa}
                />
              </div>

            </div>

            {/* Handling Tambahan */}
            <div className="mt-6 border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Rincian Handling & Layanan Tambahan (SAR)</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-blue-600 mb-1">Handling Airport (Per Pax)</label>
                  <Input type="number" min="0" value={formData.handlingAirport} onChange={(e) => handleInputChange("handlingAirport", parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-blue-600 mb-1">Handling Hotel (Per Pax)</label>
                  <Input type="number" min="0" value={formData.handlingHotel} onChange={(e) => handleInputChange("handlingHotel", parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-blue-600 mb-1">Tiket Museum (Per Pax)</label>
                  <Input type="number" min="0" value={formData.tiketMuseum} onChange={(e) => handleInputChange("tiketMuseum", parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-amber-600 mb-1">Muthowif (Fixed)</label>
                  <Input type="number" min="0" value={formData.muthowif} onChange={(e) => handleInputChange("muthowif", parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-amber-600 mb-1">Muthowifah Raudhah (Fixed)</label>
                  <Input type="number" min="0" value={formData.muthowifahRaudhah} onChange={(e) => handleInputChange("muthowifahRaudhah", parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-amber-600 mb-1">Tip Driver (Fixed)</label>
                  <Input type="number" min="0" value={formData.tipDriver} onChange={(e) => handleInputChange("tipDriver", parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-amber-600 mb-1">Biaya Tak Terduga (Fixed)</label>
                  <Input type="number" min="0" value={formData.biayaTakTerduga} onChange={(e) => handleInputChange("biayaTakTerduga", parseFloat(e.target.value) || 0)} />
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center space-x-2 mb-4">
              <DollarSign className="h-5 w-5 text-green-600" />
              <h2 className="text-lg font-semibold">Total & Margin</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <div className="flex gap-2 mb-1">
                  <label className="block text-sm font-medium text-gray-700 flex-1">
                    Jenis Profit
                  </label>
                  <label className="block text-sm font-medium text-gray-700 flex-1">
                    Nilai Profit
                  </label>
                </div>
                <div className="flex gap-2 mb-4">
                  <select
                    value={formData.profitType}
                    onChange={(e) => handleInputChange("profitType", e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="percentage">Persentase (%)</option>
                    <option value="fixed">Fix Amount (SAR)</option>
                  </select>
                  <Input
                    type="number"
                    min="0"
                    value={formData.profitValue}
                    onChange={(e) => handleInputChange("profitValue", parseFloat(e.target.value) || 0)}
                    className="flex-1"
                  />
                </div>
                
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Catatan Internal
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleInputChange("notes", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={3}
                />
              </div>

              <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal Modal</span>
                    <span>SAR {subTotal.toLocaleString('en-US')}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>Profit ({formData.profitType === 'percentage' ? `${formData.profitValue}%` : 'Fixed'})</span>
                    <span>+ SAR {profitAmount.toLocaleString('en-US')}</span>
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between font-bold text-lg">
                      <span>GRAND TOTAL</span>
                      <span>SAR {grandTotal.toLocaleString('en-US')}</span>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Sub-Total Non-Hotel / Pax</span>
                      <span>SAR {nonHotelPerPax.toLocaleString('en-US', {maximumFractionDigits:2})}</span>
                    </div>
                    <div className="flex justify-between font-medium text-blue-600">
                      <span>Harga Per Pax (Double)</span>
                      <span>SAR {priceDouble.toLocaleString('en-US', {maximumFractionDigits:2})}</span>
                    </div>
                    <div className="flex justify-between font-medium text-blue-600">
                      <span>Harga Per Pax (Triple)</span>
                      <span>SAR {priceTriple.toLocaleString('en-US', {maximumFractionDigits:2})}</span>
                    </div>
                    <div className="flex justify-between font-medium text-blue-600">
                      <span>Harga Per Pax (Quad)</span>
                      <span>SAR {priceQuad.toLocaleString('en-US', {maximumFractionDigits:2})}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate({ to: "/custom-la-requests" })}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={createLaMutation.isPending}
            >
              {createLaMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Simpan Pesanan
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </PageLayout>
  )
}
