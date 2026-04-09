import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
import { useState, useEffect } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Save, Loader2 } from "lucide-react"
import { z } from "zod"
import { authService } from "@/lib/auth"
import { useServiceOrder, useUpdateServiceOrder } from "@/lib/queries/serviceOrders"
import { useClients } from "@/lib/queries/clients"

const editServiceOrderSchema = z.object({
  clientId: z.number().min(1, "Client harus dipilih"),
  productType: z.enum(["visa_umrah", "siskopatuh"]),
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
  const [formData, setFormData] = useState<EditServiceOrderForm>({
    clientId: 0,
    productType: "visa_umrah",
    groupLeaderName: "",
    groupLeaderPhone: "",
    totalPeople: 1,
    unitPriceUSD: 0,
    departureDate: "",
    returnDate: "",
    notes: "",
  })

  const [errors, setErrors] = useState<Partial<Record<keyof EditServiceOrderForm, string>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Populate form when service order data is loaded
  useEffect(() => {
    if (serviceOrder) {
      setFormData({
        clientId: serviceOrder.clientId || 0,
        productType: serviceOrder.productType || "visa_umrah",
        groupLeaderName: serviceOrder.groupLeaderName || "",
        groupLeaderPhone: serviceOrder.groupLeaderPhone || "",
        totalPeople: serviceOrder.totalPeople || 1,
        unitPriceUSD: serviceOrder.unitPriceUSD || 0,
        departureDate: serviceOrder.departureDate ? serviceOrder.departureDate.split('T')[0] : "",
        returnDate: serviceOrder.returnDate ? serviceOrder.returnDate.split('T')[0] : "",
        notes: serviceOrder.notes || "",
      })
    }
  }, [serviceOrder])

  const validateForm = (): boolean => {
    try {
      editServiceOrderSchema.parse(formData)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      const updateData = {
        ...formData,
        totalPriceUSD: formData.unitPriceUSD * formData.totalPeople,
        departureDate: new Date(formData.departureDate).toISOString(),
        returnDate: new Date(formData.returnDate).toISOString(),
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
      <PageLayout title="Edit Service Order" subtitle="Loading...">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </PageLayout>
    )
  }

  if (!serviceOrder) {
    return (
      <PageLayout title="Edit Service Order" subtitle="Service order not found">
        <div className="text-center py-8">
          <p>Service order not found.</p>
          <Button
            variant="outline"
            onClick={() => navigate({ to: "/service-orders" })}
            className="mt-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Service Orders
          </Button>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Edit Service Order" subtitle={`SO Number: ${serviceOrder.number}`}>
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
                <select
                  id="clientId"
                  value={formData.clientId}
                  onChange={(e) => handleInputChange('clientId', parseInt(e.target.value))}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={0}>Select a client</option>
                  {clients?.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name} - {client.email}
                    </option>
                  ))}
                </select>
                {errors.clientId && <p className="text-red-500 text-sm mt-1">{errors.clientId}</p>}
              </div>

              <div>
                <Label htmlFor="productType">Product Type *</Label>
                <select
                  id="productType"
                  value={formData.productType}
                  onChange={(e) => handleInputChange('productType', e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="visa_umrah">Visa Umrah</option>
                  <option value="siskopatuh">Siskopatuh</option>
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

          {/* Submit Button */}
          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate({ to: `/service-order-detail/${serviceOrderId}` })}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Update Service Order
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </PageLayout>
  )
}