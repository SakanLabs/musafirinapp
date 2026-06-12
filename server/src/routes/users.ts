import { Hono } from 'hono'
import { createClient } from '@supabase/supabase-js'
import { db } from '../db'
import { user, account } from '../db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireOwner } from '../middleware/auth'
import type { ApiResponse } from 'shared/dist'
import { hashPassword } from 'better-auth/crypto'

const supabase = createClient(
  process.env.SUPABASE_URL || 'http://localhost:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy_key_for_local_dev',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

interface CreateUserRequest {
  name: string
  email: string
  password: string
  userType?: 'direct' | 'agent'
  role?: 'user' | 'admin' | 'owner' | 'finance'
}

const app = new Hono()
  .use('/*', requireOwner)

  .get('/', async (c) => {
    try {
      const allUsers = await db.select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        userType: user.userType,
        banned: user.banned,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      })
      .from(user)
      .orderBy(desc(user.createdAt))

      return c.json<ApiResponse>({
        success: true,
        message: 'Users fetched successfully',
        data: allUsers
      }, 200)
    } catch (error) {
      console.error('Error fetching users:', error)
      return c.json<ApiResponse>({
        success: false,
        message: 'Failed to fetch users'
      }, 500)
    }
  })

  .post('/', async (c) => {
    try {
      const body: CreateUserRequest = await c.req.json()

      if (!body.name || !body.email || !body.password) {
        return c.json<ApiResponse>({
          success: false,
          message: 'Name, email, and password are required'
        }, 400)
      }

      if (body.password.length < 6) {
        return c.json<ApiResponse>({
          success: false,
          message: 'Password must be at least 6 characters'
        }, 400)
      }

      const existingUser = await db.query.user.findFirst({
        where: eq(user.email, body.email)
      })

      if (existingUser) {
        return c.json<ApiResponse>({
          success: false,
          message: 'User with this email already exists in Better Auth'
        }, 409)
      }

      const { data: supabaseUsers } = await supabase.auth.admin.listUsers()
      const supabaseUserExists = supabaseUsers?.users.some((u: any) => u.email === body.email)

      if (supabaseUserExists) {
        return c.json<ApiResponse>({
          success: false,
          message: 'User with this email already exists in Supabase'
        }, 409)
      }

      const userId = crypto.randomUUID()
      const now = new Date()

      await db.insert(user).values({
        id: userId,
        name: body.name,
        email: body.email,
        emailVerified: false,
        role: body.role && ['user', 'admin', 'owner', 'finance'].includes(body.role) ? body.role : 'user',
        userType: body.userType || 'direct',
        banned: false,
        createdAt: now,
        updatedAt: now
      })

      const { error: supabaseError } = await supabase.auth.admin.createUser({
        email: body.email,
        password: body.password,
        user_metadata: {
          name: body.name
        },
        email_confirm: true
      })

      if (supabaseError) {
        console.error('Supabase user creation failed:', supabaseError)
        await db.delete(user).where(eq(user.id, userId))
        return c.json<ApiResponse>({
          success: false,
          message: `Supabase error: ${supabaseError.message}`
        }, 400)
      }

      const passwordHash = await hashPassword(body.password)

      await db.insert(account).values({
        id: crypto.randomUUID(),
        accountId: body.email,
        providerId: 'email',
        userId: userId,
        password: passwordHash,
        createdAt: now,
        updatedAt: now,
      })

      return c.json<ApiResponse>({
        success: true,
        message: 'User created successfully in Better Auth and Supabase',
        data: {
          id: userId,
          name: body.name,
          email: body.email
        }
      }, 201)

    } catch (error) {
      console.error('Error creating user:', error)
      return c.json<ApiResponse>({
        success: false,
        message: 'Failed to create user'
      }, 500)
    }
  })

  .put('/:id', async (c) => {
    try {
      const userId = c.req.param('id')
      const body = await c.req.json()

      const existingUser = await db.query.user.findFirst({
        where: eq(user.id, userId)
      })

      if (!existingUser) {
        return c.json<ApiResponse>({
          success: false,
          message: 'User not found'
        }, 404)
      }

      if (body.userType && !['direct', 'agent'].includes(body.userType)) {
        return c.json<ApiResponse>({
          success: false,
          message: 'Invalid user type. Must be "direct" or "agent"'
        }, 400)
      }

      const updateData: any = {
        updatedAt: new Date()
      }

      if (body.name) updateData.name = body.name
      if (body.userType) updateData.userType = body.userType
      if (body.role && ['user', 'admin', 'finance', 'owner'].includes(body.role)) updateData.role = body.role

      await db.update(user).set(updateData).where(eq(user.id, userId))

      return c.json<ApiResponse>({
        success: true,
        message: 'User updated successfully'
      }, 200)

    } catch (error) {
      console.error('Error updating user:', error)
      return c.json<ApiResponse>({
        success: false,
        message: 'Failed to update user'
      }, 500)
    }
  })

  .delete('/:id', async (c) => {
    try {
      const userId = c.req.param('id')

      const existingUser = await db.query.user.findFirst({
        where: eq(user.id, userId)
      })

      if (!existingUser) {
        return c.json<ApiResponse>({
          success: false,
          message: 'User not found'
        }, 404)
      }

      const { data: supabaseUsers } = await supabase.auth.admin.listUsers()
      const supabaseUser = supabaseUsers?.users.find((u: any) => u.email === existingUser.email)

      if (supabaseUser) {
        const { error: deleteSupabaseError } = await supabase.auth.admin.deleteUser(supabaseUser.id)
        if (deleteSupabaseError) {
          console.error('Failed to delete Supabase user:', deleteSupabaseError)
        }
      }

      await db.delete(user).where(eq(user.id, userId))

      return c.json<ApiResponse>({
        success: true,
        message: 'User deleted successfully from Better Auth and Supabase'
      }, 200)

    } catch (error) {
      console.error('Error deleting user:', error)
      return c.json<ApiResponse>({
        success: false,
        message: 'Failed to delete user'
      }, 500)
    }
  })

export default app
