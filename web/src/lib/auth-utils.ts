import { createClient } from '@/lib/supabase/server'

export async function requireUser() {
  const supabase = await createClient()
  // const { data: { user }, error } = await supabase.auth.getUser()

  // if (error || !user) {
  //   throw new Error('Unauthorized')
  // }

  return { id: 1, email: 'fake@example.com' }
}
