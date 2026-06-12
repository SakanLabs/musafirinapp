import { Link, useLocation } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { authService, UserRole } from '@/lib/auth'
import {
  LayoutDashboard,
  Calendar,
  FileText,
  Ticket,
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
  Package,
  UserCheck,
  ShoppingBag
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

const navigationSections = [
  {
    title: 'Overview',
    items: [
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
      }
    ]
  },
  {
    title: 'Operations',
    items: [
      {
        name: 'CRM Pipeline',
        href: '/leads',
        icon: Users,
        roles: ['admin', 'owner']
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
        name: 'Visa',
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
        name: 'Souvenir Store',
        href: '/store',
        icon: ShoppingBag,
        roles: ['admin', 'owner', 'finance']
      }

    ]
  },
  {
    title: 'Billing & Finance',
    items: [
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
      }
    ]
  },
  {
    title: 'Master Records',
    items: [
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
        name: 'Master Layanan (LA)',
        href: '/master-services',
        icon: Package,
        roles: ['admin', 'owner']
      },
      {
        name: 'Master Muthowifs',
        href: '/dashboard/muthowifs',
        icon: UserCheck,
        roles: ['admin', 'owner']
      },
      {
        name: 'Staff Management',
        href: '/admin',
        icon: Shield,
        roles: ['owner']
      }
    ]
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

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-3.5 left-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="bg-white hover:bg-gray-50 border-[#e5e7eb] rounded-md h-9 w-9 p-0 flex items-center justify-center shadow-xs"
        >
          {isMobileMenuOpen ? (
            <X className="h-4 w-4 text-[#111111]" />
          ) : (
            <Menu className="h-4 w-4 text-[#111111]" />
          )}
        </Button>
      </div>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-xs z-40 transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-[#e5e7eb] transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
        isMobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full",
        className
      )}>
        <div className="flex flex-col h-full">
          {/* Brand Logo Header */}
          <div className="flex items-center justify-start h-16 px-6 border-b border-[#e5e7eb]">
            <Link to="/dashboard/admin" className="flex items-center">
              <img 
                src="/Logo Musafirin with PT.png" 
                alt="Musafirin" 
                className="h-9 object-contain" 
              />
            </Link>
          </div>

          {/* Grouped Sidebar Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-6 overflow-y-auto scrollbar-none">
            {navigationSections.map((section) => {
              // Filter section items that matches user roles
              const visibleItems = section.items.filter(item => item.roles.includes(userRole));
              
              if (visibleItems.length === 0) return null;

              return (
                <div key={section.title} className="space-y-1">
                  {/* Category Title */}
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-2 block">
                    {section.title}
                  </h4>
                  
                  {/* Section Links */}
                  <div className="space-y-0.5">
                    {visibleItems.map((item) => {
                      const isActive = location.pathname === item.href ||
                        (item.href !== '/dashboard/admin' && location.pathname.startsWith(item.href));

                      return (
                        <Link
                          key={item.name}
                          to={item.href}
                          className={cn(
                            "flex items-center px-3 py-2 text-[13px] font-medium transition-all rounded-md gap-2.5 group",
                            isActive
                              ? "bg-[#f5f5f5] text-[#111111] font-semibold border-l-2 border-[#111111] rounded-l-none"
                              : "text-[#6b7280] hover:text-[#111111] hover:bg-gray-50"
                          )}
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <item.icon className={cn(
                            "h-4 w-4 shrink-0 transition-colors",
                            isActive 
                              ? "text-[#111111]" 
                              : "text-gray-400 group-hover:text-[#111111]"
                          )} />
                          <span>{item.name}</span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              );
            })}
          </nav>

          {/* Elegant Sidebar Footer */}
          <div className="p-4 border-t border-[#e5e7eb] bg-[#f8f9fa] flex items-center justify-between">
            <div className="text-[10px] text-[#6b7280] font-semibold tracking-wider flex items-center gap-1.5 select-none">
              <span className="h-1.5 w-1.5 rounded-full bg-[#10b981] animate-pulse"></span>
              <span>SYS LIVE v0.4.0</span>
            </div>
            <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider select-none">
              Musafirin
            </div>
          </div>
        </div>
      </div>
    </>
  )
}