import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { authService } from '../lib/auth'
import { 
  useHotelCostTemplates, 
  useCreateHotelCostTemplate, 
  useUpdateHotelCostTemplate, 
  useDeleteHotelCostTemplate,
  useOperationalCosts,
  useCreateOperationalCost,
  useDeleteOperationalCost
} from '../lib/queries/analytics'
import type { HotelCostTemplate, NewHotelCostTemplate, OperationalCost, NewOperationalCost } from 'shared/src/types'

export const Route = createFileRoute('/costs')({
  beforeLoad: async () => {
    const isAuthenticated = await authService.isAuthenticated()
    if (!isAuthenticated) {
      throw redirect({ to: '/login' })
    }
    
    const isAdmin = await authService.isAdmin()
    if (!isAdmin) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: CostManagementPage,
})

function CostManagementPage() {
  const [activeTab, setActiveTab] = useState<'templates' | 'operational'>('templates')
  const [showTemplateForm, setShowTemplateForm] = useState(false)
  const [showOperationalForm, setShowOperationalForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<HotelCostTemplate | null>(null)

  // Hotel Templates
  const { data: templates, isLoading: templatesLoading } = useHotelCostTemplates()
  const createTemplateMutation = useCreateHotelCostTemplate()
  const updateTemplateMutation = useUpdateHotelCostTemplate()
  const deleteTemplateMutation = useDeleteHotelCostTemplate()

  // Operational Costs
  const { data: operationalCosts, isLoading: operationalLoading } = useOperationalCosts()
  const createOperationalMutation = useCreateOperationalCost()
  const deleteOperationalMutation = useDeleteOperationalCost()

  const handleCreateTemplate = async (data: NewHotelCostTemplate) => {
    try {
      await createTemplateMutation.mutateAsync(data)
      setShowTemplateForm(false)
    } catch (error) {
      console.error('Error creating template:', error)
    }
  }

  const handleUpdateTemplate = async (data: Partial<HotelCostTemplate>) => {
    if (!editingTemplate) return
    try {
      await updateTemplateMutation.mutateAsync({ id: editingTemplate.id.toString(), data })
      setEditingTemplate(null)
    } catch (error) {
      console.error('Error updating template:', error)
    }
  }

  const handleDeleteTemplate = async (id: number) => {
    if (confirm('Are you sure you want to delete this template?')) {
      try {
        await deleteTemplateMutation.mutateAsync(id.toString())
      } catch (error) {
        console.error('Error deleting template:', error)
      }
    }
  }

  const handleCreateOperational = async (data: NewOperationalCost) => {
    try {
      await createOperationalMutation.mutateAsync(data)
      setShowOperationalForm(false)
    } catch (error) {
      console.error('Error creating operational cost:', error)
    }
  }

  const handleDeleteOperational = async (id: number) => {
    if (confirm('Are you sure you want to delete this operational cost?')) {
      try {
        await deleteOperationalMutation.mutateAsync(id.toString())
      } catch (error) {
        console.error('Error deleting operational cost:', error)
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">Cost Management</h1>
            <p className="mt-1 text-sm text-gray-600">Manage hotel cost templates and operational costs</p>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('templates')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'templates'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Hotel Cost Templates
              </button>
              <button
                onClick={() => setActiveTab('operational')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'operational'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Operational Costs
              </button>
            </nav>
          </div>

          {/* Hotel Templates Tab */}
          {activeTab === 'templates' && (
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-medium text-gray-900">Hotel Cost Templates</h2>
                <button
                  onClick={() => setShowTemplateForm(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Add Template
                </button>
              </div>

              {templatesLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading templates...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Hotel
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          City
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Room Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Cost Price (SAR)
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {templates?.map((template) => (
                        <tr key={template.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {template.hotelName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {template.city}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {template.roomType}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {parseFloat(template.costPrice).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                              Active
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                            <button
                              onClick={() => setEditingTemplate(template)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteTemplate(template.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {templates?.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No templates found</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Operational Costs Tab */}
          {activeTab === 'operational' && (
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-medium text-gray-900">Operational Costs</h2>
                <button
                  onClick={() => setShowOperationalForm(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Add Cost
                </button>
              </div>

              {operationalLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading operational costs...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Booking ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Cost Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Description
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Amount (SAR)
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {operationalCosts?.map((cost) => (
                        <tr key={cost.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            #{cost.bookingId}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {cost.costType}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                            {cost.description || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {parseFloat(cost.amount).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(cost.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => handleDeleteOperational(cost.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {operationalCosts?.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No operational costs found</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Template Form Modal */}
      {(showTemplateForm || editingTemplate) && (
        <TemplateFormModal
          template={editingTemplate}
          onSubmit={editingTemplate ? handleUpdateTemplate : handleCreateTemplate}
          onClose={() => {
            setShowTemplateForm(false)
            setEditingTemplate(null)
          }}
          isLoading={createTemplateMutation.isPending || updateTemplateMutation.isPending}
        />
      )}

      {/* Operational Cost Form Modal */}
      {showOperationalForm && (
        <OperationalCostFormModal
          onSubmit={handleCreateOperational}
          onClose={() => setShowOperationalForm(false)}
          isLoading={createOperationalMutation.isPending}
        />
      )}
    </div>
  )
}

// Template Form Modal Component
function TemplateFormModal({
  template,
  onSubmit,
  onClose,
  isLoading
}: {
  template?: HotelCostTemplate | null
  onSubmit: (data: any) => void
  onClose: () => void
  isLoading: boolean
}) {
  const [formData, setFormData] = useState({
    hotelName: template?.hotelName || '',
    city: template?.city || ('Makkah' as 'Makkah' | 'Madinah'),
    roomType: template?.roomType || 'Standard',
    costPrice: template?.costPrice || ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      ...formData,
      costPrice: parseFloat(formData.costPrice) || 0
    })
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {template ? 'Edit Template' : 'Add New Template'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Hotel Name</label>
              <input
                type="text"
                value={formData.hotelName}
                onChange={(e) => setFormData({ ...formData, hotelName: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">City</label>
              <select
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value as 'Makkah' | 'Madinah' })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="Makkah">Makkah</option>
                <option value="Madinah">Madinah</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Room Type</label>
              <select
                value={formData.roomType}
                onChange={(e) => setFormData({ ...formData, roomType: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="Standard">Standard</option>
                <option value="Deluxe">Deluxe</option>
                <option value="Suite">Suite</option>
                <option value="Family">Family</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Cost Price</label>
              <input
                type="number"
                value={formData.costPrice}
                onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                required
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? 'Saving...' : template ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// Operational Cost Form Modal Component
function OperationalCostFormModal({
  onSubmit,
  onClose,
  isLoading
}: {
  onSubmit: (data: NewOperationalCost) => void
  onClose: () => void
  isLoading: boolean
}) {
  const [formData, setFormData] = useState({
    bookingId: '',
    costType: '',
    amount: '',
    description: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      bookingId: parseInt(formData.bookingId),
      costType: formData.costType,
      amount: parseFloat(formData.amount),
      description: formData.description || undefined
    })
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Add Operational Cost</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Booking ID</label>
              <input
                type="number"
                value={formData.bookingId}
                onChange={(e) => setFormData({ ...formData, bookingId: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Cost Type</label>
              <select
                value={formData.costType}
                onChange={(e) => setFormData({ ...formData, costType: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                required
              >
                <option value="">Select cost type</option>
                <option value="transportation">Transportation</option>
                <option value="visa">Visa</option>
                <option value="admin">Admin</option>
                <option value="marketing">Marketing</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Amount (SAR)</label>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                rows={3}
              />
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}