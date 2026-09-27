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
  Ticket,
  Calendar,
  MapPin,
  Users,
  Loader2
} from "lucide-react"
import { SARCurrency } from "@/components/ui/sar-currency"
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
        subtitle="Review detail voucher hotel dan reservasi sebelum diterbitkan"
        actions={
          <div className="flex items-center space-x-2.5">
            <Button 
              variant="outline" 
              onClick={() => setShowPreview(false)}
              className="h-9 px-4 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 hover:text-black flex items-center rounded-md font-semibold text-xs bg-white shadow-none"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Edit
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isLoading}
              className="bg-[#111111] hover:bg-[#242424] text-white h-9 px-4 rounded-md text-xs font-semibold transition-colors border border-transparent shadow-none"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin text-white" />
                  Menerbitkan...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2 text-white" />
                  Create Voucher
                </>
              )}
            </Button>
          </div>
        }
      >
        {/* Voucher Boarding-Pass Preview */}
        <div className="max-w-2xl mx-auto">
          <div className="bg-[#111111] border border-zinc-800 rounded-2xl shadow-xl p-8 text-white relative overflow-hidden">
            {/* Ambient Background Circles */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-zinc-800/10 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-zinc-800/10 rounded-full blur-2xl -ml-16 -mb-16 pointer-events-none" />

            {/* Top Brand Header */}
            <div className="flex justify-between items-start border-b border-zinc-800/80 pb-6 mb-6">
              <div className="flex items-center space-x-3">
                <Ticket className="h-5 w-5 text-zinc-400" />
                <div>
                  <h1 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">Musafirin Travel</h1>
                  <h2 className="text-lg font-extrabold tracking-tight text-white mt-0.5">Hotel Reservation Voucher</h2>
                </div>
              </div>
              <div className="text-right">
                <span className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Voucher Status</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 uppercase">
                  {formData.status}
                </span>
              </div>
            </div>

            {/* Voucher Number Tagline */}
            <div className="flex justify-between items-center bg-zinc-900 border border-zinc-800/60 rounded-xl px-4 py-3 mb-6">
              <div>
                <span className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Voucher Number</span>
                <span className="text-sm font-mono font-bold text-white mt-0.5">{formData.voucherNumber}</span>
              </div>
              <div className="text-right">
                <span className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Booking Reference</span>
                <span className="text-sm font-mono font-bold text-white mt-0.5">{formData.bookingCode}</span>
              </div>
            </div>

            {/* Guest & Trip Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-zinc-900 border border-zinc-800/60 rounded-xl p-4">
                <span className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Guest Specifications</span>
                <div className="space-y-2">
                  <div>
                    <span className="block text-[8px] font-bold text-zinc-500 uppercase tracking-wider">Guest Name</span>
                    <p className="text-xs font-bold text-white">{formData.guestName}</p>
                  </div>
                  <div>
                    <span className="block text-[8px] font-bold text-zinc-500 uppercase tracking-wider">Email Address</span>
                    <p className="text-xs font-semibold text-zinc-300">{formData.guestEmail}</p>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800/60 rounded-xl p-4">
                <span className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Package Details</span>
                <div className="space-y-2">
                  <div>
                    <span className="block text-[8px] font-bold text-zinc-500 uppercase tracking-wider">Package Name</span>
                    <p className="text-xs font-bold text-white">{formData.packageName}</p>
                  </div>
                  <div>
                    <span className="block text-[8px] font-bold text-zinc-500 uppercase tracking-wider">Destination</span>
                    <p className="text-xs font-bold text-white">{formData.destination}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Travel Dates Block */}
            <div className="bg-zinc-900 border border-zinc-800/60 rounded-xl p-4 mb-6">
              <span className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-3">Travel Accommodation Schedule</span>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-[8px] font-bold text-zinc-500 uppercase tracking-wider">Check-In Date</span>
                  <p className="text-sm font-bold text-white mt-0.5">{formatDate(formData.checkInDate)}</p>
                </div>
                <div>
                  <span className="block text-[8px] font-bold text-zinc-500 uppercase tracking-wider">Check-Out Date</span>
                  <p className="text-sm font-bold text-white mt-0.5">{formatDate(formData.checkOutDate)}</p>
                </div>
              </div>
              <div className="border-t border-zinc-800/80 pt-3 mt-3 flex justify-between items-center">
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Duration of Stay</span>
                <span className="text-xs font-extrabold text-white bg-zinc-850 px-2.5 py-0.5 rounded border border-zinc-700/50">{calculateDays()} Nights</span>
              </div>
            </div>

            {/* Dashed Separator Tear-off Coupon */}
            <div className="relative my-6 -mx-8">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-8 bg-[#ffffff] rounded-r-full border-r border-[#e5e7eb]" />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-8 bg-[#ffffff] rounded-l-full border-l border-[#e5e7eb]" />
              <div className="border-t border-dashed border-zinc-700/80 w-full" />
            </div>

            {/* Coupon Section (Validity & Price) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-3 bg-zinc-900 border border-zinc-800/60 rounded-xl p-4">
                <span className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Validity Specifications</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="block text-[8px] font-bold text-zinc-500 uppercase tracking-wider">Issue Date</span>
                    <p className="text-[11px] font-bold text-white mt-0.5">{formatDate(formData.issueDate)}</p>
                  </div>
                  <div>
                    <span className="block text-[8px] font-bold text-zinc-500 uppercase tracking-wider">Valid Until</span>
                    <p className="text-[11px] font-bold text-white mt-0.5">{formatDate(formData.validUntil)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800/60 rounded-xl p-4 flex flex-col justify-center items-center text-center">
                <span className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Total Valuation</span>
                <p className="text-2xl font-extrabold text-white tracking-tight">
                  {formatCurrency(formData.totalAmount, formData.currency)}
                </p>
                <span className="block text-[8px] font-semibold text-zinc-400 uppercase tracking-wider mt-0.5">Semua Layanan Sudah Termasuk</span>
              </div>
            </div>

            {/* Notes */}
            {formData.notes && (
              <div className="bg-zinc-900 border border-zinc-800/60 rounded-xl p-4 mt-4">
                <span className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Special Instructions / Notes</span>
                <p className="text-xs font-semibold text-zinc-300 leading-relaxed">{formData.notes}</p>
              </div>
            )}

            {/* Footer Rules */}
            <div className="text-center mt-6 pt-4 border-t border-zinc-800">
              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
                Voucher ini sah dan wajib ditunjukkan kepada resepsionis hotel saat check-in.
              </p>
            </div>
          </div>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="Create Voucher"
      subtitle="Terbitkan voucher baru untuk reservasi hotel dan perjalanan"
      actions={
        <div className="flex items-center space-x-2.5">
          <Button 
            variant="outline" 
            onClick={() => navigate({ to: "/vouchers" })}
            className="h-9 px-4 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 hover:text-black flex items-center rounded-md font-semibold text-xs bg-white shadow-none"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button 
            variant="outline" 
            onClick={handlePreview}
            className="h-9 px-4 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 hover:text-black flex items-center rounded-md font-semibold text-xs bg-white shadow-none"
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading}
            className="bg-[#111111] hover:bg-[#242424] text-white h-9 px-4 rounded-md text-xs font-semibold transition-colors border border-transparent shadow-none"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin text-white" />
                Menerbitkan...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2 text-white" />
                Create Voucher
              </>
            )}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="max-w-xl mx-auto space-y-6">
        {/* Basic Information */}
        <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none p-6">
          <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-zinc-100">
            <Ticket className="h-5 w-5 text-zinc-500" />
            <div>
              <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider">Basic Information</h3>
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mt-0.5">Nomor voucher dan tanggal terbit</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Voucher Number
              </label>
              <Input
                value={formData.voucherNumber}
                onChange={(e) => handleInputChange('voucherNumber', e.target.value)}
                placeholder="VCH-2026-001"
                disabled
                className="h-10 border-[#e5e7eb] rounded-lg bg-zinc-50/80 text-sm font-medium text-zinc-400 shadow-none w-full cursor-not-allowed border-dashed"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Issue Date *
              </label>
              <Input
                type="date"
                value={formData.issueDate}
                onChange={(e) => handleInputChange('issueDate', e.target.value)}
                className={`h-10 border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none w-full ${errors.issueDate ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500" : ""}`}
              />
              {errors.issueDate && (
                <p className="text-rose-500 text-xs font-semibold mt-1">{errors.issueDate}</p>
              )}
            </div>
          </div>
        </div>

        {/* Guest Information */}
        <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none p-6">
          <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-zinc-100">
            <Users className="h-5 w-5 text-zinc-500" />
            <div>
              <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider">Guest Information</h3>
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mt-0.5">Identitas tamu dan kode booking reservasi</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Guest Name *
              </label>
              <Input
                value={formData.guestName}
                onChange={(e) => handleInputChange('guestName', e.target.value)}
                placeholder="Nama Lengkap Jamaah Utama"
                className={`h-10 border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none w-full ${errors.guestName ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500" : ""}`}
              />
              {errors.guestName && (
                <p className="text-rose-500 text-xs font-semibold mt-1">{errors.guestName}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Guest Email *
              </label>
              <Input
                type="email"
                value={formData.guestEmail}
                onChange={(e) => handleInputChange('guestEmail', e.target.value)}
                placeholder="guest@example.com"
                className={`h-10 border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none w-full ${errors.guestEmail ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500" : ""}`}
              />
              {errors.guestEmail && (
                <p className="text-rose-500 text-xs font-semibold mt-1">{errors.guestEmail}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Booking Code *
              </label>
              <Input
                value={formData.bookingCode}
                onChange={(e) => handleInputChange('bookingCode', e.target.value)}
                placeholder="Contoh: BK-123"
                className={`h-10 border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none w-full ${errors.bookingCode ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500" : ""}`}
              />
              {errors.bookingCode && (
                <p className="text-rose-500 text-xs font-semibold mt-1">{errors.bookingCode}</p>
              )}
            </div>
          </div>
        </div>

        {/* Trip Details */}
        <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none p-6">
          <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-zinc-100">
            <MapPin className="h-5 w-5 text-zinc-500" />
            <div>
              <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider">Trip Details</h3>
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mt-0.5">Destinasi hotel dan durasi akomodasi</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Package Name *
              </label>
              <Input
                value={formData.packageName}
                onChange={(e) => handleInputChange('packageName', e.target.value)}
                placeholder="Nama Paket Layanan"
                className={`h-10 border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none w-full ${errors.packageName ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500" : ""}`}
              />
              {errors.packageName && (
                <p className="text-rose-500 text-xs font-semibold mt-1">{errors.packageName}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Destination *
              </label>
              <Input
                value={formData.destination}
                onChange={(e) => handleInputChange('destination', e.target.value)}
                placeholder="Contoh: Makkah / Madinah"
                className={`h-10 border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none w-full ${errors.destination ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500" : ""}`}
              />
              {errors.destination && (
                <p className="text-rose-500 text-xs font-semibold mt-1">{errors.destination}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Check-in Date *
              </label>
              <Input
                type="date"
                value={formData.checkInDate}
                onChange={(e) => handleInputChange('checkInDate', e.target.value)}
                className={`h-10 border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none w-full ${errors.checkInDate ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500" : ""}`}
              />
              {errors.checkInDate && (
                <p className="text-rose-500 text-xs font-semibold mt-1">{errors.checkInDate}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Check-out Date *
              </label>
              <Input
                type="date"
                value={formData.checkOutDate}
                onChange={(e) => handleInputChange('checkOutDate', e.target.value)}
                className={`h-10 border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none w-full ${errors.checkOutDate ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500" : ""}`}
              />
              {errors.checkOutDate && (
                <p className="text-rose-500 text-xs font-semibold mt-1">{errors.checkOutDate}</p>
              )}
            </div>
          </div>
        </div>

        {/* Pricing & Validity */}
        <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none p-6">
          <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-zinc-100">
            <Calendar className="h-5 w-5 text-zinc-500" />
            <div>
              <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider">Pricing & Validity</h3>
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mt-0.5">Nilai akomodasi dan validitas voucher</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Total Amount *
              </label>
              <Input
                type="number"
                value={formData.totalAmount}
                onChange={(e) => handleInputChange('totalAmount', e.target.value)}
                placeholder="Masukkan nominal harga..."
                className={`h-10 border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none w-full ${errors.totalAmount ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500" : ""}`}
              />
              {errors.totalAmount && (
                <p className="text-rose-500 text-xs font-semibold mt-1">{errors.totalAmount}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Currency
              </label>
              <select
                value={formData.currency}
                onChange={(e) => handleInputChange('currency', e.target.value)}
                className="h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:outline-none focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none w-full"
              >
                <option value="IDR">IDR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="SAR">SAR</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Valid Until *
              </label>
              <Input
                type="date"
                value={formData.validUntil}
                onChange={(e) => handleInputChange('validUntil', e.target.value)}
                className={`h-10 border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none w-full ${errors.validUntil ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500" : ""}`}
              />
              {errors.validUntil && (
                <p className="text-rose-500 text-xs font-semibold mt-1">{errors.validUntil}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                className="h-10 px-3 border border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:outline-none focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none w-full"
              >
                <option value="active">Active</option>
                <option value="used">Used</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none p-6">
          <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-zinc-100">
            <Ticket className="h-5 w-5 text-zinc-500" />
            <div>
              <h3 className="text-sm font-bold text-[#111111] uppercase tracking-wider">Additional Notes</h3>
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mt-0.5">Catatan tambahan atau instruksi khusus</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Masukkan instruksi khusus atau catatan tambahan untuk hotel/jamaah..."
              rows={4}
              className="w-full px-3 py-2 border border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:outline-none focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none w-full resize-none min-h-[100px]"
            />
          </div>
        </div>
      </form>
    </PageLayout>
  )
}