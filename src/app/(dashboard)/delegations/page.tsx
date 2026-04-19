import { createClient } from '@/lib/supabase/server'
import { DelegationsClient } from './delegations-client'

export default async function DelegationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: delegationsRaw },
    { data: usersRaw },
    { data: orgsRaw },
    { data: userRolesRaw },
  ] = await Promise.all([
    supabase
      .from('delegations')
      .select('*, delegator_profile:profiles!delegator_id(first_name, last_name), delegate_profile:profiles!delegate_id(first_name, last_name), organization:organizations(name, code)')
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, first_name, last_name').eq('is_active', true).order('first_name'),
    supabase.from('organizations').select('id, name, code').eq('is_active', true).order('name'),
    supabase.from('user_roles').select('role, organization_id').eq('user_id', user?.id ?? '').eq('is_active', true),
  ])

  const currentUserRoles = (userRolesRaw ?? []).map((r: Record<string, unknown>) => r.role as string)
  const currentUserOrgIds = (userRolesRaw ?? []).map((r: Record<string, unknown>) => r.organization_id as string)

  return (
    <DelegationsClient
      delegations={(delegationsRaw ?? []) as Parameters<typeof DelegationsClient>[0]['delegations']}
      users={(usersRaw ?? []) as Array<{ id: string; first_name: string; last_name: string }>}
      organizations={(orgsRaw ?? []) as Array<{ id: string; name: string; code: string }>}
      currentUserId={user?.id ?? ''}
      currentUserRoles={currentUserRoles}
      currentUserOrgIds={currentUserOrgIds}
    />
  )
}
