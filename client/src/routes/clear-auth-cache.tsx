import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export const Route = createFileRoute("/clear-auth-cache")({
  component: ClearAuthCachePage
})

function ClearAuthCachePage() {
  const navigate = useNavigate()

  const clearAllCache = () => {
    // Clear localStorage
    localStorage.clear()
    
    // Clear sessionStorage
    sessionStorage.clear()
    
    // Clear any cookies (if possible)
    document.cookie.split(";").forEach((c) => {
      const eqPos = c.indexOf("=")
      const name = eqPos > -1 ? c.substr(0, eqPos) : c
      document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/"
    })
    
    alert("Cache cleared! Please refresh the page and try logging in again.")
  }

  const refreshPage = () => {
    window.location.reload()
  }

  return (
    <PageLayout title="Clear Auth Cache">
      <div className="space-y-6">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Authentication Cache Management</h2>
          
          <div className="space-y-4">
            <p className="text-gray-600">
              Jika Anda mengalami masalah dengan autentikasi, coba clear cache dan login ulang.
            </p>
            
            <div className="space-y-2">
              <Button onClick={clearAllCache} className="w-full" variant="destructive">
                🗑️ Clear All Cache & Cookies
              </Button>
              
              <Button onClick={refreshPage} className="w-full" variant="outline">
                🔄 Refresh Page
              </Button>
              
              <Button 
                onClick={() => navigate({ to: "/login" })} 
                className="w-full"
              >
                🔐 Go to Login
              </Button>
              
              <Button 
                onClick={() => navigate({ to: "/test-booking-access" })} 
                className="w-full"
                variant="outline"
              >
                🧪 Test Booking Access
              </Button>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-2">Troubleshooting Steps:</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
            <li>Clear cache menggunakan tombol di atas</li>
            <li>Refresh halaman</li>
            <li>Login ulang dengan akun admin</li>
            <li>Coba akses halaman /bookings/create</li>
            <li>Jika masih bermasalah, check console browser untuk error</li>
          </ol>
        </Card>
      </div>
    </PageLayout>
  )
}
