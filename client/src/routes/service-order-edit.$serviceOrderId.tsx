import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
import { useState, useEffect } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Save, Loader2, Building, Car, Link as LinkIcon, Plus, Trash2, Users } from "lucide-react"
import { z } from "zod"
import { authService } from "@/lib/auth"
import { useServiceOrder, useUpdateServiceOrder, type VisaMeta } from "@/lib/queries/serviceOrders"
import { useClients } from "@/lib/queries/clients"
import { ClientSearchCombobox } from "@/components/clients/ClientSearchCombobox"

const editServiceOrderSchema = z.object({
  clientId: z.number().min(1, "Client harus dipilih"),
  productType: z.enum(["visa_umrah", "siskopatuh", "visa_siskopatuh"]),
  groupLeaderName: z.string().min(1, "Nama ketua rombongan harus diisi"),
  groupLeaderPhone: z.string().optional(),
  totalPeople: z.number().min(1, "Jumlah orang minimal 1"),
  unitPriceUSD: z.number().min(0, "Harga per unit harus valid"),
  departureDate: z.string().min(1, "Tanggal keberangkatan harus diisi"),
  returnDate: z.string().min(1, "Tanggal kepulangan harus diisi"),
  notes: z.string().optional(),
})

type EditServiceOrderForm = z.infer<typeof editServiceOrderSchema>

export const Route = createFileRoute("/service-order-edit/$serviceOrderId")({
  beforeLoad: async () => {
    // Check if user is authenticated
    const isAuthenticated = await authService.isAuthenticated()
    if (!isAuthenticated) {
      throw redirect({ to: "/login" })
    }
  },
  component: EditServiceOrderPage
})

function EditServiceOrderPage() {
  const { serviceOrderId } = Route.useParams()
  const navigate = useNavigate()

  // Fetch service order and clients data
  const { data: serviceOrder, isLoading: isLoadingOrder } = useServiceOrder(serviceOrderId)
  const { data: clients, isLoading: isLoadingClients } = useClients()
  const updateServiceOrder = useUpdateServiceOrder()

  // Form state
  const [formData, setFormData] = useState<EditServiceOrderForm & { meta?: VisaMeta | null }>({
    clientId: 0,
    productType: "visa_umrah",
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
    }
  })

  const [errors, setErrors] = useState<Partial<Record<keyof EditServiceOrderForm | 'visaUnitPriceUSD' | 'siskopatuhUnitPriceUSD', string>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [visaUnitPriceUSD, setVisaUnitPriceUSD] = useState(0)
  const [siskopatuhUnitPriceUSD, setSiskopatuhUnitPriceUSD] = useState(0)

  const isBundle = formData.productType === "visa_siskopatuh"

  // Populate form when service order data is loaded
  useEffect(() => {
    if (serviceOrder) {
      const existingBundleItems = Array.isArray(serviceOrder.meta?.bundleItems)
        ? serviceOrder.meta.bundleItems
        : []
      const visaItem = existingBundleItems.find((i: any) => i.productType === 'visa_umrah')
      const siskopatuhItem = existingBundleItems.find((i: any) => i.productType === 'siskopatuh')
      setVisaUnitPriceUSD(visaItem ? Number(visaItem.unitPriceUSD) || 0 : Number(serviceOrder.unitPriceUSD) || 0)
      setSiskopatuhUnitPriceUSD(siskopatuhItem ? Number(siskopatuhItem.unitPriceUSD) || 0 : 0)

      setFormData({
        clientId: serviceOrder.clientId || 0,
        productType: serviceOrder.productType || "visa_umrah",
        groupLeaderName: serviceOrder.groupLeaderName || "",
        groupLeaderPhone: serviceOrder.groupLeaderPhone || "",
        totalPeople: serviceOrder.totalPeople || 1,
        unitPriceUSD: Number(serviceOrder.unitPriceUSD) || 0,
        departureDate: serviceOrder.departureDate ? serviceOrder.departureDate.split('T')[0] : "",
        returnDate: serviceOrder.returnDate ? serviceOrder.returnDate.split('T')[0] : "",
        notes: serviceOrder.notes || "",
        meta: serviceOrder.meta || {
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
        }
      })
    }
  }, [serviceOrder])

  const validateForm = (): boolean => {
    try {
      editServiceOrderSchema.parse(formData)
      if (isBundle) {
        const bundleErrors: Partial<Record<'visaUnitPriceUSD' | 'siskopatuhUnitPriceUSD', string>> = {}
        if (visaUnitPriceUSD <= 0) bundleErrors.visaUnitPriceUSD = "Harga Visa Umrah harus lebih dari 0"
        if (siskopatuhUnitPriceUSD <= 0) bundleErrors.siskopatuhUnitPriceUSD = "Harga SISKOPATUH harus lebih dari 0"
        if (Object.keys(bundleErrors).length > 0) {
          setErrors(bundleErrors)
          return false
        }
      }
      setErrors({})
      return true
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Partial<Record<keyof EditServiceOrderForm, string>> = {}
        error.issues.forEach((err: z.ZodIssue) => {
          if (err.path[0]) {
            newErrors[err.path[0] as keyof EditServiceOrderForm] = err.message
          }
        })
        setErrors(newErrors)
      }
      return false
    }
  }

  const handleInputChange = (field: keyof EditServiceOrderForm, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))

    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }))
    }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      const effectiveUnitPriceUSD = isBundle
        ? +(visaUnitPriceUSD + siskopatuhUnitPriceUSD).toFixed(2)
        : formData.unitPriceUSD

      const updatedMeta: VisaMeta = {
        ...(formData.meta || {}),
        bundleItems: isBundle
          ? [
              {
                productType: "visa_umrah",
                name: "Visa Umrah",
                description: "Penerbitan Visa Umrah Elektronik",
                pax: formData.totalPeople,
                unitPriceUSD: visaUnitPriceUSD,
                lineTotalUSD: +(visaUnitPriceUSD * formData.totalPeople).toFixed(2),
              },
              {
                productType: "siskopatuh",
                name: "SISKOPATUH",
                description: "Pendaftaran SISKOPATUH",
                pax: formData.totalPeople,
                unitPriceUSD: siskopatuhUnitPriceUSD,
                lineTotalUSD: +(siskopatuhUnitPriceUSD * formData.totalPeople).toFixed(2),
              },
            ]
          : undefined,
      }

      const updateData = {
        ...formData,
        unitPriceUSD: effectiveUnitPriceUSD,
        totalPriceUSD: +(effectiveUnitPriceUSD * formData.totalPeople).toFixed(2),
        departureDate: new Date(formData.departureDate).toISOString(),
        returnDate: new Date(formData.returnDate).toISOString(),
        meta: updatedMeta
      }

      await updateServiceOrder.mutateAsync({
        id: serviceOrderId,
        data: updateData
      })

      toast.success('Service order updated successfully!')
      navigate({ to: `/service-order-detail/${serviceOrderId}` })
    } catch (error) {
      console.error('Error updating service order:', error)
      const msg = error instanceof Error ? error.message : 'An unexpected error occurred'
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoadingOrder || isLoadingClients) {
    return (
      <PageLayout title="Edit Visa" subtitle="Loading...">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </PageLayout>
    )
  }

  if (!serviceOrder) {
    return (
      <PageLayout title="Edit Visa" subtitle="Visa not found">
        <div className="text-center text-red-600 p-8">
          {error?.message || "Visa not found"}
          <Button
            variant="outline"
            onClick={() => navigate({ to: "/service-orders" })}
            className="mt-4 block mx-auto"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Visa
          </Button>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Edit Visa" subtitle={`Visa Number: ${serviceOrder.number}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: `/service-order-detail/${serviceOrderId}` })}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Details
          </Button>
        </div>

        {/* Edit Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Client Information */}
          <Card>
            <CardHeader>
              <CardTitle>Client Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="clientId">Client *</Label>
                <ClientSearchCombobox
                  clients={clients ?? []}
                  selectedClientId={formData.clientId ? formData.clientId.toString() : ""}
                  onSelectClient={(id) => handleInputChange('clientId', id ? parseInt(id) : 0)}
                  isLoading={isLoadingClients}
                  error={Boolean(errors.clientId)}
                  className="w-full h-10 mt-1"
                />
                {errors.clientId && <p className="text-red-500 text-sm mt-1">{errors.clientId}</p>}
              </div>

              <div>
                <Label htmlFor="productType">Product Type *</Label>
                <select
                  id="productType"
                  value={formData.productType}
                  onChange={(e) => handleInputChange('productType', e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#111111]"
                >
                  <option value="visa_siskopatuh">Visa Umrah + SISKOPATUH (Bundle)</option>
                  <option value="visa_umrah">Visa Umrah</option>
                  <option value="siskopatuh">SISKOPATUH</option>
                </select>
                {errors.productType && <p className="text-red-500 text-sm mt-1">{errors.productType}</p>}
              </div>
            </CardContent>
          </Card>

          {/* Booking Details */}
          <Card>
            <CardHeader>
              <CardTitle>Booking Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="groupLeaderName">Nama Ketua Rombongan *</Label>
                  <Input
                    id="groupLeaderName"
                    value={formData.groupLeaderName}
                    onChange={(e) => handleInputChange('groupLeaderName', e.target.value)}
                    placeholder="Masukkan nama ketua rombongan"
                  />
                  {errors.groupLeaderName && <p className="text-red-500 text-sm mt-1">{errors.groupLeaderName}</p>}
                </div>

                <div>
                  <Label htmlFor="groupLeaderPhone">Nomor Ketua Rombongan</Label>
                  <Input
                    id="groupLeaderPhone"
                    value={formData.groupLeaderPhone || ""}
                    onChange={(e) => handleInputChange('groupLeaderPhone', e.target.value)}
                    placeholder="Masukkan nomor telepon ketua rombongan"
                  />
                  {errors.groupLeaderPhone && <p className="text-red-500 text-sm mt-1">{errors.groupLeaderPhone}</p>}
                </div>
              </div>

              {isBundle ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="totalPeople">Total People (Pax) *</Label>
                      <Input
                        id="totalPeople"
                        type="number"
                        min="1"
                        value={formData.totalPeople}
                        onChange={(e) => handleInputChange('totalPeople', parseInt(e.target.value) || 1)}
                        placeholder="Enter total people"
                      />
                      {errors.totalPeople && <p className="text-red-500 text-sm mt-1">{errors.totalPeople}</p>}
                    </div>

                    <div>
                      <Label htmlFor="visaUnitPriceUSD">Harga Visa Umrah / Pax (USD) *</Label>
                      <Input
                        id="visaUnitPriceUSD"
                        type="number"
                        min="0"
                        step="0.01"
                        value={visaUnitPriceUSD}
                        onChange={(e) => setVisaUnitPriceUSD(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                      {errors.visaUnitPriceUSD && <p className="text-red-500 text-sm mt-1">{errors.visaUnitPriceUSD}</p>}
                    </div>

                    <div>
                      <Label htmlFor="siskopatuhUnitPriceUSD">Harga SISKOPATUH / Pax (USD) *</Label>
                      <Input
                        id="siskopatuhUnitPriceUSD"
                        type="number"
                        min="0"
                        step="0.01"
                        value={siskopatuhUnitPriceUSD}
                        onChange={(e) => setSiskopatuhUnitPriceUSD(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                      {errors.siskopatuhUnitPriceUSD && <p className="text-red-500 text-sm mt-1">{errors.siskopatuhUnitPriceUSD}</p>}
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs space-y-1.5">
                    <div className="flex justify-between text-gray-700">
                      <span>1. Visa Umrah ({formData.totalPeople} pax x ${visaUnitPriceUSD.toFixed(2)})</span>
                      <span className="font-mono font-semibold">${(visaUnitPriceUSD * formData.totalPeople).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-700">
                      <span>2. SISKOPATUH ({formData.totalPeople} pax x ${siskopatuhUnitPriceUSD.toFixed(2)})</span>
                      <span className="font-mono font-semibold">${(siskopatuhUnitPriceUSD * formData.totalPeople).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-200 pt-1.5 font-semibold text-gray-900">
                      <span>Total Bundle (USD)</span>
                      <span className="font-mono">${((visaUnitPriceUSD + siskopatuhUnitPriceUSD) * formData.totalPeople).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="totalPeople">Total People *</Label>
                    <Input
                      id="totalPeople"
                      type="number"
                      min="1"
                      value={formData.totalPeople}
                      onChange={(e) => handleInputChange('totalPeople', parseInt(e.target.value) || 1)}
                      placeholder="Enter total people"
                    />
                    {errors.totalPeople && <p className="text-red-500 text-sm mt-1">{errors.totalPeople}</p>}
                  </div>

                  <div>
                    <Label htmlFor="unitPriceUSD">Unit Price (USD) *</Label>
                    <Input
                      id="unitPriceUSD"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.unitPriceUSD}
                      onChange={(e) => handleInputChange('unitPriceUSD', parseFloat(e.target.value) || 0)}
                      placeholder="Enter unit price"
                    />
                    {errors.unitPriceUSD && <p className="text-red-500 text-sm mt-1">{errors.unitPriceUSD}</p>}
                  </div>

                  <div>
                    <Label>Total Price (USD)</Label>
                    <Input
                      value={`$${(formData.unitPriceUSD * formData.totalPeople).toFixed(2)}`}
                      disabled
                      className="bg-gray-50"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Travel Information */}
          <Card>
            <CardHeader>
              <CardTitle>Travel Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="departureDate">Departure Date *</Label>
                  <Input
                    id="departureDate"
                    type="date"
                    value={formData.departureDate}
                    onChange={(e) => handleInputChange('departureDate', e.target.value)}
                  />
                  {errors.departureDate && <p className="text-red-500 text-sm mt-1">{errors.departureDate}</p>}
                </div>

                <div>
                  <Label htmlFor="returnDate">Return Date *</Label>
                  <Input
                    id="returnDate"
                    type="date"
                    value={formData.returnDate}
                    onChange={(e) => handleInputChange('returnDate', e.target.value)}
                  />
                  {errors.returnDate && <p className="text-red-500 text-sm mt-1">{errors.returnDate}</p>}
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Enter any additional notes"
                  rows={3}
                />
                {errors.notes && <p className="text-red-500 text-sm mt-1">{errors.notes}</p>}
              </div>
            </CardContent>
          </Card>

          {/* HOTEL MAKKAH */}
          <Card>
            <CardHeader className="flex flex-row items-center space-x-2">
              <Building className="h-5 w-5 text-amber-600" />
              <CardTitle>Hotel Makkah</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Nama Hotel</Label>
                  <Input
                    value={formData.meta?.hotelMakkah?.name || ""}
                    onChange={(e) => handleMetaChange("hotelMakkah", "name", e.target.value)}
                    placeholder="Nama Hotel Makkah"
                  />
                </div>
                <div>
                  <Label>Check-in</Label>
                  <Input
                    type="date"
                    value={formData.meta?.hotelMakkah?.checkIn || ""}
                    onChange={(e) => handleMetaChange("hotelMakkah", "checkIn", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Check-out</Label>
                  <Input
                    type="date"
                    value={formData.meta?.hotelMakkah?.checkOut || ""}
                    onChange={(e) => handleMetaChange("hotelMakkah", "checkOut", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* HOTEL MADINAH */}
          <Card>
            <CardHeader className="flex flex-row items-center space-x-2">
              <Building className="h-5 w-5 text-emerald-600" />
              <CardTitle>Hotel Madinah</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Nama Hotel</Label>
                  <Input
                    value={formData.meta?.hotelMadinah?.name || ""}
                    onChange={(e) => handleMetaChange("hotelMadinah", "name", e.target.value)}
                    placeholder="Nama Hotel Madinah"
                  />
                </div>
                <div>
                  <Label>Check-in</Label>
                  <Input
                    type="date"
                    value={formData.meta?.hotelMadinah?.checkIn || ""}
                    onChange={(e) => handleMetaChange("hotelMadinah", "checkIn", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Check-out</Label>
                  <Input
                    type="date"
                    value={formData.meta?.hotelMadinah?.checkOut || ""}
                    onChange={(e) => handleMetaChange("hotelMadinah", "checkOut", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* TRANSPORTATION */}
          <Card>
            <CardHeader className="flex flex-row items-center space-x-2">
              <Car className="h-5 w-5 text-blue-600" />
              <CardTitle>Transportasi</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>

          {/* JAMAAH DETAILS */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-indigo-600" />
                <CardTitle>Data Jamaah</CardTitle>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addJamaah}>
                <Plus className="h-4 w-4 mr-2" />
                Tambah Jamaah
              </Button>
            </CardHeader>
            <CardContent>
              {(!formData.meta?.jamaah || formData.meta.jamaah.length === 0) ? (
                <p className="text-gray-500 text-sm text-center py-4">Belum ada data jamaah. Silakan tambahkan.</p>
              ) : (
                <div className="space-y-4">
                  {formData.meta.jamaah.map((j, index) => (
                    <div key={index} className="flex flex-col md:flex-row gap-4 items-start md:items-end border p-4 rounded-md relative group">
                      <div className="flex-1 w-full">
                        <Label>Nama</Label>
                        <Input className="mt-1" value={j.name} onChange={e => updateJamaah(index, "name", e.target.value)} placeholder="Nama Sesuai Paspor" />
                      </div>
                      <div className="flex-1 w-full">
                        <Label>No. Paspor</Label>
                        <Input className="mt-1" value={j.passportNo} onChange={e => updateJamaah(index, "passportNo", e.target.value)} placeholder="A1234567" />
                      </div>
                      <div className="w-full md:w-32">
                        <Label>L/P</Label>
                        <select
                          value={j.gender}
                          onChange={e => updateJamaah(index, "gender", e.target.value)}
                          className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-10"
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
            </CardContent>
          </Card>

          {/* GOOGLE DRIVE LINK */}
          <Card>
            <CardHeader className="flex flex-row items-center space-x-2">
              <LinkIcon className="h-5 w-5 text-blue-500" />
              <CardTitle>Link Dokumen (Google Drive)</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                type="url"
                value={formData.meta?.googleDriveLink || ""}
                onChange={(e) => handleDriveLinkChange(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/..."
              />
              <p className="text-xs text-gray-500 mt-2">Masukkan link folder Google Drive yang berisi scan paspor, KTP, KK, dll.</p>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate({ to: `/service-order-detail/${serviceOrderId}` })}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateServiceOrder.isPending} className="w-full md:w-auto">
              {updateServiceOrder.isPending ? 'Updating...' : 'Update Visa'}
            </Button>
          </div>
        </form>
      </div>
    </PageLayout>
  )
}