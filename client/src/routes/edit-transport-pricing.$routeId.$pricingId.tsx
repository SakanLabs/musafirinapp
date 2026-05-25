import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Save, ArrowLeft, Loader2, Calendar, DollarSign } from "lucide-react"
import { useTransportPricing, useUpdateTransportPricing, useTransportRoutes } from "@/lib/queries/master"

export const Route = createFileRoute("/edit-transport-pricing/$routeId/$pricingId")({
  component: EditTransportPricingPage
})

const VEHICLE_TYPES = [
  { value: 'sedan', label: 'Sedan' },
  { value: 'staria', label: 'Staria' },
  { value: 'hiace', label: 'Hiace' },
  { value: 'gmc', label: 'GMC' },
  { value: 'coaster', label: 'Coaster' },
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
    agentPrice: 0,
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
          agentPrice: Number(period.agentPrice) || 0,
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
      toast.error('End date must be after start date')
      return
    }
    try {
      await updatePricingMutation.mutateAsync({
        routeId,
        id: pricingId,
        data: {
          ...formData,
          costPrice: String(formData.costPrice),
          sellingPrice: String(formData.sellingPrice),
          agentPrice: String(formData.agentPrice)
        }
      })
      toast.success('Pricing period updated successfully')
      navigate({ to: "/master-transport-detail/$routeId", params: { routeId: routeId.toString() } })
    } catch (error) {
      toast.error('Failed to update pricing period')
      console.error(error)
    }
  }

  const inputCls = "h-10 px-3 border-[#e5e7eb] rounded-lg bg-white text-sm focus-visible:ring-0 focus-visible:border-[#111111] shadow-none transition-colors"
  const selectCls = "w-full h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm text-zinc-700 focus:outline-none focus:border-[#111111] transition-colors"
  const labelCls = "text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 block"

  if (isPricingLoading) {
    return (
      <PageLayout title="Edit Pricing Period">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="Edit Pricing Period"
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
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-4">

        {/* Vehicle & Period */}
        <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none overflow-hidden">
          <div className="px-6 py-4 border-b border-[#e5e7eb] flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-zinc-400" />
            <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider">Vehicle & Period</h3>
          </div>
          <div className="p-6 space-y-5">
            <div>
              <label htmlFor="vehicleType" className={labelCls}>Vehicle Type *</label>
              <select
                id="vehicleType"
                title="Vehicle Type"
                value={formData.vehicleType}
                onChange={(e) => handleInputChange('vehicleType', e.target.value)}
                className={selectCls}
                required
              >
                {VEHICLE_TYPES.map(vt => (
                  <option key={vt.value} value={vt.value}>{vt.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label htmlFor="startDate" className={labelCls}>Start Date *</label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => handleInputChange('startDate', e.target.value)}
                  required
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="endDate" className={labelCls}>End Date *</label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => handleInputChange('endDate', e.target.value)}
                  required
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="currency" className={labelCls}>Currency</label>
                <select
                  id="currency"
                  title="Currency"
                  value={formData.currency}
                  onChange={(e) => handleInputChange('currency', e.target.value)}
                  className={selectCls}
                >
                  <option value="SAR">SAR — Saudi Riyal</option>
                  <option value="IDR">IDR — Indonesian Rupiah</option>
                  <option value="USD">USD — US Dollar</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none overflow-hidden">
          <div className="px-6 py-4 border-b border-[#e5e7eb] flex items-center space-x-2">
            <DollarSign className="h-4 w-4 text-zinc-400" />
            <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider">Pricing</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label htmlFor="costPrice" className={labelCls}>Base Cost Price *</label>
                <Input
                  id="costPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.costPrice}
                  onChange={(e) => handleInputChange('costPrice', parseFloat(e.target.value) || 0)}
                  required
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div>
                <label htmlFor="sellingPrice" className={labelCls}>Selling Price (Direct) *</label>
                <Input
                  id="sellingPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.sellingPrice}
                  onChange={(e) => handleInputChange('sellingPrice', parseFloat(e.target.value) || 0)}
                  required
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div>
                <label htmlFor="agentPrice" className={labelCls}>Agent Price</label>
                <Input
                  id="agentPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.agentPrice}
                  onChange={(e) => handleInputChange('agentPrice', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className={`${inputCls} font-mono`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Status + Actions */}
        <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none overflow-hidden">
          <div className="p-5 flex items-center justify-between flex-wrap gap-4">
            <label className="flex items-center space-x-3 cursor-pointer select-none">
              <div
                className={`relative w-9 h-5 rounded-full transition-colors ${formData.isActive ? 'bg-[#111111]' : 'bg-zinc-200'}`}
                onClick={() => handleInputChange('isActive', !formData.isActive)}
              >
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${formData.isActive ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#111111]">Active for Bookings</p>
                <p className="text-xs text-zinc-400">{formData.isActive ? 'Period is bookable' : 'Period is disabled'}</p>
              </div>
            </label>

            <div className="flex items-center space-x-3">
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
                disabled={updatePricingMutation.isPending || !formData.vehicleType || !formData.startDate || !formData.endDate}
                className="bg-[#111111] hover:bg-[#242424] text-white h-9 px-5 rounded-md text-xs font-semibold transition-colors border border-transparent shadow-none disabled:opacity-50"
              >
                {updatePricingMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </form>
    </PageLayout>
  )
}
