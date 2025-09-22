import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { authService } from "@/lib/auth"

export const Route = createFileRoute("/test-booking-access")({
  component: TestBookingAccessPage
})

function TestBookingAccessPage() {
  const navigate = useNavigate()
  const [authStatus, setAuthStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const checkAuth = async () => {
    setLoading(true)
    try {
      console.log("=== TESTING BOOKING ACCESS ===")
      
      // Clear any cache first
      localStorage.removeItem('auth-cache')
      
      // Check isAuthenticated
      const isAuth = await authService.isAuthenticated()
      console.log("isAuthenticated result:", isAuth)
      
      // Get current user
      const user = await authService.getCurrentUser()
      console.log("getCurrentUser result:", user)
      
      // Check if admin
      const isAdmin = await authService.isAdmin()
      console.log("isAdmin result:", isAdmin)
      
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

  const testBookingAccess = async () => {
    try {
      console.log("=== TESTING BOOKING CREATE ACCESS ===")
      
      // Simulate the same check as in bookings/create route
      const isAuthenticated = await authService.isAuthenticated()
      console.log("Booking access check - isAuthenticated:", isAuthenticated)
      
      if (!isAuthenticated) {
        console.log("Not authenticated, would redirect to login")
        alert("Not authenticated - would redirect to login")
        return
      }
      
      console.log("Authentication passed, would navigate to booking create")
      alert("Authentication passed! Navigating to booking create...")
      navigate({ to: "/bookings/create" })
    } catch (error) {
      console.error("Booking access test error:", error)
      alert(`Error: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  useEffect(() => {
    checkAuth()
  }, [])

  return (
    <PageLayout title="Test Booking Access">
      <div className="space-y-6">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Authentication Test</h2>
          
          <div className="space-y-4">
            <Button onClick={checkAuth} className="w-full">
              🔄 Refresh Auth Status
            </Button>
            
            <Button onClick={testBookingAccess} className="w-full" variant="outline">
              🧪 Test Booking Create Access
            </Button>
          </div>
          
          {loading ? (
            <p className="mt-4">Loading...</p>
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <h3 className="font-medium">Current Status:</h3>
                <div className="bg-gray-100 p-3 rounded text-sm">
                  <p><strong>✅ Authenticated:</strong> {authStatus?.isAuthenticated ? "Yes" : "No"}</p>
                  <p><strong>👑 Admin:</strong> {authStatus?.isAdmin ? "Yes" : "No"}</p>
                  <p><strong>👤 User:</strong> {authStatus?.user?.name || "N/A"}</p>
                  <p><strong>📧 Email:</strong> {authStatus?.user?.email || "N/A"}</p>
                  <p><strong>🎭 Role:</strong> {authStatus?.user?.role || "N/A"}</p>
                </div>
              </div>
              
              {authStatus?.error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                  <strong>❌ Error:</strong> {authStatus.error}
                </div>
              )}
            </div>
          )}
        </Card>
        
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Quick Navigation</h2>
          <div className="grid grid-cols-2 gap-2">
            <Button 
              onClick={() => navigate({ to: "/login" })}
              variant="outline"
            >
              🔐 Login
            </Button>
            <Button 
              onClick={() => navigate({ to: "/admin" })}
              variant="outline"
            >
              ⚙️ Admin
            </Button>
            <Button 
              onClick={() => navigate({ to: "/bookings" })}
              variant="outline"
            >
              📋 Bookings List
            </Button>
            <Button 
              onClick={() => window.location.href = "/bookings/create"}
              variant="outline"
            >
              ➕ Direct to Create
            </Button>
          </div>
        </Card>
      </div>
    </PageLayout>
  )
}