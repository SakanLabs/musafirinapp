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
    <PageLayout title="Buat Pesanan Visa">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: "/service-orders" })}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Kembali
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Buat Pesanan Visa</h1>
              <p className="text-gray-600">Buat pesanan layanan visa umrah atau SISKOPATUH</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Users className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold">Informasi Client & Produk</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client *
                </label>
                <select
                  value={selectedClientId}
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
                  Jenis Produk *
                </label>
                <select
                  value={formData.productType}
                  onChange={(e) => handleInputChange("productType", e.target.value as ProductType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="visa_umrah">Visa Umrah</option>
                  <option value="siskopatuh">SISKOPATUH</option>
                </select>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Users className="h-5 w-5 text-green-600" />
              <h2 className="text-lg font-semibold">Informasi Pemesan</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Ketua Rombongan *
                </label>
                <Input
                  value={formData.groupLeaderName}
                  onChange={(e) => handleInputChange("groupLeaderName", e.target.value)}
                  placeholder="Masukkan nama ketua rombongan"
                />
                {errors.groupLeaderName && <p className="text-red-500 text-sm mt-1">{errors.groupLeaderName}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nomor Telepon Ketua Rombongan *
                </label>
                <Input
                  value={formData.groupLeaderPhone}
                  onChange={(e) => handleInputChange("groupLeaderPhone", e.target.value)}
                  placeholder="Masukkan nomor telepon ketua rombongan"
                  type="tel"
                />
                {errors.groupLeaderPhone && <p className="text-red-500 text-sm mt-1">{errors.groupLeaderPhone}</p>}
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Users className="h-5 w-5 text-purple-600" />
              <h2 className="text-lg font-semibold">Informasi Jamaah & Harga</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Jumlah Jamaah *
                </label>
                <Input
                  type="number"
                  min="1"
                  value={formData.totalPeople}
                  onChange={(e) => handleInputChange("totalPeople", parseInt(e.target.value) || 1)}
                  placeholder="1"
                />
                {errors.totalPeople && <p className="text-red-500 text-sm mt-1">{errors.totalPeople}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Harga per Jamaah (USD) *
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.unitPriceUSD}
                  onChange={(e) => handleInputChange("unitPriceUSD", parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
                {errors.unitPriceUSD && <p className="text-red-500 text-sm mt-1">{errors.unitPriceUSD}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Harga (USD)
                </label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-gray-700 font-medium">
                  ${totalPriceUSD.toFixed(2)}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Calendar className="h-5 w-5 text-orange-600" />
              <h2 className="text-lg font-semibold">Tanggal Perjalanan</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tanggal Keberangkatan *
                </label>
                <Input
                  type="date"
                  value={formData.departureDate}
                  onChange={(e) => handleInputChange("departureDate", e.target.value)}
                />
                {errors.departureDate && <p className="text-red-500 text-sm mt-1">{errors.departureDate}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tanggal Kepulangan *
                </label>
                <Input
                  type="date"
                  value={formData.returnDate}
                  onChange={(e) => handleInputChange("returnDate", e.target.value)}
                />
                {errors.returnDate && <p className="text-red-500 text-sm mt-1">{errors.returnDate}</p>}
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Plane className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold">Catatan Tambahan</h2>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Catatan (Opsional)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleInputChange("notes", e.target.value)}
                placeholder="Masukkan catatan tambahan jika ada..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </Card>

          {/* HOTEL MAKKAH */}
          <Card className="p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Building className="h-5 w-5 text-amber-600" />
              <h2 className="text-lg font-semibold">Hotel Makkah</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Hotel</label>
                <Input
                  value={formData.meta?.hotelMakkah?.name || ""}
                  onChange={(e) => handleMetaChange("hotelMakkah", "name", e.target.value)}
                  placeholder="Nama Hotel Makkah"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Check-in</label>
                <Input
                  type="date"
                  value={formData.meta?.hotelMakkah?.checkIn || ""}
                  onChange={(e) => handleMetaChange("hotelMakkah", "checkIn", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Check-out</label>
                <Input
                  type="date"
                  value={formData.meta?.hotelMakkah?.checkOut || ""}
                  onChange={(e) => handleMetaChange("hotelMakkah", "checkOut", e.target.value)}
                />
              </div>
            </div>
          </Card>

          {/* HOTEL MADINAH */}
          <Card className="p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Building className="h-5 w-5 text-emerald-600" />
              <h2 className="text-lg font-semibold">Hotel Madinah</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Hotel</label>
                <Input
                  value={formData.meta?.hotelMadinah?.name || ""}
                  onChange={(e) => handleMetaChange("hotelMadinah", "name", e.target.value)}
                  placeholder="Nama Hotel Madinah"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Check-in</label>
                <Input
                  type="date"
                  value={formData.meta?.hotelMadinah?.checkIn || ""}
                  onChange={(e) => handleMetaChange("hotelMadinah", "checkIn", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Check-out</label>
                <Input
                  type="date"
                  value={formData.meta?.hotelMadinah?.checkOut || ""}
                  onChange={(e) => handleMetaChange("hotelMadinah", "checkOut", e.target.value)}
                />
              </div>
            </div>
          </Card>

          {/* TRANSPORTATION */}
          <Card className="p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Car className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold">Transportasi</h2>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div className="font-medium text-gray-700">1. Airport - Hotel</div>
                <select
                  value={formData.meta?.transportation?.route1Vehicle || ""}
                  onChange={(e) => handleMetaChange("transportation", "route1Vehicle", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <div className="font-medium text-gray-700">2. City - City</div>
                <select
                  value={formData.meta?.transportation?.route2Vehicle || ""}
                  onChange={(e) => handleMetaChange("transportation", "route2Vehicle", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <div className="font-medium text-gray-700">3. Hotel - Airport</div>
                <select
                  value={formData.meta?.transportation?.route3Vehicle || ""}
                  onChange={(e) => handleMetaChange("transportation", "route3Vehicle", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-indigo-600" />
                <h2 className="text-lg font-semibold">Data Jamaah</h2>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addJamaah}>
                <Plus className="h-4 w-4 mr-2" />
                Tambah Jamaah
              </Button>
            </div>
            
            {(!formData.meta?.jamaah || formData.meta.jamaah.length === 0) ? (
              <p className="text-gray-500 text-sm text-center py-4">Belum ada data jamaah. Silakan tambahkan.</p>
            ) : (
              <div className="space-y-4">
                {formData.meta.jamaah.map((j, index) => (
                  <div key={index} className="flex flex-col md:flex-row gap-4 items-start md:items-end border p-4 rounded-md relative group">
                    <div className="flex-1 w-full">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Nama</label>
                      <Input value={j.name} onChange={e => updateJamaah(index, "name", e.target.value)} placeholder="Nama Sesuai Paspor" />
                    </div>
                    <div className="flex-1 w-full">
                      <label className="block text-xs font-medium text-gray-700 mb-1">No. Paspor</label>
                      <Input value={j.passportNo} onChange={e => updateJamaah(index, "passportNo", e.target.value)} placeholder="A1234567" />
                    </div>
                    <div className="w-full md:w-32">
                      <label className="block text-xs font-medium text-gray-700 mb-1">L/P</label>
                      <select
                        value={j.gender}
                        onChange={e => updateJamaah(index, "gender", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-10"
                      >
                        <option value="L">Laki-laki</option>
                        <option value="P">Perempuan</option>
                      </select>
                    </div>
                    <Button 
                      type="button" 
                      variant="destructive" 
                      size="icon" 
                      className="shrink-0"
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
          <Card className="p-6">
            <div className="flex items-center space-x-2 mb-4">
              <LinkIcon className="h-5 w-5 text-blue-500" />
              <h2 className="text-lg font-semibold">Link Dokumen (Google Drive)</h2>
            </div>
            
            <div>
              <Input
                type="url"
                value={formData.meta?.googleDriveLink || ""}
                onChange={(e) => handleDriveLinkChange(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/..."
              />
              <p className="text-xs text-gray-500 mt-1">Masukkan link folder Google Drive yang berisi scan paspor, KTP, KK, dll.</p>
            </div>
          </Card>

          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate({ to: "/service-orders" })}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={createServiceOrderMutation.isPending}
            >
              {createServiceOrderMutation.isPending ? (
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