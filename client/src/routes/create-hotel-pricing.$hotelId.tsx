import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Save, ArrowLeft, Loader2, Plus, Trash2, Calendar, DollarSign } from "lucide-react"
import { useCreateHotelPricing, useHotels, useHotelPricing } from "@/lib/queries/master"

export const Route = createFileRoute("/create-hotel-pricing/$hotelId")({
  validateSearch: (search: Record<string, unknown>): { startDate?: string; endDate?: string } => {
    return {
      startDate: (search.startDate as string) || "",
      endDate: (search.endDate as string) || "",
    }
  },
  component: CreateHotelPricingPage
})

function CreateHotelPricingPage() {
  const { hotelId: hotelIdParam } = Route.useParams()
  const hotelId = Number(hotelIdParam)
  const navigate = useNavigate()

  const { data: hotels = [] } = useHotels()
  const hotel = hotels.find(h => h.id === hotelId)
  const { data: existingPricing = [] } = useHotelPricing(hotelId)
  const createPricingMutation = useCreateHotelPricing()

  const { startDate: qsStart, endDate: qsEnd } = Route.useSearch()

  const [periodData, setPeriodData] = useState({
    startDate: qsStart,
    endDate: qsEnd,
    currency: "SAR",
    isActive: true
  })

  const [roomConfigs, setRoomConfigs] = useState([
    { id: '1', roomType: 'Double', mealPlan: 'Room Only', costPrice: 0, sellingPrice: 0, agentPrice: 0 },
    { id: '2', roomType: 'Triple', mealPlan: 'Room Only', costPrice: 0, sellingPrice: 0, agentPrice: 0 },
    { id: '3', roomType: 'Quad', mealPlan: 'Room Only', costPrice: 0, sellingPrice: 0, agentPrice: 0 }
  ])

  const [isSubmitting, setIsSubmitting] = useState(false)

  const handlePeriodChange = (field: string, value: string | boolean) => {
    setPeriodData(prev => ({ ...prev, [field]: value }))
  }

  const handleRoomChange = (id: string, field: string, value: string | number) => {
    setRoomConfigs(prev => prev.map(room => room.id === id ? { ...room, [field]: value } : room))
  }

  const addRoomConfig = () => {
    setRoomConfigs(prev => [
      ...prev,
      { id: Date.now().toString(), roomType: '', mealPlan: 'Room Only', costPrice: 0, sellingPrice: 0, agentPrice: 0 }
    ])
  }

  const removeRoomConfig = (id: string) => {
    setRoomConfigs(prev => prev.filter(r => r.id !== id))
  }

  const existingConfigs = existingPricing.filter(p => {
    if (!periodData.startDate || !periodData.endDate) return false
    const startStr = new Date(p.startDate).toISOString().split('T')[0]
    const endStr = new Date(p.endDate).toISOString().split('T')[0]
    return startStr === periodData.startDate && endStr === periodData.endDate
  })

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
    const validRooms = roomConfigs.filter(r => r.roomType.trim() !== '')
    if (validRooms.length === 0) {
      toast.error('Please add at least one valid room type')
      return
    }

    try {
      setIsSubmitting(true)
      await Promise.all(
        validRooms.map(room =>
          createPricingMutation.mutateAsync({
            hotelId,
            data: {
              roomType: room.roomType,
              mealPlan: room.mealPlan,
              startDate: periodData.startDate,
              endDate: periodData.endDate,
              currency: periodData.currency,
              isActive: periodData.isActive,
              costPrice: String(room.costPrice),
              sellingPrice: String(room.sellingPrice),
              agentPrice: String(room.agentPrice)
            }
          })
        )
      )
      toast.success(`${validRooms.length} pricing record${validRooms.length > 1 ? 's' : ''} created`)
      navigate({ to: "/master-hotel-detail/$hotelId", params: { hotelId: hotelId.toString() } })
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
      subtitle={hotel ? `${hotel.name} · ${hotel.city}` : "Loading..."}
      actions={
        <Button
          variant="outline"
          onClick={() => navigate({ to: "/master-hotel-detail/$hotelId", params: { hotelId: hotelId.toString() } })}
          className="h-9 px-4 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 hover:text-black rounded-md text-xs font-semibold shadow-none"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Hotel
        </Button>
      }
    >
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-4">

        {/* Period Configuration */}
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
                  <p className="text-xs text-zinc-400">This period will be available for use in booking forms</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Existing Configs Notice */}
        {existingConfigs.length > 0 && (
          <div className="border border-blue-200 rounded-xl bg-blue-50 p-4">
            <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-3">
              Already saved for this period
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {existingConfigs.map(p => (
                <div key={p.id} className="bg-white rounded-lg border border-blue-100 p-3">
                  <p className="text-sm font-bold text-zinc-800">{p.roomType}</p>
                  <p className="text-xs text-zinc-400 mb-2">{p.mealPlan}</p>
                  <div className="space-y-0.5 text-xs text-zinc-500">
                    <div className="flex justify-between">
                      <span>Cost:</span>
                      <span className="font-mono font-semibold">{p.currency} {p.costPrice}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Direct:</span>
                      <span className="font-mono font-semibold text-zinc-800">{p.currency} {p.sellingPrice}</span>
                    </div>
                    {Number(p.agentPrice) > 0 && (
                      <div className="flex justify-between">
                        <span>Agent:</span>
                        <span className="font-mono font-semibold text-emerald-700">{p.currency} {p.agentPrice}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Room Types */}
        <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none overflow-hidden">
          <div className="px-6 py-4 border-b border-[#e5e7eb] flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-zinc-400" />
              <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider">Room Types & Pricing</h3>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRoomConfig}
              className="h-8 px-3 border-[#e5e7eb] text-zinc-700 hover:bg-zinc-50 text-xs font-semibold rounded-md shadow-none"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Row
            </Button>
          </div>

          <div className="p-4 space-y-3">
            {/* Header row */}
            <div className="hidden md:grid md:grid-cols-[2fr_1.5fr_1fr_1fr_1fr_auto] gap-3 px-1">
              <span className={labelCls}>Room Type *</span>
              <span className={labelCls}>Meal Plan *</span>
              <span className={labelCls}>Base Cost</span>
              <span className={labelCls}>Direct Price</span>
              <span className={labelCls}>Agent Price</span>
              <span></span>
            </div>

            {roomConfigs.map((room) => (
              <div key={room.id} className="grid grid-cols-1 md:grid-cols-[2fr_1.5fr_1fr_1fr_1fr_auto] gap-3 items-center bg-[#fafafa] border border-[#f3f4f6] rounded-lg p-3 md:p-2 md:bg-transparent md:border-0">
                <div>
                  <span className="block md:hidden text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Room Type</span>
                  <Input
                    value={room.roomType}
                    onChange={(e) => handleRoomChange(room.id, 'roomType', e.target.value)}
                    placeholder="e.g. Double, Triple, Suite"
                    required
                    className={inputCls}
                  />
                </div>
                <div>
                  <span className="block md:hidden text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Meal Plan</span>
                  <select
                    value={room.mealPlan}
                    onChange={(e) => handleRoomChange(room.id, 'mealPlan', e.target.value)}
                    className={selectCls}
                    required
                  >
                    <option value="Room Only">Room Only</option>
                    <option value="Breakfast">Breakfast</option>
                    <option value="Full Board">Full Board</option>
                  </select>
                </div>
                <div>
                  <span className="block md:hidden text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Base Cost</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={room.costPrice}
                    onChange={(e) => handleRoomChange(room.id, 'costPrice', parseFloat(e.target.value) || 0)}
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
                    value={room.sellingPrice}
                    onChange={(e) => handleRoomChange(room.id, 'sellingPrice', parseFloat(e.target.value) || 0)}
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
                    value={room.agentPrice}
                    onChange={(e) => handleRoomChange(room.id, 'agentPrice', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className={`${inputCls} font-mono`}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRoomConfig(room.id)}
                  className="h-10 w-10 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-full self-end md:self-center"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {roomConfigs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-sm text-zinc-400 font-medium mb-3">No room types added</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addRoomConfig}
                  className="h-9 px-4 border-[#e5e7eb] text-zinc-700 hover:bg-zinc-50 text-xs font-semibold rounded-md shadow-none"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Room
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
            onClick={() => navigate({ to: "/master-hotel-detail/$hotelId", params: { hotelId: hotelId.toString() } })}
            className="h-9 px-4 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 rounded-md text-xs font-semibold shadow-none"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || roomConfigs.length === 0 || !periodData.startDate}
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
