import { createClient } from '@/lib/supabase/server'
import { AuditClient } from './audit-client'

export default async function AuditPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: logsRaw },
    { data: orgsRaw },
    { data: userRolesRaw },
  ] = await Promise.all([
    supabase
      .from('audit_logs')
      .select('*, profile:profiles(first_name, last_name), organization:organizations(name, code)')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase.from('organizations').select('id, name, code').eq('is_active', true).order('name'),
    supabase.from('user_roles').select('role').eq('user_id', user?.id ?? '').eq('is_active', true),
  ])

  const currentUserRoles = (userRolesRaw ?? []).map((r: Record<string, unknown>) => r.role as string)

  return (
    <AuditClient
      logs={(logsRaw ?? []) as Parameters<typeof AuditClient>[0]['logs']}
      organizations={(orgsRaw ?? []) as Array<{ id: string; name: string; code: string }>}
      currentUserRoles={currentUserRoles}
    />
  )
}
