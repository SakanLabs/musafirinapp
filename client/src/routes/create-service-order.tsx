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
import { ClientSearchCombobox } from "@/components/clients/ClientSearchCombobox"

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
    productType: "visa_siskopatuh" as ProductType,
    groupLeaderName: "",
    groupLeaderPhone: "",
    totalPeople: 1,
    unitPriceUSD: 0,
    visaUnitPriceUSD: 0,
    siskopatuhUnitPriceUSD: 0,
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

  const isBundle = formData.productType === "visa_siskopatuh"

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.clientId) newErrors.clientId = "Client harus dipilih"
    if (!formData.groupLeaderName.trim()) newErrors.groupLeaderName = "Nama ketua rombongan harus diisi"
    if (!formData.groupLeaderPhone.trim()) newErrors.groupLeaderPhone = "Nomor telepon ketua rombongan harus diisi"
    if (formData.totalPeople < 1) newErrors.totalPeople = "Jumlah jamaah minimal 1"
    if (isBundle) {
      if (formData.visaUnitPriceUSD <= 0) newErrors.visaUnitPriceUSD = "Harga Visa Umrah per jamaah harus lebih dari 0"
      if (formData.siskopatuhUnitPriceUSD <= 0) newErrors.siskopatuhUnitPriceUSD = "Harga SISKOPATUH per jamaah harus lebih dari 0"
    } else if (formData.unitPriceUSD <= 0) {
      newErrors.unitPriceUSD = "Harga per jamaah harus lebih dari 0"
    }
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
      const effectiveUnitPriceUSD = isBundle
        ? +(formData.visaUnitPriceUSD + formData.siskopatuhUnitPriceUSD).toFixed(2)
        : formData.unitPriceUSD

      const metaToSubmit: VisaMeta = {
        ...formData.meta,
        bundleItems: isBundle
          ? [
              {
                productType: "visa_umrah",
                name: "Visa Umrah",
                description: "Penerbitan Visa Umrah Elektronik",
                pax: formData.totalPeople,
                unitPriceUSD: formData.visaUnitPriceUSD,
                lineTotalUSD: +(formData.visaUnitPriceUSD * formData.totalPeople).toFixed(2),
              },
              {
                productType: "siskopatuh",
                name: "SISKOPATUH",
                description: "Pendaftaran SISKOPATUH",
                pax: formData.totalPeople,
                unitPriceUSD: formData.siskopatuhUnitPriceUSD,
                lineTotalUSD: +(formData.siskopatuhUnitPriceUSD * formData.totalPeople).toFixed(2),
              },
            ]
          : undefined,
      }

      const serviceOrderData: CreateServiceOrderData = {
        clientId: formData.clientId,
        productType: formData.productType,
        groupLeaderName: formData.groupLeaderName,
        groupLeaderPhone: formData.groupLeaderPhone,
        totalPeople: formData.totalPeople,
        unitPriceUSD: effectiveUnitPriceUSD,
        departureDate: formData.departureDate,
        returnDate: formData.returnDate,
        notes: formData.notes || undefined,
        meta: metaToSubmit
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
    setSelectedClientId(clientId)
    handleInputChange("clientId", clientId ? parseInt(clientId) : 0)
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

  const visaSubtotalUSD = formData.totalPeople * formData.visaUnitPriceUSD
  const siskopatuhSubtotalUSD = formData.totalPeople * formData.siskopatuhUnitPriceUSD
  const bundleUnitPriceUSD = formData.visaUnitPriceUSD + formData.siskopatuhUnitPriceUSD
  const totalPriceUSD = isBundle
    ? visaSubtotalUSD + siskopatuhSubtotalUSD
    : formData.totalPeople * formData.unitPriceUSD

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
                <ClientSearchCombobox
                  clients={clients}
                  selectedClientId={selectedClientId}
                  onSelectClient={handleClientChange}
                  isLoading={isClientsLoading}
                  error={Boolean(errors.clientId)}
                  onAddNewClient={() => navigate({ to: "/clients/create", search: { redirectTo: "/create-service-order" } })}
                  className="w-full h-10"
                />
                {errors.clientId && <p className="text-red-600 text-xs font-medium mt-1">{errors.clientId}</p>}
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                  Jenis Produk *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5" role="group" aria-label="Pilih jenis produk">
                  {[
                    { value: "visa_siskopatuh" as ProductType, label: "Visa + SISKOPATUH", hint: "Bundle, 2 item di invoice" },
                    { value: "visa_umrah" as ProductType, label: "Visa Umrah", hint: "Layanan visa saja" },
                    { value: "siskopatuh" as ProductType, label: "SISKOPATUH", hint: "Layanan SISKOPATUH saja" },
                  ].map((option) => {
                    const active = formData.productType === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => handleInputChange("productType", option.value)}
                        className={`min-h-[44px] text-left px-3.5 py-2.5 rounded-lg border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] ${
                          active
                            ? "border-[#111111] bg-[#111111] text-white"
                            : "border-[#e5e7eb] bg-white text-gray-800 hover:bg-gray-50"
                        }`}
                      >
                        <div className="text-sm font-semibold">{option.label}</div>
                        <div className={`text-xs mt-0.5 ${active ? "text-gray-300" : "text-gray-500"}`}>
                          {option.hint}
                        </div>
                      </button>
                    )
                  })}
                </div>
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
            
            {isBundle ? (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="space-y-1.5">
                    <label htmlFor="totalPeople" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                      Jumlah Jamaah (Pax) *
                    </label>
                    <Input
                      id="totalPeople"
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
                    <label htmlFor="visaUnitPriceUSD" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                      Harga Visa Umrah / Pax (USD) *
                    </label>
                    <Input
                      id="visaUnitPriceUSD"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.visaUnitPriceUSD}
                      onChange={(e) => handleInputChange("visaUnitPriceUSD", parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="h-10 px-3 border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] focus-visible:ring-[#111111] focus-visible:border-[#111111] focus-visible:ring-offset-0 focus-visible:ring-1 bg-white font-mono"
                    />
                    {errors.visaUnitPriceUSD && <p className="text-red-600 text-xs font-medium mt-1">{errors.visaUnitPriceUSD}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="siskopatuhUnitPriceUSD" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                      Harga SISKOPATUH / Pax (USD) *
                    </label>
                    <Input
                      id="siskopatuhUnitPriceUSD"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.siskopatuhUnitPriceUSD}
                      onChange={(e) => handleInputChange("siskopatuhUnitPriceUSD", parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="h-10 px-3 border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] focus-visible:ring-[#111111] focus-visible:border-[#111111] focus-visible:ring-offset-0 focus-visible:ring-1 bg-white font-mono"
                    />
                    {errors.siskopatuhUnitPriceUSD && <p className="text-red-600 text-xs font-medium mt-1">{errors.siskopatuhUnitPriceUSD}</p>}
                  </div>
                </div>

                {/* Live 2-item invoice preview */}
                <div className="rounded-lg border border-[#e5e7eb] overflow-hidden bg-[#f9fafb]">
                  <div className="px-4 py-2.5 border-b border-[#e5e7eb] flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700">Rincian Item di Invoice (2 Item)</span>
                    <span className="text-xs text-gray-600 font-mono">
                      Bundle: ${bundleUnitPriceUSD.toFixed(2)} / pax
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[#e5e7eb] text-gray-600 bg-white">
                          <th className="text-left py-2 px-4 font-semibold">Item</th>
                          <th className="text-center py-2 px-3 font-semibold">Pax</th>
                          <th className="text-right py-2 px-3 font-semibold">Harga / Pax</th>
                          <th className="text-right py-2 px-4 font-semibold">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e5e7eb] bg-white">
                        <tr>
                          <td className="py-2.5 px-4 font-medium text-gray-900">1. Visa Umrah</td>
                          <td className="py-2.5 px-3 text-center text-gray-700 font-mono">{formData.totalPeople}</td>
                          <td className="py-2.5 px-3 text-right text-gray-700 font-mono">${formData.visaUnitPriceUSD.toFixed(2)}</td>
                          <td className="py-2.5 px-4 text-right font-semibold text-gray-900 font-mono">${visaSubtotalUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-medium text-gray-900">2. SISKOPATUH</td>
                          <td className="py-2.5 px-3 text-center text-gray-700 font-mono">{formData.totalPeople}</td>
                          <td className="py-2.5 px-3 text-right text-gray-700 font-mono">${formData.siskopatuhUnitPriceUSD.toFixed(2)}</td>
                          <td className="py-2.5 px-4 text-right font-semibold text-gray-900 font-mono">${siskopatuhSubtotalUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-[#e5e7eb] bg-[#f9fafb]">
                          <td colSpan={3} className="py-2.5 px-4 text-right font-semibold text-gray-700">Total Harga (USD)</td>
                          <td className="py-2.5 px-4 text-right font-bold text-[#111111] font-mono text-sm">
                            ${totalPriceUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-1.5">
                  <label htmlFor="totalPeople" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                    Jumlah Jamaah *
                  </label>
                  <Input
                    id="totalPeople"
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
                  <label htmlFor="unitPriceUSD" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                    Harga per Jamaah (USD) *
                  </label>
                  <Input
                    id="unitPriceUSD"
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
                  <div className="h-10 flex items-center px-3 bg-[#f9fafb] border border-[#e5e7eb] rounded-md text-[#111111] font-semibold font-mono text-sm">
                    ${totalPriceUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            )}
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