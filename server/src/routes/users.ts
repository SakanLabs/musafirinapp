import { Hono } from 'hono'
import { createClient } from '@supabase/supabase-js'
import { db } from '../db'
import { user } from '../db/schema'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '../middleware/auth'
import type { ApiResponse } from 'shared/dist'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
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
}

const app = new Hono()
  .use('/*', requireAdmin)

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
      const supabaseUserExists = supabaseUsers?.users.some(u => u.email === body.email)

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
        role: 'user',
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
      const supabaseUser = supabaseUsers?.users.find(u => u.email === existingUser.email)

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
