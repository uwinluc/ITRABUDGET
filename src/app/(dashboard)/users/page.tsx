import { createClient } from '@/lib/supabase/server'
import { UsersClient } from './users-client'

export default async function UsersPage() {
  const supabase = await createClient()

  const { data: profiles } = await supabase
    .from('profiles')
    .select(`
      *,
      user_roles(
        id, role, is_active, valid_until,
        organization:organizations(id, name, code, level)
      )
    `)
    .order('last_name')

  // Récupérer emails depuis auth.users via admin
  // Note: en production, utiliser Supabase Admin SDK
  const users = profiles ?? []

  const { data: organizations } = await supabase
    .from('organizations')
    .select('id, name, code, level')
    .eq('is_active', true)
    .order('name')

  return <UsersClient users={users} organizations={organizations ?? []} />
}
