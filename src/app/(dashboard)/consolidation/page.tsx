import { createClient } from '@/lib/supabase/server'
import { ConsolidationClient } from './consolidation-client'

export default async function ConsolidationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: consolidationsRaw },
    { data: fyRaw },
    { data: orgsRaw },
    { data: intercoRaw },
    { data: userRolesRaw },
    { data: budgetsRaw },
  ] = await Promise.all([
    supabase
      .from('consolidations')
      .select('*, fiscal_year:fiscal_years(code, name), prepared_by_profile:profiles!prepared_by(first_name, last_name), validated_by_profile:profiles!validated_by(first_name, last_name)')
      .order('prepared_at', { ascending: false }),
    supabase.from('fiscal_years').select('id, code, name').eq('status', 'active').order('start_date', { ascending: false }),
    supabase.from('organizations').select('id, name, code').eq('is_active', true).order('name'),
    supabase.from('intercompany_transactions').select('*').order('created_at', { ascending: false }).limit(200),
    supabase.from('user_roles').select('role, organization_id').eq('user_id', user?.id ?? '').eq('is_active', true),
    supabase
      .from('budgets')
      .select('organization_id, organization:organizations(name), budget_lines(amount_usd), execution_lines:budget_lines(execution_items:execution_items(amount_usd))')
      .in('status', ['approved', 'locked', 'transmitted', 'consolidated', 'final']),
  ])

  const currentUserRoles = (userRolesRaw ?? []).map((r: Record<string, unknown>) => r.role as string)

  // Build budget summary per org
  const orgMap = new Map((orgsRaw ?? []).map(o => [o.id, o.name]))
  const budgetByOrg = new Map<string, { total_budget_usd: number; total_consumed_usd: number; budget_count: number; organization_name: string }>()

  for (const b of (budgetsRaw ?? []) as Record<string, unknown>[]) {
    const orgId = b.organization_id as string
    const orgName = (b.organization as Record<string, string> | null)?.name ?? orgMap.get(orgId) ?? orgId
    const lines = (b.budget_lines as Array<{ amount_usd: number | null }> | null) ?? []
    const budgetUSD = lines.reduce((s, l) => s + (l.amount_usd ?? 0), 0)

    const existing = budgetByOrg.get(orgId) ?? { total_budget_usd: 0, total_consumed_usd: 0, budget_count: 0, organization_name: orgName }
    existing.total_budget_usd += budgetUSD
    existing.budget_count += 1
    budgetByOrg.set(orgId, existing)
  }

  const budgetSummary = Array.from(budgetByOrg.entries()).map(([organization_id, v]) => ({
    organization_id,
    ...v,
  }))

  return (
    <ConsolidationClient
      consolidations={(consolidationsRaw ?? []) as Parameters<typeof ConsolidationClient>[0]['consolidations']}
      fiscalYears={(fyRaw ?? []) as Array<{ id: string; code: string; name: string }>}
      organizations={(orgsRaw ?? []) as Array<{ id: string; name: string; code: string }>}
      intercoTransactions={(intercoRaw ?? []) as Parameters<typeof ConsolidationClient>[0]['intercoTransactions']}
      currentUserId={user?.id ?? ''}
      currentUserRoles={currentUserRoles}
      budgetSummary={budgetSummary}
    />
  )
}
