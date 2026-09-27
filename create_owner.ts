import { createClient } from '@supabase/supabase-js'
import { db } from './server/src/db/index.ts'
import { user } from './server/src/db/schema.ts'
import * as dotenv from 'dotenv'

dotenv.config({ path: './server/.env' })

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  try {
    const email = 'owner@musafirin.com'
    const password = 'password123'
    const name = 'System Owner'

    const userId = crypto.randomUUID()
    const now = new Date()

    // Create in Supabase first
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name },
      email_confirm: true
    })

    if (error) {
      if (error.message.includes('already registered')) {
        console.log('User already exists in Supabase. Proceeding to update local DB.')
      } else {
        throw error
      }
    }

    // Insert or update in local DB
    const { data: listUsers } = await supabase.auth.admin.listUsers()
    const supabaseUser = listUsers.users.find(u => u.email === email)
    
    if (supabaseUser) {
        try {
            await db.insert(user).values({
                id: supabaseUser.id,
                name: name,
                email: email,
                emailVerified: true,
                role: 'owner',
                userType: 'direct',
                banned: false,
                createdAt: now,
                updatedAt: now
            })
            console.log('Inserted successfully')
        } catch (e: any) {
             console.log('User might exist in DB already. Error:', e.message)
        }
    }

    console.log(`\n🎉 OWNER ACCOUNT CREATED SUCCESSFULLY 🎉`)
    console.log(`Email: ${email}`)
    console.log(`Password: ${password}`)
    console.log(`Role: owner\n`)
  } catch (error) {
    console.error('Failed:', error)
  }
}
main()
