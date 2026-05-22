import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Users, Calendar, Save, ArrowLeft, Loader2, Package, DollarSign, CheckCircle2, Circle, Plus, RefreshCw
} from "lucide-react"
import { authService } from "@/lib/auth"
import { useCreateCustomLaRequest, useClients, useBookings, useServiceOrders } from "@/lib/queries"
import { useTransportationBookings } from "@/lib/queries/transportationBookings"
import { formatCurrency } from "@/lib/utils"
import { toast } from "sonner"

export const Route = createFileRoute("/create-custom-la")({
  beforeLoad: async () => {
    const isAuthenticated = await authService.isAuthenticated()
    if (!isAuthenticated) {
      throw redirect({ to: "/login" })
    }
  },
  component: CreateCustomLaWizard
})

function CreateCustomLaWizard() {
  const navigate = useNavigate()
  const createLaMutation = useCreateCustomLaRequest()
  const { data: clients = [], isLoading: isClientsLoading } = useClients()

  const [step, setStep] = useState(1)
  
  const [formData, setFormData] = useState({
    clientId: 0,
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    travelName: "",
    totalPax: 1,
    kedatangan: "",
    keberangkatan: "",
    
    // Cart (Linked Items)
    linkedBookingIds: [] as number[],
    linkedTransportIds: [] as number[],
    linkedServiceOrderIds: [] as number[],
    
    // Additional LA Specific services
    handlingAirport: 0,
    handlingHotel: 0,
    muthowif: 0,
    muthowifTourType: "Full Trip Paket",
    
    // Margin
    profitType: "percentage",
    profitValue: 0,
    notes: ""
  })

  // Fetch unlinked components for the selected client
  const { data: unlinkedBookings = [], refetch: refetchBookings, isFetching: isRefetchingB } = useBookings(formData.clientId, true);
  const { data: unlinkedTransports = [], refetch: refetchTransports, isFetching: isRefetchingT } = useTransportationBookings(formData.clientId, true);
  const { data: unlinkedServiceOrders = [], refetch: refetchSO, isFetching: isRefetchingSO } = useServiceOrders(formData.clientId, true);

  const handleClientChange = (clientId: string) => {
    const id = parseInt(clientId)
    const client = clients.find(c => c.id === id)
    if (client) {
      setFormData(prev => ({
        ...prev,
        clientId: id,
        customerName: client.name || prev.customerName,
        customerPhone: client.phone || prev.customerPhone,
        customerEmail: client.email || prev.customerEmail,
        // reset cart on client change
        linkedBookingIds: [],
        linkedTransportIds: [],
        linkedServiceOrderIds: []
      }))
    }
  }

  const handleToggleCart = (type: 'booking' | 'transport' | 'serviceOrder', id: number) => {
    setFormData(prev => {
      const field = type === 'booking' ? 'linkedBookingIds' : type === 'transport' ? 'linkedTransportIds' : 'linkedServiceOrderIds';
      const arr = prev[field] as number[];
      if (arr.includes(id)) {
        return { ...prev, [field]: arr.filter(x => x !== id) };
      } else {
        return { ...prev, [field]: [...arr, id] };
      }
    });
  }
  
  const getSelectedTotal = () => {
    let total = 0;
    unlinkedBookings.filter((b:any) => formData.linkedBookingIds.includes(b.id)).forEach((b:any) => total += parseFloat(b.totalAmount || 0));
    unlinkedTransports.filter((t:any) => formData.linkedTransportIds.includes(t.id)).forEach((t:any) => total += parseFloat(t.totalAmount || 0));
    unlinkedServiceOrders.filter((s:any) => formData.linkedServiceOrderIds.includes(s.id)).forEach((s:any) => total += parseFloat(s.totalAmount || 0));
    
    // add handling
    const handlingTotal = (formData.handlingAirport * formData.totalPax) + (formData.handlingHotel * formData.totalPax) + formData.muthowif;
    total += handlingTotal;
    
    return total;
  }
  
  const baseTotal = getSelectedTotal();
  const profitAmount = formData.profitType === "percentage" ? baseTotal * (formData.profitValue / 100) : formData.profitValue;
  const grandTotal = baseTotal + profitAmount;

  const handleSubmit = async () => {
    try {
      await createLaMutation.mutateAsync({
        clientId: formData.clientId,
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        customerEmail: formData.customerEmail,
        travelName: formData.travelName,
        totalPax: formData.totalPax,
        totalAmountSAR: grandTotal,
        linkedBookingIds: formData.linkedBookingIds,
        linkedTransportIds: formData.linkedTransportIds,
        linkedServiceOrderIds: formData.linkedServiceOrderIds,
        meta: {
          tanggalKedatangan: formData.kedatangan,
          tanggalKeberangkatan: formData.keberangkatan,
          profitType: formData.profitType,
          profitValue: formData.profitValue,
          notes: formData.notes,
          handlingDetails: {
            handlingAirport: formData.handlingAirport,
            handlingHotel: formData.handlingHotel,
            muthowif: formData.muthowif,
            muthowifTourType: formData.muthowifTourType,
          },
          totals: {
            baseTotal,
            profitAmount,
            grandTotal,
            perPaxPrice: formData.totalPax > 0 ? grandTotal / formData.totalPax : 0
          }
        }
      });
      toast.success("Land Arrangement berhasil dibuat dan layanan terkait telah digabungkan!");
      navigate({ to: "/custom-la-requests" });
    } catch (e: any) {
      toast.error("Gagal membuat LA: " + e.message);
    }
  }

  return (
    <PageLayout title="Buat Permintaan LA (Integrated Wizard)">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Stepper Header */}
        <div className="flex items-center justify-between mb-8 bg-white p-4 rounded-lg shadow-sm border">
          {[1, 2, 3, 4].map(idx => (
            <div key={idx} className={`flex items-center ${idx !== 4 ? 'flex-1' : ''}`}>
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${step >= idx ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'} font-bold`}>
                {step > idx ? <CheckCircle2 className="w-5 h-5" /> : idx}
              </div>
              <div className="mx-3 text-sm font-medium hidden sm:block">
                {idx === 1 && "Info Client"}
                {idx === 2 && "Pilih Layanan"}
                {idx === 3 && "Handling Tambahan"}
                {idx === 4 && "Rekap & Margin"}
              </div>
              {idx !== 4 && <div className="flex-1 h-1 mx-2 bg-gray-200"><div className={`h-1 ${step > idx ? 'bg-blue-600' : 'bg-gray-200'}`}></div></div>}
            </div>
          ))}
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-6 flex items-center"><Users className="mr-2" /> Informasi Pemesan & Jadwal</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-1">Pilih Client Terdaftar *</label>
                <select value={formData.clientId} onChange={(e) => handleClientChange(e.target.value)} className="w-full border p-2 rounded">
                  <option value="">Pilih Client</option>
                  {clients.map((c:any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nama Group / PIC</label>
                <Input value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} placeholder="Nama Grup" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Total Jamaah *</label>
                <Input type="number" min="1" value={formData.totalPax} onChange={e => setFormData({...formData, totalPax: parseInt(e.target.value)||1})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Kedatangan</label>
                  <Input type="date" value={formData.kedatangan} onChange={e => setFormData({...formData, kedatangan: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Keberangkatan</label>
                  <Input type="date" value={formData.keberangkatan} onChange={e => setFormData({...formData, keberangkatan: e.target.value})} />
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!formData.clientId || !formData.customerName}>Lanjut ke Pemilihan Layanan</Button>
            </div>
          </Card>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-blue-900 flex items-center"><Package className="mr-2" /> Keranjang Layanan Terintegrasi</h3>
                <p className="text-sm text-blue-800">Pilih booking hotel, transport, atau visa yang sudah Anda buat sebelumnya. Atau buat baru di tab/jendela terpisah lalu klik Refresh.</p>
              </div>
              <div className="space-x-2">
                <Button variant="outline" size="sm" onClick={() => window.open('/create-booking', '_blank')}><Plus className="w-4 h-4 mr-1"/> Buat Booking Hotel</Button>
                <Button variant="outline" size="sm" onClick={() => { refetchBookings(); refetchTransports(); refetchSO(); }}><RefreshCw className={`w-4 h-4 mr-1 ${(isRefetchingB||isRefetchingT||isRefetchingSO) ? 'animate-spin':''}`}/> Refresh Data</Button>
              </div>
            </div>

            <Card className="p-6">
              <h4 className="font-bold mb-4 border-b pb-2">Hotel Bookings (Unlinked)</h4>
              {unlinkedBookings.length === 0 ? <p className="text-gray-500 italic text-sm">Tidak ada booking hotel yang unlinked untuk client ini.</p> : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {unlinkedBookings.map((b:any) => (
                    <div key={b.id} className={`border p-4 rounded-lg cursor-pointer transition-colors ${formData.linkedBookingIds.includes(b.id) ? 'bg-blue-50 border-blue-500' : 'hover:bg-gray-50'}`} onClick={() => handleToggleCart('booking', b.id)}>
                      <div className="flex justify-between">
                        <span className="font-bold">{b.hotelName} ({b.city})</span>
                        <input type="checkbox" checked={formData.linkedBookingIds.includes(b.id)} readOnly className="h-5 w-5" />
                      </div>
                      <div className="text-sm text-gray-600 mt-1">Code: {b.code} | {b.checkIn ? new Date(b.checkIn).toLocaleDateString() : '-'}</div>
                      <div className="font-bold mt-2 text-green-700">{formatCurrency(b.totalAmount, 'SAR')}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-6">
              <h4 className="font-bold mb-4 border-b pb-2">Transportation Bookings (Unlinked)</h4>
              {unlinkedTransports.length === 0 ? <p className="text-gray-500 italic text-sm">Tidak ada booking transport yang unlinked.</p> : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {unlinkedTransports.map((t:any) => (
                    <div key={t.id} className={`border p-4 rounded-lg cursor-pointer transition-colors ${formData.linkedTransportIds.includes(t.id) ? 'bg-blue-50 border-blue-500' : 'hover:bg-gray-50'}`} onClick={() => handleToggleCart('transport', t.id)}>
                      <div className="flex justify-between">
                        <span className="font-bold">{t.number}</span>
                        <input type="checkbox" checked={formData.linkedTransportIds.includes(t.id)} readOnly className="h-5 w-5" />
                      </div>
                      <div className="font-bold mt-2 text-green-700">{formatCurrency(t.totalAmount, t.currency || 'SAR')}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-6">
              <h4 className="font-bold mb-4 border-b pb-2">Service Orders - Visa/Siskopatuh (Unlinked)</h4>
              {unlinkedServiceOrders.length === 0 ? <p className="text-gray-500 italic text-sm">Tidak ada service order yang unlinked.</p> : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {unlinkedServiceOrders.map((s:any) => (
                    <div key={s.id} className={`border p-4 rounded-lg cursor-pointer transition-colors ${formData.linkedServiceOrderIds.includes(s.id) ? 'bg-blue-50 border-blue-500' : 'hover:bg-gray-50'}`} onClick={() => handleToggleCart('serviceOrder', s.id)}>
                      <div className="flex justify-between">
                        <span className="font-bold">{s.productType} - {s.number}</span>
                        <input type="checkbox" checked={formData.linkedServiceOrderIds.includes(s.id)} readOnly className="h-5 w-5" />
                      </div>
                      <div className="text-sm text-gray-600 mt-1">Pax: {s.totalPax}</div>
                      <div className="font-bold mt-2 text-green-700">{formatCurrency(s.totalAmount, s.currency || 'SAR')}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>Kembali</Button>
              <Button onClick={() => setStep(3)}>Lanjut ke Layanan Tambahan</Button>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-6 flex items-center"><Calendar className="mr-2" /> Layanan Tambahan Khusus LA</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-1">Handling Airport (SAR per pax)</label>
                <Input type="number" value={formData.handlingAirport} onChange={e => setFormData({...formData, handlingAirport: parseFloat(e.target.value)||0})} />
                <p className="text-xs text-gray-500 mt-1">Total: {formatCurrency(formData.handlingAirport * formData.totalPax, 'SAR')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Handling Hotel (SAR per pax)</label>
                <Input type="number" value={formData.handlingHotel} onChange={e => setFormData({...formData, handlingHotel: parseFloat(e.target.value)||0})} />
                <p className="text-xs text-gray-500 mt-1">Total: {formatCurrency(formData.handlingHotel * formData.totalPax, 'SAR')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tipe Tour Muthowif</label>
                <select value={formData.muthowifTourType} onChange={e => setFormData({...formData, muthowifTourType: e.target.value})} className="w-full border p-2 rounded">
                  <option value="Full Trip Paket">Full Trip Paket</option>
                  <option value="City Tour Makkah">City Tour Makkah</option>
                  <option value="City Tour Madinah">City Tour Madinah</option>
                  <option value="Tanpa Tour">Tanpa Tour</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Biaya Muthowif (SAR Fixed)</label>
                <Input type="number" value={formData.muthowif} onChange={e => setFormData({...formData, muthowif: parseFloat(e.target.value)||0})} />
              </div>
            </div>
            <div className="mt-8 flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>Kembali</Button>
              <Button onClick={() => setStep(4)}>Lanjut ke Margin & Simpan</Button>
            </div>
          </Card>
        )}

        {/* STEP 4 */}
        {step === 4 && (
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-6 flex items-center"><DollarSign className="mr-2" /> Rekapitulasi & Margin Profit</h2>
            
            <div className="bg-gray-50 p-4 rounded-lg border mb-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Total Item Terpilih (Hotel, Transport, Visa)</span>
                <span>{formatCurrency(baseTotal - ((formData.handlingAirport + formData.handlingHotel) * formData.totalPax) - formData.muthowif, 'SAR')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Total Handling & Tambahan LA</span>
                <span>{formatCurrency(((formData.handlingAirport + formData.handlingHotel) * formData.totalPax) + formData.muthowif, 'SAR')}</span>
              </div>
              <div className="flex justify-between font-bold border-t pt-2">
                <span>Base Total (HPP)</span>
                <span>{formatCurrency(baseTotal, 'SAR')}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium mb-1">Tipe Profit</label>
                <select value={formData.profitType} onChange={e => setFormData({...formData, profitType: e.target.value})} className="w-full border p-2 rounded">
                  <option value="percentage">Persentase (%)</option>
                  <option value="fixed">Nominal Fixed (SAR)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nilai Profit</label>
                <Input type="number" value={formData.profitValue} onChange={e => setFormData({...formData, profitValue: parseFloat(e.target.value)||0})} />
                <p className="text-xs text-green-600 font-bold mt-1">Margin: +{formatCurrency(profitAmount, 'SAR')}</p>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Catatan Tambahan</label>
                <textarea rows={3} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full border p-2 rounded" />
              </div>
            </div>

            <div className="bg-blue-600 text-white p-4 rounded-lg flex justify-between items-center mb-8">
              <div>
                <p className="text-blue-100 text-sm">Grand Total Tagihan LA</p>
                <p className="text-3xl font-bold">{formatCurrency(grandTotal, 'SAR')}</p>
              </div>
              <div className="text-right">
                <p className="text-blue-100 text-sm">Harga Per Pax</p>
                <p className="text-xl font-semibold">{formatCurrency(formData.totalPax > 0 ? grandTotal / formData.totalPax : 0, 'SAR')}</p>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(3)}>Kembali</Button>
              <Button onClick={handleSubmit} disabled={createLaMutation.isPending} className="bg-green-600 hover:bg-green-700">
                {createLaMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Simpan & Gabungkan LA
              </Button>
            </div>
          </Card>
        )}

      </div>
    </PageLayout>
  )
}
