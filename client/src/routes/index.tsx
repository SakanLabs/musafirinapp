import { createFileRoute, redirect } from "@tanstack/react-router";
import { authService } from "@/lib/auth";

export const Route = createFileRoute("/")({
	beforeLoad: async () => {
		// Check if user is authenticated
		const isAuthenticated = await authService.isAuthenticated();
		
		if (isAuthenticated) {
			// Redirect to appropriate dashboard based on role
			const defaultDashboard = await authService.getDefaultDashboard();
			throw redirect({ to: defaultDashboard });
		} else {
			// Redirect to login page
			throw redirect({ to: "/login" });
		}
	},
	component: Index,
});

function Index() {
	// This component should never render due to redirects
	return (
		<div className="min-h-screen bg-gray-50 flex items-center justify-center">
			<div className="text-center">
				<h1 className="text-2xl font-bold text-gray-900 mb-4">Musafirin</h1>
				<p className="text-gray-600">Loading...</p>
			</div>
		</div>
	);
}
