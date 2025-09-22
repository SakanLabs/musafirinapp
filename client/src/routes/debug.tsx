import { createFileRoute, useLocation, useRouter } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { authService } from '@/lib/auth'

export const Route = createFileRoute('/debug')({
  component: DebugPage,
})

function DebugPage() {
  const location = useLocation()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await authService.getCurrentUser()
        const authStatus = await authService.isAuthenticated()
        setUser(currentUser)
        setIsAuthenticated(authStatus)
      } catch (error) {
        console.error('Auth check error:', error)
      } finally {
        setLoading(false)
      }
    }
    checkAuth()
  }, [])

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Debug Information</h1>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Debug Information</h1>
      
      <div className="space-y-6">
        <div className="bg-gray-100 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Current Location</h2>
          <pre className="text-sm overflow-auto">
            {JSON.stringify(location, null, 2)}
          </pre>
        </div>

        <div className="bg-gray-100 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Authentication Status</h2>
          <div className="space-y-2">
            <p><strong>Is Authenticated:</strong> {isAuthenticated ? 'Yes' : 'No'}</p>
            <p><strong>User:</strong></p>
            <pre className="text-sm overflow-auto">
              {JSON.stringify(user, null, 2)}
            </pre>
          </div>
        </div>

        <div className="bg-gray-100 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Router State</h2>
          <pre className="text-sm overflow-auto">
            {JSON.stringify({
              state: router.state,
              history: router.history.location
            }, null, 2)}
          </pre>
        </div>

        <div className="bg-gray-100 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Test Navigation</h2>
          <div className="space-y-2">
            <button 
              onClick={() => router.navigate({ to: '/bookings' })}
              className="bg-blue-500 text-white px-4 py-2 rounded mr-2"
            >
              Navigate to /bookings
            </button>
            <button 
              onClick={() => router.navigate({ to: '/bookings/create' })}
              className="bg-green-500 text-white px-4 py-2 rounded mr-2"
            >
              Navigate to /bookings/create
            </button>
            <button 
              onClick={() => window.location.href = '/bookings/create'}
              className="bg-red-500 text-white px-4 py-2 rounded"
            >
              Direct window.location to /bookings/create
            </button>
          </div>
        </div>

        <div className="bg-gray-100 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Current URL</h2>
          <p><strong>window.location.href:</strong> {window.location.href}</p>
          <p><strong>window.location.pathname:</strong> {window.location.pathname}</p>
        </div>
      </div>
    </div>
  )
}