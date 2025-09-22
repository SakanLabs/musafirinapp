// Better Auth integration
import { authClient, getSession } from './auth-client'

export type UserRole = 'user' | 'admin'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  isAuthenticated: boolean
}

// Helper function to convert Better Auth session to our User interface
const sessionToUser = (session: any): User | null => {
  console.log('sessionToUser - input session:', session);
  console.log('sessionToUser - session type:', typeof session);
  
  if (!session) {
    console.log('sessionToUser - session is null/undefined');
    return null;
  }
  
  // Handle different session response formats
  let user = null;
  
  // Try session.user first (Better Auth format and direct API format)
  if (session.user) {
    console.log('sessionToUser - found session.user:', session.user);
    user = session.user;
  }
  // Try session.data.user (alternative format)
  else if (session.data?.user) {
    console.log('sessionToUser - found session.data.user:', session.data.user);
    user = session.data.user;
  }
  // Try direct user object
  else if (session.id && session.email) {
    console.log('sessionToUser - treating session as direct user object');
    user = session;
  }
  
  if (!user) {
    console.log('sessionToUser - no user found in session');
    return null;
  }
  
  console.log('sessionToUser - extracted user:', user);
  
  // Ensure all required fields are present
  if (!user.id || !user.email) {
    console.log('sessionToUser - user missing required fields (id or email)');
    return null;
  }
  
  // Map database roles to our UserRole type
  let role: UserRole = 'user'; // default
  if (user.role) {
    if (user.role === 'admin') {
      role = 'admin';
    } else {
      role = 'user'; // other roles map to 'user'
    }
  }

  return {
    id: user.id,
    name: user.name || user.email,
    email: user.email,
    role: role,
    isAuthenticated: true
  }
}

// Simple cache for user data to prevent duplicate API calls
let userCache: { user: User | null; timestamp: number } | null = null;
const CACHE_DURATION = 5000; // 5 seconds

export const authService = {
  // Login with email and password
  login: async (email: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> => {
    try {
      const result = await authClient.signIn.email({
        email,
        password,
      })
      
      if (result.data?.user) {
        const session = await getSession()
        const user = sessionToUser(session)
        // Update cache
        userCache = { user, timestamp: Date.now() };
        return { success: true, user: user || undefined }
      }
      
      return { success: false, error: result.error?.message || 'Login failed' }
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred' }
    }
  },

  // Get current user
  getCurrentUser: async (): Promise<User | null> => {
    // Check cache first
    if (userCache && (Date.now() - userCache.timestamp) < CACHE_DURATION) {
      console.log('getCurrentUser - returning cached user:', userCache.user);
      return userCache.user;
    }
    
    try {
      console.log('getCurrentUser - fetching fresh session');
      const session = await getSession({
        fetchOptions: {
          onError(context) {
            console.error('getCurrentUser - fetch error:', context);
          },
        },
      });
      
      console.log('getCurrentUser - raw session response:', session);
      
      const user = sessionToUser(session);
      console.log('getCurrentUser - converted user:', user);
      
      // Update cache
      userCache = {
        user,
        timestamp: Date.now()
      };
      
      return user;
    } catch (error) {
      console.error('getCurrentUser - error:', error);
      
      // Clear cache on error
      userCache = null;
      
      return null;
    }
  },

  // Check if user is authenticated
  isAuthenticated: async (): Promise<boolean> => {
    try {
      console.log('isAuthenticated - starting check');
      const user = await authService.getCurrentUser()
      const result = user?.isAuthenticated ?? false;
      console.log('isAuthenticated - user:', user, 'result:', result);
      return result;
    } catch (error) {
      console.warn('Authentication check failed, falling back to false:', error);
      // For development, you can return true to bypass auth
      // return true;
      return false;
    }
  },

  // Check if user has specific role
  hasRole: async (role: UserRole): Promise<boolean> => {
    const user = await authService.getCurrentUser()
    return user?.role === role || false
  },

  // Check if user is admin
  isAdmin: async (): Promise<boolean> => {
    return await authService.hasRole('admin')
  },

  // Check if user is regular user
  isUser: async (): Promise<boolean> => {
    return await authService.hasRole('user')
  },

  // Logout
  logout: async (): Promise<void> => {
    await authClient.signOut()
    // Clear cache on logout
    userCache = null;
  },

  // Get redirect path based on user role
  getDefaultDashboard: async (): Promise<string> => {
    const user = await authService.getCurrentUser()
    if (!user) return '/login'
    
    return user.role === 'admin' ? '/dashboard/admin' : '/dashboard/user'
  },

  // Google OAuth sign in
  signInWithGoogle: async (): Promise<{ success: boolean; error?: string }> => {
    try {
      // Use dedicated OAuth callback route for role-based redirection
      const callbackURL = `${window.location.origin}/auth/callback`
      
      // Better Auth social sign-in performs a redirect, so we don't get a return value
      await authClient.signIn.social({
        provider: 'google',
        callbackURL
      })
      
      // This line won't be reached as the user will be redirected
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Authentication failed' }
    }
  }
}

// Route guards
export const requireAuth = async () => {
  if (!(await authService.isAuthenticated())) {
    throw new Error('Authentication required')
  }
}

export const requireAdmin = async () => {
  await requireAuth()
  if (!(await authService.isAdmin())) {
    throw new Error('Admin access required')
  }
}

export const requireUser = async () => {
  await requireAuth()
  if (!(await authService.isUser())) {
    throw new Error('User access required')
  }
}