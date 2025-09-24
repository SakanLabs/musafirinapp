import { createFileRoute, redirect } from "@tanstack/react-router"
import { PageLayout } from "@/components/layout/PageLayout"
import { AnalyticsDashboard } from "@/components/analytics"
import { authService } from "@/lib/auth"

export const Route = createFileRoute("/analytics" as any)({
  beforeLoad: async () => {
    // Check if user is authenticated
    const isAuthenticated = await authService.isAuthenticated()
    if (!isAuthenticated) {
      throw redirect({ to: "/login" })
    }
    
    // Check if user is admin (analytics might be admin-only)
    const isAdmin = await authService.isAdmin()
    if (!isAdmin) {
      throw redirect({ to: "/dashboard" })
    }
  },
  component: AnalyticsPage
})

function AnalyticsPage() {
  return (
    <PageLayout title="Revenue & Profit Analytics" subtitle="Comprehensive analysis of your business performance">
      <AnalyticsDashboard />
    </PageLayout>
  )
}