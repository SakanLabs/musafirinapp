import { createFileRoute, redirect } from "@tanstack/react-router"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Shield, 
  Users, 
  Settings, 
  Database, 
  TrendingUp, 
  AlertTriangle, 
  Server, 
  Bell, 
  LogOut,
  BarChart3,
  UserPlus,
  Lock,
  Globe,
  HardDrive,
  Cpu,
  Zap,
  Eye,
  Edit,
  Trash2
} from "lucide-react"
import { authService } from "@/lib/auth"

export const Route = createFileRoute("/dashboard/admin")({ 
  component: AdminDashboard,
  beforeLoad: async () => {
    if (!(await authService.isAuthenticated())) {
      throw redirect({ to: '/login' })
    }
    if (!(await authService.isAdmin())) {
      throw redirect({ to: '/dashboard/user' })
    }
  }
})

// Mock admin data
const adminData = {
  name: "Admin User",
  email: "admin@example.com",
  role: "admin",
  lastLogin: "30 minutes ago",
  systemStats: {
    totalUsers: 1247,
    activeUsers: 892,
    totalProjects: 156,
    systemUptime: "99.9%",
    serverLoad: "23%",
    storageUsed: "67%",
    memoryUsage: "45%",
    networkTraffic: "2.3 GB"
  },
  recentUsers: [
    { id: 1, name: "John Doe", email: "john@example.com", status: "active", joinDate: "2024-01-15" },
    { id: 2, name: "Jane Smith", email: "jane@example.com", status: "inactive", joinDate: "2024-01-14" },
    { id: 3, name: "Bob Johnson", email: "bob@example.com", status: "active", joinDate: "2024-01-13" },
    { id: 4, name: "Alice Brown", email: "alice@example.com", status: "pending", joinDate: "2024-01-12" }
  ],
  systemAlerts: [
    { id: 1, type: "warning", message: "High memory usage detected on Server 2", time: "5 minutes ago" },
    { id: 2, type: "info", message: "Scheduled maintenance completed successfully", time: "2 hours ago" },
    { id: 3, type: "error", message: "Failed login attempts from IP 192.168.1.100", time: "1 day ago" }
  ],
  quickStats: [
    { label: "New Users Today", value: "23", change: "+12%", trend: "up" },
    { label: "Active Sessions", value: "156", change: "+5%", trend: "up" },
    { label: "System Errors", value: "3", change: "-25%", trend: "down" },
    { label: "Revenue", value: "$12,450", change: "+8%", trend: "up" }
  ]
}

function AdminDashboard() {
  const handleLogout = () => {
    authService.logout()
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-purple-200 dark:border-purple-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Shield className="h-8 w-8 text-purple-600" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
              <Badge variant="admin" className="text-xs">
                Administrator
              </Badge>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full"></span>
              </Button>
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold mb-2">Welcome back, {adminData.name}!</h2>
                <p className="text-purple-100">System overview and administrative controls at your fingertips.</p>
              </div>
              <div className="hidden md:block">
                <div className="bg-white/20 rounded-lg p-4">
                  <Shield className="h-12 w-12 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {adminData.quickStats.map((stat, index) => (
            <Card key={index} className="bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.label}</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                    <div className="flex items-center mt-1">
                      <span className={`text-sm font-medium ${
                        stat.trend === 'up' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {stat.change}
                      </span>
                      <TrendingUp className={`h-4 w-4 ml-1 ${
                        stat.trend === 'up' ? 'text-green-600' : 'text-red-600 rotate-180'
                      }`} />
                    </div>
                  </div>
                  <div className="bg-purple-100 dark:bg-purple-900 p-3 rounded-full">
                    <BarChart3 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* System Health */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white dark:bg-gray-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Server Load</p>
                  <p className="text-2xl font-bold text-green-600">{adminData.systemStats.serverLoad}</p>
                </div>
                <Cpu className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Memory Usage</p>
                  <p className="text-2xl font-bold text-yellow-600">{adminData.systemStats.memoryUsage}</p>
                </div>
                <Zap className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Storage Used</p>
                  <p className="text-2xl font-bold text-orange-600">{adminData.systemStats.storageUsed}</p>
                </div>
                <HardDrive className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Uptime</p>
                  <p className="text-2xl font-bold text-green-600">{adminData.systemStats.systemUptime}</p>
                </div>
                <Server className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* User Management */}
          <div className="lg:col-span-2">
            <Card className="bg-white dark:bg-gray-800">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <Users className="h-5 w-5" />
                      <span>User Management</span>
                    </CardTitle>
                    <CardDescription>
                      Recent user registrations and activity
                    </CardDescription>
                  </div>
                  <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {adminData.recentUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
                      <div className="flex items-center space-x-3">
                        <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded-full">
                          <Users className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {user.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {user.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Badge 
                          variant={user.status === 'active' ? 'success' : user.status === 'inactive' ? 'secondary' : 'warning'}
                          className="text-xs"
                        >
                          {user.status}
                        </Badge>
                        <div className="flex space-x-1">
                          <Button size="sm" variant="ghost">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* System Alerts */}
          <div>
            <Card className="bg-white dark:bg-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5" />
                  <span>System Alerts</span>
                </CardTitle>
                <CardDescription>
                  Recent system notifications
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {adminData.systemAlerts.map((alert) => (
                    <div key={alert.id} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="flex items-start space-x-3">
                        <div className={`p-1 rounded-full ${
                          alert.type === 'error' ? 'bg-red-100 dark:bg-red-900' :
                          alert.type === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900' :
                          'bg-blue-100 dark:bg-blue-900'
                        }`}>
                          <AlertTriangle className={`h-4 w-4 ${
                            alert.type === 'error' ? 'text-red-600 dark:text-red-400' :
                            alert.type === 'warning' ? 'text-yellow-600 dark:text-yellow-400' :
                            'text-blue-600 dark:text-blue-400'
                          }`} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {alert.message}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {alert.time}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Admin Tools */}
        <div className="mt-8">
          <Card className="bg-white dark:bg-gray-800">
            <CardHeader>
              <CardTitle>Administrative Tools</CardTitle>
              <CardDescription>
                System management and configuration options
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <Button className="h-20 flex-col space-y-2 bg-purple-600 hover:bg-purple-700" variant="default">
                  <Users className="h-6 w-6" />
                  <span className="text-sm">Users</span>
                </Button>
                <Button className="h-20 flex-col space-y-2" variant="outline">
                  <Database className="h-6 w-6" />
                  <span className="text-sm">Database</span>
                </Button>
                <Button className="h-20 flex-col space-y-2" variant="outline">
                  <Server className="h-6 w-6" />
                  <span className="text-sm">Servers</span>
                </Button>
                <Button className="h-20 flex-col space-y-2" variant="outline">
                  <Lock className="h-6 w-6" />
                  <span className="text-sm">Security</span>
                </Button>
                <Button className="h-20 flex-col space-y-2" variant="outline">
                  <Globe className="h-6 w-6" />
                  <span className="text-sm">Network</span>
                </Button>
                <Button className="h-20 flex-col space-y-2" variant="outline">
                  <Settings className="h-6 w-6" />
                  <span className="text-sm">Settings</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}