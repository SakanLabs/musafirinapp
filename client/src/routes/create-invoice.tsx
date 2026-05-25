import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { useEffect, useMemo, useState } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import {
  FileText,
  Save,
  ArrowLeft,
  Loader2,
  User,
  Building,
  Plus,
  Trash
} from "lucide-react"
import { authService } from "@/lib/auth"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useClients, useCreateClient } from "@/lib/queries/clients"
import { useClientBookings } from "@/lib/queries/clients"
import { useBooking } from "@/lib/queries/bookings"
import { useBookingServiceItems, useCreateBookingServiceItem, useDeleteBookingServiceItem, type ServiceItemType } from "@/lib/queries/bookingServiceItems"
import { useGenerateInvoice } from "@/lib/queries/bookings"
import { useInvoices } from "@/lib/queries/invoices"
import { apiClient, API_ENDPOINTS } from "@/lib/api"
import { useTransportationBookings, useGenerateTransportationInvoice } from "@/lib/queries/transportationBookings"
import { useServiceOrders, useGenerateServiceOrderInvoice } from "@/lib/queries/serviceOrders"

export const Route = createFileRoute("/create-invoice")({
  beforeLoad: async () => {
    const isAuthenticated = await authService.isAuthenticated()
    if (!isAuthenticated) {
      throw redirect({ to: "/login" })
    }
  },
  component: CreateInvoicePage
})

interface NewClientForm {
  name: string
  email: string
  phone: string
  address?: string
}

interface NewServiceItemForm {
  serviceType: ServiceItemType
  description: string
  quantity: number
  unitPrice: number
  notes?: string
}

function CreateInvoicePage() {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string>("")
  const [sourceType, setSourceType] = useState<'hotel' | 'transportation' | 'service_order'>("hotel")
  const [selectedBookingId, setSelectedBookingId] = useState<string>("")
  const [selectedTransportationId, setSelectedTransportationId] = useState<string>("")
  const [selectedServiceOrderId, setSelectedServiceOrderId] = useState<string>("")
  // Multi-select collections for combining into one Hotel Booking invoice
  const [selectedTransportationIdsMulti, setSelectedTransportationIdsMulti] = useState<string[]>([])
  const [selectedServiceOrderIdsMulti, setSelectedServiceOrderIdsMulti] = useState<string[]>([])
  const [dueDate, setDueDate] = useState<string>(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
  const [isAddingClient, setIsAddingClient] = useState(false)
  const [newClient, setNewClient] = useState<NewClientForm>({ name: "", email: "", phone: "" })
  const [newItem, setNewItem] = useState<NewServiceItemForm>({ serviceType: 'visa_umrah', description: '', quantity: 1, unitPrice: 0 })

  // Data hooks
  const { data: clients = [] } = useClients()
  const { data: clientBookings = [], isLoading: loadingBookings } = useClientBookings(selectedClientId)
  const { data: booking } = useBooking(selectedBookingId)
  const { data: serviceItems = [] } = useBookingServiceItems(selectedBookingId)
  const { mutateAsync: createClient, isPending: creatingClient } = useCreateClient()
  const { mutateAsync: createServiceItem, isPending: creatingItem } = useCreateBookingServiceItem()
  const { mutateAsync: deleteServiceItem } = useDeleteBookingServiceItem()
  const { mutateAsync: generateInvoice } = useGenerateInvoice()
  const { data: allInvoices = [] } = useInvoices()
  const { data: allTransportation = [] } = useTransportationBookings()
  const { data: serviceOrders = [] } = useServiceOrders()
  const { mutateAsync: generateTransportationInvoice } = useGenerateTransportationInvoice()
  const { mutateAsync: generateServiceOrderInvoice } = useGenerateServiceOrderInvoice()

  // Derived lists filtered by client and invoice-not-created
  const hotelBookingOptions = useMemo(() => {
    if (!selectedClientId) return [] as typeof clientBookings
    const invoicedBookingIds = new Set(allInvoices.map(inv => inv.bookingId))
    return clientBookings.filter(b => !invoicedBookingIds.has(b.id))
  }, [selectedClientId, clientBookings, allInvoices])

  const transportationOptionsRaw = useMemo(() => {
    return (allTransportation || []).filter((t: any) => t.clientId?.toString() === selectedClientId)
  }, [allTransportation, selectedClientId])

  const [transportationOptions, setTransportationOptions] = useState<any[]>([])

  const serviceOrdersRaw = useMemo(() => {
    return (serviceOrders || []).filter((so: any) => so.clientId?.toString() === selectedClientId)
  }, [serviceOrders, selectedClientId])

  const [serviceOrdersOptions, setServiceOrdersOptions] = useState<any[]>([])

  // Reset selections when client or source type changes
  useEffect(() => {
    setSelectedBookingId("")
    setSelectedTransportationId("")
    setSelectedServiceOrderId("")
    setSelectedTransportationIdsMulti([])
    setSelectedServiceOrderIdsMulti([])
  }, [selectedClientId, sourceType])

  // Transportation invoice existence fetch and filter
  useEffect(() => {
    const fetchInvoices = async () => {
      const results: any[] = []
      for (const t of transportationOptionsRaw) {
        try {
          await apiClient.get(API_ENDPOINTS.TRANSPORTATION_INVOICE(t.id))
          // If success, invoice exists -> skip
        } catch (err) {
          // If fails (likely 404), include as not invoiced
          results.push(t)
        }
      }
      setTransportationOptions(results)
    }
    if (selectedClientId) {
      fetchInvoices()
    } else {
      setTransportationOptions([])
    }
  }, [transportationOptionsRaw, selectedClientId])

  // Service order invoice existence fetch and filter
  useEffect(() => {
    const fetchServiceOrderInvoices = async () => {
      const results: any[] = []
      for (const so of serviceOrdersRaw) {
        try {
          await apiClient.get(API_ENDPOINTS.SERVICE_ORDER_GET_INVOICE(so.id))
          // exists -> skip
        } catch (err) {
          // 404 -> include
          results.push(so)
        }
      }
      setServiceOrdersOptions(results)
    }
    if (selectedClientId) {
      fetchServiceOrderInvoices()
    } else {
      setServiceOrdersOptions([])
    }
  }, [serviceOrdersRaw, selectedClientId])

  const bookingTotal = useMemo(() => booking?.totalAmount ?? 0, [booking])
  const extraTotal = useMemo(() => serviceItems.reduce((sum, item) => sum + parseFloat(item.subtotal as any), 0), [serviceItems])
  const grandTotal = useMemo(() => (bookingTotal || 0) + (extraTotal || 0), [bookingTotal, extraTotal])
  // Additional totals from multi-selected transport & service orders (for preview only)
  const additionalSelectedTotal = useMemo(() => {
    let total = 0
    const tSelectedSet = new Set(selectedTransportationIdsMulti)
    const soSelectedSet = new Set(selectedServiceOrderIdsMulti)
    for (const t of transportationOptions) {
      if (tSelectedSet.has(t.id.toString())) {
        total += parseFloat(t.totalAmount || '0')
      }
    }
    for (const so of serviceOrdersOptions) {
      if (soSelectedSet.has(so.id.toString())) {
        total += parseFloat(so.totalPriceSAR || '0')
      }
    }
    return total
  }, [transportationOptions, serviceOrdersOptions, selectedTransportationIdsMulti, selectedServiceOrderIdsMulti])

  const computedGrandTotal = useMemo(() => (grandTotal || 0) + (additionalSelectedTotal || 0), [grandTotal, additionalSelectedTotal])

  const handleCreateClient = async () => {
    try {
      const created = await createClient({
        name: newClient.name,
        email: newClient.email,
        phone: newClient.phone,
        address: newClient.address
      })
      setIsAddingClient(false)
      setNewClient({ name: "", email: "", phone: "" })
      setSelectedClientId(created.id.toString())
    } catch (err) {
      console.error('Gagal membuat client:', err)
    }
  }

  const handleAddServiceItem = async () => {
    if (!selectedBookingId) return
    try {
      await createServiceItem({
        bookingId: parseInt(selectedBookingId),
        serviceType: newItem.serviceType,
        description: newItem.description,
        quantity: newItem.quantity,
        unitPrice: newItem.unitPrice,
        notes: newItem.notes
      })
      setNewItem({ serviceType: 'visa_umrah', description: '', quantity: 1, unitPrice: 0 })
    } catch (err) {
      console.error('Gagal menambah service item:', err)
    }
  }

  const handleDeleteServiceItem = async (id: number) => {
    if (!selectedBookingId) return
    try {
      await deleteServiceItem({ id, bookingId: parseInt(selectedBookingId) })
    } catch (err) {
      console.error('Gagal menghapus service item:', err)
    }
  }

  const handleGenerateInvoice = async () => {
    setIsLoading(true)
    try {
      if (sourceType === 'hotel') {
        if (!selectedBookingId) return
        // If user selected transport/service orders to combine, create service items first
        const tSelectedSet = new Set(selectedTransportationIdsMulti)
        const soSelectedSet = new Set(selectedServiceOrderIdsMulti)
        const createItemsPromises: Promise<any>[] = []
        for (const t of transportationOptions) {
          if (tSelectedSet.has(t.id.toString())) {
            createItemsPromises.push(
              createServiceItem({
                bookingId: parseInt(selectedBookingId),
                serviceType: 'transportasi',
                description: `Transport ${t.number} — ${t.routeCount} routes`,
                quantity: 1,
                unitPrice: parseFloat(t.totalAmount || '0'),
                notes: `Auto-added from Transportation booking ${t.number}`
              })
            )
          }
        }
        for (const so of serviceOrdersOptions) {
          if (soSelectedSet.has(so.id.toString())) {
            createItemsPromises.push(
              createServiceItem({
                bookingId: parseInt(selectedBookingId),
                serviceType: 'visa_umrah',
                description: `Visa ${so.number} — ${so.productType} — ${so.totalPeople} org`,
                quantity: 1,
                unitPrice: parseFloat(so.totalPriceSAR),
                notes: `Auto-added from Visa ${so.number}`
              })
            )
          }
        }
        if (createItemsPromises.length > 0) {
          await Promise.allSettled(createItemsPromises)
        }
        await generateInvoice({ bookingId: selectedBookingId, dueDate })
      } else if (sourceType === 'transportation') {
        if (!selectedTransportationId) return
        await generateTransportationInvoice({
          bookingId: selectedTransportationId,
          dueDate: dueDate || new Date().toISOString().split('T')[0],
        })
      } else if (sourceType === 'service_order') {
        if (!selectedServiceOrderId) return
        await generateServiceOrderInvoice({ serviceOrderId: selectedServiceOrderId, customDueDate: dueDate })
      }
      navigate({ to: "/invoices" })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <PageLayout
      title="Create Invoice"
      subtitle="Gabungkan layanan (Visa, Transportasi, dll) ke dalam satu invoice resmi"
      actions={
        <div className="flex items-center space-x-2.5">
          <Button 
            variant="outline" 
            onClick={() => navigate({ to: "/invoices" })}
            className="h-9 px-4 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 hover:text-black flex items-center rounded-md font-semibold text-xs bg-white shadow-none"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Batal
          </Button>
          <Button 
            onClick={handleGenerateInvoice} 
            disabled={isLoading || (sourceType === 'hotel' ? !selectedBookingId : sourceType === 'transportation' ? !selectedTransportationId : !selectedServiceOrderId)}
            className="bg-[#111111] hover:bg-[#242424] text-white h-9 px-4 rounded-md text-xs font-semibold transition-colors border border-transparent shadow-none"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin text-white" />
                Menerbitkan...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2 text-white/80" />
                Terbitkan Invoice
              </>
            )}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Container */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client & Booking Selection */}
          <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none p-6">
            <div className="flex items-center space-x-2 mb-6 pb-2 border-b border-gray-100">
              <User className="h-4.5 w-4.5 text-zinc-700" />
              <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider">Pilih Client & Booking</h3>
            </div>
            <div className="space-y-5">
              {/* Select existing client */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Client Existing</label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:outline-none focus:border-[#111111] focus:ring-1 focus:ring-[#111111]"
                  >
                    <option value="">Pilih Client Existing</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id.toString()}>{c.name} — {c.email}</option>
                    ))}
                  </select>
                </div>
                <div className="flex">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsAddingClient(v => !v)}
                    className="w-full h-10 px-4 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 hover:text-black flex items-center justify-center rounded-lg font-semibold text-xs bg-white shadow-none"
                  >
                    <Plus className="h-4 w-4 mr-1.5 text-zinc-500" /> Client Baru
                  </Button>
                </div>
              </div>

              {/* Inline new client form */}
              {isAddingClient && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-zinc-50/60 border border-zinc-150 rounded-lg">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Nama Lengkap</label>
                    <Input 
                      value={newClient.name} 
                      onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} 
                      className="h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Email Address</label>
                    <Input 
                      type="email" 
                      value={newClient.email} 
                      onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} 
                      className="h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">No. Telepon</label>
                    <Input 
                      value={newClient.phone} 
                      onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} 
                      className="h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none"
                    />
                  </div>
                  <div className="flex">
                    <Button 
                      type="button" 
                      onClick={handleCreateClient} 
                      disabled={creatingClient}
                      className="w-full bg-[#111111] hover:bg-[#242424] text-white h-10 rounded-lg text-xs font-semibold transition-colors border border-transparent shadow-none"
                    >
                      {creatingClient ? <Loader2 className="h-4 w-4 mr-2 animate-spin text-white" /> : <Plus className="h-4 w-4 mr-2 text-white/80" />}
                      Simpan Client
                    </Button>
                  </div>
                </div>
              )}

              {/* Sumber & Booking milik Client */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Tipe Sumber</label>
                  <select
                    value={sourceType}
                    onChange={(e) => setSourceType(e.target.value as any)}
                    className="w-full h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:outline-none focus:border-[#111111] focus:ring-1 focus:ring-[#111111]"
                  >
                    <option value="hotel">Hotel Booking</option>
                    <option value="transportation">Transportasi</option>
                    <option value="service_order">Visa</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Booking milik Client</label>
                  {sourceType === 'hotel' && (
                    <select
                      value={selectedBookingId}
                      onChange={(e) => setSelectedBookingId(e.target.value)}
                      disabled={!selectedClientId || loadingBookings}
                      className="w-full h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:outline-none focus:border-[#111111] focus:ring-1 focus:ring-[#111111] disabled:opacity-50"
                    >
                      <option value="">{selectedClientId ? 'Pilih Booking' : 'Pilih client terlebih dahulu'}</option>
                      {hotelBookingOptions.map(b => (
                        <option key={b.id} value={b.id.toString()}>{b.code} — {b.hotelName} ({formatDate(b.checkIn)} - {formatDate(b.checkOut)})</option>
                      ))}
                    </select>
                  )}
                  {sourceType === 'hotel' && selectedClientId && selectedBookingId && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Tambahkan Transportasi</label>
                        <div className="space-y-1.5 max-h-40 overflow-auto border border-[#e5e7eb] rounded-lg p-3 bg-zinc-50/50">
                          {transportationOptions.length === 0 ? (
                            <p className="text-xs text-zinc-500 italic">Tidak ada transportasi yang belum ber-invoice.</p>
                          ) : (
                            transportationOptions.map(t => {
                              const checked = selectedTransportationIdsMulti.includes(t.id.toString())
                              return (
                                <label key={t.id} className="flex items-start gap-2.5 text-xs text-zinc-700 cursor-pointer font-medium">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      setSelectedTransportationIdsMulti(prev => {
                                        const id = t.id.toString()
                                        if (e.target.checked) return [...prev, id]
                                        return prev.filter(x => x !== id)
                                      })
                                    }}
                                    className="h-4 w-4 rounded border-gray-300 text-zinc-950 focus:ring-zinc-950 mt-0.5 accent-black shrink-0"
                                  />
                                  <span>{t.number} ({t.routeCount} rute) • {formatCurrency(parseFloat(t.totalAmount), t.currency || 'SAR')}</span>
                                </label>
                              )
                            })
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Tambahkan Visa</label>
                        <div className="space-y-1.5 max-h-40 overflow-auto border border-[#e5e7eb] rounded-lg p-3 bg-zinc-50/50">
                          {serviceOrdersOptions.length === 0 ? (
                            <p className="text-xs text-zinc-500 italic">Tidak ada visa yang belum ber-invoice.</p>
                          ) : (
                            serviceOrdersOptions.map(so => {
                              const checked = selectedServiceOrderIdsMulti.includes(so.id.toString())
                              return (
                                <label key={so.id} className="flex items-start gap-2.5 text-xs text-zinc-700 cursor-pointer font-medium">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      setSelectedServiceOrderIdsMulti(prev => {
                                        const id = so.id.toString()
                                        if (e.target.checked) return [...prev, id]
                                        return prev.filter(x => x !== id)
                                      })
                                    }}
                                    className="h-4 w-4 rounded border-gray-300 text-zinc-950 focus:ring-zinc-950 mt-0.5 accent-black shrink-0"
                                  />
                                  <span>{so.number} ({so.totalPeople} org) • {formatCurrency(parseFloat(so.totalPriceSAR), 'SAR')}</span>
                                </label>
                              )
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  {sourceType === 'transportation' && (
                    <select
                      value={selectedTransportationId}
                      onChange={(e) => setSelectedTransportationId(e.target.value)}
                      disabled={!selectedClientId}
                      className="w-full h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:outline-none focus:border-[#111111] focus:ring-1 focus:ring-[#111111] disabled:opacity-50"
                    >
                      <option value="">{selectedClientId ? 'Pilih Transportasi' : 'Pilih client terlebih dahulu'}</option>
                      {transportationOptions.map(t => (
                        <option key={t.id} value={t.id.toString()}>{t.number} — Rute: {t.routeCount} • Total: {formatCurrency(parseFloat(t.totalAmount), t.currency || 'SAR')}</option>
                      ))}
                    </select>
                  )}
                  {sourceType === 'service_order' && (
                    <select
                      value={selectedServiceOrderId}
                      onChange={(e) => setSelectedServiceOrderId(e.target.value)}
                      disabled={!selectedClientId}
                      className="w-full h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:outline-none focus:border-[#111111] focus:ring-1 focus:ring-[#111111] disabled:opacity-50"
                    >
                      <option value="">{selectedClientId ? 'Pilih Visa' : 'Pilih client terlebih dahulu'}</option>
                      {serviceOrdersOptions.map(so => (
                        <option key={so.id} value={so.id.toString()}>{so.number} — {so.productType} • {so.totalPeople} org • Total: {formatCurrency(parseFloat(so.totalPriceSAR), 'SAR')}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Service Items */}
          {sourceType === 'hotel' && (
            <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none p-6">
              <div className="flex items-center space-x-2 mb-6 pb-2 border-b border-gray-100">
                <Building className="h-4.5 w-4.5 text-zinc-700" />
                <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider">Service Items (Visa, Transportasi, Lainnya)</h3>
              </div>
              <div className="space-y-5">
                {/* Existing items list */}
                <div className="space-y-2">
                  {serviceItems.length === 0 ? (
                    <p className="text-xs text-zinc-500 italic py-2">Belum ada layanan tambahan ditambahkan untuk booking ini.</p>
                  ) : (
                    <div className="space-y-2">
                      {serviceItems.map(item => (
                        <div key={item.id} className="flex items-center justify-between border border-[#e5e7eb] rounded-lg p-3.5 bg-white transition-all hover:border-[#111111]/30">
                          <div className="space-y-0.5">
                            <p className="text-sm font-bold text-zinc-800">{item.description}</p>
                            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Tipe: {item.serviceType} • Qty: {item.quantity} • Harga Unit: {formatCurrency(parseFloat(item.unitPrice as any), 'SAR')}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-[#111111]">{formatCurrency(parseFloat(item.subtotal as any), 'SAR')}</span>
                            <Button 
                              variant="outline" 
                              onClick={() => handleDeleteServiceItem(item.id)}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/60 h-8 w-8 p-0 rounded-md flex items-center justify-center transition-colors shadow-none"
                            >
                              <Trash className="h-4 w-4 text-rose-500" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add new item */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end pt-4 border-t border-gray-100/80">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Tipe Layanan</label>
                    <select
                      value={newItem.serviceType}
                      onChange={(e) => setNewItem({ ...newItem, serviceType: e.target.value as ServiceItemType })}
                      className="w-full h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:outline-none focus:border-[#111111] focus:ring-1 focus:ring-[#111111]"
                    >
                      <option value="visa_umrah">Visa/Umrah</option>
                      <option value="transportasi">Transportasi</option>
                      <option value="other">Lainnya</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Deskripsi Rincian Layanan</label>
                    <Input 
                      value={newItem.description} 
                      onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} 
                      placeholder="Contoh: Visa Umrah 5 pax / Bus Full Trip" 
                      className="h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Quantity</label>
                    <Input 
                      type="number" 
                      min={1} 
                      value={newItem.quantity} 
                      onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })} 
                      className="h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Unit Price (SAR)</label>
                    <Input 
                      type="number" 
                      min={0} 
                      step={0.01} 
                      value={newItem.unitPrice} 
                      onChange={(e) => setNewItem({ ...newItem, unitPrice: parseFloat(e.target.value) || 0 })} 
                      className="h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none"
                    />
                  </div>
                  <div className="md:col-span-5 flex justify-end mt-2">
                    <Button 
                      type="button" 
                      onClick={handleAddServiceItem} 
                      disabled={!selectedBookingId || creatingItem}
                      className="h-9 px-4 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 hover:text-black flex items-center rounded-md font-semibold text-xs bg-white shadow-none border"
                    >
                      {creatingItem ? <Loader2 className="h-4 w-4 mr-2 animate-spin text-zinc-500" /> : <Plus className="h-4 w-4 mr-1.5 text-zinc-500" />}
                      Tambah Item
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Invoice Details */}
          <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none p-6">
            <div className="flex items-center space-x-2 mb-6 pb-2 border-b border-gray-100">
              <FileText className="h-4.5 w-4.5 text-zinc-700" />
              <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider">Invoice Settings</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Due Date (Tanggal Jatuh Tempo) *
                </label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none"
                />
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Informasi Nilai</label>
                <p className="text-xs text-zinc-500">Invoice akan diterbitkan dalam mata uang default SAR. Nilai total akhir akan diakumulasikan otomatis dari seluruh layanan terkait.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Invoice Preview */}
        <div className="space-y-6">
          <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none p-6 sticky top-6">
            <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider mb-6 pb-2 border-b border-gray-100">
              Invoice Checkout Preview
            </h3>
            <div className="space-y-5 text-xs text-zinc-600">
              <div className="space-y-1">
                <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Client Recipient</span>
                <p className="font-bold text-zinc-900 text-sm">{clients.find(c => c.id.toString() === selectedClientId)?.name || "Pilih Client..."}</p>
                <p className="text-zinc-500 font-medium">{clients.find(c => c.id.toString() === selectedClientId)?.email || "email@client.com"}</p>
              </div>

              <div className="space-y-1">
                <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Selected Booking Base</span>
                {booking ? (
                  <div className="bg-zinc-50 border border-zinc-150 rounded-lg p-3 space-y-0.5">
                    <p className="font-bold text-zinc-800 text-xs">{booking.code} — {booking.hotelName}</p>
                    <p className="text-zinc-500 font-semibold">{booking.city} • {formatDate(booking.checkIn)} s/d {formatDate(booking.checkOut)}</p>
                  </div>
                ) : (
                  <p className="text-zinc-400 italic">Pilih hotel booking...</p>
                )}
              </div>

              <div className="space-y-2">
                <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Pricing Breakdown Summary</span>
                <div className="space-y-1.5 bg-zinc-50/50 border border-zinc-100 rounded-lg p-3">
                  <div className="flex justify-between font-medium">
                    <span className="text-zinc-500">Booking (Hotel)</span>
                    <span className="font-bold text-zinc-800">{formatCurrency(bookingTotal || 0, 'SAR')}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span className="text-zinc-500">Service Items</span>
                    <span className="font-bold text-zinc-800">{formatCurrency(extraTotal || 0, 'SAR')}</span>
                  </div>
                  {sourceType === 'hotel' && (
                    <>
                      <div className="flex justify-between font-medium border-t border-dashed border-gray-200/80 pt-1.5">
                        <span className="text-zinc-500">Combined Transport</span>
                        <span className="font-bold text-zinc-800">{formatCurrency(
                          transportationOptions.reduce((sum, t) => sum + (selectedTransportationIdsMulti.includes(t.id.toString()) ? parseFloat(t.totalAmount || '0') : 0), 0),
                          'SAR'
                        )}</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span className="text-zinc-500">Combined Visa</span>
                        <span className="font-bold text-zinc-800">{formatCurrency(
                          serviceOrdersOptions.reduce((sum, so) => sum + (selectedServiceOrderIdsMulti.includes(so.id.toString()) ? parseFloat(so.totalPriceSAR || '0') : 0), 0),
                          'SAR'
                        )}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="border-t border-zinc-200 pt-4 mt-2">
                <div className="flex justify-between items-center font-bold border-t border-[#111111] pt-3 text-[#111111]">
                  <span className="text-xs uppercase tracking-wider font-bold">Grand Total Amount</span>
                  <span className="text-base tracking-tight font-extrabold">{formatCurrency((sourceType === 'hotel' ? computedGrandTotal : grandTotal) || 0, 'SAR')}</span>
                </div>
              </div>

              <div className="space-y-1 pt-2 border-t border-zinc-50">
                <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Tanggal Jatuh Tempo</span>
                <p className="font-bold text-zinc-800">{dueDate ? formatDate(dueDate) : "-"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  )
}