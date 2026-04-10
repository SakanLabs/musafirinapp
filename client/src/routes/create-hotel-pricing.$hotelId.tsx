import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Save, ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react"
import { useCreateHotelPricing, useHotels, useHotelPricing } from "@/lib/queries/master"

export const Route = createFileRoute("/create-hotel-pricing/$hotelId")({
  validateSearch: (search: Record<string, unknown>) => {
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

  const { startDate: qsStart, endDate: qsEnd } = Route.useSearch();

  const [periodData, setPeriodData] = useState({
    startDate: qsStart,
    endDate: qsEnd,
    currency: "SAR",
    isActive: true
  })

  const [roomConfigs, setRoomConfigs] = useState([
    { id: '1', roomType: 'Double', mealPlan: 'Room Only', costPrice: 0, sellingPrice: 0 },
    { id: '2', roomType: 'Triple', mealPlan: 'Room Only', costPrice: 0, sellingPrice: 0 },
    { id: '3', roomType: 'Quad', mealPlan: 'Room Only', costPrice: 0, sellingPrice: 0 }
  ])

  const handlePeriodChange = (field: string, value: string | boolean) => {
    setPeriodData(prev => ({ ...prev, [field]: value }))
  }

  const handleRoomChange = (id: string, field: string, value: string | number) => {
    setRoomConfigs(prev => prev.map(room => 
      room.id === id ? { ...room, [field]: value } : room
    ))
  }

  const addRoomConfig = () => {
    setRoomConfigs(prev => [
      ...prev,
      { id: Date.now().toString(), roomType: '', mealPlan: 'Room Only', costPrice: 0, sellingPrice: 0 }
    ])
  }

  const removeRoomConfig = (id: string) => {
    setRoomConfigs(prev => prev.filter(r => r.id !== id))
  }

  const [isSubmitting, setIsSubmitting] = useState(false)

  const existingConfigs = existingPricing.filter(p => {
    if (!periodData.startDate || !periodData.endDate) return false;
    const startStr = new Date(p.startDate).toISOString().split('T')[0];
    const endStr = new Date(p.endDate).toISOString().split('T')[0];
    return startStr === periodData.startDate && endStr === periodData.endDate;
  });

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

    const validRooms = roomConfigs.filter(r => r.roomType.trim() !== '')
    if (validRooms.length === 0) {
      toast.error('Please add at least one valid room type')
      return
    }

    try {
      setIsSubmitting(true)
      // Save all room types sequentially
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
              sellingPrice: String(room.sellingPrice)
            }
          })
        )
      )

      toast.success(`${validRooms.length} pricing periods created successfully`)
      navigate({ to: "/master-hotel-detail/$hotelId", params: { hotelId: hotelId.toString() } })
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
      subtitle={hotel ? `For Hotel: ${hotel.name} (${hotel.city})` : "Loading hotel details..."}
      actions={
        <Button variant="outline" onClick={() => navigate({ to: "/master-hotel-detail/$hotelId", params: { hotelId: hotelId.toString() } })}>
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

        {/* Existing Configs Alert */}
        {existingConfigs.length > 0 && (
          <div className="bg-blue-50 text-blue-800 p-4 rounded-lg border border-blue-200">
            <h4 className="font-semibold text-sm mb-3 flex items-center">
              <span className="mr-2">ℹ️</span> Already saved prices for this period:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              {existingConfigs.map(p => (
                <div key={p.id} className="bg-white p-3 rounded-md border border-blue-100 flex flex-col shadow-sm">
                  <span className="font-bold text-gray-800">{p.roomType}</span>
                  <span className="text-gray-500 mb-2">{p.mealPlan}</span>
                  <div className="flex justify-between mt-auto pt-2 border-t border-gray-100">
                    <span className="text-xs text-gray-400">Cost: {p.currency} {p.costPrice}</span>
                    <span className="font-semibold text-blue-700">{p.currency} {p.sellingPrice}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Room Configurations Segment */}
        <Card>
          <CardHeader className="flex flex-row justify-between items-center border-b pb-4">
            <CardTitle className="text-lg">Room Types</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addRoomConfig}>
              <Plus className="h-4 w-4 mr-2" />
              Add Room
            </Button>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            {roomConfigs.map((room, index) => (
              <div key={room.id} className="flex flex-wrap md:flex-nowrap gap-4 items-end bg-gray-50 p-4 rounded-lg border border-gray-100">
                <div className="w-full md:w-1/3">
                  <Label>Room Type *</Label>
                  <Input
                    value={room.roomType}
                    onChange={(e) => handleRoomChange(room.id, 'roomType', e.target.value)}
                    placeholder="E.g. Double, Triple, Suite"
                    required
                  />
                </div>
                
                <div className="w-full md:w-1/4">
                  <Label>Meal Plan *</Label>
                  <select
                    value={room.mealPlan}
                    onChange={(e) => handleRoomChange(room.id, 'mealPlan', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="Room Only">Room Only</option>
                    <option value="Breakfast">Breakfast</option>
                    <option value="Full Board">Full Board</option>
                  </select>
                </div>
                
                <div className="w-full md:w-1/4">
                  <Label>Cost Price</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={room.costPrice}
                    onChange={(e) => handleRoomChange(room.id, 'costPrice', parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>

                <div className="w-full md:w-1/4">
                  <Label>Selling Price</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={room.sellingPrice}
                    onChange={(e) => handleRoomChange(room.id, 'sellingPrice', parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>

                <div className="w-full md:w-auto">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRoomConfig(room.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            
            {roomConfigs.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No room types added yet. Click 'Add Room' to start.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: "/master-hotel-detail/$hotelId", params: { hotelId: hotelId.toString() } })}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || roomConfigs.length === 0 || !periodData.startDate}
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
