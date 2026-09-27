import { createFileRoute, redirect, Outlet } from "@tanstack/react-router"
import { authService } from "@/lib/auth"

export const Route = createFileRoute("/clients")({
  beforeLoad: async () => {
    const isAuthenticated = await authService.isAuthenticated()

    if (!isAuthenticated) {
      throw redirect({ to: "/login" })
    }
  },
  component: ClientsLayout
})

function ClientsLayout() {
  return <Outlet />
}
