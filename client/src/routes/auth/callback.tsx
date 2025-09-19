import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { authService } from "@/lib/auth";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/auth/callback")({
	component: OAuthCallback,
});

function OAuthCallback() {
	const navigate = useNavigate();
	const [isProcessing, setIsProcessing] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const handleOAuthCallback = async () => {
			try {
				// Add a delay to allow the OAuth session to be fully established
				await new Promise(resolve => setTimeout(resolve, 2000));
				
				const user = await authService.getCurrentUser();
				console.log("OAuth callback - user:", user);
				
				if (!user) {
					console.log("OAuth callback - no user found, redirecting to login");
					setError("Authentication failed. Please try again.");
					setTimeout(() => {
						navigate({ to: "/login" });
					}, 2000);
					return;
				}
				
				// Redirect to appropriate dashboard based on role
				const dashboardPath = user.role === 'admin' ? '/dashboard/admin' : '/dashboard/user';
				console.log("OAuth callback - redirecting to:", dashboardPath);
				
				navigate({ to: dashboardPath });
			} catch (error) {
				console.error("OAuth callback error:", error);
				setError("An error occurred during authentication.");
				setTimeout(() => {
					navigate({ to: "/login" });
				}, 2000);
			} finally {
				setIsProcessing(false);
			}
		};

		handleOAuthCallback();
	}, [navigate]);

	if (error) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<div className="text-center">
					<div className="text-red-600 text-lg mb-4">{error}</div>
					<p className="text-gray-600">Redirecting to login...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50 flex items-center justify-center">
			<div className="text-center">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
				<p className="mt-4 text-gray-600">
					{isProcessing ? "Completing sign in..." : "Redirecting..."}
				</p>
			</div>
		</div>
	);
}