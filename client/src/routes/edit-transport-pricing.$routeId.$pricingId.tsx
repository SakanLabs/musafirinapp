import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Save, ArrowLeft, Loader2 } from "lucide-react"
import { useTransportPricing, useUpdateTransportPricing, useTransportRoutes } from "@/lib/queries/master"

export const Route = createFileRoute("/edit-transport-pricing/$routeId/$pricingId")({
  component: EditTransportPricingPage
})

const VEHICLE_TYPES = [
  { value: 'sedan', label: 'Sedan' },
  { value: 'suv', label: 'SUV' },
  { value: 'van', label: 'Van' },
  { value: 'minibus', label: 'Minibus' },
  { value: 'bus', label: 'Bus' }
]

function EditTransportPricingPage() {
  const { routeId: routeIdParam, pricingId: pricingIdParam } = Route.useParams()
  const routeId = Number(routeIdParam)
  const pricingId = Number(pricingIdParam)
  const navigate = useNavigate()

  const { data: routes = [] } = useTransportRoutes()
  const routeMaster = routes.find(r => r.id === routeId)
  
  const { data: pricingPeriods = [], isLoading: isPricingLoading } = useTransportPricing(routeId)
  const updatePricingMutation = useUpdateTransportPricing()

  const [formData, setFormData] = useState({
    vehicleType: "sedan",
    startDate: "",
    endDate: "",
    costPrice: 0,
    sellingPrice: 0,
    currency: "SAR",
    isActive: true
  })

  useEffect(() => {
    if (pricingPeriods.length > 0) {
      const period = pricingPeriods.find(p => p.id === pricingId)
      if (period) {
        setFormData({
          vehicleType: period.vehicleType,
          startDate: new Date(period.startDate).toISOString().split('T')[0],
          endDate: new Date(period.endDate).toISOString().split('T')[0],
          costPrice: Number(period.costPrice),
          sellingPrice: Number(period.sellingPrice),
          currency: period.currency,
          isActive: period.isActive
        })
      }
    }
  }, [pricingPeriods, pricingId])

  const handleInputChange = (field: string, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.vehicleType || !formData.startDate || !formData.endDate) {
      toast.error("Please fill in all required fields.")
      return
    }

    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      toast.error('End date must be continuously after or equal to start date')
      return
    }

    try {
      await updatePricingMutation.mutateAsync({
        routeId,
        id: pricingId,
        data: {
          ...formData,
          costPrice: String(formData.costPrice),
          sellingPrice: String(formData.sellingPrice)
        }
      })
      toast.success('Pricing period updated successfully')
      navigate({ to: "/master-transport-detail/$routeId", params: { routeId: routeId.toString() } })
    } catch (error) {
      toast.error('Failed to update pricing period')
      console.error(error)
    }
  }

  if (isPricingLoading) {
    return (
      <PageLayout title="Edit Pricing Period">
         <div className="flex justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
         </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="Edit Pricing Period"
      subtitle={routeMaster ? `For Route: ${routeMaster.originLocation} ➔ ${routeMaster.destinationLocation}` : "Loading route details..."}
      actions={
        <Button variant="outline" onClick={() => navigate({ to: "/master-transport-detail/$routeId", params: { routeId: routeId.toString() } })}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Details
        </Button>
      }
    >
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-6">
        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <Label htmlFor="vehicleType">Vehicle Type *</Label>
                <select
                  id="vehicleType"
                  title="Vehicle Type"
                  value={formData.vehicleType}
                  onChange={(e) => handleInputChange('vehicleType', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {VEHICLE_TYPES.map(vt => (
                    <option key={vt.value} value={vt.value}>{vt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => handleInputChange('startDate', e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="endDate">End Date *</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => handleInputChange('endDate', e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="costPrice">Base Cost Price *</Label>
                <Input
                  id="costPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.costPrice}
                  onChange={(e) => handleInputChange('costPrice', parseFloat(e.target.value) || 0)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="sellingPrice">Retail Selling Price *</Label>
                <Input
                  id="sellingPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.sellingPrice}
                  onChange={(e) => handleInputChange('sellingPrice', parseFloat(e.target.value) || 0)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="currency">Currency</Label>
                <select
                  id="currency"
                  title="Currency"
                  value={formData.currency}
                  onChange={(e) => handleInputChange('currency', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="SAR">SAR</option>
                  <option value="IDR">IDR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2 border-t border-gray-100">
              <input
                type="checkbox"
                id="isActivePeriod"
                checked={formData.isActive}
                onChange={(e) => handleInputChange('isActive', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <Label htmlFor="isActivePeriod" className="font-medium text-gray-700 cursor-pointer">Active for Bookings</Label>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: "/master-transport-detail/$routeId", params: { routeId: routeId.toString() } })}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={updatePricingMutation.isPending || !formData.vehicleType || !formData.startDate || !formData.endDate}
            className="flex items-center space-x-2 bg-blue-600 border border-blue-600 hover:bg-blue-700 text-white"
          >
            {updatePricingMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span>Save Changes</span>
          </Button>
        </div>
      </form>
    </PageLayout>
  )
}
