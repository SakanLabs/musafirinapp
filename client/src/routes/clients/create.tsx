import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Loader2, Save, ArrowLeft } from "lucide-react"
import { authService } from "@/lib/auth"
import { useCreateClient } from "@/lib/queries"

interface ClientFormState {
  name: string
  email: string
  phone: string
  address: string
}

interface CreateClientSearch {
  redirectTo?: string
}

export const Route = createFileRoute("/clients/create")({
  validateSearch: (search: Record<string, unknown>): CreateClientSearch => {
    const redirectTo = typeof search.redirectTo === "string" && search.redirectTo.length > 0
      ? search.redirectTo
      : undefined

    return { redirectTo }
  },
  beforeLoad: async () => {
    const isAuthenticated = await authService.isAuthenticated()

    if (!isAuthenticated) {
      throw redirect({ to: "/login" })
    }
  },
  component: CreateClientPage
})

function CreateClientPage() {
  const navigate = useNavigate()
  const { redirectTo } = Route.useSearch()
  const createClientMutation = useCreateClient()
  const [formData, setFormData] = useState<ClientFormState>({
    name: "",
    email: "",
    phone: "",
    address: ""
  })
  const [errors, setErrors] = useState<Partial<Record<keyof ClientFormState, string>>>({})

  const handleInputChange = (field: keyof ClientFormState, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))

    if (errors[field]) {
      setErrors(prev => {
        const updated = { ...prev }
        delete updated[field]
        return updated
      })
    }
  }

  const validateForm = () => {
    const newErrors: Partial<Record<keyof ClientFormState, string>> = {}

    if (!formData.name.trim()) {
      newErrors.name = "Client name is required"
    }
    if (!formData.email.trim()) {
      newErrors.email = "Client email is required"
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address"
    }
    if (!formData.phone.trim()) {
      newErrors.phone = "Client phone is required"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        ...(formData.address.trim() ? { address: formData.address.trim() } : {})
      }

      await createClientMutation.mutateAsync(payload)

      if (redirectTo === "/create-booking") {
        navigate({ to: "/create-booking" })
        return
      }

      navigate({ to: "/clients" })
    } catch (error) {
      console.error("Failed to create client:", error)
    }
  }

  return (
    <PageLayout
      title="Add New Client"
      subtitle="Create a client record to reuse across bookings"
      actions={
        <Button
          variant="outline"
          onClick={() => {
            if (redirectTo === "/create-booking") {
              navigate({ to: "/create-booking" })
              return
            }

            navigate({ to: "/clients" })
          }}
          className="h-9 px-4 border-[#e5e7eb] hover:bg-gray-50 text-gray-700 font-medium rounded-md flex items-center space-x-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </Button>
      }
    >
      <Card className="max-w-2xl mx-auto p-8 border border-[#e5e7eb] rounded-xl shadow-none bg-white">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="client-name" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Full Name *</Label>
              <Input
                id="client-name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Enter client's full name"
                required
                className="h-10 px-3 border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] focus-visible:ring-[#111111] focus-visible:border-[#111111] focus-visible:ring-offset-0 focus-visible:ring-1 bg-white"
              />
              {errors.name && (
                <p className="text-red-600 text-xs font-medium mt-1">{errors.name}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="client-email" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Email Address *</Label>
              <Input
                id="client-email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                placeholder="Enter email address"
                required
                className="h-10 px-3 border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] focus-visible:ring-[#111111] focus-visible:border-[#111111] focus-visible:ring-offset-0 focus-visible:ring-1 bg-white"
              />
              {errors.email && (
                <p className="text-red-600 text-xs font-medium mt-1">{errors.email}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="client-phone" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Phone Number *</Label>
              <Input
                id="client-phone"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                placeholder="Enter phone number"
                required
                className="h-10 px-3 border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] focus-visible:ring-[#111111] focus-visible:border-[#111111] focus-visible:ring-offset-0 focus-visible:ring-1 bg-white"
              />
              {errors.phone && (
                <p className="text-red-600 text-xs font-medium mt-1">{errors.phone}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="client-address" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Address</Label>
              <Textarea
                id="client-address"
                value={formData.address}
                onChange={(e) => handleInputChange("address", e.target.value)}
                placeholder="Enter client's address (optional)"
                rows={3}
                className="px-3 py-2 border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] focus-visible:ring-[#111111] focus-visible:border-[#111111] focus-visible:ring-offset-0 focus-visible:ring-1 bg-white"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-[#e5e7eb] mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (redirectTo === "/create-booking") {
                  navigate({ to: "/create-booking" })
                  return
                }

                navigate({ to: "/clients" })
              }}
              className="h-10 border-[#e5e7eb] hover:bg-gray-50 text-gray-700 font-semibold rounded-md transition-colors"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createClientMutation.isPending}
              className="h-10 px-6 bg-[#111111] hover:bg-[#242424] text-white font-semibold rounded-md transition-colors border border-transparent shadow-sm flex items-center justify-center min-w-[140px]"
            >
              {createClientMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Create Client
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>
    </PageLayout>
  )
}
