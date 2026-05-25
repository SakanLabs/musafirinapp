import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Save, ArrowLeft, Loader2, Plus, Trash2, Calendar, DollarSign, Bus } from "lucide-react"
import { useCreateTransportPricing, useTransportRoutes } from "@/lib/queries/master"

export const Route = createFileRoute("/create-transport-pricing/$routeId")({
  component: CreateTransportPricingPage
})

const VEHICLE_TYPES = [
  { value: 'sedan', label: 'Sedan' },
  { value: 'staria', label: 'Staria' },
  { value: 'hiace', label: 'Hiace' },
  { value: 'gmc', label: 'GMC' },
  { value: 'coaster', label: 'Coaster' },
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
    { id: '1', vehicleType: 'sedan', costPrice: 0, sellingPrice: 0, agentPrice: 0 },
    { id: '2', vehicleType: 'staria', costPrice: 0, sellingPrice: 0, agentPrice: 0 }
  ])

  const [isSubmitting, setIsSubmitting] = useState(false)

  const handlePeriodChange = (field: string, value: string | boolean) => {
    setPeriodData(prev => ({ ...prev, [field]: value }))
  }

  const handleVehicleChange = (id: string, field: string, value: string | number) => {
    setVehicleConfigs(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v))
  }

  const addVehicleConfig = () => {
    setVehicleConfigs(prev => [
      ...prev,
      { id: Date.now().toString(), vehicleType: 'hiace', costPrice: 0, sellingPrice: 0, agentPrice: 0 }
    ])
  }

  const removeVehicleConfig = (id: string) => {
    setVehicleConfigs(prev => prev.filter(v => v.id !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!periodData.startDate || !periodData.endDate) {
      toast.error("Please select both start and end dates.")
      return
    }
    if (new Date(periodData.endDate) < new Date(periodData.startDate)) {
      toast.error('End date must be after start date')
      return
    }
    if (vehicleConfigs.length === 0) {
      toast.error('Please add at least one vehicle type')
      return
    }

    try {
      setIsSubmitting(true)
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
              sellingPrice: String(vehicle.sellingPrice),
              agentPrice: String(vehicle.agentPrice)
            }
          })
        )
      )
      toast.success(`${vehicleConfigs.length} pricing record${vehicleConfigs.length > 1 ? 's' : ''} created`)
      navigate({ to: "/master-transport-detail/$routeId", params: { routeId: routeId.toString() } })
    } catch (error) {
      toast.error('Failed to create pricing periods')
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputCls = "h-10 px-3 border-[#e5e7eb] rounded-lg bg-white text-sm focus-visible:ring-0 focus-visible:border-[#111111] shadow-none transition-colors"
  const selectCls = "w-full h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm text-zinc-700 focus:outline-none focus:border-[#111111] transition-colors"
  const labelCls = "text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 block"

  return (
    <PageLayout
      title="Add Pricing Period"
      subtitle={routeMaster ? `${routeMaster.originLocation} → ${routeMaster.destinationLocation}` : "Loading..."}
      actions={
        <Button
          variant="outline"
          onClick={() => navigate({ to: "/master-transport-detail/$routeId", params: { routeId: routeId.toString() } })}
          className="h-9 px-4 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 hover:text-black rounded-md text-xs font-semibold shadow-none"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Route
        </Button>
      }
    >
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-4">

        {/* Period Config */}
        <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none overflow-hidden">
          <div className="px-6 py-4 border-b border-[#e5e7eb] flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-zinc-400" />
            <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider">Period Configuration</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label htmlFor="startDate" className={labelCls}>Start Date *</label>
                <Input
                  id="startDate"
                  type="date"
                  value={periodData.startDate}
                  onChange={(e) => handlePeriodChange('startDate', e.target.value)}
                  required
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="endDate" className={labelCls}>End Date *</label>
                <Input
                  id="endDate"
                  type="date"
                  value={periodData.endDate}
                  onChange={(e) => handlePeriodChange('endDate', e.target.value)}
                  required
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="currency" className={labelCls}>Currency</label>
                <select
                  id="currency"
                  title="Currency"
                  value={periodData.currency}
                  onChange={(e) => handlePeriodChange('currency', e.target.value)}
                  className={selectCls}
                >
                  <option value="SAR">SAR — Saudi Riyal</option>
                  <option value="IDR">IDR — Indonesian Rupiah</option>
                  <option value="USD">USD — US Dollar</option>
                </select>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-[#f3f4f6]">
              <label className="flex items-center space-x-3 cursor-pointer select-none">
                <div
                  className={`relative w-9 h-5 rounded-full transition-colors ${periodData.isActive ? 'bg-[#111111]' : 'bg-zinc-200'}`}
                  onClick={() => handlePeriodChange('isActive', !periodData.isActive)}
                >
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${periodData.isActive ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#111111]">Active for Bookings</p>
                  <p className="text-xs text-zinc-400">This period will be available in booking forms</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Vehicle Pricing */}
        <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none overflow-hidden">
          <div className="px-6 py-4 border-b border-[#e5e7eb] flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-zinc-400" />
              <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider">Vehicle Types & Pricing</h3>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addVehicleConfig}
              className="h-8 px-3 border-[#e5e7eb] text-zinc-700 hover:bg-zinc-50 text-xs font-semibold rounded-md shadow-none"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Row
            </Button>
          </div>

          <div className="p-4 space-y-3">
            {/* Column headers */}
            <div className="hidden md:grid md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 px-1">
              <span className={labelCls}>Vehicle Type *</span>
              <span className={labelCls}>Base Cost</span>
              <span className={labelCls}>Direct Price</span>
              <span className={labelCls}>Agent Price</span>
              <span></span>
            </div>

            {vehicleConfigs.map((vehicle) => (
              <div key={vehicle.id} className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 items-center bg-[#fafafa] border border-[#f3f4f6] rounded-lg p-3 md:p-2 md:bg-transparent md:border-0">
                <div>
                  <span className="block md:hidden text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Vehicle Type</span>
                  <select
                    title="Vehicle Type"
                    value={vehicle.vehicleType}
                    onChange={(e) => handleVehicleChange(vehicle.id, 'vehicleType', e.target.value)}
                    className={selectCls}
                    required
                  >
                    {VEHICLE_TYPES.map(vt => (
                      <option key={vt.value} value={vt.value}>{vt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="block md:hidden text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Base Cost</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={vehicle.costPrice}
                    onChange={(e) => handleVehicleChange(vehicle.id, 'costPrice', parseFloat(e.target.value) || 0)}
                    className={`${inputCls} font-mono`}
                    required
                  />
                </div>
                <div>
                  <span className="block md:hidden text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Direct Price</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={vehicle.sellingPrice}
                    onChange={(e) => handleVehicleChange(vehicle.id, 'sellingPrice', parseFloat(e.target.value) || 0)}
                    className={`${inputCls} font-mono`}
                    required
                  />
                </div>
                <div>
                  <span className="block md:hidden text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Agent Price</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={vehicle.agentPrice}
                    onChange={(e) => handleVehicleChange(vehicle.id, 'agentPrice', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className={`${inputCls} font-mono`}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeVehicleConfig(vehicle.id)}
                  className="h-10 w-10 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-full self-end md:self-center"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {vehicleConfigs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12">
                <Bus className="h-8 w-8 text-zinc-200 mb-3" />
                <p className="text-sm text-zinc-400 font-medium mb-3">No vehicle types added</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addVehicleConfig}
                  className="h-9 px-4 border-[#e5e7eb] text-zinc-700 hover:bg-zinc-50 text-xs font-semibold rounded-md shadow-none"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Vehicle
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex justify-end items-center space-x-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: "/master-transport-detail/$routeId", params: { routeId: routeId.toString() } })}
            className="h-9 px-4 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 rounded-md text-xs font-semibold shadow-none"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || vehicleConfigs.length === 0 || !periodData.startDate}
            className="bg-[#111111] hover:bg-[#242424] text-white h-9 px-5 rounded-md text-xs font-semibold transition-colors border border-transparent shadow-none disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save All Pricing
          </Button>
        </div>
      </form>
    </PageLayout>
  )
}
