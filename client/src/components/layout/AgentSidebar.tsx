import { Link, useLocation } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  ClipboardList,
  Plus,
  Building2,
  Bell,
  Menu,
  X,
  User as UserIcon,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/api'

const navigationSections = [
  {
    title: 'Menu Utama',
    items: [
      {
        name: 'Dashboard',
        href: '/agent/dashboard',
        icon: LayoutDashboard,
      },
      {
        name: 'Request Saya',
        href: '/agent/requests',
        icon: ClipboardList,
      },
      {
        name: 'Buat Request',
        href: '/agent/create-request',
        icon: Plus,
      },
    ]
  },
  {
    title: 'Akun',
    items: [
      {
        name: 'Profil Perusahaan',
        href: '/agent/profile',
        icon: Building2,
      },
      {
        name: 'Notifikasi',
        href: '/agent/notifications',
        icon: Bell,
      },
    ]
  },
]

interface AgentSidebarProps {
  className?: string
}

export function AgentSidebar({ className }: AgentSidebarProps) {
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    // Fetch unread notification count
    apiClient.get<any>('/api/agent-requests/notifications/list')
      .then(res => {
        if (res.success) {
          setUnreadCount(res.data.unreadCount || 0)
        }
      })
      .catch(() => {})
  }, [location.pathname])

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
            <Link to="/agent/dashboard" className="flex items-center gap-2">
              <img 
                src="/Logo Musafirin with PT.png" 
                alt="Musafirin" 
                className="h-8 object-contain" 
              />
            </Link>
          </div>

          {/* Agent Badge */}
          <div className="px-6 py-3 border-b border-[#e5e7eb] bg-[#f8f9fa]">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-[#111111] flex items-center justify-center">
                <UserIcon className="h-3.5 w-3.5 text-white" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-[#111111] uppercase tracking-wider">Agent Portal</span>
              </div>
            </div>
          </div>

          {/* Grouped Sidebar Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-6 overflow-y-auto scrollbar-none">
            {navigationSections.map((section) => (
              <div key={section.title} className="space-y-1">
                {/* Category Title */}
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-2 block">
                  {section.title}
                </h4>
                
                {/* Section Links */}
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const isActive = location.pathname === item.href ||
                      (item.href !== '/agent/dashboard' && location.pathname.startsWith(item.href));

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
                        <span className="flex-1">{item.name}</span>
                        {item.name === 'Notifikasi' && unreadCount > 0 && (
                          <span className="bg-red-500 text-white text-[10px] font-bold rounded-full h-5 min-w-5 px-1.5 flex items-center justify-center">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-[#e5e7eb] bg-[#f8f9fa] flex items-center justify-between">
            <div className="text-[10px] text-[#6b7280] font-semibold tracking-wider flex items-center gap-1.5 select-none">
              <span className="h-1.5 w-1.5 rounded-full bg-[#10b981] animate-pulse"></span>
              <span>AGENT PORTAL v1.0</span>
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
