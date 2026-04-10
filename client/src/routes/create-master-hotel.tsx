import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Save, ArrowLeft, Loader2 } from "lucide-react"
import { useCreateHotel } from "@/lib/queries/master"

export const Route = createFileRoute("/create-master-hotel")({
  component: CreateMasterHotelPage
})

function CreateMasterHotelPage() {
  const navigate = useNavigate()
  const createHotelMutation = useCreateHotel()

  const [formData, setFormData] = useState({
    name: "",
    city: "Makkah" as "Makkah" | "Madinah",
    address: "",
    starRating: 3,
    contactPerson: "",
    contactPhone: "",
    supplierName: "",
    picName: "",
    picContact: "",
    isActive: true
  })

  const handleInputChange = (field: string, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name) {
      toast.error("Hotel name is required")
      return
    }

    try {
      await createHotelMutation.mutateAsync(formData)
      toast.success("Hotel created successfully")
      navigate({ to: "/master-hotels" })
    } catch (error) {
      toast.error("Failed to create hotel")
      console.error(error)
    }
  }

  return (
    <PageLayout
      title="Add New Master Hotel"
      subtitle="Create a new hotel record in the master database"
      actions={
        <Button variant="outline" onClick={() => navigate({ to: "/master-hotels" })}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Hotels
        </Button>
      }
    >
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-6">
        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <Label htmlFor="hotelName">Hotel Name *</Label>
                <Input
                  id="hotelName"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="e.g. Dar Al Tawhid"
                  required
                />
              </div>

              <div>
                <Label htmlFor="city">City *</Label>
                <select
                  id="city"
                  value={formData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="Makkah">Makkah</option>
                  <option value="Madinah">Madinah</option>
                </select>
              </div>

              <div>
                <Label htmlFor="starRating">Star Rating</Label>
                <Input
                  id="starRating"
                  type="number"
                  min="0"
                  max="5"
                  value={formData.starRating}
                  onChange={(e) => handleInputChange('starRating', parseInt(e.target.value) || 0)}
                  placeholder="0-5 stars"
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  placeholder="Full street address..."
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="contactPerson">Contact Person</Label>
                <Input
                  id="contactPerson"
                  value={formData.contactPerson}
                  onChange={(e) => handleInputChange('contactPerson', e.target.value)}
                  placeholder="Manager / Reception name"
                />
              </div>

              <div>
                <Label htmlFor="contactPhone">Contact Phone</Label>
                <Input
                  id="contactPhone"
                  value={formData.contactPhone}
                  onChange={(e) => handleInputChange('contactPhone', e.target.value)}
                  placeholder="e.g. +966 50 123 4567"
                />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-gray-100 mt-4">
              <h3 className="font-semibold text-gray-800">Supplier & PIC Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <Label htmlFor="supplierName">Supplier Name</Label>
                  <Input
                    id="supplierName"
                    value={formData.supplierName}
                    onChange={(e) => handleInputChange('supplierName', e.target.value)}
                    placeholder="e.g. Global Hotels LLC"
                  />
                </div>

                <div>
                  <Label htmlFor="picName">Person In Charge (PIC) Name</Label>
                  <Input
                    id="picName"
                    value={formData.picName}
                    onChange={(e) => handleInputChange('picName', e.target.value)}
                    placeholder="e.g. Ahmed"
                  />
                </div>

                <div>
                  <Label htmlFor="picContact">PIC Contact Number</Label>
                  <Input
                    id="picContact"
                    value={formData.picContact}
                    onChange={(e) => handleInputChange('picContact', e.target.value)}
                    placeholder="e.g. +966 55 987 6543"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-4 border-t border-gray-100 mt-4">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => handleInputChange('isActive', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <Label htmlFor="isActive" className="font-medium text-gray-700 cursor-pointer">Active in System</Label>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: "/master-hotels" })}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createHotelMutation.isPending || !formData.name}
            className="flex items-center space-x-2"
          >
            {createHotelMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span>Save Hotel</span>
          </Button>
        </div>
      </form>
    </PageLayout>
  )
}
