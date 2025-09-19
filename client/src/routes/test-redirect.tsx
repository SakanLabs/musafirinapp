import { createFileRoute, redirect } from "@tanstack/react-router"
import { authService } from "@/lib/auth"

export const Route = createFileRoute("/test-redirect")({
  component: TestRedirect,
  beforeLoad: async () => {
    console.log('test-redirect: beforeLoad called')
    try {
      const isAuth = await authService.isAuthenticated()
      console.log('test-redirect: isAuthenticated =', isAuth)
      
      if (!isAuth) {
        console.log('test-redirect: redirecting to login')
        throw redirect({ to: '/login' })
      }
      
      console.log('test-redirect: user is authenticated, proceeding')
    } catch (error) {
      console.error('test-redirect: error in beforeLoad:', error)
      throw error
    }
  }
})

function TestRedirect() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Test Redirect Page</h1>
      <p>If you can see this, you are authenticated!</p>
    </div>
  )
}
