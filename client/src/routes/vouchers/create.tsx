import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Save,
  ArrowLeft,
  Eye,
  Download,
  Ticket,
  Calendar,
  MapPin,
  Users,
  DollarSign,
  Loader2
} from "lucide-react"
import { useState } from "react"
import { authService } from "@/lib/auth"
import { formatCurrency, formatDate } from "@/lib/utils"
// Define CreateVoucherData type
interface CreateVoucherData {
  voucherNumber: string
  guestName: string
  guestEmail: string
  bookingCode: string
  packageName: string
  destination: string
  checkInDate: string
  checkOutDate: string
  totalAmount: string
  currency: string
  issueDate: string
  validUntil: string
  status: string
  notes: string
}

export const Route = createFileRoute("/vouchers/create")({
  beforeLoad: async () => {
    const isAuthenticated = await authService.isAuthenticated()
    if (!isAuthenticated) {
      throw redirect({ to: "/login" })
    }
  },
  component: CreateVoucherPage
})

function CreateVoucherPage() {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  
  const [formData, setFormData] = useState<CreateVoucherData>({
    voucherNumber: `VCH-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
    guestName: "",
    guestEmail: "",
    bookingCode: "",
    packageName: "",
    destination: "",
    checkInDate: "",
    checkOutDate: "",
    totalAmount: "",
    currency: "IDR",
    issueDate: new Date().toISOString().split('T')[0],
    validUntil: "",
    status: "active",
    notes: ""
  })

  const handleInputChange = (field: keyof CreateVoucherData, value: string) => {
    setFormData((prev: CreateVoucherData) => ({
      ...prev,
      [field]: value
    }))
    
    // Clear error when user starts typing
    if (errors[field as keyof typeof errors]) {
      setErrors(prev => ({
        ...prev,
        [field]: ""
      }))
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.guestName.trim()) {
      newErrors.guestName = "Guest name is required"
    }
    
    if (!formData.guestEmail.trim()) {
      newErrors.guestEmail = "Guest email is required"
    } else if (!/\S+@\S+\.\S+/.test(formData.guestEmail)) {
      newErrors.guestEmail = "Please enter a valid email address"
    }
    
    if (!formData.bookingCode.trim()) {
      newErrors.bookingCode = "Booking code is required"
    }
    
    if (!formData.packageName.trim()) {
      newErrors.packageName = "Package name is required"
    }
    
    if (!formData.destination.trim()) {
      newErrors.destination = "Destination is required"
    }
    
    if (!formData.checkInDate) {
      newErrors.checkInDate = "Check-in date is required"
    }
    
    if (!formData.checkOutDate) {
      newErrors.checkOutDate = "Check-out date is required"
    }
    
    if (!formData.totalAmount.trim()) {
      newErrors.totalAmount = "Total amount is required"
    } else if (isNaN(Number(formData.totalAmount)) || Number(formData.totalAmount) <= 0) {
      newErrors.totalAmount = "Please enter a valid amount"
    }
    
    if (!formData.validUntil) {
      newErrors.validUntil = "Valid until date is required"
    }
    
    // Validate dates
    if (formData.checkInDate && formData.checkOutDate) {
      if (new Date(formData.checkInDate) >= new Date(formData.checkOutDate)) {
        newErrors.checkOutDate = "Check-out date must be after check-in date"
      }
    }
    
    if (formData.validUntil) {
      if (new Date(formData.validUntil) <= new Date()) {
        newErrors.validUntil = "Valid until date must be in the future"
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
      // Here you would typically call your API to create the voucher
      console.log("Creating voucher:", formData)
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Navigate back to vouchers list
      navigate({ to: "/vouchers" })
    } catch (error) {
      console.error("Error creating voucher:", error)
      // Handle error (show toast, etc.)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePreview = () => {
    if (validateForm()) {
      setShowPreview(true)
    }
  }

  const calculateDays = () => {
    if (formData.checkInDate && formData.checkOutDate) {
      const checkIn = new Date(formData.checkInDate)
      const checkOut = new Date(formData.checkOutDate)
      const diffTime = Math.abs(checkOut.getTime() - checkIn.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      return diffDays
    }
    return 0
  }

  if (showPreview) {
    return (
      <PageLayout
        title="Voucher Preview"
        subtitle="Review voucher before creating"
        actions={
          <div className="flex space-x-3">
            <Button 
              variant="outline" 
              onClick={() => setShowPreview(false)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Edit
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
                  Create Voucher
                </>
              )}
            </Button>
          </div>
        }
      >
        {/* Voucher Preview */}
        <div className="max-w-4xl mx-auto">
          <Card className="p-8 bg-gradient-to-br from-blue-50 to-indigo-100 border-2 border-blue-200">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center mb-4">
                <div className="bg-blue-600 p-3 rounded-full">
                  <Ticket className="h-8 w-8 text-white" />
                </div>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Travel Voucher</h1>
              <p className="text-lg text-gray-600">{formData.voucherNumber}</p>
              <Badge className="mt-2 bg-green-100 text-green-800 border-green-200">
                {formData.status.toUpperCase()}
              </Badge>
            </div>

            {/* Guest Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Users className="h-5 w-5 mr-2 text-blue-600" />
                  Guest Information
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Name</p>
                    <p className="font-medium text-gray-900">{formData.guestName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-medium text-gray-900">{formData.guestEmail}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Booking Code</p>
                    <p className="font-medium text-gray-900">{formData.bookingCode}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <MapPin className="h-5 w-5 mr-2 text-blue-600" />
                  Trip Details
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Package</p>
                    <p className="font-medium text-gray-900">{formData.packageName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Destination</p>
                    <p className="font-medium text-gray-900">{formData.destination}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Duration</p>
                    <p className="font-medium text-gray-900">{calculateDays()} days</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Travel Dates */}
            <div className="bg-white rounded-lg p-6 shadow-sm mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Calendar className="h-5 w-5 mr-2 text-blue-600" />
                Travel Dates
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-600">Check-in Date</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {formatDate(formData.checkInDate)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Check-out Date</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {formatDate(formData.checkOutDate)}
                  </p>
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="bg-white rounded-lg p-6 shadow-sm mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <DollarSign className="h-5 w-5 mr-2 text-blue-600" />
                Pricing
              </h3>
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">Total Amount</p>
                <p className="text-4xl font-bold text-blue-600">
                  {formatCurrency(formData.totalAmount, formData.currency)}
                </p>
              </div>
            </div>

            {/* Validity */}
            <div className="bg-white rounded-lg p-6 shadow-sm mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Validity</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-600">Issue Date</p>
                  <p className="font-medium text-gray-900">{formatDate(formData.issueDate)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Valid Until</p>
                  <p className="font-medium text-gray-900">{formatDate(formData.validUntil)}</p>
                </div>
              </div>
            </div>

            {/* Notes */}
            {formData.notes && (
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Notes</h3>
                <p className="text-gray-700">{formData.notes}</p>
              </div>
            )}

            {/* Footer */}
            <div className="text-center mt-8 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                This voucher is valid for the specified travel dates and must be presented during check-in.
              </p>
            </div>
          </Card>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="Create Voucher"
      subtitle="Generate a new travel voucher"
      actions={
        <div className="flex space-x-3">
          <Button 
            variant="outline" 
            onClick={() => navigate({ to: "/vouchers" })}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button 
            variant="outline" 
            onClick={handlePreview}
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview
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
                Create Voucher
              </>
            )}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-8">
        {/* Basic Information */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Voucher Number
              </label>
              <Input
                value={formData.voucherNumber}
                onChange={(e) => handleInputChange('voucherNumber', e.target.value)}
                placeholder="VCH-2024-001"
                disabled
                className="bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Issue Date
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
          </div>
        </Card>

        {/* Guest Information */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Guest Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Guest Name *
              </label>
              <Input
                value={formData.guestName}
                onChange={(e) => handleInputChange('guestName', e.target.value)}
                placeholder="Enter guest name"
                className={errors.guestName ? "border-red-500" : ""}
              />
              {errors.guestName && (
                <p className="text-red-500 text-sm mt-1">{errors.guestName}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Guest Email *
              </label>
              <Input
                type="email"
                value={formData.guestEmail}
                onChange={(e) => handleInputChange('guestEmail', e.target.value)}
                placeholder="guest@example.com"
                className={errors.guestEmail ? "border-red-500" : ""}
              />
              {errors.guestEmail && (
                <p className="text-red-500 text-sm mt-1">{errors.guestEmail}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Booking Code *
              </label>
              <Input
                value={formData.bookingCode}
                onChange={(e) => handleInputChange('bookingCode', e.target.value)}
                placeholder="BK001"
                className={errors.bookingCode ? "border-red-500" : ""}
              />
              {errors.bookingCode && (
                <p className="text-red-500 text-sm mt-1">{errors.bookingCode}</p>
              )}
            </div>
          </div>
        </Card>

        {/* Trip Details */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Trip Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Package Name *
              </label>
              <Input
                value={formData.packageName}
                onChange={(e) => handleInputChange('packageName', e.target.value)}
                placeholder="Bali Adventure Package"
                className={errors.packageName ? "border-red-500" : ""}
              />
              {errors.packageName && (
                <p className="text-red-500 text-sm mt-1">{errors.packageName}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Destination *
              </label>
              <Input
                value={formData.destination}
                onChange={(e) => handleInputChange('destination', e.target.value)}
                placeholder="Bali, Indonesia"
                className={errors.destination ? "border-red-500" : ""}
              />
              {errors.destination && (
                <p className="text-red-500 text-sm mt-1">{errors.destination}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Check-in Date *
              </label>
              <Input
                type="date"
                value={formData.checkInDate}
                onChange={(e) => handleInputChange('checkInDate', e.target.value)}
                className={errors.checkInDate ? "border-red-500" : ""}
              />
              {errors.checkInDate && (
                <p className="text-red-500 text-sm mt-1">{errors.checkInDate}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Check-out Date *
              </label>
              <Input
                type="date"
                value={formData.checkOutDate}
                onChange={(e) => handleInputChange('checkOutDate', e.target.value)}
                className={errors.checkOutDate ? "border-red-500" : ""}
              />
              {errors.checkOutDate && (
                <p className="text-red-500 text-sm mt-1">{errors.checkOutDate}</p>
              )}
            </div>
          </div>
        </Card>

        {/* Pricing & Validity */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Pricing & Validity</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Total Amount *
              </label>
              <Input
                type="number"
                value={formData.totalAmount}
                onChange={(e) => handleInputChange('totalAmount', e.target.value)}
                placeholder="2500000"
                className={errors.totalAmount ? "border-red-500" : ""}
              />
              {errors.totalAmount && (
                <p className="text-red-500 text-sm mt-1">{errors.totalAmount}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Currency
              </label>
              <select
                value={formData.currency}
                onChange={(e) => handleInputChange('currency', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="IDR">IDR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Valid Until *
              </label>
              <Input
                type="date"
                value={formData.validUntil}
                onChange={(e) => handleInputChange('validUntil', e.target.value)}
                className={errors.validUntil ? "border-red-500" : ""}
              />
              {errors.validUntil && (
                <p className="text-red-500 text-sm mt-1">{errors.validUntil}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="active">Active</option>
                <option value="used">Used</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Notes */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Additional Notes</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Any additional notes or special instructions..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </Card>
      </form>
    </PageLayout>
  )
}