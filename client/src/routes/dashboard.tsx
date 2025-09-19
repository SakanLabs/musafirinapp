import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { authService } from "@/lib/auth";

export const Route = createFileRoute("/dashboard")({
	beforeLoad: async ({ location }) => {
		// Only redirect if accessing the exact /dashboard path, not nested routes
		if (location.pathname === '/dashboard') {
			// Add a small delay to allow session to be established after OAuth callback
			await new Promise(resolve => setTimeout(resolve, 1000));
			
			const user = await authService.getCurrentUser();
			console.log("Dashboard beforeLoad - user:", user);
			if (!user) {
				console.log("No user found, redirecting to login");
				throw redirect({ to: "/login" });
			}
			// Redirect to appropriate dashboard based on role
			const dashboardPath = user.role === 'admin' ? '/dashboard/admin' : '/dashboard/user';
			console.log("Redirecting to:", dashboardPath);
			throw redirect({ to: dashboardPath });
		}
	},
	component: Dashboard,
});

// This component renders child routes via Outlet
function Dashboard() {
	return <Outlet />;
}