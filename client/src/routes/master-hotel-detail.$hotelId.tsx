import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Plus,
  Edit,
  Trash2,
  ArrowLeft,
  Calendar,
  Building,
  Star,
  Loader2,
  ChevronDown,
  ChevronUp
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

  // Collapsible state for each group
  const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>({})

  const toggleGroup = (groupIdx: number) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupIdx]: !prev[groupIdx]
    }))
  }

  // Data fetching
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
    } catch (error) {
      toast.error('Failed to delete')
    }
  }

  if (error) {
    return (
      <PageLayout title="Hotel Details">
        <div className="text-center py-8 text-red-600">Error: {error.message}</div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title={hotel ? `Hotel: ${hotel.name}` : "Loading Details..."}
      subtitle={hotel ? `${hotel.city} ${hotel.starRating ? `• ${hotel.starRating} Stars` : ''}` : "Fetching hotel details"}
      actions={
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => navigate({ to: "/master-hotels" })}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Hotels
          </Button>
          <Button onClick={() => navigate({ to: "/create-hotel-pricing/$hotelId", params: { hotelId: hotelId.toString() } })}>
            <Plus className="h-4 w-4 mr-2" />
            Add Pricing Period
          </Button>
        </div>
      }
    >
      {/* Hotel Summary */}
      {hotel && (
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
           <Card>
             <CardHeader className="pb-2">
                 <CardTitle className="text-md flex items-center"><Building className="h-4 w-4 mr-2 text-gray-500" /> Information</CardTitle>
             </CardHeader>
             <CardContent>
               <div className="space-y-1 text-sm text-gray-700">
                 <p><span className="font-semibold text-gray-900">Address:</span> {hotel.address || 'N/A'}</p>
                 <p><span className="font-semibold text-gray-900">City:</span> {hotel.city}</p>
                 <p><span className="font-semibold text-gray-900">Contact Person:</span> {hotel.contactPerson || 'N/A'}</p>
                 <p><span className="font-semibold text-gray-900">Contact Phone:</span> {hotel.contactPhone || 'N/A'}</p>
                 <p><span className="font-semibold text-gray-900">Supplier Name:</span> {hotel.supplierName || 'N/A'}</p>
                 <p><span className="font-semibold text-gray-900">PIC Name:</span> {hotel.picName || 'N/A'}</p>
                 <p><span className="font-semibold text-gray-900">PIC Contact:</span> {hotel.picContact || 'N/A'}</p>
                 <p><span className="font-semibold text-gray-900">Status:</span> {hotel.isActive ? 'Active' : 'Inactive'}</p>
               </div>
             </CardContent>
           </Card>
           <Card>
             <CardHeader className="pb-2">
                 <CardTitle className="text-md flex items-center"><Star className="h-4 w-4 mr-2 text-gray-500"/> Contact Info</CardTitle>
             </CardHeader>
             <CardContent>
               <div className="space-y-1 text-sm text-gray-700">
                 <p><span className="font-semibold text-gray-900">Contact Person:</span> {hotel.contactPerson || 'N/A'}</p>
                 <p><span className="font-semibold text-gray-900">Phone:</span> {hotel.contactPhone || 'N/A'}</p>
               </div>
             </CardContent>
           </Card>
         </div>
      )}

      {/* Pricing Periods List */}
      <h3 className="font-semibold text-lg flex items-center mb-4 text-gray-800">
         <Calendar className="h-5 w-5 mr-2 text-blue-500" /> Current Pricing Periods
      </h3>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : groupedPeriods.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 text-center py-8 text-gray-500">
          No pricing periods configured for this hotel.
        </div>
      ) : (
        <div className="space-y-4">
          {groupedPeriods.map((group, groupIdx) => {
            const first = group[0]
            const isExpanded = expandedGroups[groupIdx] === true // Default to false if undefined
            return (
              <Card key={groupIdx} className="overflow-hidden border border-gray-200 shadow-sm transition-all duration-200">
                <div 
                  className="bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer border-b border-gray-200 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  onClick={() => toggleGroup(groupIdx)}
                >
                  <div className="flex items-center space-x-3">
                    <Calendar className="h-5 w-5 text-gray-400" />
                    <div>
                      <h4 className="font-bold text-gray-800">
                        {formatDate(first.startDate)} — {formatDate(first.endDate)}
                      </h4>
                      <div className="text-sm text-gray-500 mt-1 flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${first.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {first.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <span>•</span>
                        <span>{group.length} Room Types</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end items-center mr-2 space-x-2 text-gray-500">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="bg-white border-blue-200 text-blue-600 hover:bg-blue-50"
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
                      <Plus className="h-3 w-3 mr-1"/> Add Room/Meal
                    </Button>
                    <div className="p-1">
                      {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </div>
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="overflow-x-auto bg-white transition-all duration-300">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50/50 text-gray-600">
                        <tr>
                          <th className="py-3 px-6 font-medium">Room Type</th>
                          <th className="py-3 px-6 font-medium">Meal Plan</th>
                          <th className="py-3 px-6 font-medium">Base Cost</th>
                          <th className="py-3 px-6 font-medium">Retail Selling Price</th>
                          <th className="py-3 px-6 font-medium text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(() => {
                          const byRoomType = group.reduce((acc, curr) => {
                            if (!acc[curr.roomType]) acc[curr.roomType] = [];
                            acc[curr.roomType].push(curr);
                            return acc;
                          }, {} as Record<string, typeof group>);

                          return Object.entries(byRoomType).sort((a, b) => a[0].localeCompare(b[0])).map(([roomType, items]) => {
                            items.sort((a, b) => (a.mealPlan || '').localeCompare(b.mealPlan || ''));
                            return items.map((item, index) => (
                              <tr key={item.id} className={`hover:bg-gray-50/50 transition-colors ${index === items.length - 1 ? 'border-b-2 border-gray-100' : 'border-b border-gray-100'}`}>
                                {index === 0 && (
                                  <td 
                                    className="py-3 px-6 font-semibold text-gray-800 bg-gray-50/40 align-middle border-r border-gray-100" 
                                    rowSpan={items.length}
                                  >
                                    {roomType}
                                  </td>
                                )}
                                <td className="py-3 px-6 text-gray-700 font-medium">{item.mealPlan || 'Room Only'}</td>
                                <td className="py-3 px-6 text-gray-600">{item.currency} {item.costPrice}</td>
                                <td className="py-3 px-6 text-gray-600">{item.currency} {item.sellingPrice}</td>
                                <td className="py-3 px-6 text-right">
                                  <div className="flex justify-end space-x-2">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 w-8 p-0"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        navigate({ to: "/edit-hotel-pricing/$hotelId/$pricingId", params: { hotelId: hotelId.toString(), pricingId: item.id.toString() } })
                                      }}
                                      title="Edit Period"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleDeletePricing(item.id)
                                      }}
                                      title="Delete Period"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ));
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </PageLayout>
  )
}
