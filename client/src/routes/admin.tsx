import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { PageLayout } from '@/components/layout/PageLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { authService } from '@/lib/auth'
import { admin } from '@/lib/auth-client'
import { Plus, RefreshCw, Users as UsersIcon } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    const isAuthenticated = await authService.isAuthenticated()
    if (!isAuthenticated) {
      throw redirect({ to: '/login' })
    }
    
    const isOwner = await authService.isOwner()
    if (!isOwner) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: AdminPage,
})

interface User {
  id: string
  name: string
  email: string
  role: 'user' | 'admin' | 'owner' | 'finance'
  userType: 'direct' | 'agent'
  createdAt: string
}

function AdminPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    accountCategory: 'staff' as 'customer' | 'staff',
    userType: 'direct' as 'direct' | 'agent',
    role: 'admin' as 'user' | 'admin' | 'owner' | 'finance'
  })
  const [createError, setCreateError] = useState<string | null>(null)
  const [createLoading, setCreateLoading] = useState(false)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`${API_URL}/api/users`, {
        credentials: 'include'
      })
      
      const data = await response.json()
      
      if (data.success) {
        const mappedUsers: User[] = data.data.map((u: any) => ({
          id: String(u.id),
          name: String(u.name || u.email || 'Unknown'),
          email: String(u.email || ''),
          role: (u.role && ['admin', 'owner', 'finance'].includes(u.role) ? u.role : 'user') as 'user' | 'admin' | 'owner' | 'finance',
          userType: (u.userType === 'agent' ? 'agent' : 'direct') as 'direct' | 'agent',
          createdAt: String(u.createdAt || new Date().toISOString())
        }))
        setUsers(mappedUsers)
      } else {
        setError(data.message || 'Failed to load users')
      }
    } catch (err) {
      console.error('Error loading users:', err)
      setError('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateLoading(true)
    setCreateError(null)

    try {
      const response = await fetch(`${API_URL}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          name: createForm.name,
          email: createForm.email,
          password: createForm.password,
          userType: createForm.accountCategory === 'customer' ? createForm.userType : 'direct',
          role: createForm.accountCategory === 'staff' ? createForm.role : 'user'
        })
      })

      const data = await response.json()

      if (!response.ok) {
        setCreateError(data.message || 'Failed to create user')
        return
      }

      setShowCreateModal(false)
      setCreateForm({ name: '', email: '', password: '', accountCategory: 'staff', userType: 'direct', role: 'admin' })
      await loadUsers()
    } catch (err) {
      console.error('Error creating user:', err)
      setCreateError('Failed to create user. Please try again.')
    } finally {
      setCreateLoading(false)
    }
  }

  const updateUser = async (userId: string, data: { role?: string; userType?: string }) => {
    try {
      const response = await fetch(`${API_URL}/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const errorData = await response.json()
        setError(errorData.message || 'Failed to update user')
        return
      }

      await loadUsers()
    } catch (err) {
      console.error('Error updating user:', err)
      setError('Failed to update user')
    }
  }

  const removeUser = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this user? This will delete from both Better Auth and Supabase.')) return
    
    try {
      setError(null)
      const response = await fetch(`${API_URL}/api/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || 'Failed to remove user')
        return
      }

      await loadUsers()
    } catch (err) {
      console.error('Error removing user:', err)
      setError('Failed to remove user')
    }
  }

  const actions = (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowCreateModal(true)}
        className="flex items-center gap-2"
      >
        <Plus className="h-4 w-4" />
        Add User
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={loadUsers}
        disabled={loading}
        className="flex items-center gap-2"
      >
        <RefreshCw className="h-4 w-4" />
        Refresh
      </Button>
    </div>
  )

  return (
    <PageLayout
      title="Staff Management"
      subtitle="Manage staff accounts and their roles"
      actions={actions}
    >
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <p className="text-gray-500">Loading users...</p>
                    </div>
                  </td>
                </tr>
              ) : users.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <UsersIcon className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={user.userType}
                      onChange={(e) => updateUser(user.id, { userType: e.target.value })}
                      className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                    >
                      <option value="direct">Direct</option>
                      <option value="agent">Agent</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={user.role}
                      onChange={(e) => updateUser(user.id, { role: e.target.value })}
                      className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                      <option value="finance">Finance</option>
                      <option value="owner">Owner</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeUser(user.id)}
                      className="text-red-600 hover:text-red-900 hover:bg-red-50"
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && users.length === 0 && (
            <div className="text-center py-12">
              <UsersIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No users found</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateModal(true)}
                className="mt-4"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create First User
              </Button>
            </div>
          )}
        </div>
      </Card>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Create New Account</h3>
            
            {createError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateUser}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <Input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <Input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="john@example.com"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <Input
                  type="password"
                  required
                  minLength={6}
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder="Minimum 6 characters"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Category</label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      className="mr-2"
                      checked={createForm.accountCategory === 'customer'}
                      onChange={() => setCreateForm({ ...createForm, accountCategory: 'customer' })}
                    />
                    Customer
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      className="mr-2"
                      checked={createForm.accountCategory === 'staff'}
                      onChange={() => setCreateForm({ ...createForm, accountCategory: 'staff' })}
                    />
                    Staff
                  </label>
                </div>
              </div>

              {createForm.accountCategory === 'customer' ? (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pricing Tiers/User Type</label>
                  <select
                    value={createForm.userType}
                    onChange={(e) => setCreateForm({ ...createForm, userType: e.target.value as 'direct' | 'agent' })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="direct">Direct - Harga regular untuk customer</option>
                    <option value="agent">Agent - Harga khusus untuk agen/reseller</option>
                  </select>
                </div>
              ) : (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Staff Role</label>
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as any })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="admin">Admin - (Booking, Master Data, Invoices, Vouchers)</option>
                    <option value="finance">Finance - (Invoices, Receipts, Clients, Analytics)</option>
                    <option value="owner">Owner - (Full Access & User Management)</option>
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateModal(false)
                    setCreateError(null)
                    setCreateForm({ name: '', email: '', password: '', accountCategory: 'staff', userType: 'direct', role: 'admin' })
                  }}
                  disabled={createLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createLoading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {createLoading ? 'Creating...' : 'Create User'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </PageLayout>
  )
}
