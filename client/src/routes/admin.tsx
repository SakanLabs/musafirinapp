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
    
    const isAdmin = await authService.isAdmin()
    if (!isAdmin) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: AdminPage,
})

interface User {
  id: string
  name: string
  email: string
  role: 'user' | 'admin'
  createdAt: string
}

function AdminPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '' })
  const [createError, setCreateError] = useState<string | null>(null)
  const [createLoading, setCreateLoading] = useState(false)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await admin.listUsers({
        query: {
          limit: 100,
          offset: 0
        }
      })
      
      
      if (response.data?.users) {
        const mappedUsers: User[] = (response.data.users as Record<string, unknown>[]).map((user) => ({
          id: String(user.id),
          name: String(user.name || user.email || 'Unknown'),
          email: String(user.email || ''),
          role: (user.role === 'admin' ? 'admin' : 'user') as 'user' | 'admin',
          createdAt: String(user.createdAt || new Date().toISOString())
        }))
        setUsers(mappedUsers)
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
        body: JSON.stringify(createForm)
      })

      const data = await response.json()

      if (!response.ok) {
        setCreateError(data.message || 'Failed to create user')
        return
      }

      setShowCreateModal(false)
      setCreateForm({ name: '', email: '', password: '' })
      await loadUsers()
    } catch (err) {
      console.error('Error creating user:', err)
      setCreateError('Failed to create user. Please try again.')
    } finally {
      setCreateLoading(false)
    }
  }

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      await admin.setRole({
        userId,
        role: newRole as 'user' | 'admin'
      })
      await loadUsers()
    } catch (err) {
      console.error('Error updating user role:', err)
      setError('Failed to update user role')
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
      title="User Management"
      subtitle="Manage users and their roles"
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
                  <td colSpan={4} className="px-6 py-12 text-center">
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
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.role === 'admin' 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <select
                      value={user.role}
                      onChange={(e) => updateUserRole(user.id, e.target.value)}
                      className="border border-gray-300 rounded-md px-2 py-1 text-sm mr-2"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
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
            <h3 className="text-lg font-semibold mb-4">Create New User</h3>
            
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

              <div className="mb-6">
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

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateModal(false)
                    setCreateError(null)
                    setCreateForm({ name: '', email: '', password: '' })
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
