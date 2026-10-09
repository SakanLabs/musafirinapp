import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/ui/modal"
import { Loader2 } from "lucide-react"
import { Booking } from "@/lib/queries/bookings"

interface UpdateBookingStatusModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: {
    paymentStatus?: Booking['paymentStatus']
    bookingStatus?: Booking['bookingStatus']
    hotelConfirmationNo?: string
    source?: string
  }) => void
  isLoading: boolean
  booking: Booking
}

export function UpdateBookingStatusModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  booking
}: UpdateBookingStatusModalProps) {
  const [paymentStatus, setPaymentStatus] = useState<Booking['paymentStatus']>(booking.paymentStatus)
  const [bookingStatus, setBookingStatus] = useState<Booking['bookingStatus']>(booking.bookingStatus)
  const [hotelConfirmationNo, setHotelConfirmationNo] = useState(booking.hotelConfirmationNo || '')
  const [source, setSource] = useState(booking.source || '')
  const [showHcnField, setShowHcnField] = useState(false)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setPaymentStatus(booking.paymentStatus)
      setBookingStatus(booking.bookingStatus)
      setHotelConfirmationNo(booking.hotelConfirmationNo || '')
      setSource(booking.source || '')
      setShowHcnField(booking.bookingStatus === 'confirmed')
    }
  }, [isOpen, booking])

  // Show HCN field when booking status is confirmed
  useEffect(() => {
    setShowHcnField(bookingStatus === 'confirmed')
  }, [bookingStatus])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const updateData: {
      paymentStatus?: Booking['paymentStatus']
      bookingStatus?: Booking['bookingStatus']
      hotelConfirmationNo?: string
      source?: string
    } = {}

    // Only include changed fields
    if (paymentStatus !== booking.paymentStatus) {
      updateData.paymentStatus = paymentStatus
    }
    if (bookingStatus !== booking.bookingStatus) {
      updateData.bookingStatus = bookingStatus
    }
    if (showHcnField && hotelConfirmationNo !== booking.hotelConfirmationNo) {
      updateData.hotelConfirmationNo = hotelConfirmationNo
    }
    if (source !== (booking.source || '')) {
      updateData.source = source
    }

    onSubmit(updateData)
  }

  const hasChanges = 
    paymentStatus !== booking.paymentStatus ||
    bookingStatus !== booking.bookingStatus ||
    (showHcnField && hotelConfirmationNo !== booking.hotelConfirmationNo) ||
    source !== (booking.source || '')

  const footer = (
    <>
      <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
        Cancel
      </Button>
      <Button 
        type="submit" 
        disabled={isLoading || !hasChanges}
        onClick={handleSubmit}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Updating...
          </>
        ) : (
          'Update Status'
        )}
      </Button>
    </>
  )

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      title="Update Booking Status"
      footer={footer}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="paymentStatus" className="block text-sm font-medium text-gray-700">
            Payment Status
          </label>
          <select
            id="paymentStatus"
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value as Booking['paymentStatus'])}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="bookingStatus" className="block text-sm font-medium text-gray-700">
            Booking Status
          </label>
          <select
            id="bookingStatus"
            value={bookingStatus}
            onChange={(e) => setBookingStatus(e.target.value as Booking['bookingStatus'])}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {showHcnField && (
          <div className="space-y-2">
            <label htmlFor="hotelConfirmationNo" className="block text-sm font-medium text-gray-700">
              Hotel Confirmation Number
            </label>
            <Input
              id="hotelConfirmationNo"
              value={hotelConfirmationNo}
              onChange={(e) => setHotelConfirmationNo(e.target.value)}
              placeholder="Enter hotel confirmation number"
              maxLength={100}
            />
            <p className="text-sm text-gray-500">
              Required for confirmed bookings to generate vouchers
            </p>
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="bookingSource" className="block text-sm font-medium text-gray-700">
            Sumber Pemesanan Hotel (Source)
          </label>
          <Input
            id="bookingSource"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Contoh: Agoda, Expedia, Direct Hotel, Vendor Lokal..."
            maxLength={255}
          />
          <p className="text-xs text-gray-500">
            Catatan asal/vendor pemesanan hotel (free text)
          </p>
        </div>
      </form>
    </Modal>
  )
}