import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useHotels, useCustomLaRequest } from "@/lib/queries"
import { Loader2, ArrowLeft, Printer } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export const Route = createFileRoute('/custom-la-quotation/$id')({
  component: CustomLaQuotationPage
})

function CustomLaQuotationPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  
  const searchParams = new URLSearchParams(window.location.search)
  const currency = searchParams.get('currency') || 'SAR'
  const exchangeRate = parseFloat(searchParams.get('rate') || '1')
  
  const { data: request, isLoading: isReqLoading } = useCustomLaRequest(parseInt(id))
  const { data: hotels, isLoading: isHotelsLoading } = useHotels()

  if (isReqLoading || isHotelsLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!request) {
    return <div className="p-8 text-center text-red-600">Permintaan tidak ditemukan.</div>
  }

  const meta = request.meta || {}
  const totals = meta.totals || {}
  const rooms = meta.rooms || { makkah: {}, madinah: {} }
  const handling = meta.handlingDetails || {}

  const makkahHotel = hotels?.find(h => h.id == (meta.makkahHotelId || totals.makkahHotelId))
  const madinahHotel = hotels?.find(h => h.id == (meta.madinahHotelId || totals.madinahHotelId))

  // Calculate pricing per pax per room type
  const makkahNights = rooms.makkah.nights || 0
  const madinahNights = rooms.madinah.nights || 0
  const totalNights = makkahNights + madinahNights

  const nonHotelTotal = request.totalAmountSAR - (totals.makkahHotelTotal || 0) - (totals.madinahHotelTotal || 0)
  const nonHotelPerPax = request.totalPax > 0 ? nonHotelTotal / request.totalPax : 0

  const makkahDoublePerPax = ((rooms.makkah.doublePrice || 0) * makkahNights) / 2
  const madinahDoublePerPax = ((rooms.madinah.doublePrice || 0) * madinahNights) / 2
  const priceDouble = (nonHotelPerPax + makkahDoublePerPax + madinahDoublePerPax) * exchangeRate

  const makkahTriplePerPax = ((rooms.makkah.triplePrice || 0) * makkahNights) / 3
  const madinahTriplePerPax = ((rooms.madinah.triplePrice || 0) * madinahNights) / 3
  const priceTriple = (nonHotelPerPax + makkahTriplePerPax + madinahTriplePerPax) * exchangeRate

  const makkahQuadPerPax = ((rooms.makkah.quadPrice || 0) * makkahNights) / 4
  const madinahQuadPerPax = ((rooms.madinah.quadPrice || 0) * madinahNights) / 4
  const priceQuad = (nonHotelPerPax + makkahQuadPerPax + madinahQuadPerPax) * exchangeRate

  const minValidPrice = nonHotelPerPax * exchangeRate

  return (
    <div className="min-h-screen bg-gray-100 py-8 font-sans print:bg-white print:py-0">
      <div className="max-w-[210mm] mx-auto mb-4 flex justify-between print:hidden">
        <Button variant="outline" onClick={() => navigate({ to: `/custom-la-detail/${id}` })}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Kembali
        </Button>
        <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white">
          <Printer className="h-4 w-4 mr-2" /> Cetak PDF
        </Button>
      </div>

      <style type="text/css">
        {`
          @media print {
            @page { size: A4; margin: 0; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        `}
      </style>

      <div className="w-[210mm] h-[297mm] mx-auto bg-white shadow-lg print:shadow-none overflow-hidden relative">
        {/* Background Template */}
        <img src="/Template LA.png" alt="Template Background" className="absolute inset-0 w-full h-full object-fill z-0" />

        <div className="relative z-10 px-10 pt-[170px] pb-[70px]">
          <div className="text-center mb-5">
            <h3 className="text-2xl font-bold text-gray-900">Umroh Group - {request.totalPax} Pax</h3>
            <p className="text-base text-gray-700 mt-0.5">
              Periode {meta.tanggalKedatangan ? new Date(meta.tanggalKedatangan).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) : 'Menyesuaikan'}
            </p>
          </div>

          <div className="border border-gray-800 mb-5 rounded-sm overflow-hidden bg-white">
            <div className="flex border-b border-gray-800 last:border-b-0">
              <div className="w-1/2 bg-[#427d96] text-white py-2 px-3 text-center font-bold text-base border-r border-gray-800">
                Hotel Makkah *{makkahHotel?.starRating || 4}
              </div>
              <div className="w-1/2 bg-white text-black py-2 px-3 text-center font-bold text-base flex items-center justify-center">
                {makkahHotel?.name || '-'}
              </div>
            </div>
            <div className="flex border-b border-gray-800 last:border-b-0">
              <div className="w-1/2 bg-[#427d96] text-white py-2 px-3 text-center font-bold text-base border-r border-gray-800">
                Hotel Madinah *{madinahHotel?.starRating || 4}
              </div>
              <div className="w-1/2 bg-white text-black py-2 px-3 text-center font-bold text-base flex items-center justify-center">
                {madinahHotel?.name || '-'}
              </div>
            </div>
          </div>

          <div className="border border-gray-800 mb-5 rounded-sm overflow-hidden bg-white">
            <div className="flex bg-[#427d96] text-white font-bold text-center border-b border-gray-800 text-base">
              <div className="w-1/4 py-2 px-3 border-r border-gray-800">Program</div>
              <div className="w-1/4 py-2 px-3 border-r border-gray-800">Double</div>
              <div className="w-1/4 py-2 px-3 border-r border-gray-800">Triple</div>
              <div className="w-1/4 py-2 px-3">Quad</div>
            </div>
            <div className="flex text-center items-center bg-white">
              <div className="w-1/4 py-3 px-3 border-r border-gray-800 font-bold">
                Program {totalNights + 2} Hari<br />
                <span className="text-sm font-normal">({madinahNights} Malam Madinah,<br />{makkahNights} Malam Makkah)</span>
              </div>
              <div className="w-1/4 py-3 px-3 border-r border-gray-800 font-bold text-base">
                {priceDouble > minValidPrice ? formatCurrency(priceDouble, currency) : '-'}
              </div>
              <div className="w-1/4 py-3 px-3 border-r border-gray-800 font-bold text-base">
                {priceTriple > minValidPrice ? formatCurrency(priceTriple, currency) : '-'}
              </div>
              <div className="w-1/4 py-3 px-3 font-bold text-base">
                {priceQuad > minValidPrice ? formatCurrency(priceQuad, currency) : '-'}
              </div>
            </div>
          </div>

          <div className="flex border border-gray-800 rounded-sm overflow-hidden bg-white/95">
            <div className="w-1/2 border-r border-gray-800">
              <div className="bg-[#427d96] text-white text-center py-2 px-3 font-bold text-base border-b border-gray-800">
                Harga Termasuk
              </div>
              <ul className="text-sm outline-none focus:bg-gray-50/50 print:bg-transparent" contentEditable={true} suppressContentEditableWarning={true}>
                <li className="py-2 px-3 border-b border-gray-300">Transportasi Bus Full Trip (Sesuai Rute)</li>
                <li className="py-2 px-3 border-b border-gray-300">Hotel Makkah dan Madinah sesuai paket</li>
                {handling.keretaCepat > 0 && <li className="py-2 px-3 border-b border-gray-300">Tiket Kereta Cepat Haramain (HHR)</li>}
                {handling.muthowif > 0 && <li className="py-2 px-3 border-b border-gray-300">Pembimbing Ibadah atau Guide Pengalaman</li>}
                {handling.tiketMuseum > 0 && <li className="py-2 px-3 border-b border-gray-300">Tiket Masuk Museum Wahyu Makkah</li>}
                {handling.tipDriver > 0 && <li className="py-2 px-3 border-b border-gray-300">Tips Supir / Driver</li>}
                {totals.includeVisa && <li className="py-2 px-3 border-b border-gray-300">Visa Umroh dan Asuransi Kesehatan Arab Saudi</li>}
                {handling.handlingAirport > 0 && <li className="py-2 px-3 border-b border-gray-300">Handling Kedatangan dan Kepulangan Bandara Arab Saudi</li>}
                {handling.handlingHotel > 0 && <li className="py-2 px-3 border-b border-gray-300">Handling Hotel Makkah & Madinah</li>}
                {handling.muthowifahRaudhah > 0 && <li className="py-2 px-3 border-b border-gray-300">Muthowifah Raudhah</li>}
                {/* Fallbacks if some are missing from custom handling */}
                <li className="py-2 px-3 border-b border-gray-300">Makan 3x sehari (Jika termasuk dalam request)</li>
                <li className="py-2 px-3">Air Zamzam Kepulangan (Jika diizinkan maskapai)</li>
              </ul>
            </div>
            <div className="w-1/2">
              <div className="bg-[#427d96] text-white text-center py-2 px-3 font-bold text-base border-b border-gray-800">
                Harga Belum Termasuk
              </div>
              <ul className="text-sm outline-none focus:bg-gray-50/50 print:bg-transparent" contentEditable={true} suppressContentEditableWarning={true}>
                <li className="py-2 px-3 border-b border-gray-300">Perlengkapan</li>
                <li className="py-2 px-3 border-b border-gray-300">Pengeluaran Pribadi</li>
                <li className="py-2 px-3 border-b border-gray-300">Vaksin Meningitis</li>
                <li className="py-2 px-3 border-b border-gray-300">Paket tour tambahan (Jabal Khandamah, Thaif, Al Ula, Badr)</li>
                {!totals.includeVisa && <li className="py-2 px-3 border-b border-gray-300 text-red-600 font-medium">Visa Umroh (Tidak Termasuk)</li>}
                <li className="py-2 px-3 border-b border-gray-300">Biaya di luar program</li>
                <li className="py-2 px-3">Tiket Penerbangan Domestik & Internasional</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
