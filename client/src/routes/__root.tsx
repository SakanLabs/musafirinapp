import { createRootRoute, Outlet, ErrorComponent } from "@tanstack/react-router";

export const Route = createRootRoute({
	component: () => {
		return (
			<>
				<Outlet />
			</>
		);
	},
	errorComponent: ({ error }) => {
		return <ErrorComponent error={error} />;
	},
});
