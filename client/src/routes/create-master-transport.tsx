import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Save, ArrowLeft, Loader2, Navigation } from "lucide-react"
import { useCreateTransportRoute } from "@/lib/queries/master"

export const Route = createFileRoute("/create-master-transport")({
  component: CreateMasterTransportPage
})

function CreateMasterTransportPage() {
  const navigate = useNavigate()
  const createRouteMutation = useCreateTransportRoute()

  const [formData, setFormData] = useState({
    originLocation: "",
    destinationLocation: "",
    supplierName: "",
    picName: "",
    picContact: "",
    isActive: true
  })

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.originLocation || !formData.destinationLocation) {
      toast.error("Please fill in all required fields.")
      return
    }

    try {
      await createRouteMutation.mutateAsync(formData)
      toast.success('Transport route created successfully')
      navigate({ to: "/master-transport" })
    } catch (error) {
      toast.error('Failed to create transport route')
      console.error(error)
    }
  }

  return (
    <PageLayout
      title="Add New Transport Route"
      subtitle="Define a new origin and destination for transportation"
      actions={
        <Button variant="outline" onClick={() => navigate({ to: "/master-transport" })}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Routes
        </Button>
      }
    >
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <Navigation className="h-5 w-5 mr-2 text-blue-500" />
              Route Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="originLocation">Origin Location *</Label>
                <Input
                  id="originLocation"
                  value={formData.originLocation}
                  onChange={(e) => handleInputChange('originLocation', e.target.value)}
                  placeholder="e.g. Makkah Hotel, Jeddah Airport"
                  required
                />
              </div>

              <div>
                <Label htmlFor="destinationLocation">Destination Location *</Label>
                <Input
                  id="destinationLocation"
                  value={formData.destinationLocation}
                  onChange={(e) => handleInputChange('destinationLocation', e.target.value)}
                  placeholder="e.g. Madinah Hotel, Haram"
                  required
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
                    placeholder="e.g. Al-Haramain Transport"
                  />
                </div>

                <div>
                  <Label htmlFor="picName">Person In Charge (PIC) Name</Label>
                  <Input
                    id="picName"
                    value={formData.picName}
                    onChange={(e) => handleInputChange('picName', e.target.value)}
                    placeholder="e.g. Tariq"
                  />
                </div>

                <div>
                  <Label htmlFor="picContact">PIC Contact Number</Label>
                  <Input
                    id="picContact"
                    value={formData.picContact}
                    onChange={(e) => handleInputChange('picContact', e.target.value)}
                    placeholder="e.g. +966 50 111 2222"
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
              <Label htmlFor="isActive" className="font-medium text-gray-700 cursor-pointer">Active for Bookings</Label>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: "/master-transport" })}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createRouteMutation.isPending || !formData.originLocation || !formData.destinationLocation}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {createRouteMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span>Create Route</span>
          </Button>
        </div>
      </form>
    </PageLayout>
  )
}
