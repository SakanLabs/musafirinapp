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
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => navigate({ to: "/custom-la-requests" })}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali
          </Button>

          <div className="flex space-x-2 items-center">
            <div className="flex items-center space-x-2 mr-2">
              <select
                className="border border-gray-300 rounded-md text-sm px-2 py-1.5 h-9"
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
                  className="border border-gray-300 rounded-md text-sm px-2 py-1.5 h-9 w-32"
                />
              )}
            </div>
            <Button variant="outline" className="border-amber-500 text-amber-600 hover:bg-amber-50" onClick={() => navigate({ to: `/custom-la-quotation/${id}?currency=${displayCurrency}&rate=${exchangeRate}` })}>
              <FileText className="h-4 w-4 mr-2" />
              Lihat Penawaran (PDF)
            </Button>
            <Button variant="outline" onClick={handleShareWhatsApp}>
              <Share className="h-4 w-4 mr-2" />
              Kirim via WhatsApp
            </Button>
            {request.status === 'pending' && (
              <Button onClick={() => handleUpdateStatus('quoted')} disabled={isUpdating} className="bg-blue-600 hover:bg-blue-700 text-white">
                <RefreshCw className={`h-4 w-4 mr-2 ${isUpdating ? 'animate-spin' : ''}`} />
                Tandai sbg Quoted
              </Button>
            )}
            {(request.status === 'pending' || request.status === 'quoted') && (
              <Button onClick={() => handleUpdateStatus('invoiced')} disabled={isUpdating} className="bg-green-600 hover:bg-green-700 text-white">
                <FileText className={`h-4 w-4 mr-2 ${isUpdating ? 'animate-spin' : ''}`} />
                Terbitkan Invoice Resmi
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Overview & Rincian</TabsTrigger>
            <TabsTrigger value="billing">Billing & Pembayaran</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              {/* Kolom Kiri: Informasi Data */}
              <div className="md:col-span-2 space-y-6">

                <Card>
                  <CardHeader className="bg-gray-50 border-b">
                    <CardTitle className="text-lg flex items-center">
                      <Users className="w-5 h-5 mr-2" /> Info Pemesan
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Nama PIC</p>
                      <p className="font-semibold">{request.customerName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">No. Telepon / WA</p>
                      <p className="font-semibold">{request.customerPhone || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="font-semibold">{request.customerEmail || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Nama Travel</p>
                      <p className="font-semibold">{request.travelName || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Total Jamaah</p>
                      <p className="font-semibold">{totals.totalPax || request.totalPax || 0} Pax</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Durasi Malam</p>
                      <p className="font-semibold">{totals.totalMalam || (makkahNights + madinahNights)} Malam</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="bg-amber-50 border-b border-amber-100">
                    <CardTitle className="text-lg flex items-center text-amber-900">
                      <Building className="w-5 h-5 mr-2" /> Jadwal & Hotel
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Kedatangan</p>
                        <p className="font-semibold">{meta.tanggalKedatangan || '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Keberangkatan</p>
                        <p className="font-semibold">{meta.tanggalKeberangkatan || '-'}</p>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center mb-2">
                        <p className="font-semibold">Hotel Makkah ({makkahNights} Malam)</p>
                        <p className="font-bold text-amber-700">{formatCurrency(totals.makkahHotelTotal || 0, 'SAR')}</p>
                      </div>

                      {makkahNights > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="bg-gray-50 p-2 rounded-md">
                            <p className="text-xs text-gray-500">Single ({meta.rooms?.makkah?.singleQty || 0} Kamar)</p>
                            <p className="font-semibold">{formatCurrency(meta.rooms?.makkah?.singlePrice || 0, 'SAR')} / mlm</p>
                          </div>
                          <div className="bg-gray-50 p-2 rounded-md">
                            <p className="text-xs text-gray-500">Double ({meta.rooms?.makkah?.doubleQty || 0} Kamar)</p>
                            <p className="font-semibold">{formatCurrency(meta.rooms?.makkah?.doublePrice || 0, 'SAR')} / mlm</p>
                          </div>
                          <div className="bg-gray-50 p-2 rounded-md">
                            <p className="text-xs text-gray-500">Triple ({meta.rooms?.makkah?.tripleQty || 0} Kamar)</p>
                            <p className="font-semibold">{formatCurrency(meta.rooms?.makkah?.triplePrice || 0, 'SAR')} / mlm</p>
                          </div>
                          <div className="bg-gray-50 p-2 rounded-md">
                            <p className="text-xs text-gray-500">Quad ({meta.rooms?.makkah?.quadQty || 0} Kamar)</p>
                            <p className="font-semibold">{formatCurrency(meta.rooms?.makkah?.quadPrice || 0, 'SAR')} / mlm</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">Tidak ada pemesanan Hotel Makkah.</p>
                      )}
                    </div>

                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center mb-2">
                        <p className="font-semibold">Hotel Madinah ({madinahNights} Malam)</p>
                        <p className="font-bold text-amber-700">{formatCurrency(totals.madinahHotelTotal || 0, 'SAR')}</p>
                      </div>

                      {madinahNights > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="bg-gray-50 p-2 rounded-md">
                            <p className="text-xs text-gray-500">Single ({meta.rooms?.madinah?.singleQty || 0} Kamar)</p>
                            <p className="font-semibold">{formatCurrency(meta.rooms?.madinah?.singlePrice || 0, 'SAR')} / mlm</p>
                          </div>
                          <div className="bg-gray-50 p-2 rounded-md">
                            <p className="text-xs text-gray-500">Double ({meta.rooms?.madinah?.doubleQty || 0} Kamar)</p>
                            <p className="font-semibold">{formatCurrency(meta.rooms?.madinah?.doublePrice || 0, 'SAR')} / mlm</p>
                          </div>
                          <div className="bg-gray-50 p-2 rounded-md">
                            <p className="text-xs text-gray-500">Triple ({meta.rooms?.madinah?.tripleQty || 0} Kamar)</p>
                            <p className="font-semibold">{formatCurrency(meta.rooms?.madinah?.triplePrice || 0, 'SAR')} / mlm</p>
                          </div>
                          <div className="bg-gray-50 p-2 rounded-md">
                            <p className="text-xs text-gray-500">Quad ({meta.rooms?.madinah?.quadQty || 0} Kamar)</p>
                            <p className="font-semibold">{formatCurrency(meta.rooms?.madinah?.quadPrice || 0, 'SAR')} / mlm</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">Tidak ada pemesanan Hotel Madinah.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="bg-blue-50 border-b border-blue-100">
                    <CardTitle className="text-lg flex items-center text-blue-900">
                      <Plane className="w-5 h-5 mr-2" /> Transportasi
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">Total Transportasi</p>
                        <p className="text-sm text-gray-500">Sesuai pengaturan rute / bus (Fixed)</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(totals.totalTransport || 0, 'SAR')}</p>
                      </div>
                    </div>
                    {meta.handlingDetails?.keretaCepat > 0 && (
                      <div className="flex justify-between items-center mt-2 pt-2 border-t">
                        <div>
                          <p className="font-medium">Kereta Cepat</p>
                          <p className="text-sm text-gray-500">Per Pax</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(meta.handlingDetails.keretaCepat, 'SAR')}</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="bg-green-50 border-b border-green-100">
                    <CardTitle className="text-lg flex items-center text-green-900">
                      <Package className="w-5 h-5 mr-2" /> Layanan Tambahan (Handling)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-2">
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
                        <div key={key} className="flex justify-between items-center py-1 border-b last:border-b-0">
                          <span className="text-gray-600">{label}</span>
                          <span className="font-semibold">{formatCurrency(numVal, 'SAR')}</span>
                        </div>
                      );
                    })}
                    {totals.includeVisa && (
                      <div className="flex justify-between items-center py-1 mt-2 border-t pt-2 border-gray-200">
                        <span className="text-gray-600 font-medium">Total Layanan Tambahan</span>
                        <span className="font-semibold">{formatCurrency(totals.visaTotal || 0, 'SAR')}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="bg-emerald-50 border-b border-emerald-100">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center text-emerald-900">
                        <Map className="w-5 h-5 mr-2" /> City Tour & Penugasan Muthowif
                      </CardTitle>
                      <Button variant="outline" size="sm" onClick={() => setIsAssignMuthowifOpen(true)}>
                        <UserCheck className="mr-2 h-4 w-4" />
                        Assign Muthowif Tour
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    <div className="bg-white p-3 rounded border text-sm text-gray-700">
                      <strong>Jadwal City Tour:</strong> Muthowif akan ditugaskan untuk mengawal City Tour (Makkah, Madinah, Jeddah, Thaif, dll) sesuai kebutuhan rombongan.
                    </div>

                    <div className="space-y-3">
                      {isAssignmentsLoading ? (
                        <p className="text-gray-500 text-sm">Loading...</p>
                      ) : assignmentsData?.assignments && assignmentsData.assignments.length > 0 ? (
                        assignmentsData.assignments.map((assignment, idx) => (
                          <div key={idx} className="bg-gray-50 p-4 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4 border">
                            <div>
                              <p className="font-semibold text-gray-900">{assignment.muthowif?.name} <Badge variant={assignment.status === 'active' ? 'default' : 'secondary'} className="ml-2">{assignment.status}</Badge></p>
                              <p className="text-sm text-gray-500 mt-1">Visa: {assignment.muthowif?.visaStatus} | Tipe: {assignment.muthowif?.residentType}</p>
                              <p className="text-sm text-gray-500">Tugas: {formatDate(assignment.startDate)} - {formatDate(assignment.endDate)}</p>
                              {assignment.taskDescription && <p className="text-sm text-gray-600 mt-2 bg-white p-2 rounded border">Catatan Tour: {assignment.taskDescription}</p>}
                            </div>
                            {assignment.status === 'active' && (
                              <Button variant="secondary" size="sm" onClick={() => handleCompleteTask(assignment.id)} disabled={completeTaskMutation.isPending}>
                                {completeTaskMutation.isPending ? 'Memproses...' : 'Selesaikan Tugas'}
                              </Button>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-500 text-sm italic">Belum ada muthowif yang ditugaskan untuk City Tour rombongan ini.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

              </div>

              {/* Kolom Kanan: Pricing Summary */}
              <div className="space-y-6">
                <Card>
                  <CardHeader className="bg-purple-50 border-b border-purple-100">
                    <CardTitle className="text-lg flex items-center text-purple-900">
                      <Package className="w-5 h-5 mr-2" /> Detail Layanan (Sub-Bookings)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3">
                    <p className="text-sm text-gray-500 mb-2">Layanan berikut digenerate otomatis. Klik untuk mengelola spesifik.</p>

                    {request.linkedBookings?.map((b) => (
                      <div key={b.id} className="flex justify-between items-center p-3 border rounded-md hover:bg-gray-50">
                        <div>
                          <p className="font-semibold">{b.hotelName} <Badge variant="outline">{b.city}</Badge></p>
                          <p className="text-xs text-gray-500">Check-in: {formatDate(b.checkIn)}</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => navigate({ to: `/booking-view/${b.id}` })}>
                          Hotel ➔
                        </Button>
                      </div>
                    ))}

                    {request.linkedTransport?.map((t) => (
                      <div key={t.id} className="flex justify-between items-center p-3 border rounded-md hover:bg-gray-50">
                        <div>
                          <p className="font-semibold">Transportasi <Badge variant="outline">{t.status}</Badge></p>
                          <p className="text-xs text-gray-500">{t.number}</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => navigate({ to: `/transportation-booking-detail/${t.id}` })}>
                          Transport ➔
                        </Button>
                      </div>
                    ))}

                    {request.linkedServiceOrders?.map((so) => (
                      <div key={so.id} className="flex justify-between items-center p-3 border rounded-md hover:bg-gray-50">
                        <div>
                          <p className="font-semibold">Visa <Badge variant="outline">{so.status}</Badge></p>
                          <p className="text-xs text-gray-500">{so.number} • {so.totalPax} Pax</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => navigate({ to: `/service-orders/${so.id}` })}>
                          Visa ➔
                        </Button>
                      </div>
                    ))}

                    {(!request.linkedBookings?.length && !request.linkedTransport?.length && !request.linkedServiceOrders?.length) && (
                      <p className="text-sm text-gray-400 italic">Belum ada layanan yang terhubung.</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-amber-200 shadow-md">
                  <CardHeader className="bg-amber-50 border-b border-amber-200">
                    <CardTitle className="text-xl">Ringkasan Harga</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">

                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Total Jamaah</span>
                      <span className="font-bold">{totals.totalPax || 0} Pax</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Total Hotel Makkah</span>
                      <span className="font-semibold">{formatCurrency(totals.makkahHotelTotal || 0, 'SAR')}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Total Hotel Madinah</span>
                      <span className="font-semibold">{formatCurrency(totals.madinahHotelTotal || 0, 'SAR')}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Total Transportasi</span>
                      <span className="font-semibold">{formatCurrency(totals.totalTransport || 0, 'SAR')}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Layanan Tambahan</span>
                      <span className="font-semibold">{formatCurrency((totals.subTotalHandling || 0) - (totals.totalTransport || 0), 'SAR')}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm text-amber-600">
                      <span className="font-semibold">Profit ({meta.profitType === 'percentage' ? `${meta.profitValue}%` : 'Fixed Amount'})</span>
                      <span className="font-semibold">+{formatCurrency(totals.profit || 0, 'SAR')}</span>
                    </div>

                    <div className="pt-4 border-t mt-4">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-gray-800 font-bold">GRAND TOTAL</span>
                        <div className="text-right">
                          <span className="text-xl font-black text-amber-600 block">{formatCurrency(totals.grandTotal || 0, 'SAR')}</span>
                          {displayCurrency === 'IDR' && (
                            <span className="text-sm font-bold text-gray-500">{formatCurrency((totals.grandTotal || 0) * Number(exchangeRate), 'IDR')}</span>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 space-y-1">
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Sub-Total Non-Hotel / Pax</span>
                          <span>{formatCurrency(nonHotelPerPax, 'SAR')}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 text-sm">Harga Per Pax (Double)</span>
                          <div className="text-right">
                            <span className="text-sm font-bold text-green-600 block">{formatCurrency(priceDouble, 'SAR')}</span>
                            {displayCurrency === 'IDR' && <span className="text-xs text-gray-500">{formatCurrency(priceDouble * Number(exchangeRate), 'IDR')}</span>}
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 text-sm">Harga Per Pax (Triple)</span>
                          <div className="text-right">
                            <span className="text-sm font-bold text-green-600 block">{formatCurrency(priceTriple, 'SAR')}</span>
                            {displayCurrency === 'IDR' && <span className="text-xs text-gray-500">{formatCurrency(priceTriple * Number(exchangeRate), 'IDR')}</span>}
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 text-sm">Harga Per Pax (Quad)</span>
                          <div className="text-right">
                            <span className="text-sm font-bold text-green-600 block">{formatCurrency(priceQuad, 'SAR')}</span>
                            {displayCurrency === 'IDR' && <span className="text-xs text-gray-500">{formatCurrency(priceQuad * Number(exchangeRate), 'IDR')}</span>}
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
