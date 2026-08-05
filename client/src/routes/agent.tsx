import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { authService } from "@/lib/auth";

export const Route = createFileRoute("/agent")({
  beforeLoad: async ({ location }) => {
    const user = await authService.getCurrentUser();
    if (!user) {
      throw redirect({ to: "/login" });
    }

    // Only agent users can access agent portal
    if (user.userType !== 'agent') {
      throw redirect({ to: "/dashboard/admin" });
    }

    // Redirect /agent to /agent/dashboard
    if (location.pathname === '/agent') {
      throw redirect({ to: "/agent/dashboard" });
    }
  },
  component: AgentLayout,
});

function AgentLayout() {
  return <Outlet />;
}
