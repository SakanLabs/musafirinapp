import { createFileRoute, Link } from "@tanstack/react-router"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export const Route = createFileRoute("/test-routing")({
  component: TestRoutingPage
})

function TestRoutingPage() {
  return (
    <PageLayout
      title="Test Routing"
      subtitle="Test navigasi ke berbagai halaman"
    >
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Test Navigation</h3>
          <div className="space-y-4">
            <div>
              <Link to="/bookings">
                <Button className="w-full">Go to Bookings List</Button>
              </Link>
            </div>
            <div>
              <Link to="/bookings/create">
                <Button className="w-full" variant="outline">Go to Create Booking Form</Button>
              </Link>
            </div>
            <div>
              <Link to="/admin">
                <Button className="w-full" variant="secondary">Go to Admin</Button>
              </Link>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Direct Links</h3>
          <div className="space-y-2 text-sm">
            <p><strong>Bookings List:</strong> <a href="/bookings" className="text-blue-600 underline">/bookings</a></p>
            <p><strong>Create Booking:</strong> <a href="/bookings/create" className="text-blue-600 underline">/bookings/create</a></p>
            <p><strong>Admin:</strong> <a href="/admin" className="text-blue-600 underline">/admin</a></p>
          </div>
        </Card>
      </div>
    </PageLayout>
  )
}