import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/test-simple-redirect")({
  component: TestSimpleRedirect,
  beforeLoad: async () => {
    console.log('test-simple-redirect: beforeLoad called - should redirect to login')
    throw redirect({ to: '/login' })
  }
})

function TestSimpleRedirect() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">This should never be seen</h1>
      <p>If you see this, the redirect failed!</p>
    </div>
  )
}