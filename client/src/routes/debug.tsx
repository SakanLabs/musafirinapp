import { createFileRoute } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import { authService } from "@/lib/auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/debug")({
  component: DebugPage,
})

function DebugPage() {
  const [authState, setAuthState] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const checkAuth = async () => {
    setLoading(true)
    setError(null)
    try {
      console.log('Debug: Checking authentication...')
      
      const user = await authService.getCurrentUser()
      const isAuth = await authService.isAuthenticated()
      const isAdmin = await authService.isAdmin()
      
      setAuthState({
        user,
        isAuthenticated: isAuth,
        isAdmin,
        timestamp: new Date().toISOString()
      })
      
      console.log('Debug: Auth state:', { user, isAuth, isAdmin })
    } catch (err) {
      console.error('Debug: Auth check failed:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkAuth()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Authentication Debug Page</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={checkAuth} disabled={loading}>
              {loading ? 'Checking...' : 'Refresh Auth State'}
            </Button>
            
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                <strong>Error:</strong> {error}
              </div>
            )}
            
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Current Auth State:</h3>
              <pre className="text-sm overflow-auto">
                {JSON.stringify(authState, null, 2)}
              </pre>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-semibold">Quick Actions:</h3>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => window.location.href = '/login'}
                >
                  Go to Login
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => window.location.href = '/dashboard/user'}
                >
                  Go to User Dashboard
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => window.location.href = '/test-user-dashboard'}
                >
                  Go to Test Dashboard
                </Button>
              </div>
            </div>
            
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <p><strong>Current URL:</strong> {window.location.href}</p>
              <p><strong>User Agent:</strong> {navigator.userAgent}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}