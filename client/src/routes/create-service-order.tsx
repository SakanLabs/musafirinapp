import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
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
  Plane,
  Building,
  Car,
  Link as LinkIcon,
  Plus,
  Trash2
} from "lucide-react"
import { authService } from "@/lib/auth"
import { useCreateServiceOrder, type CreateServiceOrderData, type ProductType, type VisaMeta } from "@/lib/queries/serviceOrders"
import { useClients } from "@/lib/queries"

export const Route = createFileRoute("/create-service-order")({ 
  beforeLoad: async () => {
    const isAuthenticated = await authService.isAuthenticated()
    
    if (!isAuthenticated) {
      throw redirect({ to: "/login" })
    }
  },
  component: CreateServiceOrderPage
})

function CreateServiceOrderPage() {
  const navigate = useNavigate()
  const createServiceOrderMutation = useCreateServiceOrder()
  const { data: clients = [], isLoading: isClientsLoading } = useClients()
  const [selectedClientId, setSelectedClientId] = useState("")
  
  const [formData, setFormData] = useState({
    clientId: 0,
    productType: "visa_umrah" as ProductType,
    groupLeaderName: "",
    groupLeaderPhone: "",
    totalPeople: 1,
    unitPriceUSD: 0,
    departureDate: "",
    returnDate: "",
    notes: "",
    meta: {
      hotelMakkah: { name: "", checkIn: "", checkOut: "" },
      hotelMadinah: { name: "", checkIn: "", checkOut: "" },
      transportation: {
        route1: "Airport - Hotel",
        route1Vehicle: "",
        route2: "City - City",
        route2Vehicle: "",
        route3: "Hotel - Airport",
        route3Vehicle: ""
      },
      jamaah: [],
      googleDriveLink: ""
    } as VisaMeta
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.clientId) newErrors.clientId = "Client harus dipilih"
    if (!formData.groupLeaderName.trim()) newErrors.groupLeaderName = "Nama ketua rombongan harus diisi"
    if (!formData.groupLeaderPhone.trim()) newErrors.groupLeaderPhone = "Nomor telepon ketua rombongan harus diisi"
    if (formData.totalPeople < 1) newErrors.totalPeople = "Jumlah jamaah minimal 1"
    if (formData.unitPriceUSD <= 0) newErrors.unitPriceUSD = "Harga per jamaah harus lebih dari 0"
    if (!formData.departureDate) newErrors.departureDate = "Tanggal keberangkatan harus diisi"
    if (!formData.returnDate) newErrors.returnDate = "Tanggal kepulangan harus diisi"
    
    if (formData.departureDate && formData.returnDate) {
      const departure = new Date(formData.departureDate)
      const returnDate = new Date(formData.returnDate)
      if (returnDate <= departure) {
        newErrors.returnDate = "Tanggal kepulangan harus setelah tanggal keberangkatan"
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    try {
      const serviceOrderData: CreateServiceOrderData = {
        clientId: formData.clientId,
        productType: formData.productType,
        groupLeaderName: formData.groupLeaderName,
        groupLeaderPhone: formData.groupLeaderPhone,
        totalPeople: formData.totalPeople,
        unitPriceUSD: formData.unitPriceUSD,
        departureDate: formData.departureDate,
        returnDate: formData.returnDate,
        notes: formData.notes || undefined,
        meta: formData.meta
      }

      await createServiceOrderMutation.mutateAsync(serviceOrderData)
      navigate({ to: "/service-orders" })
    } catch (error) {
      console.error("Error creating service order:", error)
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
    setSelectedClientId(clientId)
    handleInputChange("clientId", id)
  }

  const handleMetaChange = (section: keyof VisaMeta, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      meta: {
        ...prev.meta,
        [section]: {
          ...(prev.meta?.[section] as any),
          [field]: value
        }
      }
    }))
  }

  const handleDriveLinkChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      meta: {
        ...prev.meta,
        googleDriveLink: value
      }
    }))
  }

  const addJamaah = () => {
    setFormData(prev => ({
      ...prev,
      meta: {
        ...prev.meta,
        jamaah: [...(prev.meta?.jamaah || []), { name: "", passportNo: "", gender: "L" }]
      }
    }))
  }

  const updateJamaah = (index: number, field: string, value: string) => {
    setFormData(prev => {
      const newJamaah = [...(prev.meta?.jamaah || [])]
      newJamaah[index] = { ...newJamaah[index], [field]: value }
      return {
        ...prev,
        meta: { ...prev.meta, jamaah: newJamaah }
      }
    })
  }

  const removeJamaah = (index: number) => {
    setFormData(prev => {
      const newJamaah = [...(prev.meta?.jamaah || [])]
      newJamaah.splice(index, 1)
      return {
        ...prev,
        meta: { ...prev.meta, jamaah: newJamaah }
      }
    })
  }

  const totalPriceUSD = formData.totalPeople * formData.unitPriceUSD

  return (
    <PageLayout
      title="Buat Pesanan Visa"
      subtitle="Buat pesanan layanan visa umrah atau SISKOPATUH"
      actions={
        <Button
          variant="outline"
          onClick={() => navigate({ to: "/service-orders" })}
          className="h-9 px-4 border-[#e5e7eb] hover:bg-gray-50 text-gray-700 font-medium rounded-md flex items-center space-x-1.5 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Kembali</span>
        </Button>
      }
    >
      <div className="max-w-3xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Client & Product Info */}
          <Card className="p-6 border border-[#e5e7eb] rounded-xl shadow-none bg-white">
            <div className="flex items-center space-x-2 pb-3 mb-5 border-b border-gray-100">
              <Users className="h-4 w-4 text-gray-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Informasi Client & Produk</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                  Client *
                </label>
                <select
                  value={selectedClientId}
                  onChange={(e) => handleClientChange(e.target.value)}
                  className="h-10 w-full px-3 border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] focus-visible:ring-[#111111] focus-visible:border-[#111111] focus-visible:ring-offset-0 focus-visible:ring-1 bg-white text-sm transition-colors"
                  disabled={isClientsLoading}
                >
                  <option value="">Pilih Client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
                {errors.clientId && <p className="text-red-600 text-xs font-medium mt-1">{errors.clientId}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                  Jenis Produk *
                </label>
                <select
                  value={formData.productType}
                  onChange={(e) => handleInputChange("productType", e.target.value as ProductType)}
                  className="h-10 w-full px-3 border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] focus-visible:ring-[#111111] focus-visible:border-[#111111] focus-visible:ring-offset-0 focus-visible:ring-1 bg-white text-sm transition-colors"
                >
                  <option value="visa_umrah">Visa Umrah</option>
                  <option value="siskopatuh">SISKOPATUH</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Group Leader Info */}
          <Card className="p-6 border border-[#e5e7eb] rounded-xl shadow-none bg-white">
            <div className="flex items-center space-x-2 pb-3 mb-5 border-b border-gray-100">
              <Users className="h-4 w-4 text-gray-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Informasi Pemesan</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                  Nama Ketua Rombongan *
                </label>
                <Input
                  value={formData.groupLeaderName}
                  onChange={(e) => handleInputChange("groupLeaderName", e.target.value)}
                  placeholder="Masukkan nama ketua rombongan"
                  className="h-10 px-3 border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] focus-visible:ring-[#111111] focus-visible:border-[#111111] focus-visible:ring-offset-0 focus-visible:ring-1 bg-white"
                />
                {errors.groupLeaderName && <p className="text-red-600 text-xs font-medium mt-1">{errors.groupLeaderName}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                  Nomor Telepon Ketua Rombongan *
                </label>
                <Input
                  value={formData.groupLeaderPhone}
                  onChange={(e) => handleInputChange("groupLeaderPhone", e.target.value)}
                  placeholder="Masukkan nomor telepon ketua rombongan"
                  type="tel"
                  className="h-10 px-3 border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] focus-visible:ring-[#111111] focus-visible:border-[#111111] focus-visible:ring-offset-0 focus-visible:ring-1 bg-white"
                />
                {errors.groupLeaderPhone && <p className="text-red-600 text-xs font-medium mt-1">{errors.groupLeaderPhone}</p>}
              </div>
            </div>
          </Card>

          {/* Jamaah count & Pricing */}
          <Card className="p-6 border border-[#e5e7eb] rounded-xl shadow-none bg-white">
            <div className="flex items-center space-x-2 pb-3 mb-5 border-b border-gray-100">
              <Users className="h-4 w-4 text-gray-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Informasi Jamaah & Harga</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                  Jumlah Jamaah *
                </label>
                <Input
                  type="number"
                  min="1"
                  value={formData.totalPeople}
                  onChange={(e) => handleInputChange("totalPeople", parseInt(e.target.value) || 1)}
                  placeholder="1"
                  className="h-10 px-3 border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] focus-visible:ring-[#111111] focus-visible:border-[#111111] focus-visible:ring-offset-0 focus-visible:ring-1 bg-white"
                />
                {errors.totalPeople && <p className="text-red-600 text-xs font-medium mt-1">{errors.totalPeople}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                  Harga per Jamaah (USD) *
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.unitPriceUSD}
                  onChange={(e) => handleInputChange("unitPriceUSD", parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="h-10 px-3 border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] focus-visible:ring-[#111111] focus-visible:border-[#111111] focus-visible:ring-offset-0 focus-visible:ring-1 bg-white font-mono"
                />
                {errors.unitPriceUSD && <p className="text-red-600 text-xs font-medium mt-1">{errors.unitPriceUSD}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                  Total Harga (USD)
                </label>
                <div className="h-10 flex items-center px-3 bg-[#f9fafb] border border-[#e5e7eb] rounded-md text-[#111111] font-semibold font-mono text-sm shadow-inner">
                  ${totalPriceUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </Card>

          {/* Travel Dates */}
          <Card className="p-6 border border-[#e5e7eb] rounded-xl shadow-none bg-white">
            <div className="flex items-center space-x-2 pb-3 mb-5 border-b border-gray-100">
              <Calendar className="h-4 w-4 text-gray-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Tanggal Perjalanan</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                  Tanggal Keberangkatan *
                </label>
                <Input
                  type="date"
                  value={formData.departureDate}
                  onChange={(e) => handleInputChange("departureDate", e.target.value)}
                  className="h-10 px-3 border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] focus-visible:ring-[#111111] focus-visible:border-[#111111] focus-visible:ring-offset-0 focus-visible:ring-1 bg-white font-mono"
                />
                {errors.departureDate && <p className="text-red-600 text-xs font-medium mt-1">{errors.departureDate}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                  Tanggal Kepulangan *
                </label>
                <Input
                  type="date"
                  value={formData.returnDate}
                  onChange={(e) => handleInputChange("returnDate", e.target.value)}
                  className="h-10 px-3 border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] focus-visible:ring-[#111111] focus-visible:border-[#111111] focus-visible:ring-offset-0 focus-visible:ring-1 bg-white font-mono"
                />
                {errors.returnDate && <p className="text-red-600 text-xs font-medium mt-1">{errors.returnDate}</p>}
              </div>
            </div>
          </Card>

          {/* Notes */}
          <Card className="p-6 border border-[#e5e7eb] rounded-xl shadow-none bg-white">
            <div className="flex items-center space-x-2 pb-3 mb-5 border-b border-gray-100">
              <Plane className="h-4 w-4 text-gray-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Catatan Tambahan</h2>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                Catatan (Opsional)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleInputChange("notes", e.target.value)}
                placeholder="Masukkan catatan tambahan jika ada..."
                rows={3}
                className="w-full px-3 py-2 border border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] focus-visible:ring-[#111111] focus-visible:border-[#111111] focus-visible:ring-offset-0 focus-visible:ring-1 bg-white text-sm"
              />
            </div>
          </Card>

          {/* HOTEL MAKKAH */}
          <Card className="p-6 border border-[#e5e7eb] rounded-xl shadow-none bg-white">
            <div className="flex items-center space-x-2 pb-3 mb-5 border-b border-gray-100">
              <Building className="h-4 w-4 text-gray-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Hotel Makkah</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 block">Nama Hotel</label>
                <Input
                  value={formData.meta?.hotelMakkah?.name || ""}
                  onChange={(e) => handleMetaChange("hotelMakkah", "name", e.target.value)}
                  placeholder="Nama Hotel Makkah"
                  className="h-10 px-3 border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 block">Check-in</label>
                <Input
                  type="date"
                  value={formData.meta?.hotelMakkah?.checkIn || ""}
                  onChange={(e) => handleMetaChange("hotelMakkah", "checkIn", e.target.value)}
                  className="h-10 px-3 border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] bg-white font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 block">Check-out</label>
                <Input
                  type="date"
                  value={formData.meta?.hotelMakkah?.checkOut || ""}
                  onChange={(e) => handleMetaChange("hotelMakkah", "checkOut", e.target.value)}
                  className="h-10 px-3 border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] bg-white font-mono"
                />
              </div>
            </div>
          </Card>

          {/* HOTEL MADINAH */}
          <Card className="p-6 border border-[#e5e7eb] rounded-xl shadow-none bg-white">
            <div className="flex items-center space-x-2 pb-3 mb-5 border-b border-gray-100">
              <Building className="h-4 w-4 text-gray-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Hotel Madinah</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 block">Nama Hotel</label>
                <Input
                  value={formData.meta?.hotelMadinah?.name || ""}
                  onChange={(e) => handleMetaChange("hotelMadinah", "name", e.target.value)}
                  placeholder="Nama Hotel Madinah"
                  className="h-10 px-3 border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 block">Check-in</label>
                <Input
                  type="date"
                  value={formData.meta?.hotelMadinah?.checkIn || ""}
                  onChange={(e) => handleMetaChange("hotelMadinah", "checkIn", e.target.value)}
                  className="h-10 px-3 border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] bg-white font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 block">Check-out</label>
                <Input
                  type="date"
                  value={formData.meta?.hotelMadinah?.checkOut || ""}
                  onChange={(e) => handleMetaChange("hotelMadinah", "checkOut", e.target.value)}
                  className="h-10 px-3 border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] bg-white font-mono"
                />
              </div>
            </div>
          </Card>

          {/* TRANSPORTATION */}
          <Card className="p-6 border border-[#e5e7eb] rounded-xl shadow-none bg-white">
            <div className="flex items-center space-x-2 pb-3 mb-5 border-b border-gray-100">
              <Car className="h-4 w-4 text-gray-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Transportasi</h2>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div className="text-sm font-semibold text-gray-700">1. Airport - Hotel</div>
                <select
                  value={formData.meta?.transportation?.route1Vehicle || ""}
                  onChange={(e) => handleMetaChange("transportation", "route1Vehicle", e.target.value)}
                  className="h-10 w-full px-3 border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] focus-visible:ring-[#111111] focus-visible:border-[#111111] focus-visible:ring-offset-0 focus-visible:ring-1 bg-white text-sm transition-colors"
                >
                  <option value="">Pilih Kendaraan</option>
                  <option value="Sedan">Sedan</option>
                  <option value="Staria">Staria</option>
                  <option value="Hiace">Hiace</option>
                  <option value="GMC">GMC</option>
                  <option value="Coaster">Coaster</option>
                  <option value="Bus">Bus</option>
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div className="text-sm font-semibold text-gray-700">2. City - City</div>
                <select
                  value={formData.meta?.transportation?.route2Vehicle || ""}
                  onChange={(e) => handleMetaChange("transportation", "route2Vehicle", e.target.value)}
                  className="h-10 w-full px-3 border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] focus-visible:ring-[#111111] focus-visible:border-[#111111] focus-visible:ring-offset-0 focus-visible:ring-1 bg-white text-sm transition-colors"
                >
                  <option value="">Pilih Kendaraan</option>
                  <option value="Sedan">Sedan</option>
                  <option value="Staria">Staria</option>
                  <option value="Hiace">Hiace</option>
                  <option value="GMC">GMC</option>
                  <option value="Coaster">Coaster</option>
                  <option value="Bus">Bus</option>
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div className="text-sm font-semibold text-gray-700">3. Hotel - Airport</div>
                <select
                  value={formData.meta?.transportation?.route3Vehicle || ""}
                  onChange={(e) => handleMetaChange("transportation", "route3Vehicle", e.target.value)}
                  className="h-10 w-full px-3 border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] focus-visible:ring-[#111111] focus-visible:border-[#111111] focus-visible:ring-offset-0 focus-visible:ring-1 bg-white text-sm transition-colors"
                >
                  <option value="">Pilih Kendaraan</option>
                  <option value="Sedan">Sedan</option>
                  <option value="Staria">Staria</option>
                  <option value="Hiace">Hiace</option>
                  <option value="GMC">GMC</option>
                  <option value="Coaster">Coaster</option>
                  <option value="Bus">Bus</option>
                </select>
              </div>
            </div>
          </Card>

          {/* JAMAAH DETAILS */}
          <Card className="p-6 border border-[#e5e7eb] rounded-xl shadow-none bg-white">
            <div className="flex items-center justify-between pb-3 mb-5 border-b border-gray-100">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-gray-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Data Jamaah</h2>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addJamaah}
                className="h-8 px-3 border-[#e5e7eb] hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-md transition-colors flex items-center space-x-1"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Tambah Jamaah</span>
              </Button>
            </div>
            
            {(!formData.meta?.jamaah || formData.meta.jamaah.length === 0) ? (
              <p className="text-gray-400 text-sm text-center py-6">Belum ada data jamaah. Silakan tambahkan.</p>
            ) : (
              <div className="space-y-4">
                {formData.meta.jamaah.map((j, index) => (
                  <div key={index} className="flex flex-col md:flex-row gap-4 items-start md:items-end bg-[#f9fafb] border border-[#e5e7eb] p-4 rounded-xl relative group transition-colors hover:border-gray-300">
                    <div className="flex-1 w-full space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Nama Lengkap</label>
                      <Input
                        value={j.name}
                        onChange={e => updateJamaah(index, "name", e.target.value)}
                        placeholder="Nama Sesuai Paspor"
                        className="h-10 px-3 border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] bg-white w-full"
                      />
                    </div>
                    <div className="flex-1 w-full space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">No. Paspor</label>
                      <Input
                        value={j.passportNo}
                        onChange={e => updateJamaah(index, "passportNo", e.target.value)}
                        placeholder="A1234567"
                        className="h-10 px-3 border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] bg-white font-mono w-full"
                      />
                    </div>
                    <div className="w-full md:w-44 space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">L/P</label>
                      <select
                        value={j.gender}
                        onChange={e => updateJamaah(index, "gender", e.target.value)}
                        className="h-10 w-full px-3 border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] bg-white text-sm"
                      >
                        <option value="L">Laki-laki</option>
                        <option value="P">Perempuan</option>
                      </select>
                    </div>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="shrink-0 h-10 w-10 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md border border-[#e5e7eb] bg-white transition-colors flex items-center justify-center"
                      onClick={() => removeJamaah(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* GOOGLE DRIVE LINK */}
          <Card className="p-6 border border-[#e5e7eb] rounded-xl shadow-none bg-white">
            <div className="flex items-center space-x-2 pb-3 mb-5 border-b border-gray-100">
              <LinkIcon className="h-4 w-4 text-gray-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Link Dokumen (Google Drive)</h2>
            </div>
            
            <div className="space-y-1.5">
              <Input
                type="url"
                value={formData.meta?.googleDriveLink || ""}
                onChange={(e) => handleDriveLinkChange(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/..."
                className="h-10 px-3 border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] bg-white font-mono"
              />
              <p className="text-xs text-gray-400 mt-1">Masukkan link folder Google Drive yang berisi scan paspor, KTP, KK, dll.</p>
            </div>
          </Card>

          {/* Buttons */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-[#e5e7eb] mt-8">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate({ to: "/service-orders" })}
              className="h-10 px-5 border-[#e5e7eb] hover:bg-gray-50 text-gray-700 font-semibold rounded-md transition-colors"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={createServiceOrderMutation.isPending}
              className="h-10 px-6 bg-[#111111] hover:bg-[#242424] text-white font-semibold rounded-md transition-colors border border-transparent shadow-sm flex items-center justify-center min-w-[140px]"
            >
              {createServiceOrderMutation.isPending ? (
                <>
                  <Loader2 className="h-4.5 w-4.5 mr-2 animate-spin animate-spin" />
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