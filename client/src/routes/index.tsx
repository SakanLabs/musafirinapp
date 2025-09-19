import { createFileRoute, redirect } from "@tanstack/react-router";
import { authService } from "@/lib/auth";

export const Route = createFileRoute("/")({
	beforeLoad: async () => {
		const user = await authService.getCurrentUser();
		if (!user) {
			throw redirect({ to: "/login" });
		}
		// Redirect to appropriate dashboard based on role
		const dashboardPath = await authService.getDefaultDashboard();
		throw redirect({ to: dashboardPath });
	},
	component: Index,
});

// This component should never render since we redirect in beforeLoad
function Index() {
	return null;
}
