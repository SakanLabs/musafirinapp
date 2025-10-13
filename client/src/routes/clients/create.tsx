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
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      }
    >
      <Card className="max-w-3xl mx-auto p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="client-name">Full Name *</Label>
              <Input
                id="client-name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Enter client's full name"
                required
              />
              {errors.name && (
                <p className="text-red-500 text-sm mt-1">{errors.name}</p>
              )}
            </div>

            <div>
              <Label htmlFor="client-email">Email Address *</Label>
              <Input
                id="client-email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                placeholder="Enter email address"
                required
              />
              {errors.email && (
                <p className="text-red-500 text-sm mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <Label htmlFor="client-phone">Phone Number *</Label>
              <Input
                id="client-phone"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                placeholder="Enter phone number"
                required
              />
              {errors.phone && (
                <p className="text-red-500 text-sm mt-1">{errors.phone}</p>
              )}
            </div>

            <div>
              <Label htmlFor="client-address">Address</Label>
              <Textarea
                id="client-address"
                value={formData.address}
                onChange={(e) => handleInputChange("address", e.target.value)}
                placeholder="Enter client's address (optional)"
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-2">
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
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createClientMutation.isPending}
              className="min-w-[140px]"
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
