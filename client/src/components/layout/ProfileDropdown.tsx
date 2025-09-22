import { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Avatar } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { authService, type User } from '@/lib/auth'
import { 
  User as UserIcon, 
  Settings, 
  LogOut, 
  Shield,
  ChevronDown 
} from 'lucide-react'

export function ProfileDropdown() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await authService.getCurrentUser()
        setUser(currentUser)
      } catch (error) {
        console.error('Failed to load user:', error)
      } finally {
        setLoading(false)
      }
    }

    loadUser()
  }, [])

  const handleLogout = async () => {
    try {
      await authService.logout()
      navigate({ to: '/login' })
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  const handleProfile = () => {
    // Navigate to profile page when implemented
    console.log('Navigate to profile')
  }

  const handleSettings = () => {
    // Navigate to settings page when implemented
    console.log('Navigate to settings')
  }

  const handleAdmin = () => {
    navigate({ to: '/admin' })
  }

  if (loading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse" />
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </div>
    )
  }

  if (!user) {
    return (
      <Button 
        variant="outline" 
        size="sm"
        onClick={() => navigate({ to: '/login' })}
      >
        Login
      </Button>
    )
  }

  const trigger = (
    <div className="flex items-center space-x-2 hover:bg-gray-50 rounded-lg px-2 py-1 transition-colors cursor-pointer">
      <Avatar 
        src={undefined} // Add user.avatar when available
        fallback={user.name}
        size="sm"
      />
      <div className="hidden md:block text-left">
        <div className="text-sm font-medium text-gray-900">{user.name}</div>
        <div className="text-xs text-gray-500 capitalize">{user.role}</div>
      </div>
      <ChevronDown className="h-4 w-4 text-gray-400" />
    </div>
  )

  return (
    <DropdownMenu trigger={trigger} align="end">
      <DropdownMenuLabel>
        <div className="flex flex-col space-y-1">
          <p className="text-sm font-medium leading-none">{user.name}</p>
          <p className="text-xs leading-none text-gray-500">{user.email}</p>
        </div>
      </DropdownMenuLabel>
      
      <DropdownMenuSeparator />
      
      <DropdownMenuItem onClick={handleProfile}>
        <UserIcon className="mr-2 h-4 w-4" />
        <span>Profile</span>
      </DropdownMenuItem>
      
      <DropdownMenuItem onClick={handleSettings}>
        <Settings className="mr-2 h-4 w-4" />
        <span>Settings</span>
      </DropdownMenuItem>
      
      {user.role === 'admin' && (
        <DropdownMenuItem onClick={handleAdmin}>
          <Shield className="mr-2 h-4 w-4" />
          <span>Admin Panel</span>
        </DropdownMenuItem>
      )}
      
      <DropdownMenuSeparator />
      
      <DropdownMenuItem onClick={handleLogout}>
        <LogOut className="mr-2 h-4 w-4" />
        <span>Logout</span>
      </DropdownMenuItem>
    </DropdownMenu>
  )
}