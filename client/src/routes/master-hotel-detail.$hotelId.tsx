import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import {
  Plus,
  Edit,
  Trash2,
  ArrowLeft,
  Calendar,
  Building2,
  Star,
  Loader2,
  ChevronDown,
  ChevronUp,
  MapPin,
  Phone,
  User,
  Briefcase,
  CheckCircle2,
  XCircle,
  DollarSign
} from "lucide-react"
import { formatDate } from "@/lib/utils"
import {
  useHotels,
  useHotelPricing,
  useDeleteHotelPricing,
  type HotelPricingPeriod
} from "@/lib/queries/master"

export const Route = createFileRoute("/master-hotel-detail/$hotelId")({
  component: MasterHotelDetailPage
})

function MasterHotelDetailPage() {
  const { hotelId: hotelIdParam } = Route.useParams()
  const hotelId = Number(hotelIdParam)
  const navigate = useNavigate()

  const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>({})

  const toggleGroup = (groupIdx: number) => {
    setExpandedGroups(prev => ({ ...prev, [groupIdx]: !prev[groupIdx] }))
  }

  const { data: hotels = [] } = useHotels()
  const hotel = hotels.find(h => h.id === hotelId)

  const { data: pricingPeriods = [], isLoading, error } = useHotelPricing(hotelId)
  const deletePricingMutation = useDeleteHotelPricing()

  const groupedPeriods = useMemo(() => {
    const groups: Record<string, HotelPricingPeriod[]> = {}
    pricingPeriods.forEach(p => {
      const key = `${p.startDate}_${p.endDate}`
      if (!groups[key]) groups[key] = []
      groups[key].push(p)
    })
    return Object.values(groups).sort((a, b) => new Date(b[0].startDate).getTime() - new Date(a[0].startDate).getTime())
  }, [pricingPeriods])

  const handleDeletePricing = async (id: number) => {
    if (!confirm('Are you sure you want to delete this pricing period?')) return
    try {
      await deletePricingMutation.mutateAsync({ hotelId, id })
      toast.success('Deleted pricing period')
    } catch {
      toast.error('Failed to delete')
    }
  }

  if (error) {
    return (
      <PageLayout title="Hotel Details">
        <div className="flex items-center justify-center py-16">
          <p className="text-red-500 text-sm font-medium">{error.message}</p>
        </div>
      </PageLayout>
    )
  }

  const starCount = hotel?.starRating || 0

  return (
    <PageLayout
      title={hotel ? hotel.name : "Hotel Details"}
      subtitle={hotel ? `${hotel.city}${hotel.starRating ? ` · ${hotel.starRating}★` : ''}` : "Loading..."}
      actions={
        <div className="flex items-center space-x-2.5">
          <Button
            variant="outline"
            onClick={() => navigate({ to: "/master-hotels" })}
            className="h-9 px-4 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 hover:text-black rounded-md text-xs font-semibold shadow-none"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate({ to: "/master-hotel-edit/$hotelId", params: { hotelId: hotelId.toString() } })}
            className="h-9 px-4 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 hover:text-black rounded-md text-xs font-semibold shadow-none"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Hotel
          </Button>
          <Button
            onClick={() => navigate({ to: "/create-hotel-pricing/$hotelId", params: { hotelId: hotelId.toString() } })}
            className="bg-[#111111] hover:bg-[#242424] text-white h-9 px-4 rounded-md text-xs font-semibold transition-colors border border-transparent shadow-none"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Pricing
          </Button>
        </div>
      }
    >
      {/* Hotel Info Cards */}
      {hotel && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Identity */}
          <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none p-5">
            <div className="flex items-center space-x-2 mb-4">
              <Building2 className="h-4 w-4 text-zinc-400" />
              <h3 className="text-xs font-bold text-[#111111] uppercase tracking-wider">Hotel Details</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <MapPin className="h-4 w-4 text-zinc-300 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">City</p>
                  <p className="text-sm text-zinc-800 font-medium">{hotel.city}</p>
                </div>
              </div>
              {hotel.address && (
                <div className="flex items-start space-x-3">
                  <MapPin className="h-4 w-4 text-zinc-300 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Address</p>
                    <p className="text-sm text-zinc-800">{hotel.address}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start space-x-3">
                <Star className="h-4 w-4 text-zinc-300 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Star Rating</p>
                  <div className="flex items-center space-x-1 mt-0.5">
                    {starCount > 0 ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3.5 w-3.5 ${i < starCount ? 'text-amber-400 fill-amber-400' : 'text-zinc-200 fill-zinc-200'}`}
                        />
                      ))
                    ) : (
                      <span className="text-sm text-zinc-400">Not rated</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle2 className="h-4 w-4 text-zinc-300 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Status</p>
                  {hotel.isActive ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 mt-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="h-3 w-3" /> Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 mt-0.5 rounded-full text-[11px] font-semibold bg-zinc-100 text-zinc-500 border border-zinc-200">
                      <XCircle className="h-3 w-3" /> Inactive
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Contact & Supplier */}
          <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none p-5">
            <div className="flex items-center space-x-2 mb-4">
              <Briefcase className="h-4 w-4 text-zinc-400" />
              <h3 className="text-xs font-bold text-[#111111] uppercase tracking-wider">Contact & Supplier</h3>
            </div>
            <div className="space-y-3">
              {hotel.contactPerson && (
                <div className="flex items-start space-x-3">
                  <User className="h-4 w-4 text-zinc-300 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Contact Person</p>
                    <p className="text-sm text-zinc-800 font-medium">{hotel.contactPerson}</p>
                  </div>
                </div>
              )}
              {hotel.contactPhone && (
                <div className="flex items-start space-x-3">
                  <Phone className="h-4 w-4 text-zinc-300 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Contact Phone</p>
                    <p className="text-sm text-zinc-800 font-medium">{hotel.contactPhone}</p>
                  </div>
                </div>
              )}
              {hotel.supplierName && (
                <div className="flex items-start space-x-3">
                  <Briefcase className="h-4 w-4 text-zinc-300 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Supplier</p>
                    <p className="text-sm text-zinc-800 font-medium">{hotel.supplierName}</p>
                  </div>
                </div>
              )}
              {hotel.picName && (
                <div className="flex items-start space-x-3">
                  <User className="h-4 w-4 text-zinc-300 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">PIC</p>
                    <p className="text-sm text-zinc-800 font-medium">{hotel.picName}</p>
                    {hotel.picContact && (
                      <p className="text-xs text-zinc-400 mt-0.5">{hotel.picContact}</p>
                    )}
                  </div>
                </div>
              )}
              {!hotel.contactPerson && !hotel.supplierName && !hotel.picName && (
                <p className="text-sm text-zinc-400 italic">No contact information recorded.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pricing Periods */}
      <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e5e7eb] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <DollarSign className="h-4 w-4 text-zinc-400" />
            <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider">Pricing Periods</h3>
            {!isLoading && (
              <span className="ml-2 text-xs font-semibold text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">
                {groupedPeriods.length} period{groupedPeriods.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <Button
            onClick={() => navigate({ to: "/create-hotel-pricing/$hotelId", params: { hotelId: hotelId.toString() } })}
            className="bg-[#111111] hover:bg-[#242424] text-white h-8 px-3 rounded-md text-xs font-semibold transition-colors border border-transparent shadow-none"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Period
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            <span className="ml-2 text-sm text-zinc-400">Loading pricing...</span>
          </div>
        ) : groupedPeriods.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <Calendar className="h-10 w-10 text-zinc-200 mb-3" />
            <p className="text-sm font-semibold text-zinc-500 mb-1">No pricing periods yet</p>
            <p className="text-xs text-zinc-400 mb-4">Add pricing periods to make this hotel bookable</p>
            <Button
              onClick={() => navigate({ to: "/create-hotel-pricing/$hotelId", params: { hotelId: hotelId.toString() } })}
              className="bg-[#111111] hover:bg-[#242424] text-white h-9 px-4 rounded-md text-xs font-semibold transition-colors border border-transparent shadow-none"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add First Pricing Period
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-[#e5e7eb]">
            {groupedPeriods.map((group, groupIdx) => {
              const first = group[0]
              const isExpanded = expandedGroups[groupIdx] === true
              return (
                <div key={groupIdx}>
                  {/* Period Header */}
                  <div
                    className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-6 py-4 cursor-pointer hover:bg-zinc-50 transition-colors"
                    onClick={() => toggleGroup(groupIdx)}
                  >
                    <div className="flex items-center space-x-3">
                      <Calendar className="h-4 w-4 text-zinc-300 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-[#111111]">
                          {formatDate(first.startDate)} — {formatDate(first.endDate)}
                        </p>
                        <div className="flex items-center space-x-2 mt-0.5">
                          {first.isActive ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                              <CheckCircle2 className="h-3 w-3" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-400">
                              <XCircle className="h-3 w-3" /> Inactive
                            </span>
                          )}
                          <span className="text-zinc-300">·</span>
                          <span className="text-[10px] text-zinc-400 font-medium">{group.length} room type{group.length !== 1 ? 's' : ''}</span>
                          <span className="text-zinc-300">·</span>
                          <span className="text-[10px] text-zinc-400 font-medium">{first.currency}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-3 border-[#e5e7eb] text-zinc-600 hover:text-[#111111] hover:bg-zinc-50 text-xs font-semibold rounded-md shadow-none"
                        onClick={(e) => {
                          e.stopPropagation()
                          const startStr = new Date(first.startDate).toISOString().split('T')[0]
                          const endStr = new Date(first.endDate).toISOString().split('T')[0]
                          navigate({
                            to: "/create-hotel-pricing/$hotelId",
                            params: { hotelId: hotelId.toString() },
                            search: { startDate: startStr, endDate: endStr }
                          })
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" /> Add Room
                      </Button>
                      <div className="w-7 h-7 flex items-center justify-center text-zinc-400">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Pricing Table */}
                  {isExpanded && (
                    <div className="overflow-x-auto bg-[#fafafa] border-t border-[#e5e7eb]">
                      <table className="w-full text-sm text-left">
                        <thead>
                          <tr className="border-b border-[#e5e7eb]">
                            <th className="py-3 px-6 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Room Type</th>
                            <th className="py-3 px-6 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Meal Plan</th>
                            <th className="py-3 px-6 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Base Cost</th>
                            <th className="py-3 px-6 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Direct Price</th>
                            <th className="py-3 px-6 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Agent Price</th>
                            <th className="py-3 px-6"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f3f4f6]">
                          {(() => {
                            const byRoomType = group.reduce((acc, curr) => {
                              if (!acc[curr.roomType]) acc[curr.roomType] = []
                              acc[curr.roomType].push(curr)
                              return acc
                            }, {} as Record<string, typeof group>)

                            return Object.entries(byRoomType).sort((a, b) => a[0].localeCompare(b[0])).map(([roomType, items]) => {
                              items.sort((a, b) => (a.mealPlan || '').localeCompare(b.mealPlan || ''))
                              return items.map((item, index) => (
                                <tr key={item.id} className="hover:bg-white transition-colors">
                                  {index === 0 && (
                                    <td
                                      className="py-3 px-6 font-semibold text-[#111111] text-sm align-middle border-r border-[#f3f4f6]"
                                      rowSpan={items.length}
                                    >
                                      {roomType}
                                    </td>
                                  )}
                                  <td className="py-3 px-6 text-zinc-600 text-sm">{item.mealPlan || 'Room Only'}</td>
                                  <td className="py-3 px-6 text-zinc-500 text-sm font-mono">{item.currency} {item.costPrice}</td>
                                  <td className="py-3 px-6 text-zinc-800 text-sm font-semibold font-mono">{item.currency} {item.sellingPrice}</td>
                                  <td className="py-3 px-6 text-emerald-700 text-sm font-semibold font-mono">{item.currency} {item.agentPrice || '0'}</td>
                                  <td className="py-3 px-6">
                                    <div className="flex items-center justify-end space-x-1">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-zinc-400 hover:text-[#111111] hover:bg-zinc-100 rounded-full"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          navigate({ to: "/edit-hotel-pricing/$hotelId/$pricingId", params: { hotelId: hotelId.toString(), pricingId: item.id.toString() } })
                                        }}
                                        title="Edit"
                                      >
                                        <Edit className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleDeletePricing(item.id)
                                        }}
                                        title="Delete"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            })
                          })()}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </PageLayout>
  )
}
