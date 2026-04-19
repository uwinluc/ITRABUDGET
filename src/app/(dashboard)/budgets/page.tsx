import { createClient } from '@/lib/supabase/server'
import { BudgetsClient } from './budgets-client'

export default async function BudgetsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: budgetsRaw } = await supabase
    .from('budgets')
    .select('id, title, status, created_at, submitted_at, locked_at, fiscal_year_id, organization_id')
    .order('created_at', { ascending: false })

  const { data: orgsRaw } = await supabase
    .from('organizations')
    .select('id, name, code, level')
    .eq('is_active', true)
    .order('name')

  const { data: fiscalYearsRaw } = await supabase
    .from('fiscal_years')
    .select('id, code, name, status, organization_id')
    .order('start_date', { ascending: false })

  // Fetch line counts per budget
  const budgetIds = (budgetsRaw ?? []).map((b: Record<string, unknown>) => b.id as string)
  const { data: lineCounts } = budgetIds.length > 0
    ? await supabase
        .from('budget_lines')
        .select('budget_id')
        .in('budget_id', budgetIds)
    : { data: [] }

  const countMap: Record<string, number> = {}
  ;(lineCounts ?? []).forEach((l: Record<string, unknown>) => {
    const id = l.budget_id as string
    countMap[id] = (countMap[id] ?? 0) + 1
  })

  const orgs = (orgsRaw ?? []) as Array<{ id: string; name: string; code: string; level: string }>
  const fiscalYears = (fiscalYearsRaw ?? []) as Array<{ id: string; code: string; name: string; status: string; organization_id: string }>
  const budgets = (budgetsRaw ?? []).map((b: Record<string, unknown>) => ({
    id: b.id as string,
    title: b.title as string,
    status: b.status as string,
    created_at: b.created_at as string,
    submitted_at: b.submitted_at as string | null,
    locked_at: b.locked_at as string | null,
    fiscal_year_id: b.fiscal_year_id as string,
    organization_id: b.organization_id as string,
    line_count: countMap[b.id as string] ?? 0,
    organization: orgs.find(o => o.id === b.organization_id),
    fiscal_year: fiscalYears.find(f => f.id === b.fiscal_year_id),
  }))

  return (
    <BudgetsClient
      budgets={budgets}
      organizations={orgs}
      fiscalYears={fiscalYears}
      currentUserId={user?.id ?? ''}
    />
  )
}
