import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { authService } from "@/lib/auth";

export const Route = createFileRoute("/dashboard")({
	beforeLoad: async ({ location }) => {
		// Only redirect if accessing the exact /dashboard path, not nested routes
		if (location.pathname === '/dashboard') {
			// Add a small delay to allow session to be established after OAuth callback
			await new Promise(resolve => setTimeout(resolve, 1000));
			
			const user = await authService.getCurrentUser();
			if (!user) {
				throw redirect({ to: "/login" });
			}

			const dashboardPath = await authService.getDefaultDashboard();
			throw redirect({ to: dashboardPath });
		}
	},
	component: Dashboard,
});

// This component renders child routes via Outlet
function Dashboard() {
	return <Outlet />;
}