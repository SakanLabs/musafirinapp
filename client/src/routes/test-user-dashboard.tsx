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

export const Route = createFileRoute("/test-user-dashboard")({
  component: TestUserDashboard,
})

// Mock user data
const userData = {
  name: "John Doe",
  email: "john.doe@example.com",
  role: "user",
  joinDate: "January 2024",
  lastLogin: "2 hours ago",
  stats: {
    totalTasks: 24,
    completedTasks: 18,
    activeProjects: 3,
    achievements: 7
  },
  recentActivity: [
    { id: 1, action: "Completed task 'Review documentation'", time: "2 hours ago" },
    { id: 2, action: "Started project 'Website Redesign'", time: "1 day ago" },
    { id: 3, action: "Earned achievement 'Task Master'", time: "3 days ago" },
    { id: 4, action: "Updated profile information", time: "1 week ago" }
  ],
  upcomingTasks: [
    { id: 1, title: "Team meeting", due: "Today, 2:00 PM", priority: "high" },
    { id: 2, title: "Submit report", due: "Tomorrow, 5:00 PM", priority: "medium" },
    { id: 3, title: "Code review", due: "Friday, 10:00 AM", priority: "low" }
  ]
}

function TestUserDashboard() {
  const completionRate = Math.round((userData.stats.completedTasks / userData.stats.totalTasks) * 100)

  const handleLogout = () => {
    console.log('Logout clicked')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Test Dashboard</h1>
              <Badge variant="user" className="text-xs">
                User
              </Badge>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="icon">
                <Bell className="h-5 w-5" />
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
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold mb-2">Welcome back, {userData.name}!</h2>
                <p className="text-blue-100">Here's what's happening with your account today.</p>
              </div>
              <div className="hidden md:block">
                <div className="bg-white/20 rounded-lg p-4">
                  <User className="h-12 w-12 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Tasks</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{userData.stats.totalTasks}</p>
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
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Completed</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{userData.stats.completedTasks}</p>
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
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Projects</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{userData.stats.activeProjects}</p>
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
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Completion Rate</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{completionRate}%</p>
                </div>
                <div className="bg-orange-100 dark:bg-orange-900 p-3 rounded-full">
                  <TrendingUp className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-center py-8">
          <p className="text-lg text-gray-600 dark:text-gray-400">Dashboard is rendering correctly! 🎉</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">This test route bypasses authentication to verify component rendering.</p>
        </div>
      </div>
    </div>
  )
}