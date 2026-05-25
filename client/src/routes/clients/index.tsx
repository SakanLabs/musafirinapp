import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import { PageLayout } from "@/components/layout/PageLayout"
import { DataTable, type Column } from "@/components/ui/data-table"
import { Drawer } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Modal } from "@/components/ui/modal"
import {
  Plus,
  Eye,
  Edit,
  Trash2,
  Users,
  Loader2,
  Mail,
  Phone,
  MapPin,
  Wallet,
  AlertTriangle
} from "lucide-react"
import { formatDate } from "@/lib/utils"
import {
  useClients,
  useUpdateClient,
  useDeleteClient,
  type Client,
  type UpdateClientData
} from "@/lib/queries"

export const Route = createFileRoute("/clients/")({
  component: ClientsIndexPage
})

function ClientsIndexPage() {
  const navigate = useNavigate()
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: ""
  })
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false)
  const [errorModalContent, setErrorModalContent] = useState({
    title: '',
    message: '',
    type: 'error' as 'error' | 'warning'
  })

  const { data: clients = [], isLoading, error } = useClients()
  const updateClientMutation = useUpdateClient()
  const deleteClientMutation = useDeleteClient()

  const clientColumns: Column<Client>[] = [
    {
      key: 'id',
      header: 'ID',
      sortable: true,
      width: 'w-16'
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (client) => (
        <div className="flex items-center space-x-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate({ to: "/client-detail/$clientId", params: { clientId: client.id.toString() } })}
            title="View Client Details"
            className="h-8 px-2.5 border-[#e5e7eb] text-xs font-medium hover:bg-gray-50 text-[#111111] flex items-center space-x-1 rounded-md"
          >
            <Eye className="h-3.5 w-3.5 text-gray-500" />
            <span>Details</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleEditClient(client)}
            title="Edit Client"
            className="h-8 w-8 p-0 text-gray-500 hover:text-[#111111] hover:bg-gray-50 rounded-md"
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDeleteClient(client.id)}
            title="Delete Client"
            className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
      width: 'w-44'
    },
    {
      key: 'name',
      header: 'Name',
      sortable: true
    },
    {
      key: 'email',
      header: 'Email',
      render: (client) => (
        <div className="flex items-center space-x-2">
          <Mail className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-gray-700">{client.email}</span>
        </div>
      ),
      sortable: true
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (client) => (
        <div className="flex items-center space-x-2">
          <Phone className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-gray-700">{client.phone}</span>
        </div>
      ),
      sortable: true
    },
    {
      key: 'address',
      header: 'Address',
      render: (client) => client.address ? (
        <div className="flex items-center space-x-2">
          <MapPin className="h-3.5 w-3.5 text-gray-400" />
          <span className="truncate max-w-xs text-gray-600">{client.address}</span>
        </div>
      ) : (
        <span className="text-gray-400 font-mono text-xs">-</span>
      ),
      sortable: true
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (client) => <span className="text-gray-600 text-xs font-mono">{formatDate(client.createdAt)}</span>,
      sortable: true,
      width: 'w-32'
    }
  ]

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleEditClient = (client: Client) => {
    setEditingClient(client)
    setFormData({
      name: client.name,
      email: client.email,
      phone: client.phone,
      address: client.address || ""
    })
    setIsEditDrawerOpen(true)
  }

  const handleUpdateClient = async () => {
    if (!editingClient) return

    try {
      const clientData: UpdateClientData = {
        id: editingClient.id,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        address: formData.address || undefined
      }

      await updateClientMutation.mutateAsync(clientData)

      setFormData({
        name: "",
        email: "",
        phone: "",
        address: ""
      })
      setEditingClient(null)
      setIsEditDrawerOpen(false)
    } catch (error) {
      console.error('Failed to update client:', error)
    }
  }

  const handleDeleteClient = async (clientId: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus klien ini? Tindakan ini tidak dapat dibatalkan.')) {
      return
    }

    try {
      await deleteClientMutation.mutateAsync(clientId)
      toast.success('Klien berhasil dihapus!')
    } catch (error: any) {
      console.error('🔥 Failed to delete client:', error)
      console.log('🔥 Error type:', typeof error)
      console.log('🔥 Error constructor:', error?.constructor?.name)
      console.log('🔥 Error message:', error?.message)
      console.log('🔥 Error stack:', error?.stack)
      console.log('🔥 Full error object:', JSON.stringify(error, null, 2))

      const errorMessage = error?.message || 'Failed to delete client. Please try again.'
      console.log('🔥 Final error message to display:', errorMessage)

      // Show the actual server error message directly
      setErrorModalContent({
        title: 'Error',
        message: errorMessage,
        type: 'error'
      })

      setIsErrorModalOpen(true)
    }
  }

  if (error) {
    return (
      <PageLayout title="Clients">
        <div className="text-center py-8">
          <p className="text-red-600">Error loading clients: {error.message}</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="Client Management"
      subtitle="Manage your client database"
      actions={
        <Button
          onClick={() => navigate({ to: "/clients/create" })}
          className="flex items-center space-x-2 bg-[#111111] hover:bg-[#242424] text-white h-9 px-4 rounded-md font-medium text-sm transition-colors border border-transparent shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span>Add Client</span>
        </Button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card className="border border-[#e5e7eb] rounded-xl shadow-none bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-[#111111]">{clients.length}</div>
          </CardContent>
        </Card>

        <Card className="border border-[#e5e7eb] rounded-xl shadow-none bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-500">Active Clients</CardTitle>
            <Users className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-[#111111]">{clients.length}</div>
            <p className="text-xs text-gray-400 mt-1">All registered clients are active</p>
          </CardContent>
        </Card>

        <Card className="border border-[#e5e7eb] rounded-xl shadow-none bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-500">With Deposits</CardTitle>
            <Wallet className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-[#111111]">-</div>
            <p className="text-xs text-gray-400 mt-1">Unavailable in list view</p>
          </CardContent>
        </Card>
      </div>

      <div className="overflow-hidden border border-[#e5e7eb] rounded-xl bg-white shadow-none">
        <DataTable
          data={clients}
          columns={clientColumns}
          loading={isLoading}
          emptyMessage="No clients found"
          noCard={true}
        />
      </div>

      <Drawer
        isOpen={isEditDrawerOpen}
        onClose={() => setIsEditDrawerOpen(false)}
        title="Edit Client"
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Full Name *</Label>
            <Input
              id="edit-name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Enter client's full name"
              required
              className="h-10 px-3 border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] focus-visible:ring-[#111111] focus-visible:border-[#111111] focus-visible:ring-offset-0 focus-visible:ring-1 bg-white"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-email" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Email Address *</Label>
            <Input
              id="edit-email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="Enter email address"
              required
              className="h-10 px-3 border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] focus-visible:ring-[#111111] focus-visible:border-[#111111] focus-visible:ring-offset-0 focus-visible:ring-1 bg-white"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-phone" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Phone Number *</Label>
            <Input
              id="edit-phone"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              placeholder="Enter phone number"
              required
              className="h-10 px-3 border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] focus-visible:ring-[#111111] focus-visible:border-[#111111] focus-visible:ring-offset-0 focus-visible:ring-1 bg-white"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-address" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Address</Label>
            <Textarea
              id="edit-address"
              value={formData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              placeholder="Enter client's address (optional)"
              rows={3}
              className="px-3 py-2 border-[#e5e7eb] rounded-md focus:border-[#111111] focus:ring-1 focus:ring-[#111111] focus-visible:ring-[#111111] focus-visible:border-[#111111] focus-visible:ring-offset-0 focus-visible:ring-1 bg-white"
            />
          </div>

          <div className="flex space-x-2 pt-4">
            <Button
              onClick={handleUpdateClient}
              disabled={updateClientMutation.isPending || !formData.name || !formData.email || !formData.phone}
              className="flex-1 h-10 font-semibold bg-[#111111] hover:bg-[#242424] text-white rounded-md transition-colors border border-transparent shadow-sm"
            >
              {updateClientMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Client'
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsEditDrawerOpen(false)}
              className="flex-1 h-10 border-[#e5e7eb] hover:bg-gray-50 text-gray-700 font-semibold rounded-md"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Drawer>

      {/* Error Modal */}
      <Modal
        isOpen={isErrorModalOpen}
        onClose={() => setIsErrorModalOpen(false)}
        title={errorModalContent.title}
        size="md"
        footer={
          <Button
            onClick={() => setIsErrorModalOpen(false)}
            className="h-10 px-5 bg-[#111111] hover:bg-[#242424] text-white font-semibold rounded-md transition-colors border border-transparent"
          >
            OK
          </Button>
        }
      >
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <AlertTriangle
              className={`h-6 w-6 ${errorModalContent.type === 'warning'
                ? 'text-amber-500'
                : 'text-red-500'
                }`}
            />
          </div>
          <div className="flex-1">
            <p className="text-gray-700 leading-relaxed">
              {errorModalContent.message}
            </p>
            {errorModalContent.type === 'warning' && (
              <div className="mt-3 p-3 bg-amber-50/40 border border-amber-200/60 rounded-md">
                <p className="text-sm text-amber-800">
                  <strong>Tips:</strong> Anda dapat melihat booking klien dengan mengklik tombol "View" untuk melihat booking mana yang perlu diselesaikan atau dibatalkan.
                </p>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </PageLayout>
  )
}

