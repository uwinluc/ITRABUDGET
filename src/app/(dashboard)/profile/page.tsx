import { createClient } from '@/lib/supabase/server'
import { ProfileClient } from './profile-client'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: profileRaw },
    { data: rolesRaw },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user?.id ?? '').single(),
    supabase
      .from('user_roles')
      .select('*, organization:organizations(name, code)')
      .eq('user_id', user?.id ?? '')
      .order('is_active', { ascending: false }),
  ])

  return (
    <ProfileClient
      profile={profileRaw ?? null}
      email={user?.email ?? ''}
      userRoles={(rolesRaw ?? []) as Parameters<typeof ProfileClient>[0]['userRoles']}
    />
  )
}
