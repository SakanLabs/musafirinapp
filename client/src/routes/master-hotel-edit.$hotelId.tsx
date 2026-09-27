import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Save, ArrowLeft, Loader2, Building2, Phone, Briefcase } from "lucide-react"
import { useHotels, useUpdateHotel } from "@/lib/queries/master"

export const Route = createFileRoute("/master-hotel-edit/$hotelId")({
  component: EditMasterHotelPage
})

function EditMasterHotelPage() {
  const { hotelId: hotelIdParam } = Route.useParams()
  const hotelId = Number(hotelIdParam)
  const navigate = useNavigate()

  const { data: hotels = [], isLoading: isHotelsLoading } = useHotels()
  const updateHotelMutation = useUpdateHotel()

  const [formData, setFormData] = useState({
    name: "",
    city: "Makkah" as "Makkah" | "Madinah",
    address: "",
    starRating: 3,
    contactPerson: "",
    contactPhone: "",
    supplierName: "",
    picName: "",
    picContact: "",
    isActive: true
  })

  useEffect(() => {
    if (hotels.length > 0) {
      const hotel = hotels.find(h => h.id === hotelId)
      if (hotel) {
        setFormData({
          name: hotel.name,
          city: hotel.city,
          address: hotel.address || "",
          starRating: hotel.starRating || 3,
          contactPerson: hotel.contactPerson || "",
          contactPhone: hotel.contactPhone || "",
          supplierName: hotel.supplierName || "",
          picName: hotel.picName || "",
          picContact: hotel.picContact || "",
          isActive: hotel.isActive
        })
      }
    }
  }, [hotels, hotelId])

  const handleInputChange = (field: string, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name) {
      toast.error("Hotel name is required")
      return
    }
    try {
      await updateHotelMutation.mutateAsync({ id: hotelId, ...formData })
      toast.success("Hotel updated successfully")
      navigate({ to: "/master-hotels" })
    } catch (error) {
      toast.error("Failed to update hotel")
      console.error(error)
    }
  }

  const inputCls = "h-10 px-3 border-[#e5e7eb] rounded-lg bg-white text-sm focus-visible:ring-0 focus-visible:border-[#111111] shadow-none transition-colors"
  const selectCls = "w-full h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm text-zinc-700 focus:outline-none focus:border-[#111111] transition-colors"
  const labelCls = "text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 block"

  if (isHotelsLoading) {
    return (
      <PageLayout title="Edit Hotel">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="Edit Hotel"
      subtitle={`Editing: ${formData.name || '...'}`}
      actions={
        <Button
          variant="outline"
          onClick={() => navigate({ to: "/master-hotels" })}
          className="h-9 px-4 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 hover:text-black rounded-md text-xs font-semibold shadow-none"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Hotels
        </Button>
      }
    >
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-4">

        {/* Hotel Identity */}
        <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none overflow-hidden">
          <div className="px-6 py-4 border-b border-[#e5e7eb] flex items-center space-x-2">
            <Building2 className="h-4 w-4 text-zinc-400" />
            <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider">Hotel Information</h3>
          </div>
          <div className="p-6 space-y-5">
            <div>
              <label htmlFor="hotelName" className={labelCls}>Hotel Name *</label>
              <Input
                id="hotelName"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="e.g. Dar Al Tawhid Intercontinental"
                required
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label htmlFor="city" className={labelCls}>City *</label>
                <select
                  id="city"
                  value={formData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  className={selectCls}
                  required
                >
                  <option value="Makkah">Makkah</option>
                  <option value="Madinah">Madinah</option>
                </select>
              </div>
              <div>
                <label htmlFor="starRating" className={labelCls}>Star Rating (0–5)</label>
                <Input
                  id="starRating"
                  type="number"
                  min="0"
                  max="5"
                  value={formData.starRating}
                  onChange={(e) => handleInputChange('starRating', parseInt(e.target.value) || 0)}
                  placeholder="3"
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label htmlFor="address" className={labelCls}>Address</label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                placeholder="Full street address..."
                rows={3}
                className="px-3 py-2.5 border-[#e5e7eb] rounded-lg bg-white text-sm focus-visible:ring-0 focus-visible:border-[#111111] shadow-none transition-colors resize-none"
              />
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none overflow-hidden">
          <div className="px-6 py-4 border-b border-[#e5e7eb] flex items-center space-x-2">
            <Phone className="h-4 w-4 text-zinc-400" />
            <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider">Hotel Contact</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label htmlFor="contactPerson" className={labelCls}>Contact Person</label>
                <Input
                  id="contactPerson"
                  value={formData.contactPerson}
                  onChange={(e) => handleInputChange('contactPerson', e.target.value)}
                  placeholder="Manager / Reception name"
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="contactPhone" className={labelCls}>Contact Phone</label>
                <Input
                  id="contactPhone"
                  value={formData.contactPhone}
                  onChange={(e) => handleInputChange('contactPhone', e.target.value)}
                  placeholder="+966 50 123 4567"
                  className={inputCls}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Supplier & PIC */}
        <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none overflow-hidden">
          <div className="px-6 py-4 border-b border-[#e5e7eb] flex items-center space-x-2">
            <Briefcase className="h-4 w-4 text-zinc-400" />
            <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider">Supplier & PIC</h3>
          </div>
          <div className="p-6 space-y-5">
            <div>
              <label htmlFor="supplierName" className={labelCls}>Supplier Name</label>
              <Input
                id="supplierName"
                value={formData.supplierName}
                onChange={(e) => handleInputChange('supplierName', e.target.value)}
                placeholder="e.g. Global Hotels LLC"
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label htmlFor="picName" className={labelCls}>PIC Name</label>
                <Input
                  id="picName"
                  value={formData.picName}
                  onChange={(e) => handleInputChange('picName', e.target.value)}
                  placeholder="e.g. Ahmed Abdullah"
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="picContact" className={labelCls}>PIC Contact</label>
                <Input
                  id="picContact"
                  value={formData.picContact}
                  onChange={(e) => handleInputChange('picContact', e.target.value)}
                  placeholder="+966 55 987 6543"
                  className={inputCls}
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
                <p className="text-sm font-semibold text-[#111111]">Active in System</p>
                <p className="text-xs text-zinc-400">{formData.isActive ? 'Hotel is available for bookings' : 'Hotel is disabled'}</p>
              </div>
            </label>

            <div className="flex items-center space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate({ to: "/master-hotels" })}
                className="h-9 px-4 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 rounded-md text-xs font-semibold shadow-none"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateHotelMutation.isPending || !formData.name}
                className="bg-[#111111] hover:bg-[#242424] text-white h-9 px-5 rounded-md text-xs font-semibold transition-colors border border-transparent shadow-none disabled:opacity-50"
              >
                {updateHotelMutation.isPending ? (
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
