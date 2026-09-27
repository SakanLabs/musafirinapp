import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Save, ArrowLeft, Loader2, ArrowRight, Briefcase } from "lucide-react"
import { useTransportRoutes, useUpdateTransportRoute } from "@/lib/queries/master"
import { TRANSPORT_LOCATIONS } from "@/lib/constants"

export const Route = createFileRoute("/master-transport-edit/$routeId")({
  component: MasterTransportEditPage
})

function MasterTransportEditPage() {
  const { routeId: routeIdParam } = Route.useParams()
  const routeId = Number(routeIdParam)
  const navigate = useNavigate()

  const { data: routes = [], isLoading } = useTransportRoutes()
  const routeMaster = routes.find(r => r.id === routeId)
  const updateRouteMutation = useUpdateTransportRoute()

  const [formData, setFormData] = useState({
    originLocation: "",
    destinationLocation: "",
    supplierName: "",
    picName: "",
    picContact: "",
    isActive: true
  })

  useEffect(() => {
    if (routeMaster) {
      setFormData({
        originLocation: routeMaster.originLocation || "",
        destinationLocation: routeMaster.destinationLocation || "",
        supplierName: routeMaster.supplierName || "",
        picName: routeMaster.picName || "",
        picContact: routeMaster.picContact || "",
        isActive: routeMaster.isActive
      })
    }
  }, [routeMaster])

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.originLocation || !formData.destinationLocation) {
      toast.error("Please fill in all required fields.")
      return
    }
    try {
      await updateRouteMutation.mutateAsync({ id: routeId, ...formData })
      toast.success('Transport route updated successfully')
      navigate({ to: "/master-transport" })
    } catch (error) {
      toast.error('Failed to update transport route')
      console.error(error)
    }
  }

  const inputCls = "h-10 px-3 border-[#e5e7eb] rounded-lg bg-white text-sm focus-visible:ring-0 focus-visible:border-[#111111] shadow-none transition-colors"
  const labelCls = "text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 block"

  if (isLoading) {
    return (
      <PageLayout title="Edit Transport Route">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      </PageLayout>
    )
  }

  if (!routeMaster && !isLoading) {
    return (
      <PageLayout title="Edit Transport Route">
        <div className="flex items-center justify-center py-20">
          <p className="text-red-500 text-sm font-medium">Route not found.</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="Edit Transport Route"
      subtitle={routeMaster ? `${routeMaster.originLocation} → ${routeMaster.destinationLocation}` : "Update route details"}
      actions={
        <Button
          variant="outline"
          onClick={() => navigate({ to: "/master-transport" })}
          className="h-9 px-4 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 hover:text-black rounded-md text-xs font-semibold shadow-none"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Routes
        </Button>
      }
    >
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-4">

        {/* Route Details */}
        <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none overflow-hidden">
          <div className="px-6 py-4 border-b border-[#e5e7eb] flex items-center space-x-2">
            <ArrowRight className="h-4 w-4 text-zinc-400" />
            <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider">Route Details</h3>
          </div>
          <div className="p-6 space-y-5">
            {/* Live route preview */}
            {(formData.originLocation || formData.destinationLocation) && (
              <div className="flex items-center space-x-3 p-3 bg-zinc-50 rounded-lg border border-[#f3f4f6]">
                <span className="text-sm font-semibold text-zinc-600 truncate">
                  {formData.originLocation || '…'}
                </span>
                <ArrowRight className="h-4 w-4 text-zinc-300 shrink-0" />
                <span className="text-sm font-semibold text-zinc-600 truncate">
                  {formData.destinationLocation || '…'}
                </span>
              </div>
            )}

            <div>
              <label htmlFor="originLocation" className={labelCls}>Origin Location *</label>
              <select
                id="originLocation"
                value={formData.originLocation}
                onChange={(e) => handleInputChange('originLocation', e.target.value)}
                required
                className="w-full h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none transition-colors"
              >
                <option value="">Pilih Lokasi Asal</option>
                {TRANSPORT_LOCATIONS.map(loc => (
                  <option key={`origin-${loc}`} value={loc}>{loc}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="destinationLocation" className={labelCls}>Destination Location *</label>
              <select
                id="destinationLocation"
                value={formData.destinationLocation}
                onChange={(e) => handleInputChange('destinationLocation', e.target.value)}
                required
                className="w-full h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none transition-colors"
              >
                <option value="">Pilih Lokasi Tujuan</option>
                {TRANSPORT_LOCATIONS.map(loc => (
                  <option key={`dest-${loc}`} value={loc}>{loc}</option>
                ))}
              </select>
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
                placeholder="e.g. Al-Haramain Transport"
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
                  placeholder="e.g. Tariq"
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="picContact" className={labelCls}>PIC Contact</label>
                <Input
                  id="picContact"
                  value={formData.picContact}
                  onChange={(e) => handleInputChange('picContact', e.target.value)}
                  placeholder="+966 50 111 2222"
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
                <p className="text-sm font-semibold text-[#111111]">Active for Bookings</p>
                <p className="text-xs text-zinc-400">{formData.isActive ? 'Route is available in booking forms' : 'Route is disabled'}</p>
              </div>
            </label>

            <div className="flex items-center space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate({ to: "/master-transport" })}
                className="h-9 px-4 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 rounded-md text-xs font-semibold shadow-none"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateRouteMutation.isPending || !formData.originLocation || !formData.destinationLocation}
                className="bg-[#111111] hover:bg-[#242424] text-white h-9 px-5 rounded-md text-xs font-semibold transition-colors border border-transparent shadow-none disabled:opacity-50"
              >
                {updateRouteMutation.isPending ? (
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
