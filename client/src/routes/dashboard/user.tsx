import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { authService, type User } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/dashboard/user")({
	beforeLoad: async () => {
		// Check if user is authenticated
		const isAuthenticated = await authService.isAuthenticated()
		if (!isAuthenticated) {
			throw redirect({ to: "/login" })
		}
	},
	component: UserDashboard,
});

function UserDashboard() {
	const navigate = useNavigate();
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);
	const [signingOut, setSigningOut] = useState(false);

	useEffect(() => {
		const loadUser = async () => {
			try {
				const currentUser = await authService.getCurrentUser();
				setUser(currentUser);
			} catch (error) {
				console.error("Failed to load user:", error);
			} finally {
				setLoading(false);
			}
		};

		loadUser();
	}, []);

	const handleSignOut = async () => {
		setSigningOut(true);
		try {
			await authService.logout();
			navigate({ to: "/login" });
		} catch (error) {
			console.error("Failed to sign out:", error);
		} finally {
			setSigningOut(false);
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
					<p className="mt-4 text-gray-600">Loading dashboard...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50">
			{/* Header */}
			<header className="bg-white shadow-sm border-b">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex justify-between items-center h-16">
						<div className="flex items-center">
							<h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
						</div>
						<div className="flex items-center space-x-4">
							{user && (
								<div className="flex items-center space-x-3">
									<div className="text-right">
										<p className="text-sm font-medium text-gray-900">{user.name}</p>
										<p className="text-xs text-gray-500">{user.email}</p>
									</div>
									<Badge variant="secondary" className="capitalize">
										{user.role}
									</Badge>
								</div>
							)}
							<Button
								variant="outline"
								onClick={handleSignOut}
								disabled={signingOut}
								className="text-red-600 hover:text-red-700 hover:bg-red-50"
							>
								{signingOut ? "Signing out..." : "Sign Out"}
							</Button>
						</div>
					</div>
				</div>
			</header>

			{/* Main Content */}
			<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				{/* Welcome Section */}
				<div className="mb-8">
					<h2 className="text-3xl font-bold text-gray-900 mb-2">
						Welcome back, {user?.name || "User"}!
					</h2>
					<p className="text-gray-600">
						Here's what's happening with your account today.
					</p>
				</div>

				{/* Dashboard Cards */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
					{/* Profile Card */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center space-x-2">
								<svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
								</svg>
								<span>Profile</span>
							</CardTitle>
							<CardDescription>
								Manage your account information
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-2">
								<p className="text-sm"><strong>Name:</strong> {user?.name}</p>
								<p className="text-sm"><strong>Email:</strong> {user?.email}</p>
								<p className="text-sm"><strong>Role:</strong> <Badge variant="outline" className="capitalize">{user?.role}</Badge></p>
							</div>
							<Button variant="outline" className="w-full mt-4">
								Edit Profile
							</Button>
						</CardContent>
					</Card>

					{/* Activity Card */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center space-x-2">
								<svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
								</svg>
								<span>Activity</span>
							</CardTitle>
							<CardDescription>
								Your recent activity overview
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-3">
								<div className="flex justify-between items-center">
									<span className="text-sm text-gray-600">Last login</span>
									<span className="text-sm font-medium">Today</span>
								</div>
								<div className="flex justify-between items-center">
									<span className="text-sm text-gray-600">Sessions</span>
									<span className="text-sm font-medium">1 active</span>
								</div>
								<div className="flex justify-between items-center">
									<span className="text-sm text-gray-600">Status</span>
									<Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Settings Card */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center space-x-2">
								<svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
								</svg>
								<span>Settings</span>
							</CardTitle>
							<CardDescription>
								Customize your preferences
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-3">
								<Button variant="ghost" className="w-full justify-start">
									<svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
									</svg>
									Security
								</Button>
								<Button variant="ghost" className="w-full justify-start">
									<svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5z" />
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 19.5A2.5 2.5 0 016.5 17H20" />
									</svg>
									Notifications
								</Button>
								<Button variant="ghost" className="w-full justify-start">
									<svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17v4a2 2 0 002 2h4M13 5l4 4" />
									</svg>
									Preferences
								</Button>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Quick Actions */}
				<Card>
					<CardHeader>
						<CardTitle>Quick Actions</CardTitle>
						<CardDescription>
							Common tasks and shortcuts
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
							<Button variant="outline" className="h-auto p-4 flex flex-col items-center space-y-2">
								<svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
								</svg>
								<span className="text-sm font-medium">Create Document</span>
							</Button>
							<Button variant="outline" className="h-auto p-4 flex flex-col items-center space-y-2">
								<svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2m-5 4v6m-3-3h6" />
								</svg>
								<span className="text-sm font-medium">View Reports</span>
							</Button>
							<Button variant="outline" className="h-auto p-4 flex flex-col items-center space-y-2">
								<svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
								</svg>
								<span className="text-sm font-medium">Manage Team</span>
							</Button>
							<Button variant="outline" className="h-auto p-4 flex flex-col items-center space-y-2">
								<svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
								</svg>
								<span className="text-sm font-medium">Support</span>
							</Button>
						</div>
					</CardContent>
				</Card>
			</main>
		</div>
	);
}