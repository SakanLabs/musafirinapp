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
                description: `Service Order ${so.number} — ${so.productType} — ${so.totalPeople} org`,
                quantity: 1,
                unitPrice: parseFloat(so.totalPriceSAR || '0'),
                notes: `Auto-added from Service Order ${so.number}`
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
    } catch (err) {
      console.error('Gagal generate invoice:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <PageLayout
      title="Create Invoice (Multi-Service)"
      subtitle="Gabungkan layanan (Visa, Transportasi, dll) ke dalam satu invoice berbasis Booking"
      showBackButton={true}
      actions={
        <div className="flex space-x-3">
          <Button variant="outline" onClick={() => navigate({ to: "/invoices" })}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleGenerateInvoice} disabled={isLoading || (sourceType === 'hotel' ? !selectedBookingId : sourceType === 'transportation' ? !selectedTransportationId : !selectedServiceOrderId)}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Create Invoice
              </>
            )}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client & Booking Selection */}
          <Card className="p-6">
            <div className="flex items-center space-x-2 mb-4">
              <User className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold">Pilih Client & Booking</h3>
            </div>
            <div className="space-y-4">
              {/* Select existing client */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Client Existing</label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
                  >
                    <option value="">Pilih Client</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id.toString()}>{c.name} — {c.email}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsAddingClient(v => !v)}>
                    <Plus className="h-4 w-4 mr-2" /> Client Baru
                  </Button>
                </div>
              </div>

              {/* Inline new client form */}
              {isAddingClient && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nama</label>
                    <Input value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <Input type="email" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                    <Input value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} />
                  </div>
                  <div className="flex items-end">
                    <Button type="button" onClick={handleCreateClient} disabled={creatingClient}>
                      {creatingClient ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                      Simpan Client
                    </Button>
                  </div>
                </div>
              )}

              {/* Sumber & Booking milik Client */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tipe Sumber</label>
                  <select
                    value={sourceType}
                    onChange={(e) => setSourceType(e.target.value as any)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
                  >
                    <option value="hotel">Hotel Booking</option>
                    <option value="transportation">Transportasi</option>
                    <option value="service_order">Service Order (Visa)</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Booking milik Client</label>
                  {sourceType === 'hotel' && (
                    <select
                      value={selectedBookingId}
                      onChange={(e) => setSelectedBookingId(e.target.value)}
                      disabled={!selectedClientId || loadingBookings}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
                    >
                      <option value="">{selectedClientId ? 'Pilih Booking' : 'Pilih client dulu'}</option>
                      {hotelBookingOptions.map(b => (
                        <option key={b.id} value={b.id.toString()}>{b.code} — {b.hotelName} ({formatDate(b.checkIn)} - {formatDate(b.checkOut)})</option>
                      ))}
                    </select>
                  )}
                  {sourceType === 'hotel' && selectedClientId && selectedBookingId && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Tambahkan Transportasi ke invoice</label>
                        <div className="space-y-2 max-h-40 overflow-auto border rounded-md p-2">
                          {transportationOptions.length === 0 ? (
                            <p className="text-xs text-gray-500">Tidak ada transportasi yang belum ber-invoice.</p>
                          ) : (
                            transportationOptions.map(t => {
                              const checked = selectedTransportationIdsMulti.includes(t.id.toString())
                              return (
                                <label key={t.id} className="flex items-center gap-2 text-sm">
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
                                  />
                                  <span>{t.number} — Routes: {t.routeCount} • Total: {formatCurrency(parseFloat(t.totalAmount), t.currency || 'SAR')}</span>
                                </label>
                              )
                            })
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Tambahkan Service Order ke invoice</label>
                        <div className="space-y-2 max-h-40 overflow-auto border rounded-md p-2">
                          {serviceOrdersOptions.length === 0 ? (
                            <p className="text-xs text-gray-500">Tidak ada service order yang belum ber-invoice.</p>
                          ) : (
                            serviceOrdersOptions.map(so => {
                              const checked = selectedServiceOrderIdsMulti.includes(so.id.toString())
                              return (
                                <label key={so.id} className="flex items-center gap-2 text-sm">
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
                                  />
                                  <span>{so.number} — {so.productType} • {so.totalPeople} org • Total: {formatCurrency(parseFloat(so.totalPriceSAR), 'SAR')}</span>
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
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
                    >
                      <option value="">{selectedClientId ? 'Pilih Transportasi' : 'Pilih client dulu'}</option>
                      {transportationOptions.map(t => (
                        <option key={t.id} value={t.id.toString()}>{t.number} — {t.customerName} • Routes: {t.routeCount} • Total: {formatCurrency(parseFloat(t.totalAmount), t.currency || 'SAR')}</option>
                      ))}
                    </select>
                  )}
                  {sourceType === 'service_order' && (
                    <select
                      value={selectedServiceOrderId}
                      onChange={(e) => setSelectedServiceOrderId(e.target.value)}
                      disabled={!selectedClientId}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
                    >
                      <option value="">{selectedClientId ? 'Pilih Service Order' : 'Pilih client dulu'}</option>
                      {serviceOrdersOptions.map(so => (
                        <option key={so.id} value={so.id.toString()}>{so.number} — {so.productType} • {so.groupLeaderName} • {so.totalPeople} org • Total: {formatCurrency(parseFloat(so.totalPriceSAR), 'SAR')}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>
          </Card>
          {/* Service Items */}
          {sourceType === 'hotel' && (
            <Card className="p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Building className="h-5 w-5 text-green-600" />
                <h3 className="text-lg font-semibold">Service Items (Visa, Transportasi, Lainnya)</h3>
              </div>
              <div className="space-y-4">
                {/* Existing items list */}
                <div className="space-y-2">
                  {serviceItems.length === 0 ? (
                    <p className="text-sm text-gray-600">Belum ada layanan ditambahkan untuk booking ini.</p>
                  ) : (
                    <div className="space-y-2">
                      {serviceItems.map(item => (
                        <div key={item.id} className="flex items-center justify-between border rounded-md p-3">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">{item.description}</p>
                            <p className="text-xs text-gray-600">Tipe: {item.serviceType} • Qty: {item.quantity} • Unit: {formatCurrency(parseFloat(item.unitPrice as any), 'SAR')}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-green-700">{formatCurrency(parseFloat(item.subtotal as any), 'SAR')}</span>
                            <Button variant="destructive" size="icon" onClick={() => handleDeleteServiceItem(item.id)}>
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add new item */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tipe Layanan</label>
                    <select
                      value={newItem.serviceType}
                      onChange={(e) => setNewItem({ ...newItem, serviceType: e.target.value as ServiceItemType })}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
                    >
                      <option value="visa_umrah">Visa/Umrah</option>
                      <option value="transportasi">Transportasi</option>
                      <option value="other">Lainnya</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Deskripsi</label>
                    <Input value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} placeholder="Contoh: Visa Umrah 5 pax / Bus Full Trip" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Qty</label>
                    <Input type="number" min={1} value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Unit Price (SAR)</label>
                    <Input type="number" min={0} step={0.01} value={newItem.unitPrice} onChange={(e) => setNewItem({ ...newItem, unitPrice: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div className="md:col-span-5 flex justify-end">
                    <Button type="button" onClick={handleAddServiceItem} disabled={!selectedBookingId || creatingItem}>
                      {creatingItem ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                      Tambah Item
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Invoice Details */}
          <Card className="p-6">
            <div className="flex items-center space-x-2 mb-4">
              <FileText className="h-5 w-5 text-indigo-600" />
              <h3 className="text-lg font-semibold">Invoice Details</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Due Date *
                </label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Catatan (opsional)
                </label>
                <p className="text-sm text-gray-600">Invoice akan menggunakan mata uang SAR dan total otomatis dihitung dari Booking + Service Items.</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Preview */}
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Invoice Preview</h3>
            <div className="space-y-4 text-sm">
              <div>
                <span className="text-gray-500">Client:</span>
                <p className="font-semibold">{clients.find(c => c.id.toString() === selectedClientId)?.name || "Pilih Client"}</p>
                <p className="text-gray-600">{clients.find(c => c.id.toString() === selectedClientId)?.email || "email@client.com"}</p>
              </div>

              <div>
                <span className="text-gray-500">Booking:</span>
                {booking ? (
                  <>
                    <p className="font-semibold">{booking.code} — {booking.hotelName}</p>
                    <p className="text-gray-600">{booking.city} • {formatDate(booking.checkIn)} - {formatDate(booking.checkOut)}</p>
                  </>
                ) : (
                  <p className="text-gray-600">Pilih booking</p>
                )}
              </div>

              <div>
                <span className="text-gray-500">Ringkasan Harga:</span>
                <div className="mt-1 space-y-1">
                  <div className="flex justify-between"><span>Booking (Hotel)</span><span>{formatCurrency(bookingTotal || 0, 'SAR')}</span></div>
                  <div className="flex justify-between"><span>Service Items</span><span>{formatCurrency(extraTotal || 0, 'SAR')}</span></div>
                  {sourceType === 'hotel' && (
                    <>
                      <div className="flex justify-between"><span>Transportasi dipilih</span><span>{formatCurrency(
                        transportationOptions.reduce((sum, t) => sum + (selectedTransportationIdsMulti.includes(t.id.toString()) ? parseFloat(t.totalAmount || '0') : 0), 0),
                        'SAR'
                      )}</span></div>
                      <div className="flex justify-between"><span>Service Orders dipilih</span><span>{formatCurrency(
                        serviceOrdersOptions.reduce((sum, so) => sum + (selectedServiceOrderIdsMulti.includes(so.id.toString()) ? parseFloat(so.totalPriceSAR || '0') : 0), 0),
                        'SAR'
                      )}</span></div>
                    </>
                  )}
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                  <span>Total:</span>
                  <span className="text-green-600">{formatCurrency((sourceType === 'hotel' ? computedGrandTotal : grandTotal) || 0, 'SAR')}</span>
                </div>
              </div>

              <div>
                <span className="text-gray-500">Due Date:</span>
                <p className="font-semibold">{dueDate ? formatDate(dueDate) : "Due Date"}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </PageLayout>
  )
}