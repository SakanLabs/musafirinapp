import { Hono } from 'hono'
import { db } from '../db'
import { user } from '../db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth'
import type { ApiResponse } from 'shared/dist'

const app = new Hono<{ Variables: { user: any; session: any } }>()
  .use('/*', requireAuth)

  .get('/me', async (c) => {
    try {
      const currentUser = c.get('user')
      const userRecord = await db.select().from(user).where(eq(user.id, currentUser.id)).limit(1)

      if (!userRecord.length) {
        return c.json<ApiResponse>({ success: false, message: 'User not found' }, 404)
      }

      return c.json<ApiResponse>({
        success: true,
        message: 'Profile fetched successfully',
        data: userRecord[0]
      }, 200)
    } catch (error) {
      console.error('Error fetching profile:', error)
      return c.json<ApiResponse>({ success: false, message: 'Failed to fetch profile' }, 500)
    }
  })

  .patch('/me', async (c) => {
    try {
      const currentUser = c.get('user')
      const body = await c.req.json()

      const existingUser = await db.select().from(user).where(eq(user.id, currentUser.id)).limit(1)
      if (!existingUser.length) {
        return c.json<ApiResponse>({ success: false, message: 'User not found' }, 404)
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() }

      if (body.name && typeof body.name === 'string') updateData.name = body.name
      if (body.userType && ['direct', 'agent'].includes(body.userType)) updateData.userType = body.userType

      await db.update(user).set(updateData).where(eq(user.id, currentUser.id))

      const updatedUser = await db.select().from(user).where(eq(user.id, currentUser.id)).limit(1)

      return c.json<ApiResponse>({
        success: true,
        message: 'Profile updated successfully',
        data: updatedUser[0]
      }, 200)
    } catch (error) {
      console.error('Error updating profile:', error)
      return c.json<ApiResponse>({ success: false, message: 'Failed to update profile' }, 500)
    }
  })

export default app
