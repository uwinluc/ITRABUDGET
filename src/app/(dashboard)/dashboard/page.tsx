import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardCards } from './dashboard-cards'
import type { UserRole } from '@/types/database'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', user.id)
    .single()

  const { data: rolesData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('is_active', true)

  const userRoles = ((rolesData ?? []) as Array<{ role: string }>).map(r => r.role) as UserRole[]
  const isHolding = userRoles.some(r => ['dg_holding','dga_holding','consolidation_officer','audit_director','admin'].includes(r))

  const [
    { count: orgCount },
    { count: userCount },
    { count: budgetCount },
    { count: pendingCount },
    { data: recentBudgetsRaw },
    { data: allBudgetsRaw },
  ] = await Promise.all([
    supabase.from('organizations').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('budgets').select('*', { count: 'exact', head: true }),
    supabase.from('budgets').select('*', { count: 'exact', head: true }).in('status', ['submitted', 'under_review']),
    supabase
      .from('budgets')
      .select('id, title, status, created_at, organization:organizations(name)')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('budgets')
      .select('status')
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  const recentBudgets = (recentBudgetsRaw ?? []).map((b: Record<string, unknown>) => ({
    id:           b.id as string,
    title:        b.title as string,
    status:       b.status as string,
    created_at:   b.created_at as string,
    organization: Array.isArray(b.organization)
      ? (b.organization[0] as { name: string } | undefined) ?? null
      : (b.organization as { name: string } | null),
  }))

  // Status breakdown for mini chart
  const statusBreakdown = (allBudgetsRaw ?? []).reduce<Record<string, number>>((acc, b) => {
    const s = (b as Record<string, unknown>).status as string
    acc[s] = (acc[s] ?? 0) + 1
    return acc
  }, {})

  return (
    <DashboardCards
      profile={profile as { first_name: string; last_name: string } | null}
      userRoles={userRoles}
      isHolding={isHolding}
      stats={{ orgCount: orgCount ?? 0, userCount: userCount ?? 0, budgetCount: budgetCount ?? 0, pendingCount: pendingCount ?? 0 }}
      recentBudgets={recentBudgets ?? []}
      statusBreakdown={statusBreakdown}
    />
  )
}
