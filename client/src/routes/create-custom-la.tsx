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
        <div className="flex items-center justify-between mb-8 bg-white p-6 rounded-xl shadow-none border border-[#e5e7eb]">
          {[1, 2, 3, 4].map(idx => (
            <div key={idx} className={`flex items-center ${idx !== 4 ? 'flex-1' : ''}`}>
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${step >= idx ? 'bg-[#111111] text-white border border-[#111111]' : 'bg-gray-100 text-gray-400 border border-gray-200'} font-semibold text-xs transition-colors duration-200`}>
                {step > idx ? <CheckCircle2 className="w-4 h-4 text-white" /> : idx}
              </div>
              <div className={`mx-3 text-xs font-semibold hidden sm:block ${step >= idx ? 'text-[#111111]' : 'text-gray-400'}`}>
                {idx === 1 && "Info Client"}
                {idx === 2 && "Pilih Layanan"}
                {idx === 3 && "Handling Tambahan"}
                {idx === 4 && "Rekap & Margin"}
              </div>
              {idx !== 4 && (
                <div className="flex-1 h-[2px] mx-2 bg-gray-100">
                  <div className={`h-[2px] transition-all duration-300 ${step > idx ? 'bg-[#111111]' : 'bg-gray-100'}`} style={{ width: step > idx ? '100%' : '0%' }}></div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <Card className="p-6 border border-[#e5e7eb] rounded-xl shadow-none bg-white">
            <h2 className="text-base font-bold text-zinc-950 mb-6 flex items-center tracking-[-0.02em]">
              <Users className="mr-2 h-4 w-4 text-zinc-500" /> Informasi Pemesan & Jadwal
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">Pilih Client Terdaftar *</label>
                <select 
                  value={formData.clientId} 
                  onChange={(e) => handleClientChange(e.target.value)} 
                  className="w-full h-10 px-3 border border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] bg-white text-sm"
                >
                  <option value="">Pilih Client</option>
                  {clients.map((c:any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">Nama Group / PIC</label>
                <Input 
                  value={formData.customerName} 
                  onChange={e => setFormData({...formData, customerName: e.target.value})} 
                  placeholder="Nama Grup"
                  className="h-10 border-[#e5e7eb] rounded-md focus-visible:ring-[#111111] focus-visible:border-[#111111]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">Total Jamaah *</label>
                <Input 
                  type="number" 
                  min="1" 
                  value={formData.totalPax} 
                  onChange={e => setFormData({...formData, totalPax: parseInt(e.target.value)||1})} 
                  className="h-10 border-[#e5e7eb] rounded-md focus-visible:ring-[#111111] focus-visible:border-[#111111]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">Kedatangan</label>
                  <Input 
                    type="date" 
                    value={formData.kedatangan} 
                    onChange={e => setFormData({...formData, kedatangan: e.target.value})} 
                    className="h-10 border-[#e5e7eb] rounded-md focus-visible:ring-[#111111] focus-visible:border-[#111111]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">Keberangkatan</label>
                  <Input 
                    type="date" 
                    value={formData.keberangkatan} 
                    onChange={e => setFormData({...formData, keberangkatan: e.target.value})} 
                    className="h-10 border-[#e5e7eb] rounded-md focus-visible:ring-[#111111] focus-visible:border-[#111111]"
                  />
                </div>
              </div>
            </div>
            <div className="mt-8 flex justify-end">
              <Button 
                onClick={() => setStep(2)} 
                disabled={!formData.clientId || !formData.customerName}
                className="bg-[#111111] hover:bg-[#242424] text-white h-10 px-6 rounded-md font-semibold text-sm transition-colors border border-transparent shadow-none"
              >
                Lanjut ke Pemilihan Layanan
              </Button>
            </div>
          </Card>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200/60 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="font-bold text-zinc-900 flex items-center text-sm tracking-tight"><Package className="mr-2 h-4 w-4 text-zinc-600" /> Keranjang Layanan Terintegrasi</h3>
                <p className="text-xs text-zinc-500 mt-1">Pilih booking hotel, transport, atau visa yang sudah Anda buat sebelumnya. Atau buat baru di tab/jendela terpisah lalu klik Refresh.</p>
              </div>
              <div className="flex space-x-2 w-full md:w-auto">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => window.open('/create-booking', '_blank')}
                  className="text-xs h-8 px-3 border-zinc-200 hover:bg-zinc-50"
                >
                  <Plus className="w-3.5 h-3.5 mr-1"/> Buat Booking Hotel
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => { refetchBookings(); refetchTransports(); refetchSO(); }}
                  className="text-xs h-8 px-3 border-zinc-200 hover:bg-zinc-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1 ${(isRefetchingB||isRefetchingT||isRefetchingSO) ? 'animate-spin':''}`}/> Refresh Data
                </Button>
              </div>
            </div>

            <Card className="p-6 border border-[#e5e7eb] rounded-xl shadow-none bg-white">
              <h4 className="font-bold text-sm text-zinc-900 mb-4 border-b pb-3 tracking-tight">Hotel Bookings (Unlinked)</h4>
              {unlinkedBookings.length === 0 ? (
                <p className="text-zinc-400 italic text-xs">Tidak ada booking hotel yang unlinked untuk client ini.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {unlinkedBookings.map((b:any) => {
                    const isSelected = formData.linkedBookingIds.includes(b.id);
                    return (
                      <div 
                        key={b.id} 
                        className={`border p-4 rounded-xl cursor-pointer transition-all duration-200 ${isSelected ? 'border-[#111111] bg-zinc-50' : 'border-[#e5e7eb] bg-white hover:bg-zinc-50/50'}`} 
                        onClick={() => handleToggleCart('booking', b.id)}
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-sm text-zinc-900">{b.hotelName} ({b.city})</span>
                          <input 
                            type="checkbox" 
                            checked={isSelected} 
                            readOnly 
                            className="h-4 w-4 rounded border-gray-300 text-zinc-950 focus:ring-zinc-950 mt-1 pointer-events-none accent-black" 
                          />
                        </div>
                        <div className="text-xs text-zinc-500 mt-1">Code: {b.code} | {b.checkIn ? new Date(b.checkIn).toLocaleDateString() : '-'}</div>
                        <div className="font-bold text-xs mt-3 text-zinc-900">{formatCurrency(b.totalAmount, 'SAR')}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card className="p-6 border border-[#e5e7eb] rounded-xl shadow-none bg-white">
              <h4 className="font-bold text-sm text-zinc-900 mb-4 border-b pb-3 tracking-tight">Transportation Bookings (Unlinked)</h4>
              {unlinkedTransports.length === 0 ? (
                <p className="text-zinc-400 italic text-xs">Tidak ada booking transport yang unlinked.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {unlinkedTransports.map((t:any) => {
                    const isSelected = formData.linkedTransportIds.includes(t.id);
                    return (
                      <div 
                        key={t.id} 
                        className={`border p-4 rounded-xl cursor-pointer transition-all duration-200 ${isSelected ? 'border-[#111111] bg-zinc-50' : 'border-[#e5e7eb] bg-white hover:bg-zinc-50/50'}`} 
                        onClick={() => handleToggleCart('transport', t.id)}
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-sm text-zinc-900">{t.number}</span>
                          <input 
                            type="checkbox" 
                            checked={isSelected} 
                            readOnly 
                            className="h-4 w-4 rounded border-gray-300 text-zinc-950 focus:ring-zinc-950 mt-1 pointer-events-none accent-black" 
                          />
                        </div>
                        <div className="font-bold text-xs mt-3 text-zinc-900">{formatCurrency(t.totalAmount, t.currency || 'SAR')}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card className="p-6 border border-[#e5e7eb] rounded-xl shadow-none bg-white">
              <h4 className="font-bold text-sm text-zinc-900 mb-4 border-b pb-3 tracking-tight">Service Orders - Visa/Siskopatuh (Unlinked)</h4>
              {unlinkedServiceOrders.length === 0 ? (
                <p className="text-zinc-400 italic text-xs">Tidak ada service order yang unlinked.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {unlinkedServiceOrders.map((s:any) => {
                    const isSelected = formData.linkedServiceOrderIds.includes(s.id);
                    return (
                      <div 
                        key={s.id} 
                        className={`border p-4 rounded-xl cursor-pointer transition-all duration-200 ${isSelected ? 'border-[#111111] bg-zinc-50' : 'border-[#e5e7eb] bg-white hover:bg-zinc-50/50'}`} 
                        onClick={() => handleToggleCart('serviceOrder', s.id)}
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-sm text-zinc-900">{s.productType} - {s.number}</span>
                          <input 
                            type="checkbox" 
                            checked={isSelected} 
                            readOnly 
                            className="h-4 w-4 rounded border-gray-300 text-zinc-950 focus:ring-zinc-950 mt-1 pointer-events-none accent-black" 
                          />
                        </div>
                        <div className="text-xs text-zinc-500 mt-1">Pax: {s.totalPax}</div>
                        <div className="font-bold text-xs mt-3 text-zinc-900">{formatCurrency(s.totalAmount, s.currency || 'SAR')}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <div className="flex justify-between">
              <Button 
                variant="outline" 
                onClick={() => setStep(1)}
                className="h-10 px-5 border-zinc-200 hover:bg-zinc-50 font-medium text-sm rounded-md"
              >
                Kembali
              </Button>
              <Button 
                onClick={() => setStep(3)}
                className="bg-[#111111] hover:bg-[#242424] text-white h-10 px-5 rounded-md font-semibold text-sm transition-colors border border-transparent shadow-none"
              >
                Lanjut ke Layanan Tambahan
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <Card className="p-6 border border-[#e5e7eb] rounded-xl shadow-none bg-white">
            <h2 className="text-base font-bold text-zinc-950 mb-6 flex items-center tracking-[-0.02em]">
              <Calendar className="mr-2 h-4 w-4 text-zinc-500" /> Layanan Tambahan Khusus LA
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">Handling Airport (SAR per pax)</label>
                <Input 
                  type="number" 
                  value={formData.handlingAirport} 
                  onChange={e => setFormData({...formData, handlingAirport: parseFloat(e.target.value)||0})} 
                  className="h-10 border-[#e5e7eb] rounded-md focus-visible:ring-[#111111] focus-visible:border-[#111111]"
                />
                <p className="text-xs text-zinc-500 mt-2 font-medium">Total: {formatCurrency(formData.handlingAirport * formData.totalPax, 'SAR')}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">Handling Hotel (SAR per pax)</label>
                <Input 
                  type="number" 
                  value={formData.handlingHotel} 
                  onChange={e => setFormData({...formData, handlingHotel: parseFloat(e.target.value)||0})} 
                  className="h-10 border-[#e5e7eb] rounded-md focus-visible:ring-[#111111] focus-visible:border-[#111111]"
                />
                <p className="text-xs text-zinc-500 mt-2 font-medium">Total: {formatCurrency(formData.handlingHotel * formData.totalPax, 'SAR')}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">Tipe Tour Muthowif</label>
                <select 
                  value={formData.muthowifTourType} 
                  onChange={e => setFormData({...formData, muthowifTourType: e.target.value})} 
                  className="w-full h-10 px-3 border border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] bg-white text-sm"
                >
                  <option value="Full Trip Paket">Full Trip Paket</option>
                  <option value="City Tour Makkah">City Tour Makkah</option>
                  <option value="City Tour Madinah">City Tour Madinah</option>
                  <option value="Tanpa Tour">Tanpa Tour</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">Biaya Muthowif (SAR Fixed)</label>
                <Input 
                  type="number" 
                  value={formData.muthowif} 
                  onChange={e => setFormData({...formData, muthowif: parseFloat(e.target.value)||0})} 
                  className="h-10 border-[#e5e7eb] rounded-md focus-visible:ring-[#111111] focus-visible:border-[#111111]"
                />
              </div>
            </div>
            <div className="mt-8 flex justify-between">
              <Button 
                variant="outline" 
                onClick={() => setStep(2)}
                className="h-10 px-5 border-zinc-200 hover:bg-zinc-50 font-medium text-sm rounded-md"
              >
                Kembali
              </Button>
              <Button 
                onClick={() => setStep(4)}
                className="bg-[#111111] hover:bg-[#242424] text-white h-10 px-5 rounded-md font-semibold text-sm transition-colors border border-transparent shadow-none"
              >
                Lanjut ke Margin & Simpan
              </Button>
            </div>
          </Card>
        )}

        {/* STEP 4 */}
        {step === 4 && (
          <Card className="p-6 border border-[#e5e7eb] rounded-xl shadow-none bg-white">
            <h2 className="text-base font-bold text-zinc-950 mb-6 flex items-center tracking-[-0.02em]">
              <DollarSign className="mr-2 h-4 w-4 text-zinc-500" /> Rekapitulasi & Margin Profit
            </h2>
            
            <div className="bg-zinc-50/50 p-5 rounded-xl border border-zinc-200/60 mb-6 space-y-3">
              <div className="flex justify-between text-xs text-zinc-500 font-semibold uppercase tracking-wider">
                <span>Total Item Terpilih (Hotel, Transport, Visa)</span>
                <span className="font-bold text-zinc-900">{formatCurrency(baseTotal - ((formData.handlingAirport + formData.handlingHotel) * formData.totalPax) - formData.muthowif, 'SAR')}</span>
              </div>
              <div className="flex justify-between text-xs text-zinc-500 font-semibold uppercase tracking-wider">
                <span>Total Handling & Tambahan LA</span>
                <span className="font-bold text-zinc-900">{formatCurrency(((formData.handlingAirport + formData.handlingHotel) * formData.totalPax) + formData.muthowif, 'SAR')}</span>
              </div>
              <div className="flex justify-between font-bold text-sm border-t border-zinc-200 pt-3">
                <span className="text-zinc-900">Base Total (HPP)</span>
                <span className="text-zinc-950">{formatCurrency(baseTotal, 'SAR')}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">Tipe Profit</label>
                <select 
                  value={formData.profitType} 
                  onChange={e => setFormData({...formData, profitType: e.target.value})} 
                  className="w-full h-10 px-3 border border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] bg-white text-sm"
                >
                  <option value="percentage">Persentase (%)</option>
                  <option value="fixed">Nominal Fixed (SAR)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">Nilai Profit</label>
                <Input 
                  type="number" 
                  value={formData.profitValue} 
                  onChange={e => setFormData({...formData, profitValue: parseFloat(e.target.value)||0})} 
                  className="h-10 border-[#e5e7eb] rounded-md focus-visible:ring-[#111111] focus-visible:border-[#111111]"
                />
                <p className="text-xs text-emerald-600 font-semibold mt-2">Margin: +{formatCurrency(profitAmount, 'SAR')}</p>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">Catatan Tambahan</label>
                <textarea 
                  rows={3} 
                  value={formData.notes} 
                  onChange={e => setFormData({...formData, notes: e.target.value})} 
                  className="w-full p-3 border border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] bg-white text-sm focus:outline-none" 
                />
              </div>
            </div>

            <div className="bg-[#111111] text-white p-6 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 shadow-sm">
              <div>
                <p className="text-[#a1a1aa] text-xs font-bold uppercase tracking-wider mb-1">Grand Total Tagihan LA</p>
                <p className="text-3xl font-bold tracking-tight">{formatCurrency(grandTotal, 'SAR')}</p>
              </div>
              <div className="sm:text-right">
                <p className="text-[#a1a1aa] text-xs font-bold uppercase tracking-wider mb-1">Harga Per Pax</p>
                <p className="text-xl font-semibold tracking-tight">{formatCurrency(formData.totalPax > 0 ? grandTotal / formData.totalPax : 0, 'SAR')}</p>
              </div>
            </div>

            <div className="flex justify-between">
              <Button 
                variant="outline" 
                onClick={() => setStep(3)}
                className="h-10 px-5 border-zinc-200 hover:bg-zinc-50 font-medium text-sm rounded-md"
              >
                Kembali
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={createLaMutation.isPending} 
                className="bg-[#111111] hover:bg-[#242424] text-white h-10 px-6 rounded-md font-semibold text-sm transition-colors border border-transparent shadow-none"
              >
                {createLaMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin text-white" /> : <Save className="w-4 h-4 mr-2 text-white" />}
                Simpan & Gabungkan LA
              </Button>
            </div>
          </Card>
        )}

      </div>
    </PageLayout>
  )
}
