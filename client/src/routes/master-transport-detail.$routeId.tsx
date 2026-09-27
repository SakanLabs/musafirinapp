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
  Loader2,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Briefcase,
  Phone,
  User,
  CheckCircle2,
  XCircle,
  DollarSign,
  Bus
} from "lucide-react"
import { formatDate } from "@/lib/utils"
import {
  useTransportRoutes,
  useTransportPricing,
  useDeleteTransportPricing,
  type TransportationRoutePricingPeriod
} from "@/lib/queries/master"

export const Route = createFileRoute("/master-transport-detail/$routeId")({
  component: MasterTransportDetailPage
})

// Vehicle type icons/labels
const VEHICLE_LABELS: Record<string, string> = {
  sedan: 'Sedan',
  staria: 'Staria',
  hiace: 'Hiace',
  gmc: 'GMC',
  coaster: 'Coaster',
  bus: 'Bus'
}

function MasterTransportDetailPage() {
  const { routeId: routeIdParam } = Route.useParams()
  const routeId = Number(routeIdParam)
  const navigate = useNavigate()

  const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>({})

  const toggleGroup = (groupIdx: number) => {
    setExpandedGroups(prev => ({ ...prev, [groupIdx]: !prev[groupIdx] }))
  }

  const { data: routes = [] } = useTransportRoutes()
  const routeMaster = routes.find(r => r.id === routeId)

  const { data: pricingPeriods = [], isLoading, error } = useTransportPricing(routeId)
  const deletePricingMutation = useDeleteTransportPricing()

  const groupedPeriods = useMemo(() => {
    const groups: Record<string, TransportationRoutePricingPeriod[]> = {}
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
      await deletePricingMutation.mutateAsync({ routeId, id })
      toast.success('Deleted pricing period')
    } catch {
      toast.error('Failed to delete')
    }
  }

  if (error) {
    return (
      <PageLayout title="Transport Route Details">
        <div className="flex items-center justify-center py-16">
          <p className="text-red-500 text-sm font-medium">{error.message}</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title={routeMaster ? `${routeMaster.originLocation} → ${routeMaster.destinationLocation}` : "Route Details"}
      subtitle="Transport route pricing periods"
      actions={
        <div className="flex items-center space-x-2.5">
          <Button
            variant="outline"
            onClick={() => navigate({ to: "/master-transport" })}
            className="h-9 px-4 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 hover:text-black rounded-md text-xs font-semibold shadow-none"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate({ to: "/master-transport-edit/$routeId", params: { routeId: routeId.toString() } })}
            className="h-9 px-4 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 hover:text-black rounded-md text-xs font-semibold shadow-none"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Route
          </Button>
          <Button
            onClick={() => navigate({ to: "/create-transport-pricing/$routeId", params: { routeId: routeId.toString() } })}
            className="bg-[#111111] hover:bg-[#242424] text-white h-9 px-4 rounded-md text-xs font-semibold transition-colors border border-transparent shadow-none"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Pricing
          </Button>
        </div>
      }
    >
      {/* Route Info Card */}
      {routeMaster && (
        <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none p-5 mb-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            {/* Route visual */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-100">
                <Bus className="h-4 w-4 text-zinc-500" />
              </div>
              <div className="flex items-center space-x-2">
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">From</p>
                  <p className="text-sm font-semibold text-[#111111]">{routeMaster.originLocation}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-zinc-300 mx-1" />
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">To</p>
                  <p className="text-sm font-semibold text-[#111111]">{routeMaster.destinationLocation}</p>
                </div>
              </div>
            </div>

            {/* Status + supplier */}
            <div className="flex items-center space-x-4">
              {routeMaster.supplierName && (
                <div className="text-right">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Supplier</p>
                  <p className="text-sm text-zinc-700">{routeMaster.supplierName}</p>
                </div>
              )}
              {routeMaster.picName && (
                <div className="text-right">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">PIC</p>
                  <p className="text-sm text-zinc-700">{routeMaster.picName}</p>
                  {routeMaster.picContact && (
                    <p className="text-xs text-zinc-400">{routeMaster.picContact}</p>
                  )}
                </div>
              )}
              {routeMaster.isActive ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="h-3 w-3" /> Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-100 text-zinc-500 border border-zinc-200">
                  <XCircle className="h-3 w-3" /> Inactive
                </span>
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
            onClick={() => navigate({ to: "/create-transport-pricing/$routeId", params: { routeId: routeId.toString() } })}
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
            <p className="text-xs text-zinc-400 mb-4">Add pricing periods to make this route bookable</p>
            <Button
              onClick={() => navigate({ to: "/create-transport-pricing/$routeId", params: { routeId: routeId.toString() } })}
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
                          <span className="text-[10px] text-zinc-400 font-medium">{group.length} vehicle type{group.length !== 1 ? 's' : ''}</span>
                          <span className="text-zinc-300">·</span>
                          <span className="text-[10px] text-zinc-400 font-medium">{first.currency}</span>
                        </div>
                      </div>
                    </div>
                    <div className="w-7 h-7 flex items-center justify-center text-zinc-400 shrink-0">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>

                  {/* Expanded Table */}
                  {isExpanded && (
                    <div className="overflow-x-auto bg-[#fafafa] border-t border-[#e5e7eb]">
                      <table className="w-full text-sm text-left">
                        <thead>
                          <tr className="border-b border-[#e5e7eb]">
                            <th className="py-3 px-6 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Vehicle Type</th>
                            <th className="py-3 px-6 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Base Cost</th>
                            <th className="py-3 px-6 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Direct Price</th>
                            <th className="py-3 px-6 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Agent Price</th>
                            <th className="py-3 px-6"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f3f4f6]">
                          {group.map(item => (
                            <tr key={item.id} className="hover:bg-white transition-colors">
                              <td className="py-3 px-6">
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-100 text-xs font-semibold text-zinc-700 capitalize">
                                  <Bus className="h-3 w-3" />
                                  {VEHICLE_LABELS[item.vehicleType] || item.vehicleType}
                                </span>
                              </td>
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
                                      navigate({ to: "/edit-transport-pricing/$routeId/$pricingId", params: { routeId: routeId.toString(), pricingId: item.id.toString() } })
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
                          ))}
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
