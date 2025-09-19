import { createFileRoute } from "@tanstack/react-router"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  User, 
  Activity, 
  TrendingUp, 
  Calendar, 
  Bell, 
  Settings, 
  LogOut,
  BarChart3,
  Clock,
  Target,
  Award
} from "lucide-react"
import { authService } from "@/lib/auth"
import { useState, useEffect } from "react"

export const Route = createFileRoute("/dashboard-test")({
  component: DashboardTest,
  // No beforeLoad function - testing component rendering
})

function DashboardTest() {
  const [authState, setAuthState] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('DashboardTest: Checking authentication...')
        
        const user = await authService.getCurrentUser()
        const isAuth = await authService.isAuthenticated()
        const isAdmin = await authService.isAdmin()
        
        setAuthState({
          user,
          isAuthenticated: isAuth,
          isAdmin,
          timestamp: new Date().toISOString()
        })
        
        console.log('DashboardTest: Auth state:', { user, isAuth, isAdmin })
      } catch (err) {
        console.error('DashboardTest: Auth check failed:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">Loading authentication state...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard Test</h1>
              <Badge variant="user" className="text-xs">
                Test Mode
              </Badge>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="icon">
                <Bell className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Auth State Display */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Authentication State</CardTitle>
            <CardDescription>Current authentication status and user information</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                <strong>Error:</strong> {error}
              </div>
            )}
            
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
              <pre className="text-sm overflow-auto">
                {JSON.stringify(authState, null, 2)}
              </pre>
            </div>
            
            <div className="mt-4 space-x-2">
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
                Try User Dashboard
              </Button>
              <Button 
                variant="outline" 
                onClick={() => window.location.reload()}
              >
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Welcome Section */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold mb-2">Dashboard Test Page</h2>
                <p className="text-blue-100">This page bypasses authentication to test component rendering.</p>
              </div>
              <div className="hidden md:block">
                <div className="bg-white/20 rounded-lg p-4">
                  <User className="h-12 w-12 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Auth Status</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {authState?.isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
                  </p>
                </div>
                <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full">
                  <Target className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">User Role</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {authState?.user?.role || 'None'}
                  </p>
                </div>
                <div className="bg-green-100 dark:bg-green-900 p-3 rounded-full">
                  <Award className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Admin Status</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {authState?.isAdmin ? 'Yes' : 'No'}
                  </p>
                </div>
                <div className="bg-purple-100 dark:bg-purple-900 p-3 rounded-full">
                  <BarChart3 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Page Status</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">Working</p>
                </div>
                <div className="bg-orange-100 dark:bg-orange-900 p-3 rounded-full">
                  <TrendingUp className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}