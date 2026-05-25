import { Hono } from 'hono'
import { db } from '../db'
import { user, storeUserAddresses } from '../db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth'
import { verify } from 'hono/jwt'
import type { ApiResponse } from 'shared/dist'

// Unified Authentication to support both Supabase JWT and Better-Auth Sessions
async function unifiedAuth(c: any, next: any) {
  try {
    const authHeader = c.req.header("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const secret = process.env.SUPABASE_JWT_SECRET;
      if (token && secret) {
        try {
          const payload = await verify(token, secret) as any;
          if (payload && payload.aud === "authenticated" && payload.email) {
            const userId = payload.sub || payload.email;
            
            // Mirror Supabase user in local user table to satisfy foreign key constraint
            let localUser = await db.query.user.findFirst({
              where: eq(user.id, userId)
            });
            
            if (!localUser) {
              const [newLocalUser] = await db.insert(user).values({
                id: userId,
                name: payload.user_metadata?.full_name || payload.email.split('@')[0] || "User",
                email: payload.email,
                role: "user",
                userType: "direct"
              }).returning();
              if (newLocalUser) {
                localUser = newLocalUser;
              }
            }
            
            if (localUser) {
              const mockUser = {
                id: localUser.id,
                email: localUser.email,
                role: localUser.role
              };
              c.set("user", mockUser);
              return await next();
            } else {
              throw new Error("Failed to mirror Supabase user locally.");
            }
          }
        } catch (jwtErr) {
          console.error("JWT verify or mirror insert error inside profile routes:", jwtErr);
        }
      }
    }
    await requireAuth(c, next);
  } catch (error) {
    console.error("Unified auth error inside profile routes:", error);
    return c.json({ error: "Unauthorized" }, 401);
  }
}

const app = new Hono<{ Variables: { user: any; session: any } }>()
  .use('/*', unifiedAuth)

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

  // GET /api/profile/addresses - Fetch all user addresses
  .get('/addresses', async (c) => {
    try {
      const currentUser = c.get('user')
      const list = await db.select().from(storeUserAddresses)
        .where(eq(storeUserAddresses.userId, currentUser.id))
        .orderBy(desc(storeUserAddresses.isDefault), desc(storeUserAddresses.createdAt))
      
      return c.json({ success: true, data: list })
    } catch (error: any) {
      console.error('Error fetching addresses:', error)
      return c.json({ success: false, error: error.message }, 500)
    }
  })

  // POST /api/profile/addresses - Create a new address
  .post('/addresses', async (c) => {
    try {
      const currentUser = c.get('user')
      const body = await c.req.json()
      const { label, recipientName, recipientPhone, shippingAddress, province, city, postalCode, isDefault } = body

      if (!label || !recipientName || !recipientPhone || !shippingAddress || !province || !city || !postalCode) {
        return c.json({ success: false, error: 'All fields are required' }, 400)
      }

      // If set as default, unset other defaults
      if (isDefault) {
        await db.update(storeUserAddresses)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(eq(storeUserAddresses.userId, currentUser.id))
      }

      // Check if this is the first address, make it default if so
      const existing = await db.select().from(storeUserAddresses).where(eq(storeUserAddresses.userId, currentUser.id)).limit(1)
      const shouldBeDefault = existing.length === 0 ? true : !!isDefault

      const [newAddress] = await db.insert(storeUserAddresses).values({
        userId: currentUser.id,
        label,
        recipientName,
        recipientPhone,
        shippingAddress,
        province,
        city,
        postalCode,
        isDefault: shouldBeDefault
      }).returning()

      return c.json({ success: true, data: newAddress })
    } catch (error: any) {
      console.error('Error creating address:', error)
      return c.json({ success: false, error: error.message }, 500)
    }
  })

  // PUT /api/profile/addresses/:id - Update an address
  .put('/addresses/:id', async (c) => {
    try {
      const currentUser = c.get('user')
      const addressId = parseInt(c.req.param('id'))
      if (isNaN(addressId)) {
        return c.json({ success: false, error: 'Invalid address ID' }, 400)
      }

      const body = await c.req.json()
      const { label, recipientName, recipientPhone, shippingAddress, province, city, postalCode, isDefault } = body

      const [address] = await db.select().from(storeUserAddresses)
        .where(and(eq(storeUserAddresses.id, addressId), eq(storeUserAddresses.userId, currentUser.id)))
        .limit(1)

      if (!address) {
        return c.json({ success: false, error: 'Address not found' }, 404)
      }

      if (isDefault && !address.isDefault) {
        await db.update(storeUserAddresses)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(eq(storeUserAddresses.userId, currentUser.id))
      }

      const [updatedAddress] = await db.update(storeUserAddresses).set({
        label: label || address.label,
        recipientName: recipientName || address.recipientName,
        recipientPhone: recipientPhone || address.recipientPhone,
        shippingAddress: shippingAddress || address.shippingAddress,
        province: province || address.province,
        city: city || address.city,
        postalCode: postalCode || address.postalCode,
        isDefault: isDefault !== undefined ? !!isDefault : address.isDefault,
        updatedAt: new Date()
      }).where(eq(storeUserAddresses.id, addressId)).returning()

      return c.json({ success: true, data: updatedAddress })
    } catch (error: any) {
      console.error('Error updating address:', error)
      return c.json({ success: false, error: error.message }, 500)
    }
  })

  // DELETE /api/profile/addresses/:id - Delete an address
  .delete('/addresses/:id', async (c) => {
    try {
      const currentUser = c.get('user')
      const addressId = parseInt(c.req.param('id'))
      if (isNaN(addressId)) {
        return c.json({ success: false, error: 'Invalid address ID' }, 400)
      }

      const [address] = await db.select().from(storeUserAddresses)
        .where(and(eq(storeUserAddresses.id, addressId), eq(storeUserAddresses.userId, currentUser.id)))
        .limit(1)

      if (!address) {
        return c.json({ success: false, error: 'Address not found' }, 404)
      }

      await db.delete(storeUserAddresses).where(eq(storeUserAddresses.id, addressId))

      // If we deleted the default address, set another address as default
      if (address.isDefault) {
        const [remaining] = await db.select().from(storeUserAddresses)
          .where(eq(storeUserAddresses.userId, currentUser.id))
          .limit(1)
        if (remaining) {
          await db.update(storeUserAddresses)
            .set({ isDefault: true, updatedAt: new Date() })
            .where(eq(storeUserAddresses.id, remaining.id))
        }
      }

      return c.json({ success: true, message: 'Address deleted successfully' })
    } catch (error: any) {
      console.error('Error deleting address:', error)
      return c.json({ success: false, error: error.message }, 500)
    }
  })

  // PATCH /api/profile/addresses/:id/default - Set an address as default
  .patch('/addresses/:id/default', async (c) => {
    try {
      const currentUser = c.get('user')
      const addressId = parseInt(c.req.param('id'))
      if (isNaN(addressId)) {
        return c.json({ success: false, error: 'Invalid address ID' }, 400)
      }

      const [address] = await db.select().from(storeUserAddresses)
        .where(and(eq(storeUserAddresses.id, addressId), eq(storeUserAddresses.userId, currentUser.id)))
        .limit(1)

      if (!address) {
        return c.json({ success: false, error: 'Address not found' }, 404)
      }

      // Unset previous default
      await db.update(storeUserAddresses)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(storeUserAddresses.userId, currentUser.id))

      // Set new default
      const [updatedAddress] = await db.update(storeUserAddresses)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(eq(storeUserAddresses.id, addressId))
        .returning()

      return c.json({ success: true, data: updatedAddress })
    } catch (error: any) {
      console.error('Error setting default address:', error)
      return c.json({ success: false, error: error.message }, 500)
    }
  })

export default app
