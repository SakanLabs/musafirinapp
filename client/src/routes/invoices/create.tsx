import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { 
  FileText,
  Save,
  ArrowLeft,
  Loader2,
  Calendar,
  User,
  Building
} from "lucide-react"
import { SARCurrency } from "@/components/ui/sar-currency"
import { authService } from "@/lib/auth"
import { formatCurrency, formatDate } from "@/lib/utils"

export const Route = createFileRoute("/invoices/create")({
  beforeLoad: async () => {
    const isAuthenticated = await authService.isAuthenticated()
    if (!isAuthenticated) {
      throw redirect({ to: "/login" })
    }
  },
  component: CreateInvoicePage
})

interface CreateInvoiceData {
  clientName: string
  clientEmail: string
  clientAddress: string
  hotelName: string
  city: string
  checkIn: string
  checkOut: string
  roomType: string
  numberOfGuests: number
  numberOfNights: number
  roomRate: number
  totalAmount: number
  currency: string
  issueDate: string
  dueDate: string
  notes: string
}

function CreateInvoicePage() {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState<CreateInvoiceData>({
    clientName: "",
    clientEmail: "",
    clientAddress: "",
    hotelName: "",
    city: "",
    checkIn: "",
    checkOut: "",
    roomType: "",
    numberOfGuests: 1,
    numberOfNights: 1,
    roomRate: 0,
    totalAmount: 0,
    currency: "IDR",
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
    notes: ""
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleInputChange = (field: keyof CreateInvoiceData, value: string | number) => {
    setFormData(prev => {
      const updated = {
        ...prev,
        [field]: value
      }
      
      // Auto-calculate fields
      if (field === 'checkIn' || field === 'checkOut') {
        if (updated.checkIn && updated.checkOut) {
          const checkInDate = new Date(updated.checkIn)
          const checkOutDate = new Date(updated.checkOut)
          const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24))
          updated.numberOfNights = Math.max(1, nights)
        }
      }
      
      if (field === 'numberOfNights' || field === 'roomRate') {
        updated.totalAmount = updated.numberOfNights * updated.roomRate
      }
      
      return updated
    })
    
    // Clear error when user starts typing
    if (errors[field as keyof typeof errors]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.clientName.trim()) newErrors.clientName = "Client name is required"
    if (!formData.clientEmail.trim()) newErrors.clientEmail = "Client email is required"
    if (!formData.hotelName.trim()) newErrors.hotelName = "Hotel name is required"
    if (!formData.city.trim()) newErrors.city = "City is required"
    if (!formData.checkIn) newErrors.checkIn = "Check-in date is required"
    if (!formData.checkOut) newErrors.checkOut = "Check-out date is required"
    if (!formData.roomType.trim()) newErrors.roomType = "Room type is required"
    if (formData.numberOfGuests < 1) newErrors.numberOfGuests = "Number of guests must be at least 1"
    if (formData.roomRate <= 0) newErrors.roomRate = "Room rate must be greater than 0"
    if (!formData.issueDate) newErrors.issueDate = "Issue date is required"
    if (!formData.dueDate) newErrors.dueDate = "Due date is required"
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (formData.clientEmail && !emailRegex.test(formData.clientEmail)) {
      newErrors.clientEmail = "Please enter a valid email address"
    }
    
    // Validate dates
    if (formData.checkIn && formData.checkOut) {
      const checkInDate = new Date(formData.checkIn)
      const checkOutDate = new Date(formData.checkOut)
      if (checkOutDate <= checkInDate) {
        newErrors.checkOut = "Check-out date must be after check-in date"
      }
    }
    
    if (formData.issueDate && formData.dueDate) {
      const issueDate = new Date(formData.issueDate)
      const dueDate = new Date(formData.dueDate)
      if (dueDate < issueDate) {
        newErrors.dueDate = "Due date must be after issue date"
      }
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    setIsLoading(true)
    
    try {
      // TODO: Implement API call to create invoice
      console.log("Creating invoice with data:", formData)
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Navigate back to invoices list
      navigate({ to: "/invoices" })
    } catch (error) {
      console.error("Failed to create invoice:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <PageLayout
      title="Create Invoice"
      subtitle="Generate a new invoice for hotel booking"
      showBackButton={true}
      actions={
        <div className="flex space-x-3">
          <Button variant="outline" onClick={() => navigate({ to: "/invoices" })}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
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
          <form onSubmit={handleSubmit}>
            {/* Client Information */}
            <Card className="p-6">
              <div className="flex items-center space-x-2 mb-4">
                <User className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold">Client Information</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Client Name *
                  </label>
                  <Input
                    value={formData.clientName}
                    onChange={(e) => handleInputChange('clientName', e.target.value)}
                    placeholder="Enter client name"
                    className={errors.clientName ? "border-red-500" : ""}
                  />
                  {errors.clientName && (
                    <p className="text-red-500 text-sm mt-1">{errors.clientName}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <Input
                    type="email"
                    value={formData.clientEmail}
                    onChange={(e) => handleInputChange('clientEmail', e.target.value)}
                    placeholder="Enter email address"
                    className={errors.clientEmail ? "border-red-500" : ""}
                  />
                  {errors.clientEmail && (
                    <p className="text-red-500 text-sm mt-1">{errors.clientEmail}</p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address
                  </label>
                  <textarea
                    value={formData.clientAddress}
                    onChange={(e) => handleInputChange('clientAddress', e.target.value)}
                    placeholder="Enter client address"
                    rows={2}
                    className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                  />
                </div>
              </div>
            </Card>

            {/* Hotel Information */}
            <Card className="p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Building className="h-5 w-5 text-green-600" />
                <h3 className="text-lg font-semibold">Hotel Information</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hotel Name *
                  </label>
                  <Input
                    value={formData.hotelName}
                    onChange={(e) => handleInputChange('hotelName', e.target.value)}
                    placeholder="Enter hotel name"
                    className={errors.hotelName ? "border-red-500" : ""}
                  />
                  {errors.hotelName && (
                    <p className="text-red-500 text-sm mt-1">{errors.hotelName}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    City *
                  </label>
                  <Input
                    value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    placeholder="Enter city"
                    className={errors.city ? "border-red-500" : ""}
                  />
                  {errors.city && (
                    <p className="text-red-500 text-sm mt-1">{errors.city}</p>
                  )}
                </div>
              </div>
            </Card>

            {/* Booking Details */}
            <Card className="p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Calendar className="h-5 w-5 text-purple-600" />
                <h3 className="text-lg font-semibold">Booking Details</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Check-in Date *
                  </label>
                  <Input
                    type="date"
                    value={formData.checkIn}
                    onChange={(e) => handleInputChange('checkIn', e.target.value)}
                    className={errors.checkIn ? "border-red-500" : ""}
                  />
                  {errors.checkIn && (
                    <p className="text-red-500 text-sm mt-1">{errors.checkIn}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Check-out Date *
                  </label>
                  <Input
                    type="date"
                    value={formData.checkOut}
                    onChange={(e) => handleInputChange('checkOut', e.target.value)}
                    className={errors.checkOut ? "border-red-500" : ""}
                  />
                  {errors.checkOut && (
                    <p className="text-red-500 text-sm mt-1">{errors.checkOut}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Room Type *
                  </label>
                  <select
                    value={formData.roomType}
                    onChange={(e) => handleInputChange('roomType', e.target.value)}
                    className={`flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm ${errors.roomType ? "border-red-500" : ""}`}
                  >
                    <option value="">Select room type</option>
                    <option value="DBL">Double Room (DBL)</option>
                    <option value="TPL">Triple Room (TPL)</option>
                    <option value="Quad">Quad Room (Quad)</option>
                  </select>
                  {errors.roomType && (
                    <p className="text-red-500 text-sm mt-1">{errors.roomType}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number of Guests *
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.numberOfGuests}
                    onChange={(e) => handleInputChange('numberOfGuests', parseInt(e.target.value) || 1)}
                    className={errors.numberOfGuests ? "border-red-500" : ""}
                  />
                  {errors.numberOfGuests && (
                    <p className="text-red-500 text-sm mt-1">{errors.numberOfGuests}</p>
                  )}
                </div>
              </div>
            </Card>

            {/* Pricing */}
            <Card className="p-6">
              <div className="flex items-center space-x-2 mb-4">
                <SARCurrency amount="" iconSize={20} className="text-orange-600" showSymbol={true} />
                <h3 className="text-lg font-semibold">Pricing</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number of Nights
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.numberOfNights}
                    onChange={(e) => handleInputChange('numberOfNights', parseInt(e.target.value) || 1)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Room Rate per Night *
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.roomRate}
                    onChange={(e) => handleInputChange('roomRate', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className={errors.roomRate ? "border-red-500" : ""}
                  />
                  {errors.roomRate && (
                    <p className="text-red-500 text-sm mt-1">{errors.roomRate}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total Amount
                  </label>
                  <Input
                    value={formatCurrency(formData.totalAmount, formData.currency)}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>
              </div>
            </Card>

            {/* Invoice Details */}
            <Card className="p-6">
              <div className="flex items-center space-x-2 mb-4">
                <FileText className="h-5 w-5 text-indigo-600" />
                <h3 className="text-lg font-semibold">Invoice Details</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Issue Date *
                  </label>
                  <Input
                    type="date"
                    value={formData.issueDate}
                    onChange={(e) => handleInputChange('issueDate', e.target.value)}
                    className={errors.issueDate ? "border-red-500" : ""}
                  />
                  {errors.issueDate && (
                    <p className="text-red-500 text-sm mt-1">{errors.issueDate}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Due Date *
                  </label>
                  <Input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => handleInputChange('dueDate', e.target.value)}
                    className={errors.dueDate ? "border-red-500" : ""}
                  />
                  {errors.dueDate && (
                    <p className="text-red-500 text-sm mt-1">{errors.dueDate}</p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    placeholder="Additional notes or terms..."
                    rows={3}
                    className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                  />
                </div>
              </div>
            </Card>
          </form>
        </div>

        {/* Preview */}
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Invoice Preview</h3>
            <div className="space-y-4 text-sm">
              <div>
                <span className="text-gray-500">Client:</span>
                <p className="font-semibold">{formData.clientName || "Client Name"}</p>
                <p className="text-gray-600">{formData.clientEmail || "client@email.com"}</p>
              </div>
              
              <div>
                <span className="text-gray-500">Hotel:</span>
                <p className="font-semibold">{formData.hotelName || "Hotel Name"}</p>
                <p className="text-gray-600">{formData.city || "City"}</p>
              </div>
              
              <div>
                <span className="text-gray-500">Stay Period:</span>
                <p className="font-semibold">
                  {formData.checkIn ? formatDate(formData.checkIn) : "Check-in"} - {formData.checkOut ? formatDate(formData.checkOut) : "Check-out"}
                </p>
                <p className="text-gray-600">{formData.numberOfNights} night(s)</p>
              </div>
              
              <div>
                <span className="text-gray-500">Room:</span>
                <p className="font-semibold">{formData.roomType || "Room Type"}</p>
                <p className="text-gray-600">{formData.numberOfGuests} guest(s)</p>
              </div>
              
              <div className="border-t pt-4">
                <div className="flex justify-between">
                  <span>Room Rate:</span>
                  <span>{formatCurrency(formData.roomRate, formData.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Nights:</span>
                  <span>{formData.numberOfNights}</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                  <span>Total:</span>
                  <span className="text-green-600">{formatCurrency(formData.totalAmount, formData.currency)}</span>
                </div>
              </div>
              
              <div>
                <span className="text-gray-500">Due Date:</span>
                <p className="font-semibold">{formData.dueDate ? formatDate(formData.dueDate) : "Due Date"}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </PageLayout>
  )
}