import { createFileRoute, redirect, Outlet } from "@tanstack/react-router"
import { authService } from "@/lib/auth"

export const Route = createFileRoute("/vouchers")({ 
  beforeLoad: async () => {
    // Check if user is authenticated
    const isAuthenticated = await authService.isAuthenticated()
    if (!isAuthenticated) {
      throw redirect({ to: "/login" })
    }
  },
  component: VouchersLayout
})

function VouchersLayout() {
  return <Outlet />
}