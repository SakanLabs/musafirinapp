import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	beforeLoad: async () => {
		// For internal use, directly redirect to admin dashboard
		throw redirect({ to: "/dashboard/admin" });
	},
	component: Index,
});

// This component should never render since we redirect in beforeLoad
function Index() {
	return null;
}
