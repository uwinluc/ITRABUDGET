import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { CopilSessionClient } from './copil-session-client'

export default async function CopilSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: session } = await supabase
    .from('copil_sessions')
    .select('*')
    .eq('id', id)
    .single()

  if (!session) notFound()

  const orgId = (session as Record<string, unknown>).organization_id as string
  const budgetId = (session as Record<string, unknown>).budget_id as string

  const [
    { data: membersRaw },
    { data: votesRaw },
    { data: budget },
    { data: org },
    { data: userRolesRaw },
    { data: userMemberRaw },
  ] = await Promise.all([
    supabase
      .from('copil_members')
      .select('id, user_id, role, is_active')
      .eq('organization_id', orgId)
      .eq('is_active', true),
    supabase
      .from('copil_votes')
      .select('id, member_id, decision, comment, voted_at')
      .eq('session_id', id),
    supabase.from('budgets').select('id, title, status').eq('id', budgetId).single(),
    supabase.from('organizations').select('id, name, code').eq('id', orgId).single(),
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user?.id ?? '')
      .eq('is_active', true),
    supabase
      .from('copil_members')
      .select('id, role')
      .eq('organization_id', orgId)
      .eq('user_id', user?.id ?? '')
      .eq('is_active', true)
      .maybeSingle(),
  ])

  // Charger les profils des membres
  const memberUserIds = (membersRaw ?? []).map((m: Record<string, unknown>) => m.user_id as string)
  const { data: profiles } = memberUserIds.length > 0
    ? await supabase.from('profiles').select('id, first_name, last_name').in('id', memberUserIds)
    : { data: [] }

  const currentUserRoles = (userRolesRaw ?? []).map((r: Record<string, unknown>) => r.role as string)

  return (
    <CopilSessionClient
      session={session as Record<string, unknown>}
      members={(membersRaw ?? []) as Array<{ id: string; user_id: string; role: string; is_active: boolean }>}
      votes={(votesRaw ?? []) as Array<{ id: string; member_id: string; decision: string; comment: string | null; voted_at: string }>}
      budget={(budget as Record<string, unknown> | null)}
      organization={(org as Record<string, unknown> | null)}
      profiles={(profiles ?? []) as Array<{ id: string; first_name: string; last_name: string }>}
      currentUserId={user?.id ?? ''}
      currentUserRoles={currentUserRoles}
      currentMember={(userMemberRaw as { id: string; role: string } | null)}
    />
  )
}
