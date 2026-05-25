import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AssignMuthowifModal } from "@/components/modals/AssignMuthowifModal"
import { ArrowLeft, Share, Users, Phone, Loader2, RefreshCw, FileText, Building, Plane, Package, Map, UserCheck } from "lucide-react"
import { authService } from "@/lib/auth"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useCustomLaRequest, useUpdateCustomLaStatus } from "@/lib/queries"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api"
import { useState } from "react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BillingTab } from "@/components/custom-la/BillingTab"

export const Route = createFileRoute("/custom-la-detail/$id")({
  beforeLoad: async () => {
    const isAuthenticated = await authService.isAuthenticated()
    if (!isAuthenticated) {
      throw redirect({ to: "/login" })
    }
  },
  component: CustomLaDetailPage,
})

function CustomLaDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()

  const { data: request, isLoading, error } = useCustomLaRequest(parseInt(id))
  const updateStatus = useUpdateCustomLaStatus()
  const [isUpdating, setIsUpdating] = useState(false)
  const [displayCurrency, setDisplayCurrency] = useState('SAR')
  const [exchangeRate, setExchangeRate] = useState('4400')
  const [isAssignMuthowifOpen, setIsAssignMuthowifOpen] = useState(false)

  const queryClient = useQueryClient()

  const { data: assignmentsData, isLoading: isAssignmentsLoading } = useQuery<{ assignments: any[] }>({
    queryKey: ['muthowif-assignments', 'custom_la', id],
    queryFn: () => apiClient.get(`/api/muthowifs/assignments/custom_la/${id}`),
    enabled: !!id
  })

  const completeTaskMutation = useMutation({
    mutationFn: (assignmentId: number) => apiClient.post(`/api/muthowifs/complete-task/${assignmentId}`),
    onSuccess: () => {
      toast.success('Tugas Muthowif telah diselesaikan.')
      queryClient.invalidateQueries({ queryKey: ['muthowif-assignments', 'custom_la', id] })
      queryClient.invalidateQueries({ queryKey: ['muthowifs'] })
    },
    onError: (err: any) => toast.error(`Gagal menyelesaikan tugas: ${err.message}`)
  })

  const handleCompleteTask = (assignmentId: number) => {
    if (confirm('Apakah Anda yakin tugas muthowif ini sudah selesai? Muthowif akan dikembalikan ke status Idle.')) {
      completeTaskMutation.mutate(assignmentId)
    }
  }

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      setIsUpdating(true)
      await updateStatus.mutateAsync({ id: parseInt(id), status: newStatus })
      toast.success(`Status berhasil diupdate menjadi ${newStatus.toUpperCase()}`)
    } catch (error) {
      toast.error('Gagal mengupdate status')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleShareWhatsApp = () => {
    if (!request) return

    const msg = `Halo Bapak/Ibu ${request.customerName},

Terima kasih atas permintaan Paket LA Anda (No. Req: ${request.number}).
Berikut adalah ringkasannya:
- Total Jamaah: ${request.totalPax} Pax
- Durasi: ${(request.meta?.rooms?.makkah?.nights || 0) + (request.meta?.rooms?.madinah?.nights || 0)} Malam
- Harga Per Pax: ${formatCurrency(request.meta?.totals?.perPaxPrice || 0, 'SAR')}
- Grand Total: ${formatCurrency(request.totalAmountSAR, 'SAR')}

Status saat ini: *${request.status.toUpperCase()}*

Silakan hubungi kami jika ada penyesuaian yang ingin dilakukan.`

    const url = `https://wa.me/${request.customerPhone?.replace(/^0/, '62')}?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  if (isLoading) {
    return (
      <PageLayout title="Loading..." subtitle="Memuat detail permintaan">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </PageLayout>
    )
  }

  if (error || !request) {
    return (
      <PageLayout title="Error" subtitle="Permintaan tidak ditemukan">
        <div className="text-center text-red-600 p-8">
          Permintaan LA tidak ditemukan.
        </div>
      </PageLayout>
    )
  }

  const meta = request.meta || {}
  const totals = meta.totals || {}
  const rooms = meta.rooms || { makkah: {}, madinah: {} }

  const makkahNights = rooms.makkah?.nights || 0
  const madinahNights = rooms.madinah?.nights || 0
  const nonHotelTotal = Number(request.totalAmountSAR) - (totals.makkahHotelTotal || 0) - (totals.madinahHotelTotal || 0)
  const nonHotelPerPax = request.totalPax > 0 ? nonHotelTotal / request.totalPax : 0

  const priceDouble = totals.priceDouble || (nonHotelPerPax + (((rooms.makkah?.doublePrice || 0) * makkahNights) / 2) + (((rooms.madinah?.doublePrice || 0) * madinahNights) / 2))
  const priceTriple = totals.priceTriple || (nonHotelPerPax + (((rooms.makkah?.triplePrice || 0) * makkahNights) / 3) + (((rooms.madinah?.triplePrice || 0) * madinahNights) / 3))
  const priceQuad = totals.priceQuad || (nonHotelPerPax + (((rooms.makkah?.quadPrice || 0) * makkahNights) / 4) + (((rooms.madinah?.quadPrice || 0) * madinahNights) / 4))

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "quoted": return "bg-blue-100 text-blue-800 border-blue-200"
      case "invoiced": return "bg-green-100 text-green-800 border-green-200"
      case "cancelled": return "bg-red-100 text-red-800 border-red-200"
      default: return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  return (
    <PageLayout title={`Review Permintaan: ${request.number}`} subtitle={`Status: ${request.status.toUpperCase()}`}>
      <div className="space-y-6">

        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate({ to: "/custom-la-requests" })}
            className="h-9 px-4 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 hover:text-black flex items-center rounded-md font-medium text-xs self-start"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-2 mr-2">
              <select
                className="w-24 h-9 px-3 border border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] bg-white text-xs font-semibold text-zinc-800"
                value={displayCurrency}
                onChange={(e) => setDisplayCurrency(e.target.value)}
              >
                <option value="SAR">SAR</option>
                <option value="IDR">IDR</option>
              </select>
              {displayCurrency === 'IDR' && (
                <input
                  type="number"
                  placeholder="Kurs SAR ke IDR"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                  className="w-32 h-9 px-3 border border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] bg-white text-xs font-semibold text-zinc-800"
                />
              )}
            </div>
            <Button 
              variant="outline" 
              onClick={() => navigate({ to: `/custom-la-quotation/${id}?currency=${displayCurrency}&rate=${exchangeRate}` })}
              className="h-9 px-3.5 border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-black flex items-center rounded-md text-xs font-semibold transition-colors"
            >
              <FileText className="h-4 w-4 mr-2 text-zinc-500" />
              Lihat Penawaran (PDF)
            </Button>
            <Button 
              variant="outline" 
              onClick={handleShareWhatsApp}
              className="h-9 px-3.5 border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-black flex items-center rounded-md text-xs font-semibold transition-colors"
            >
              <Share className="h-4 w-4 mr-2 text-zinc-500" />
              Kirim via WhatsApp
            </Button>
            {request.status === 'pending' && (
              <Button 
                onClick={() => handleUpdateStatus('quoted')} 
                disabled={isUpdating} 
                className="bg-[#111111] hover:bg-[#242424] text-white h-9 px-4 rounded-md text-xs font-semibold transition-colors border border-transparent shadow-none"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-2 text-white ${isUpdating ? 'animate-spin' : ''}`} />
                Tandai sbg Quoted
              </Button>
            )}
            {(request.status === 'pending' || request.status === 'quoted') && (
              <Button 
                onClick={() => handleUpdateStatus('invoiced')} 
                disabled={isUpdating} 
                className="bg-[#111111] hover:bg-[#242424] text-white h-9 px-4 rounded-md text-xs font-semibold transition-colors border border-transparent shadow-none"
              >
                <FileText className={`h-3.5 w-3.5 mr-2 text-white ${isUpdating ? 'animate-spin' : ''}`} />
                Terbitkan Invoice Resmi
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="bg-zinc-100 p-1 rounded-full border border-zinc-200/50 inline-flex mb-4">
            <TabsTrigger 
              value="overview"
              className="px-4 py-1.5 rounded-full text-xs font-semibold text-zinc-500 data-[state=active]:bg-white data-[state=active]:text-zinc-950 data-[state=active]:shadow-sm transition-all"
            >
              Overview & Rincian
            </TabsTrigger>
            <TabsTrigger 
              value="billing"
              className="px-4 py-1.5 rounded-full text-xs font-semibold text-zinc-500 data-[state=active]:bg-white data-[state=active]:text-zinc-950 data-[state=active]:shadow-sm transition-all"
            >
              Billing & Pembayaran
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              {/* Kolom Kiri: Informasi Data */}
              <div className="md:col-span-2 space-y-6">

                <Card className="border border-[#e5e7eb] rounded-xl bg-white shadow-none overflow-hidden">
                  <CardHeader className="bg-zinc-50/50 border-b border-[#e5e7eb] px-6 py-4">
                    <CardTitle className="text-sm font-bold text-zinc-900 flex items-center tracking-tight">
                      <Users className="w-4 h-4 mr-2 text-zinc-500" /> Info Pemesan
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Nama PIC</p>
                      <p className="font-semibold text-zinc-900 text-sm">{request.customerName}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">No. Telepon / WA</p>
                      <p className="font-semibold text-zinc-900 text-sm">{request.customerPhone || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Email</p>
                      <p className="font-semibold text-zinc-900 text-sm">{request.customerEmail || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Nama Travel</p>
                      <p className="font-semibold text-zinc-900 text-sm">{request.travelName || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Total Jamaah</p>
                      <p className="font-semibold text-zinc-900 text-sm">{totals.totalPax || request.totalPax || 0} Pax</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Durasi Malam</p>
                      <p className="font-semibold text-zinc-900 text-sm">{totals.totalMalam || (makkahNights + madinahNights)} Malam</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-[#e5e7eb] rounded-xl bg-white shadow-none overflow-hidden">
                  <CardHeader className="bg-zinc-50/50 border-b border-[#e5e7eb] px-6 py-4">
                    <CardTitle className="text-sm font-bold text-zinc-900 flex items-center tracking-tight">
                      <Building className="w-4 h-4 mr-2 text-zinc-500" /> Jadwal & Hotel
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Kedatangan</p>
                        <p className="font-semibold text-zinc-900 text-sm">{meta.tanggalKedatangan || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Keberangkatan</p>
                        <p className="font-semibold text-zinc-900 text-sm">{meta.tanggalKeberangkatan || '-'}</p>
                      </div>
                    </div>

                    <div className="border-t border-[#e5e7eb] pt-6">
                      <div className="flex justify-between items-center mb-4">
                        <p className="font-bold text-sm text-zinc-900">Hotel Makkah ({makkahNights} Malam)</p>
                        <p className="font-bold text-zinc-950 text-sm">{formatCurrency(totals.makkahHotelTotal || 0, 'SAR')}</p>
                      </div>

                      {makkahNights > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="bg-zinc-50/50 border border-zinc-150 p-3 rounded-lg">
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Single ({meta.rooms?.makkah?.singleQty || 0} Kamar)</p>
                            <p className="font-bold text-zinc-900 mt-1 text-sm">{formatCurrency(meta.rooms?.makkah?.singlePrice || 0, 'SAR')} <span className="text-[10px] font-normal text-zinc-500">/mlm</span></p>
                          </div>
                          <div className="bg-zinc-50/50 border border-zinc-150 p-3 rounded-lg">
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Double ({meta.rooms?.makkah?.doubleQty || 0} Kamar)</p>
                            <p className="font-bold text-zinc-900 mt-1 text-sm">{formatCurrency(meta.rooms?.makkah?.doublePrice || 0, 'SAR')} <span className="text-[10px] font-normal text-zinc-500">/mlm</span></p>
                          </div>
                          <div className="bg-zinc-50/50 border border-zinc-150 p-3 rounded-lg">
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Triple ({meta.rooms?.makkah?.tripleQty || 0} Kamar)</p>
                            <p className="font-bold text-zinc-900 mt-1 text-sm">{formatCurrency(meta.rooms?.makkah?.triplePrice || 0, 'SAR')} <span className="text-[10px] font-normal text-zinc-500">/mlm</span></p>
                          </div>
                          <div className="bg-zinc-50/50 border border-zinc-150 p-3 rounded-lg">
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Quad ({meta.rooms?.makkah?.quadQty || 0} Kamar)</p>
                            <p className="font-bold text-zinc-900 mt-1 text-sm">{formatCurrency(meta.rooms?.makkah?.quadPrice || 0, 'SAR')} <span className="text-[10px] font-normal text-zinc-500">/mlm</span></p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-400 italic">Tidak ada pemesanan Hotel Makkah.</p>
                      )}
                    </div>

                    <div className="border-t border-[#e5e7eb] pt-6">
                      <div className="flex justify-between items-center mb-4">
                        <p className="font-bold text-sm text-zinc-900">Hotel Madinah ({madinahNights} Malam)</p>
                        <p className="font-bold text-zinc-950 text-sm">{formatCurrency(totals.madinahHotelTotal || 0, 'SAR')}</p>
                      </div>

                      {madinahNights > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="bg-zinc-50/50 border border-zinc-150 p-3 rounded-lg">
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Single ({meta.rooms?.madinah?.singleQty || 0} Kamar)</p>
                            <p className="font-bold text-zinc-900 mt-1 text-sm">{formatCurrency(meta.rooms?.madinah?.singlePrice || 0, 'SAR')} <span className="text-[10px] font-normal text-zinc-500">/mlm</span></p>
                          </div>
                          <div className="bg-zinc-50/50 border border-zinc-150 p-3 rounded-lg">
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Double ({meta.rooms?.madinah?.doubleQty || 0} Kamar)</p>
                            <p className="font-bold text-zinc-900 mt-1 text-sm">{formatCurrency(meta.rooms?.madinah?.doublePrice || 0, 'SAR')} <span className="text-[10px] font-normal text-zinc-500">/mlm</span></p>
                          </div>
                          <div className="bg-zinc-50/50 border border-zinc-150 p-3 rounded-lg">
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Triple ({meta.rooms?.madinah?.tripleQty || 0} Kamar)</p>
                            <p className="font-bold text-zinc-900 mt-1 text-sm">{formatCurrency(meta.rooms?.madinah?.triplePrice || 0, 'SAR')} <span className="text-[10px] font-normal text-zinc-500">/mlm</span></p>
                          </div>
                          <div className="bg-zinc-50/50 border border-zinc-150 p-3 rounded-lg">
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Quad ({meta.rooms?.madinah?.quadQty || 0} Kamar)</p>
                            <p className="font-bold text-zinc-900 mt-1 text-sm">{formatCurrency(meta.rooms?.madinah?.quadPrice || 0, 'SAR')} <span className="text-[10px] font-normal text-zinc-500">/mlm</span></p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-400 italic">Tidak ada pemesanan Hotel Madinah.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-[#e5e7eb] rounded-xl bg-white shadow-none overflow-hidden">
                  <CardHeader className="bg-zinc-50/50 border-b border-[#e5e7eb] px-6 py-4">
                    <CardTitle className="text-sm font-bold text-zinc-900 flex items-center tracking-tight">
                      <Plane className="w-4 h-4 mr-2 text-zinc-500" /> Transportasi
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-bold text-zinc-900 text-sm">Total Transportasi</p>
                        <p className="text-xs text-zinc-500 mt-0.5">Sesuai pengaturan rute / bus (Fixed)</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-zinc-950 text-sm">{formatCurrency(totals.totalTransport || 0, 'SAR')}</p>
                      </div>
                    </div>
                    {meta.handlingDetails?.keretaCepat > 0 && (
                      <div className="flex justify-between items-center mt-2 pt-4 border-t border-zinc-150">
                        <div>
                          <p className="font-semibold text-zinc-800 text-sm">Kereta Cepat</p>
                          <p className="text-xs text-zinc-500 mt-0.5">Per Pax</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-zinc-900 text-sm">{formatCurrency(meta.handlingDetails.keretaCepat, 'SAR')}</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border border-[#e5e7eb] rounded-xl bg-white shadow-none overflow-hidden">
                  <CardHeader className="bg-zinc-50/50 border-b border-[#e5e7eb] px-6 py-4">
                    <CardTitle className="text-sm font-bold text-zinc-900 flex items-center tracking-tight">
                      <Package className="w-4 h-4 mr-2 text-zinc-500" /> Layanan Tambahan (Handling)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-3">
                    {Object.entries(meta.handlingDetails || {}).map(([key, value]) => {
                      // Filter out known legacy hardcoded keys to prevent them from showing up on old bookings
                      const legacyKeys = ['muthowifTourType', 'handlingAirport', 'handlingHotel', 'tiketMuseum', 'muthowif', 'muthowifahRaudhah', 'tipDriver', 'biayaTakTerduga'];
                      if (key === 'keretaCepat' || legacyKeys.includes(key)) return null;

                      const numVal = Number(value);
                      if (numVal <= 0) return null;

                      // Format camelCase keys for legacy entries (e.g. tiketMuseum -> Tiket Museum),
                      // Dynamic keys from DB will already be space-separated names.
                      let label = key;
                      if (!key.includes(' ')) {
                        label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                      }

                      return (
                        <div key={key} className="flex justify-between items-center py-2 border-b border-zinc-100 last:border-b-0">
                          <span className="text-xs font-medium text-zinc-600 uppercase tracking-wider">{label}</span>
                          <span className="font-bold text-zinc-900 text-sm">{formatCurrency(numVal, 'SAR')}</span>
                        </div>
                      );
                    })}
                    {totals.includeVisa && (
                      <div className="flex justify-between items-center py-2 mt-2 border-t pt-4 border-[#e5e7eb]">
                        <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Total Layanan Tambahan</span>
                        <span className="font-bold text-zinc-900 text-sm">{formatCurrency(totals.visaTotal || 0, 'SAR')}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border border-[#e5e7eb] rounded-xl bg-white shadow-none overflow-hidden">
                  <CardHeader className="bg-zinc-50/50 border-b border-[#e5e7eb] px-6 py-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-bold text-zinc-900 flex items-center tracking-tight">
                        <Map className="w-4 h-4 mr-2 text-zinc-500" /> City Tour & Penugasan Muthowif
                      </CardTitle>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setIsAssignMuthowifOpen(true)}
                        className="h-8 px-3 rounded-md text-xs font-semibold border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-black flex items-center transition-colors"
                      >
                        <UserCheck className="mr-1.5 h-3.5 w-3.5" />
                        Assign Muthowif Tour
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="bg-zinc-50/50 border border-zinc-200/60 p-4 rounded-lg text-xs font-medium text-zinc-600">
                      <strong>Jadwal City Tour:</strong> Muthowif akan ditugaskan untuk mengawal City Tour (Makkah, Madinah, Jeddah, Thaif, dll) sesuai kebutuhan rombongan.
                    </div>

                    <div className="space-y-4">
                      {isAssignmentsLoading ? (
                        <p className="text-zinc-400 text-xs italic">Loading...</p>
                      ) : assignmentsData?.assignments && assignmentsData.assignments.length > 0 ? (
                        assignmentsData.assignments.map((assignment, idx) => (
                          <div key={idx} className="bg-white p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-[#e5e7eb]">
                            <div>
                              <p className="font-bold text-zinc-900 text-sm flex items-center">
                                {assignment.muthowif?.name} 
                                <Badge 
                                  variant="outline" 
                                  className={`ml-2 text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded ${assignment.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50' : 'bg-zinc-50 text-zinc-500 border-zinc-200'}`}
                                >
                                  {assignment.status}
                                </Badge>
                              </p>
                              <p className="text-xs text-zinc-500 mt-2">Visa: {assignment.muthowif?.visaStatus} | Tipe: {assignment.muthowif?.residentType}</p>
                              <p className="text-xs text-zinc-500 mt-1">Tugas: {formatDate(assignment.startDate)} - {formatDate(assignment.endDate)}</p>
                              {assignment.taskDescription && <p className="text-xs text-zinc-600 mt-3 bg-zinc-50 p-2.5 rounded-lg border border-zinc-200/50">Catatan Tour: {assignment.taskDescription}</p>}
                            </div>
                            {assignment.status === 'active' && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleCompleteTask(assignment.id)} 
                                disabled={completeTaskMutation.isPending}
                                className="h-8 text-xs px-3 border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                              >
                                {completeTaskMutation.isPending ? 'Memproses...' : 'Selesaikan Tugas'}
                              </Button>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-zinc-400 text-xs italic text-center py-4">Belum ada muthowif yang ditugaskan untuk City Tour rombongan ini.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

              </div>

              {/* Kolom Kanan: Pricing Summary */}
              <div className="space-y-6">
                <Card className="border border-[#e5e7eb] rounded-xl bg-white shadow-none overflow-hidden">
                  <CardHeader className="bg-zinc-50/50 border-b border-[#e5e7eb] px-6 py-4">
                    <CardTitle className="text-sm font-bold text-zinc-900 flex items-center tracking-tight">
                      <Package className="w-4 h-4 mr-2 text-zinc-500" /> Detail Layanan (Sub-Bookings)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-3">
                    <p className="text-xs text-zinc-400 mb-4 italic">Layanan berikut digenerate otomatis. Klik untuk mengelola spesifik.</p>

                    {request.linkedBookings?.map((b) => (
                      <div key={b.id} className="flex justify-between items-center p-3.5 border border-zinc-100 rounded-xl hover:bg-zinc-50 transition-colors">
                        <div>
                          <p className="font-bold text-zinc-900 text-xs">{b.hotelName}</p>
                          <p className="text-[10px] text-zinc-500 mt-1 flex items-center gap-1.5">
                            Check-in: {formatDate(b.checkIn)}
                            <Badge variant="outline" className="text-[8px] font-bold py-0 px-1 bg-zinc-50 text-zinc-600 rounded">{b.city}</Badge>
                          </p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => navigate({ to: `/booking-view/${b.id}` })}
                          className="h-8 text-xs font-semibold px-2 hover:bg-zinc-100 text-zinc-700"
                        >
                          Hotel ➔
                        </Button>
                      </div>
                    ))}

                    {request.linkedTransport?.map((t) => (
                      <div key={t.id} className="flex justify-between items-center p-3.5 border border-zinc-100 rounded-xl hover:bg-zinc-50 transition-colors">
                        <div>
                          <p className="font-bold text-zinc-900 text-xs">Transportasi</p>
                          <p className="text-[10px] text-zinc-500 mt-1 flex items-center gap-1.5">
                            {t.number}
                            <Badge variant="outline" className="text-[8px] font-bold py-0 px-1 bg-zinc-50 text-zinc-600 rounded capitalize">{t.status}</Badge>
                          </p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => navigate({ to: `/transportation-booking-detail/${t.id}` })}
                          className="h-8 text-xs font-semibold px-2 hover:bg-zinc-100 text-zinc-700"
                        >
                          Transport ➔
                        </Button>
                      </div>
                    ))}

                    {request.linkedServiceOrders?.map((so) => (
                      <div key={so.id} className="flex justify-between items-center p-3.5 border border-zinc-100 rounded-xl hover:bg-zinc-50 transition-colors">
                        <div>
                          <p className="font-bold text-zinc-900 text-xs">Visa</p>
                          <p className="text-[10px] text-zinc-500 mt-1 flex items-center gap-1.5">
                            {so.number} • {so.totalPax} Pax
                            <Badge variant="outline" className="text-[8px] font-bold py-0 px-1 bg-zinc-50 text-zinc-600 rounded capitalize">{so.status}</Badge>
                          </p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => navigate({ to: `/service-orders/${so.id}` })}
                          className="h-8 text-xs font-semibold px-2 hover:bg-zinc-100 text-zinc-700"
                        >
                          Visa ➔
                        </Button>
                      </div>
                    ))}

                    {(!request.linkedBookings?.length && !request.linkedTransport?.length && !request.linkedServiceOrders?.length) && (
                      <p className="text-xs text-zinc-400 italic text-center py-4">Belum ada layanan yang terhubung.</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="border border-[#e5e7eb] rounded-xl bg-white shadow-none overflow-hidden">
                  <CardHeader className="bg-zinc-50/50 border-b border-[#e5e7eb] px-6 py-4">
                    <CardTitle className="text-sm font-bold text-zinc-900 tracking-tight">Ringkasan Harga</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">

                    <div className="flex justify-between items-center text-xs font-semibold text-zinc-600 uppercase tracking-wider">
                      <span>Total Jamaah</span>
                      <span className="font-bold text-zinc-900">{totals.totalPax || 0} Pax</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-semibold text-zinc-600 uppercase tracking-wider">
                      <span>Total Hotel Makkah</span>
                      <span className="font-semibold text-zinc-900">{formatCurrency(totals.makkahHotelTotal || 0, 'SAR')}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-semibold text-zinc-600 uppercase tracking-wider">
                      <span>Total Hotel Madinah</span>
                      <span className="font-semibold text-zinc-900">{formatCurrency(totals.madinahHotelTotal || 0, 'SAR')}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-semibold text-zinc-600 uppercase tracking-wider">
                      <span>Total Transportasi</span>
                      <span className="font-semibold text-zinc-900">{formatCurrency(totals.totalTransport || 0, 'SAR')}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-semibold text-zinc-600 uppercase tracking-wider">
                      <span>Layanan Tambahan</span>
                      <span className="font-semibold text-zinc-900">{formatCurrency((totals.subTotalHandling || 0) - (totals.totalTransport || 0), 'SAR')}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold text-[#b45309] uppercase tracking-wider">
                      <span>Profit ({meta.profitType === 'percentage' ? `${meta.profitValue}%` : 'Fixed Amount'})</span>
                      <span>+{formatCurrency(totals.profit || 0, 'SAR')}</span>
                    </div>

                    <div className="pt-4 border-t border-[#e5e7eb] mt-4">
                      <div className="flex justify-between items-start mb-4">
                        <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider mt-1">GRAND TOTAL</span>
                        <div className="text-right">
                          <span className="text-2xl font-bold text-[#111111] block tracking-tight">{formatCurrency(totals.grandTotal || 0, 'SAR')}</span>
                          {displayCurrency === 'IDR' && (
                            <span className="text-xs font-semibold text-zinc-400">{formatCurrency((totals.grandTotal || 0) * Number(exchangeRate), 'IDR')}</span>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 space-y-3 pt-3 border-t border-zinc-100">
                        <div className="flex justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                          <span>Sub-Total Non-Hotel / Pax</span>
                          <span>{formatCurrency(nonHotelPerPax, 'SAR')}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Pax (Double)</span>
                          <div className="text-right">
                            <span className="text-sm font-bold text-zinc-900 block">{formatCurrency(priceDouble, 'SAR')}</span>
                            {displayCurrency === 'IDR' && <span className="text-[10px] text-zinc-400 font-semibold">{formatCurrency(priceDouble * Number(exchangeRate), 'IDR')}</span>}
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Pax (Triple)</span>
                          <div className="text-right">
                            <span className="text-sm font-bold text-zinc-900 block">{formatCurrency(priceTriple, 'SAR')}</span>
                            {displayCurrency === 'IDR' && <span className="text-[10px] text-zinc-400 font-semibold">{formatCurrency(priceTriple * Number(exchangeRate), 'IDR')}</span>}
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Pax (Quad)</span>
                          <div className="text-right">
                            <span className="text-sm font-bold text-zinc-900 block">{formatCurrency(priceQuad, 'SAR')}</span>
                            {displayCurrency === 'IDR' && <span className="text-[10px] text-zinc-400 font-semibold">{formatCurrency(priceQuad * Number(exchangeRate), 'IDR')}</span>}
                          </div>
                        </div>
                      </div>
                    </div>

                  </CardContent>
                </Card>
              </div>

            </div>
          </TabsContent>

          <TabsContent value="billing">
            <BillingTab laId={parseInt(id)} />
          </TabsContent>
        </Tabs>
      </div>

      {request && (
        <AssignMuthowifModal
          isOpen={isAssignMuthowifOpen}
          onClose={() => setIsAssignMuthowifOpen(false)}
          referenceType="custom_la"
          referenceId={parseInt(id.toString())}
          startDate={meta.tanggalKedatangan || new Date().toISOString()}
          endDate={meta.tanggalKeberangkatan || new Date().toISOString()}
        />
      )}
    </PageLayout>
  )
}
