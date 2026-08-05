import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Trash2, Loader2, Users, Building, Plane, Package, DollarSign } from 'lucide-react'
import { useUpdateCustomLaRequest, type CustomLaRequest } from '@/lib/queries'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'

interface EditCustomLaModalProps {
  isOpen: boolean
  onClose: () => void
  request: CustomLaRequest
}

interface HandlingItem {
  key: string
  label: string
  amount: number
}

export function EditCustomLaModal({ isOpen, onClose, request }: EditCustomLaModalProps) {
  const updateMutation = useUpdateCustomLaRequest()

  // Tab 1: Info Pemesan & Jadwal
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [travelName, setTravelName] = useState('')
  const [totalPax, setTotalPax] = useState(1)
  const [tanggalKedatangan, setTanggalKedatangan] = useState('')
  const [tanggalKeberangkatan, setTanggalKeberangkatan] = useState('')

  // Tab 2: Hotel Makkah
  const [makkahNights, setMakkahNights] = useState(0)
  const [makkahSingleQty, setMakkahSingleQty] = useState(0)
  const [makkahSinglePrice, setMakkahSinglePrice] = useState(0)
  const [makkahDoubleQty, setMakkahDoubleQty] = useState(0)
  const [makkahDoublePrice, setMakkahDoublePrice] = useState(0)
  const [makkahTripleQty, setMakkahTripleQty] = useState(0)
  const [makkahTriplePrice, setMakkahTriplePrice] = useState(0)
  const [makkahQuadQty, setMakkahQuadQty] = useState(0)
  const [makkahQuadPrice, setMakkahQuadPrice] = useState(0)

  // Tab 2: Hotel Madinah
  const [madinahNights, setMadinahNights] = useState(0)
  const [madinahSingleQty, setMadinahSingleQty] = useState(0)
  const [madinahSinglePrice, setMadinahSinglePrice] = useState(0)
  const [madinahDoubleQty, setMadinahDoubleQty] = useState(0)
  const [madinahDoublePrice, setMadinahDoublePrice] = useState(0)
  const [madinahTripleQty, setMadinahTripleQty] = useState(0)
  const [madinahTriplePrice, setMadinahTriplePrice] = useState(0)
  const [madinahQuadQty, setMadinahQuadQty] = useState(0)
  const [madinahQuadPrice, setMadinahQuadPrice] = useState(0)

  // Tab 3: Transport & Handling
  const [totalTransport, setTotalTransport] = useState(0)
  const [keretaCepat, setKeretaCepat] = useState(0)
  const [extraHandlingItems, setExtraHandlingItems] = useState<HandlingItem[]>([])
  const [newItemLabel, setNewItemLabel] = useState('')
  const [newItemAmount, setNewItemAmount] = useState<number | ''>('')

  // Tab 4: Profit & Notes
  const [profitType, setProfitType] = useState<'percentage' | 'fixed'>('percentage')
  const [profitValue, setProfitValue] = useState<number>(0)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (request && isOpen) {
      const meta = request.meta || {}
      const rooms = meta.rooms || {}
      const makkah = rooms.makkah || {}
      const madinah = rooms.madinah || {}
      const handling = meta.handlingDetails || {}
      const totals = meta.totals || {}

      setCustomerName(request.customerName || '')
      setCustomerPhone(request.customerPhone || '')
      setCustomerEmail(request.customerEmail || '')
      setTravelName(request.travelName || '')
      setTotalPax(request.totalPax || 1)
      setTanggalKedatangan(meta.tanggalKedatangan || '')
      setTanggalKeberangkatan(meta.tanggalKeberangkatan || '')

      setMakkahNights(makkah.nights ?? (meta.malamMakkah ? parseInt(meta.malamMakkah) : 0))
      setMakkahSingleQty(makkah.singleQty ?? 0)
      setMakkahSinglePrice(makkah.singlePrice ?? 0)
      setMakkahDoubleQty(makkah.doubleQty ?? (meta.kamarDouble ?? 0))
      setMakkahDoublePrice(makkah.doublePrice ?? 0)
      setMakkahTripleQty(makkah.tripleQty ?? (meta.kamarTriple ?? 0))
      setMakkahTriplePrice(makkah.triplePrice ?? 0)
      setMakkahQuadQty(makkah.quadQty ?? (meta.kamarQuad ?? 0))
      setMakkahQuadPrice(makkah.quadPrice ?? 0)

      setMadinahNights(madinah.nights ?? (meta.malamMadinah ? parseInt(meta.malamMadinah) : 0))
      setMadinahSingleQty(madinah.singleQty ?? 0)
      setMadinahSinglePrice(madinah.singlePrice ?? 0)
      setMadinahDoubleQty(madinah.doubleQty ?? (meta.kamarDouble ?? 0))
      setMadinahDoublePrice(madinah.doublePrice ?? 0)
      setMadinahTripleQty(madinah.tripleQty ?? (meta.kamarTriple ?? 0))
      setMadinahTriplePrice(madinah.triplePrice ?? 0)
      setMadinahQuadQty(madinah.quadQty ?? (meta.kamarQuad ?? 0))
      setMadinahQuadPrice(madinah.quadPrice ?? 0)

      setTotalTransport(totals.totalTransport ?? 0)
      setKeretaCepat(handling.keretaCepat ?? 0)

      const legacyKeys = ['keretaCepat', 'muthowifTourType'];
      const items: HandlingItem[] = []

      Object.entries(handling).forEach(([k, v]) => {
        if (legacyKeys.includes(k)) return
        const numVal = Number(v)
        if (isNaN(numVal)) return

        let label = k
        if (!k.includes(' ')) {
          label = k.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
        }
        items.push({ key: k, label, amount: numVal })
      })

      setExtraHandlingItems(items)
      setProfitType(meta.profitType || 'percentage')
      setProfitValue(meta.profitValue ?? 0)
      setNotes(meta.notes || '')
    }
  }, [request, isOpen])

  const calculatePreviewTotals = () => {
    const makkahHotelTotal = makkahNights * (
      (makkahSingleQty * makkahSinglePrice) +
      (makkahDoubleQty * makkahDoublePrice) +
      (makkahTripleQty * makkahTriplePrice) +
      (makkahQuadQty * makkahQuadPrice)
    )

    const madinahHotelTotal = madinahNights * (
      (madinahSingleQty * madinahSinglePrice) +
      (madinahDoubleQty * madinahDoublePrice) +
      (madinahTripleQty * madinahTriplePrice) +
      (madinahQuadQty * madinahQuadPrice)
    )

    const keretaCepatTotal = keretaCepat * totalPax
    const extraHandlingTotal = extraHandlingItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
    const subTotalHandling = keretaCepatTotal + extraHandlingTotal

    const baseTotal = makkahHotelTotal + madinahHotelTotal + totalTransport + subTotalHandling
    const profitAmount = profitType === 'percentage' 
      ? baseTotal * ((Number(profitValue) || 0) / 100)
      : (Number(profitValue) || 0)

    const grandTotal = baseTotal + profitAmount
    const nonHotelTotal = grandTotal - makkahHotelTotal - madinahHotelTotal
    const nonHotelPerPax = totalPax > 0 ? nonHotelTotal / totalPax : 0

    const priceDouble = nonHotelPerPax + (makkahNights > 0 ? (makkahDoublePrice * makkahNights) / 2 : 0) + (madinahNights > 0 ? (madinahDoublePrice * madinahNights) / 2 : 0)
    const priceTriple = nonHotelPerPax + (makkahNights > 0 ? (makkahTriplePrice * makkahNights) / 3 : 0) + (madinahNights > 0 ? (madinahTriplePrice * madinahNights) / 3 : 0)
    const priceQuad = nonHotelPerPax + (makkahNights > 0 ? (makkahQuadPrice * makkahNights) / 4 : 0) + (madinahNights > 0 ? (madinahQuadPrice * madinahNights) / 4 : 0)

    return {
      makkahHotelTotal,
      madinahHotelTotal,
      subTotalHandling,
      baseTotal,
      profitAmount,
      grandTotal,
      perPaxPrice: totalPax > 0 ? grandTotal / totalPax : 0,
      priceDouble,
      priceTriple,
      priceQuad
    }
  }

  const totalsPreview = calculatePreviewTotals()

  const handleAddHandlingItem = () => {
    if (!newItemLabel.trim()) {
      toast.error('Masukkan nama layanan tambahan')
      return
    }
    const val = typeof newItemAmount === 'number' ? newItemAmount : 0
    setExtraHandlingItems(prev => [
      ...prev,
      { key: newItemLabel.trim(), label: newItemLabel.trim(), amount: val }
    ])
    setNewItemLabel('')
    setNewItemAmount('')
  }

  const handleRemoveHandlingItem = (index: number) => {
    setExtraHandlingItems(prev => prev.filter((_, idx) => idx !== index))
  }

  const handleUpdateHandlingAmount = (index: number, val: number) => {
    setExtraHandlingItems(prev => prev.map((item, idx) => idx === index ? { ...item, amount: val } : item))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const computed = calculatePreviewTotals()

      const handlingDetails: Record<string, any> = {
        keretaCepat,
      }
      extraHandlingItems.forEach(item => {
        if (item.label) {
          handlingDetails[item.label] = Number(item.amount) || 0
        }
      })

      const payloadMeta = {
        ...request.meta,
        tanggalKedatangan,
        tanggalKeberangkatan,
        profitType,
        profitValue: Number(profitValue) || 0,
        notes,
        rooms: {
          makkah: {
            nights: Number(makkahNights) || 0,
            singleQty: Number(makkahSingleQty) || 0,
            singlePrice: Number(makkahSinglePrice) || 0,
            doubleQty: Number(makkahDoubleQty) || 0,
            doublePrice: Number(makkahDoublePrice) || 0,
            tripleQty: Number(makkahTripleQty) || 0,
            triplePrice: Number(makkahTriplePrice) || 0,
            quadQty: Number(makkahQuadQty) || 0,
            quadPrice: Number(makkahQuadPrice) || 0,
          },
          madinah: {
            nights: Number(madinahNights) || 0,
            singleQty: Number(madinahSingleQty) || 0,
            singlePrice: Number(madinahSinglePrice) || 0,
            doubleQty: Number(madinahDoubleQty) || 0,
            doublePrice: Number(madinahDoublePrice) || 0,
            tripleQty: Number(madinahTripleQty) || 0,
            triplePrice: Number(madinahTriplePrice) || 0,
            quadQty: Number(madinahQuadQty) || 0,
            quadPrice: Number(madinahQuadPrice) || 0,
          }
        },
        handlingDetails,
        totals: {
          totalPax: Number(totalPax) || 1,
          totalMalam: (Number(makkahNights) || 0) + (Number(madinahNights) || 0),
          makkahHotelTotal: computed.makkahHotelTotal,
          madinahHotelTotal: computed.madinahHotelTotal,
          totalTransport: Number(totalTransport) || 0,
          subTotalHandling: computed.subTotalHandling,
          baseTotal: computed.baseTotal,
          profitAmount: computed.profitAmount,
          profit: computed.profitAmount,
          grandTotal: computed.grandTotal,
          perPaxPrice: computed.perPaxPrice,
          priceDouble: computed.priceDouble,
          priceTriple: computed.priceTriple,
          priceQuad: computed.priceQuad,
        }
      }

      await updateMutation.mutateAsync({
        id: request.id,
        data: {
          customerName,
          customerPhone,
          customerEmail,
          travelName,
          totalPax: Number(totalPax) || 1,
          totalAmountSAR: computed.grandTotal,
          meta: payloadMeta
        }
      })

      toast.success('Detail Custom LA berhasil diperbarui!')
      onClose()
    } catch (err: any) {
      toast.error('Gagal mengupdate Custom LA: ' + (err.message || 'Terjadi kesalahan'))
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Custom LA: ${request.number}`}
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <Tabs defaultValue="info" className="w-full">
          <TabsList className="bg-zinc-100 p-1 rounded-lg border border-zinc-200 inline-flex w-full justify-start overflow-x-auto mb-4">
            <TabsTrigger type="button" value="info" className="text-xs font-semibold px-3 py-1.5 rounded-md">
              <Users className="w-3.5 h-3.5 mr-1.5 inline" /> Pemesan & Jadwal
            </TabsTrigger>
            <TabsTrigger type="button" value="hotel" className="text-xs font-semibold px-3 py-1.5 rounded-md">
              <Building className="w-3.5 h-3.5 mr-1.5 inline" /> Hotel & Kamar
            </TabsTrigger>
            <TabsTrigger type="button" value="transport" className="text-xs font-semibold px-3 py-1.5 rounded-md">
              <Plane className="w-3.5 h-3.5 mr-1.5 inline" /> Transport & Handling
            </TabsTrigger>
            <TabsTrigger type="button" value="margin" className="text-xs font-semibold px-3 py-1.5 rounded-md">
              <DollarSign className="w-3.5 h-3.5 mr-1.5 inline" /> Margin & Ringkasan
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Info Pemesan & Jadwal */}
          <TabsContent value="info" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold text-zinc-700">Nama PIC / Jamaah *</Label>
                <Input
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Nama PIC"
                  className="mt-1 text-xs"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-zinc-700">No. Telepon / WA</Label>
                <Input
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  placeholder="08123456789"
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-zinc-700">Email</Label>
                <Input
                  type="email"
                  value={customerEmail}
                  onChange={e => setCustomerEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-zinc-700">Nama Travel</Label>
                <Input
                  value={travelName}
                  onChange={e => setTravelName(e.target.value)}
                  placeholder="Nama Travel"
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-zinc-700">Total Jamaah (Pax) *</Label>
                <Input
                  type="number"
                  min="1"
                  value={totalPax}
                  onChange={e => setTotalPax(parseInt(e.target.value) || 1)}
                  className="mt-1 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs font-semibold text-zinc-700">Tgl Kedatangan</Label>
                  <Input
                    type="date"
                    value={tanggalKedatangan}
                    onChange={e => setTanggalKedatangan(e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-zinc-700">Tgl Keberangkatan</Label>
                  <Input
                    type="date"
                    value={tanggalKeberangkatan}
                    onChange={e => setTanggalKeberangkatan(e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: Hotel & Kamar */}
          <TabsContent value="hotel" className="space-y-6">
            {/* Makkah Hotel */}
            <div className="border border-zinc-200 rounded-lg p-4 bg-zinc-50/50 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-xs text-zinc-900 uppercase tracking-wider">Hotel Makkah</h4>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-zinc-600">Durasi (Malam):</Label>
                  <Input
                    type="number"
                    min="0"
                    value={makkahNights}
                    onChange={e => setMakkahNights(parseInt(e.target.value) || 0)}
                    className="w-20 text-xs h-8"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white p-3 border border-zinc-200 rounded-md space-y-2">
                  <span className="text-[11px] font-bold text-zinc-700">Single</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <span className="text-[10px] text-zinc-500">Qty Kamar</span>
                      <Input type="number" min="0" value={makkahSingleQty} onChange={e => setMakkahSingleQty(parseInt(e.target.value)||0)} className="h-7 text-xs" />
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500">Harga/Mlm</span>
                      <Input type="number" min="0" value={makkahSinglePrice} onChange={e => setMakkahSinglePrice(parseFloat(e.target.value)||0)} className="h-7 text-xs" />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-3 border border-zinc-200 rounded-md space-y-2">
                  <span className="text-[11px] font-bold text-zinc-700">Double</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <span className="text-[10px] text-zinc-500">Qty Kamar</span>
                      <Input type="number" min="0" value={makkahDoubleQty} onChange={e => setMakkahDoubleQty(parseInt(e.target.value)||0)} className="h-7 text-xs" />
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500">Harga/Mlm</span>
                      <Input type="number" min="0" value={makkahDoublePrice} onChange={e => setMakkahDoublePrice(parseFloat(e.target.value)||0)} className="h-7 text-xs" />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-3 border border-zinc-200 rounded-md space-y-2">
                  <span className="text-[11px] font-bold text-zinc-700">Triple</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <span className="text-[10px] text-zinc-500">Qty Kamar</span>
                      <Input type="number" min="0" value={makkahTripleQty} onChange={e => setMakkahTripleQty(parseInt(e.target.value)||0)} className="h-7 text-xs" />
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500">Harga/Mlm</span>
                      <Input type="number" min="0" value={makkahTriplePrice} onChange={e => setMakkahTriplePrice(parseFloat(e.target.value)||0)} className="h-7 text-xs" />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-3 border border-zinc-200 rounded-md space-y-2">
                  <span className="text-[11px] font-bold text-zinc-700">Quad</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <span className="text-[10px] text-zinc-500">Qty Kamar</span>
                      <Input type="number" min="0" value={makkahQuadQty} onChange={e => setMakkahQuadQty(parseInt(e.target.value)||0)} className="h-7 text-xs" />
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500">Harga/Mlm</span>
                      <Input type="number" min="0" value={makkahQuadPrice} onChange={e => setMakkahQuadPrice(parseFloat(e.target.value)||0)} className="h-7 text-xs" />
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-[11px] font-semibold text-right text-zinc-600">Subtotal Hotel Makkah: {formatCurrency(totalsPreview.makkahHotelTotal, 'SAR')}</p>
            </div>

            {/* Madinah Hotel */}
            <div className="border border-zinc-200 rounded-lg p-4 bg-zinc-50/50 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-xs text-zinc-900 uppercase tracking-wider">Hotel Madinah</h4>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-zinc-600">Durasi (Malam):</Label>
                  <Input
                    type="number"
                    min="0"
                    value={madinahNights}
                    onChange={e => setMadinahNights(parseInt(e.target.value) || 0)}
                    className="w-20 text-xs h-8"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white p-3 border border-zinc-200 rounded-md space-y-2">
                  <span className="text-[11px] font-bold text-zinc-700">Single</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <span className="text-[10px] text-zinc-500">Qty Kamar</span>
                      <Input type="number" min="0" value={madinahSingleQty} onChange={e => setMadinahSingleQty(parseInt(e.target.value)||0)} className="h-7 text-xs" />
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500">Harga/Mlm</span>
                      <Input type="number" min="0" value={madinahSinglePrice} onChange={e => setMadinahSinglePrice(parseFloat(e.target.value)||0)} className="h-7 text-xs" />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-3 border border-zinc-200 rounded-md space-y-2">
                  <span className="text-[11px] font-bold text-zinc-700">Double</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <span className="text-[10px] text-zinc-500">Qty Kamar</span>
                      <Input type="number" min="0" value={madinahDoubleQty} onChange={e => setMadinahDoubleQty(parseInt(e.target.value)||0)} className="h-7 text-xs" />
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500">Harga/Mlm</span>
                      <Input type="number" min="0" value={madinahDoublePrice} onChange={e => setMadinahDoublePrice(parseFloat(e.target.value)||0)} className="h-7 text-xs" />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-3 border border-zinc-200 rounded-md space-y-2">
                  <span className="text-[11px] font-bold text-zinc-700">Triple</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <span className="text-[10px] text-zinc-500">Qty Kamar</span>
                      <Input type="number" min="0" value={madinahTripleQty} onChange={e => setMadinahTripleQty(parseInt(e.target.value)||0)} className="h-7 text-xs" />
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500">Harga/Mlm</span>
                      <Input type="number" min="0" value={madinahTriplePrice} onChange={e => setMadinahTriplePrice(parseFloat(e.target.value)||0)} className="h-7 text-xs" />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-3 border border-zinc-200 rounded-md space-y-2">
                  <span className="text-[11px] font-bold text-zinc-700">Quad</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <span className="text-[10px] text-zinc-500">Qty Kamar</span>
                      <Input type="number" min="0" value={madinahQuadQty} onChange={e => setMadinahQuadQty(parseInt(e.target.value)||0)} className="h-7 text-xs" />
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500">Harga/Mlm</span>
                      <Input type="number" min="0" value={madinahQuadPrice} onChange={e => setMadinahQuadPrice(parseFloat(e.target.value)||0)} className="h-7 text-xs" />
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-[11px] font-semibold text-right text-zinc-600">Subtotal Hotel Madinah: {formatCurrency(totalsPreview.madinahHotelTotal, 'SAR')}</p>
            </div>
          </TabsContent>

          {/* TAB 3: Transport & Handling */}
          <TabsContent value="transport" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border border-zinc-200 rounded-lg p-4 bg-zinc-50/50 space-y-3">
                <Label className="text-xs font-bold text-zinc-800 uppercase tracking-wider">Transportasi (Fixed Amount SAR)</Label>
                <Input
                  type="number"
                  min="0"
                  value={totalTransport}
                  onChange={e => setTotalTransport(parseFloat(e.target.value) || 0)}
                  placeholder="Total Biaya Transport"
                  className="text-xs bg-white"
                />
                <p className="text-[10px] text-zinc-500">Total biaya seluruh armada/rute bus.</p>
              </div>

              <div className="border border-zinc-200 rounded-lg p-4 bg-zinc-50/50 space-y-3">
                <Label className="text-xs font-bold text-zinc-800 uppercase tracking-wider">Kereta Cepat (Per Pax SAR)</Label>
                <Input
                  type="number"
                  min="0"
                  value={keretaCepat}
                  onChange={e => setKeretaCepat(parseFloat(e.target.value) || 0)}
                  placeholder="Harga Kereta Cepat / Pax"
                  className="text-xs bg-white"
                />
                <p className="text-[10px] text-zinc-500">Total Kereta ({totalPax} Pax): {formatCurrency(keretaCepat * totalPax, 'SAR')}</p>
              </div>
            </div>

            <div className="border border-zinc-200 rounded-lg p-4 bg-white space-y-3">
              <h4 className="font-bold text-xs text-zinc-900 uppercase tracking-wider">Layanan Tambahan (Handling Extra)</h4>
              
              {extraHandlingItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 py-1 border-b border-zinc-100 last:border-0">
                  <span className="text-xs font-semibold text-zinc-700 flex-1">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      value={item.amount}
                      onChange={e => handleUpdateHandlingAmount(idx, parseFloat(e.target.value) || 0)}
                      className="w-32 h-8 text-xs"
                    />
                    <span className="text-xs font-semibold text-zinc-500">SAR</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveHandlingItem(idx)}
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
                <Input
                  value={newItemLabel}
                  onChange={e => setNewItemLabel(e.target.value)}
                  placeholder="Nama Layanan Baru (e.g. Muthowif, Handling)"
                  className="text-xs h-8 flex-1"
                />
                <Input
                  type="number"
                  min="0"
                  value={newItemAmount}
                  onChange={e => setNewItemAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="Biaya (SAR)"
                  className="text-xs h-8 w-28"
                />
                <Button
                  type="button"
                  onClick={handleAddHandlingItem}
                  className="h-8 px-3 text-xs bg-zinc-900 text-white hover:bg-zinc-800"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Tambah
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* TAB 4: Margin & Profit */}
          <TabsContent value="margin" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold text-zinc-700">Tipe Profit / Margin</Label>
                <select
                  value={profitType}
                  onChange={e => setProfitType(e.target.value as any)}
                  className="mt-1 w-full h-9 px-3 border border-zinc-200 rounded-md text-xs bg-white font-semibold"
                >
                  <option value="percentage">Persentase (%)</option>
                  <option value="fixed">Nominal Tetap (SAR)</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-zinc-700">
                  {profitType === 'percentage' ? 'Persentase Profit (%)' : 'Nominal Profit (SAR)'}
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={profitValue}
                  onChange={e => setProfitValue(parseFloat(e.target.value) || 0)}
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-zinc-700">Catatan Internal / Penyesuaian</Label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Catatan tambahan..."
                className="mt-1 w-full h-20 p-2.5 border border-zinc-200 rounded-md text-xs focus:ring-1 focus:ring-zinc-900 outline-none"
              />
            </div>

            {/* Live Rekap Summary */}
            <div className="bg-zinc-900 text-white p-4 rounded-xl space-y-2 mt-4">
              <h5 className="font-bold text-xs text-zinc-300 uppercase tracking-wider border-b border-zinc-800 pb-2">Ringkasan Kalkulasi Otomatis</h5>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-xs">
                <div>
                  <span className="text-zinc-400 text-[10px] uppercase block">Subtotal Hotel</span>
                  <span className="font-bold">{formatCurrency(totalsPreview.makkahHotelTotal + totalsPreview.madinahHotelTotal, 'SAR')}</span>
                </div>
                <div>
                  <span className="text-zinc-400 text-[10px] uppercase block">Transport & Handling</span>
                  <span className="font-bold">{formatCurrency(totalsPreview.subTotalHandling + totalTransport, 'SAR')}</span>
                </div>
                <div>
                  <span className="text-zinc-400 text-[10px] uppercase block">Profit ({profitType === 'percentage' ? `${profitValue}%` : 'Fixed'})</span>
                  <span className="font-bold text-emerald-400">+{formatCurrency(totalsPreview.profitAmount, 'SAR')}</span>
                </div>
                <div>
                  <span className="text-zinc-400 text-[10px] uppercase block">Grand Total</span>
                  <span className="font-extrabold text-amber-400 text-sm">{formatCurrency(totalsPreview.grandTotal, 'SAR')}</span>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer Actions */}
        <div className="flex justify-end space-x-2 pt-4 border-t border-zinc-200">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="text-xs h-9 px-4"
          >
            Batal
          </Button>
          <Button
            type="submit"
            disabled={updateMutation.isPending}
            className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs h-9 px-5"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                Menyimpan...
              </>
            ) : (
              'Simpan Perubahan'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
