import { createClient } from '@/lib/supabase/server'
import { CopilClient } from './copil-client'

export default async function CopilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: sessionsRaw },
    { data: orgsRaw },
    { data: membersRaw },
    { data: userRolesRaw },
  ] = await Promise.all([
    supabase
      .from('copil_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('organizations')
      .select('id, name, code, level')
      .eq('has_copil', true)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('copil_members')
      .select('id, organization_id, user_id, role, is_active')
      .eq('is_active', true),
    supabase
      .from('user_roles')
      .select('role, organization_id')
      .eq('user_id', user?.id ?? '')
      .eq('is_active', true),
  ])

  // Charger les budgets concernés par les sessions
  const budgetIds = [...new Set((sessionsRaw ?? []).map((s: Record<string, unknown>) => s.budget_id as string))]
  const { data: budgetsRaw } = budgetIds.length > 0
    ? await supabase.from('budgets').select('id, title, status').in('id', budgetIds)
    : { data: [] }

  // Charger les votes pour compter
  const sessionIds = (sessionsRaw ?? []).map((s: Record<string, unknown>) => s.id as string)
  const { data: votesRaw } = sessionIds.length > 0
    ? await supabase.from('copil_votes').select('session_id, decision').in('session_id', sessionIds)
    : { data: [] }

  const currentUserRoles = (userRolesRaw ?? []).map((r: Record<string, unknown>) => r.role as string)

  return (
    <CopilClient
      sessions={(sessionsRaw ?? []) as Record<string, unknown>[]}
      organizations={(orgsRaw ?? []) as Array<{ id: string; name: string; code: string; level: string }>}
      members={(membersRaw ?? []) as Array<{ id: string; organization_id: string; user_id: string; role: string; is_active: boolean }>}
      budgets={(budgetsRaw ?? []) as Array<{ id: string; title: string; status: string }>}
      votes={(votesRaw ?? []) as Array<{ session_id: string; decision: string }>}
      currentUserId={user?.id ?? ''}
      currentUserRoles={currentUserRoles}
    />
  )
}
