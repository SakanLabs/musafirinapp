import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Share, Users, Phone, Loader2, RefreshCw, FileText, Building, Plane, Package } from "lucide-react"
import { authService } from "@/lib/auth"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useCustomLaRequest, useUpdateCustomLaStatus } from "@/lib/queries"
import { useState } from "react"

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

Terima kasih atas permintaan Paket LA Dinamis Anda (No. Req: ${request.number}).
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
  const nonHotelTotal = request.totalAmountSAR - (totals.makkahHotelTotal || 0) - (totals.madinahHotelTotal || 0)
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
                  <p className="font-semibold mb-2">Hotel Makkah ({meta.rooms?.makkah?.nights || 0} Malam)</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                </div>

                <div className="border-t pt-4">
                  <p className="font-semibold mb-2">Hotel Madinah ({meta.rooms?.madinah?.nights || 0} Malam)</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <div className="flex justify-between items-center py-1 border-b">
                  <span className="text-gray-600">Handling Airport</span>
                  <span className="font-semibold">{formatCurrency(meta.handlingDetails?.handlingAirport || 0, 'SAR')} <span className="text-xs text-gray-400 font-normal">/pax</span></span>
                </div>
                <div className="flex justify-between items-center py-1 border-b">
                  <span className="text-gray-600">Handling Hotel</span>
                  <span className="font-semibold">{formatCurrency(meta.handlingDetails?.handlingHotel || 0, 'SAR')} <span className="text-xs text-gray-400 font-normal">/pax</span></span>
                </div>
                <div className="flex justify-between items-center py-1 border-b">
                  <span className="text-gray-600">Tiket Museum</span>
                  <span className="font-semibold">{formatCurrency(meta.handlingDetails?.tiketMuseum || 0, 'SAR')} <span className="text-xs text-gray-400 font-normal">/pax</span></span>
                </div>
                <div className="flex justify-between items-center py-1 border-b">
                  <span className="text-gray-600">Muthowif</span>
                  <span className="font-semibold">{formatCurrency(meta.handlingDetails?.muthowif || 0, 'SAR')}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b">
                  <span className="text-gray-600">Muthowifah Raudhah</span>
                  <span className="font-semibold">{formatCurrency(meta.handlingDetails?.muthowifahRaudhah || 0, 'SAR')}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b">
                  <span className="text-gray-600">Tip Driver</span>
                  <span className="font-semibold">{formatCurrency(meta.handlingDetails?.tipDriver || 0, 'SAR')}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b">
                  <span className="text-gray-600">Biaya Tak Terduga</span>
                  <span className="font-semibold">{formatCurrency(meta.handlingDetails?.biayaTakTerduga || 0, 'SAR')}</span>
                </div>
                {totals.includeVisa && (
                  <div className="flex justify-between items-center py-1 mt-2">
                    <span className="text-gray-600">VISA + Siskopatuh</span>
                    <span className="font-semibold">{formatCurrency(totals.visaTotal || 0, 'SAR')}</span>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>

          {/* Kolom Kanan: Pricing Summary */}
          <div className="space-y-6">
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
      </div>
    </PageLayout>
  )
}
