import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Save, ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react"
import { useCreateTransportPricing, useTransportRoutes } from "@/lib/queries/master"

export const Route = createFileRoute("/create-transport-pricing/$routeId")({
  component: CreateTransportPricingPage
})

const VEHICLE_TYPES = [
  { value: 'sedan', label: 'Sedan' },
  { value: 'suv', label: 'SUV' },
  { value: 'van', label: 'Van' },
  { value: 'minibus', label: 'Minibus' },
  { value: 'bus', label: 'Bus' }
]

function CreateTransportPricingPage() {
  const { routeId: routeIdParam } = Route.useParams()
  const routeId = Number(routeIdParam)
  const navigate = useNavigate()

  const { data: routes = [] } = useTransportRoutes()
  const routeMaster = routes.find(r => r.id === routeId)
  
  const createPricingMutation = useCreateTransportPricing()

  const [periodData, setPeriodData] = useState({
    startDate: "",
    endDate: "",
    currency: "SAR",
    isActive: true
  })

  const [vehicleConfigs, setVehicleConfigs] = useState([
    { id: '1', vehicleType: 'sedan', costPrice: 0, sellingPrice: 0 },
    { id: '2', vehicleType: 'suv', costPrice: 0, sellingPrice: 0 }
  ])

  const handlePeriodChange = (field: string, value: string | boolean) => {
    setPeriodData(prev => ({ ...prev, [field]: value }))
  }

  const handleVehicleChange = (id: string, field: string, value: string | number) => {
    setVehicleConfigs(prev => prev.map(vehicle => 
      vehicle.id === id ? { ...vehicle, [field]: value } : vehicle
    ))
  }

  const addVehicleConfig = () => {
    setVehicleConfigs(prev => [
      ...prev,
      { id: Date.now().toString(), vehicleType: 'van', costPrice: 0, sellingPrice: 0 }
    ])
  }

  const removeVehicleConfig = (id: string) => {
    setVehicleConfigs(prev => prev.filter(v => v.id !== id))
  }

  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!periodData.startDate || !periodData.endDate) {
      toast.error("Please select both start and end dates.")
      return
    }

    if (new Date(periodData.endDate) < new Date(periodData.startDate)) {
      toast.error('End date must be continuously after or equal to start date')
      return
    }

    if (vehicleConfigs.length === 0) {
      toast.error('Please add at least one vehicle type')
      return
    }

    try {
      setIsSubmitting(true)
      // Save all vehicle types sequentially
      await Promise.all(
        vehicleConfigs.map(vehicle => 
          createPricingMutation.mutateAsync({
            routeId,
            data: {
              vehicleType: vehicle.vehicleType,
              startDate: periodData.startDate,
              endDate: periodData.endDate,
              currency: periodData.currency,
              isActive: periodData.isActive,
              costPrice: String(vehicle.costPrice),
              sellingPrice: String(vehicle.sellingPrice)
            }
          })
        )
      )

      toast.success(`${vehicleConfigs.length} pricing periods created successfully`)
      navigate({ to: "/master-transport-detail/$routeId", params: { routeId: routeId.toString() } })
    } catch (error) {
      toast.error('Failed to create some or all pricing periods')
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <PageLayout
      title="Add New Pricing Period"
      subtitle={routeMaster ? `For Route: ${routeMaster.originLocation} ➔ ${routeMaster.destinationLocation}` : "Loading route details..."}
      actions={
        <Button variant="outline" onClick={() => navigate({ to: "/master-transport-detail/$routeId", params: { routeId: routeId.toString() } })}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Details
        </Button>
      }
    >
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">
        {/* Date Period Segment */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Period Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={periodData.startDate}
                  onChange={(e) => handlePeriodChange('startDate', e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="endDate">End Date *</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={periodData.endDate}
                  onChange={(e) => handlePeriodChange('endDate', e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="currency">Currency</Label>
                <select
                  id="currency"
                  title="Currency"
                  value={periodData.currency}
                  onChange={(e) => handlePeriodChange('currency', e.target.value)}
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
                checked={periodData.isActive}
                onChange={(e) => handlePeriodChange('isActive', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <Label htmlFor="isActivePeriod" className="font-medium text-gray-700 cursor-pointer">Active for Bookings</Label>
            </div>
          </CardContent>
        </Card>

        {/* Vehicle Configurations Segment */}
        <Card>
          <CardHeader className="flex flex-row justify-between items-center border-b pb-4">
            <CardTitle className="text-lg">Vehicle Types</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addVehicleConfig}>
              <Plus className="h-4 w-4 mr-2" />
              Add Vehicle
            </Button>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            {vehicleConfigs.map((vehicle, index) => (
              <div key={vehicle.id} className="flex flex-wrap md:flex-nowrap gap-4 items-end bg-gray-50 p-4 rounded-lg border border-gray-100">
                <div className="w-full md:w-1/3">
                  <Label>Vehicle Type *</Label>
                  <select
                    title="Vehicle Type"
                    value={vehicle.vehicleType}
                    onChange={(e) => handleVehicleChange(vehicle.id, 'vehicleType', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    {VEHICLE_TYPES.map(vt => (
                      <option key={vt.value} value={vt.value}>{vt.label}</option>
                    ))}
                  </select>
                </div>
                
                <div className="w-full md:w-1/4">
                  <Label>Cost Price</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={vehicle.costPrice}
                    onChange={(e) => handleVehicleChange(vehicle.id, 'costPrice', parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>

                <div className="w-full md:w-1/4">
                  <Label>Selling Price</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={vehicle.sellingPrice}
                    onChange={(e) => handleVehicleChange(vehicle.id, 'sellingPrice', parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>

                <div className="w-full md:w-auto">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeVehicleConfig(vehicle.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            
            {vehicleConfigs.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No vehicle types added yet. Click 'Add Vehicle' to start.
              </div>
            )}
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
            disabled={isSubmitting || vehicleConfigs.length === 0 || !periodData.startDate}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span>Save All Pricing</span>
          </Button>
        </div>
      </form>
    </PageLayout>
  )
}
