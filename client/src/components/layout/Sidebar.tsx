import { Link, useLocation } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { authService, UserRole } from '@/lib/auth'
import {
  LayoutDashboard,
  Calendar,
  FileText,
  Ticket,
  Hotel,
  Menu,
  X,
  BarChart3,
  Users,
  Receipt,
  Plane,
  Car,
  Building,
  Map,
  Shield,
  Package
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard/admin',
    icon: LayoutDashboard,
    roles: ['admin', 'owner', 'finance']
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    roles: ['admin', 'owner', 'finance']
  },
  {
    name: 'Bookings',
    href: '/bookings',
    icon: Calendar,
    roles: ['admin', 'owner']
  },
  {
    name: 'Clients',
    href: '/clients',
    icon: Users,
    roles: ['admin', 'owner', 'finance']
  },
  {
    name: 'Service Orders',
    href: '/service-orders',
    icon: Plane,
    roles: ['admin', 'owner']
  },
  {
    name: 'Permintaan LA',
    href: '/custom-la-requests',
    icon: Package,
    roles: ['admin', 'owner']
  },
  {
    name: 'Transportation',
    href: '/transportation-bookings',
    icon: Car,
    roles: ['admin', 'owner']
  },
  {
    name: 'Invoices',
    href: '/invoices',
    icon: FileText,
    roles: ['admin', 'owner', 'finance']
  },
  {
    name: 'Receipts',
    href: '/receipts',
    icon: Receipt,
    roles: ['owner', 'finance']
  },
  {
    name: 'Vouchers',
    href: '/vouchers',
    icon: Ticket,
    roles: ['admin', 'owner']
  },
  {
    name: 'Master Hotels',
    href: '/master-hotels',
    icon: Building,
    roles: ['admin', 'owner']
  },
  {
    name: 'Master Transport',
    href: '/master-transport',
    icon: Map,
    roles: ['admin', 'owner']
  },
  {
    name: 'Staff Management',
    href: '/admin',
    icon: Shield,
    roles: ['owner']
  }
]

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [userRole, setUserRole] = useState<UserRole>('user')

  useEffect(() => {
    authService.getCurrentUser().then(user => {
      if (user) setUserRole(user.role)
    })
  }, [])

  // In the real code this is inside the component, but we will fix the import properly later if need be.
  // Actually useEffect is already imported from lucide-react? No, line 20 imports useState from react.


  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="bg-white"
        >
          {isMobileMenuOpen ? (
            <X className="h-4 w-4" />
          ) : (
            <Menu className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        className
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-16 px-4 border-b border-gray-200">
            <Link to="/dashboard/admin" className="flex items-center space-x-2">
              <img src="/Logo Musafirin with PT.png" alt="Musafirin" className="h-10 object-contain" />
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigation.filter(item => item.roles.includes(userRole)).map((item) => {
              const isActive = location.pathname === item.href || 
                             (item.href !== '/dashboard/admin' && location.pathname.startsWith(item.href))
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    isActive
                      ? "bg-blue-100 text-blue-700 border-r-2 border-blue-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  )}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200">
            <div className="text-xs text-gray-500 text-center">
              Hotel Booking Management
            </div>
          </div>
        </div>
      </div>
    </>
  )
}