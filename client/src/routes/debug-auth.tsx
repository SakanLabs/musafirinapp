import { createFileRoute } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { authService } from "@/lib/auth"

export const Route = createFileRoute("/debug-auth")({
  component: DebugAuthPage
})

function DebugAuthPage() {
  const [authStatus, setAuthStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const checkAuth = async () => {
    setLoading(true)
    try {
      console.log("=== DEBUG AUTH STATUS ===")
      
      // Check isAuthenticated
      const isAuth = await authService.isAuthenticated()
      console.log("isAuthenticated:", isAuth)
      
      // Get current user
      const user = await authService.getCurrentUser()
      console.log("getCurrentUser:", user)
      
      // Check if admin
      const isAdmin = await authService.isAdmin()
      console.log("isAdmin:", isAdmin)
      
      setAuthStatus({
        isAuthenticated: isAuth,
        user: user,
        isAdmin: isAdmin
      })
    } catch (error) {
      console.error("Auth check error:", error)
      setAuthStatus({ error: error instanceof Error ? error.message : String(error) })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkAuth()
  }, [])

  return (
    <PageLayout title="Debug Authentication">
      <div className="space-y-6">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Authentication Status</h2>
          
          <Button onClick={checkAuth} className="mb-4">
            Refresh Auth Status
          </Button>
          
          {loading ? (
            <p>Loading...</p>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">Authentication Status:</h3>
                <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
                  {JSON.stringify(authStatus, null, 2)}
                </pre>
              </div>
              
              <div className="space-y-2">
                <p><strong>Is Authenticated:</strong> {authStatus?.isAuthenticated ? "✅ Yes" : "❌ No"}</p>
                <p><strong>Is Admin:</strong> {authStatus?.isAdmin ? "✅ Yes" : "❌ No"}</p>
                <p><strong>User Name:</strong> {authStatus?.user?.name || "N/A"}</p>
                <p><strong>User Role:</strong> {authStatus?.user?.role || "N/A"}</p>
                <p><strong>User Email:</strong> {authStatus?.user?.email || "N/A"}</p>
              </div>
              
              {authStatus?.error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                  <strong>Error:</strong> {authStatus.error}
                </div>
              )}
            </div>
          )}
        </Card>
        
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Test Navigation</h2>
          <div className="space-y-2">
            <Button 
              onClick={() => window.location.href = '/bookings/create'}
              className="w-full"
            >
              Try Navigate to /bookings/create
            </Button>
            <Button 
              onClick={() => window.location.href = '/admin'}
              className="w-full"
              variant="outline"
            >
              Try Navigate to /admin
            </Button>
            <Button 
              onClick={() => window.location.href = '/login'}
              className="w-full"
              variant="outline"
            >
              Go to Login
            </Button>
          </div>
        </Card>
      </div>
    </PageLayout>
  )
}