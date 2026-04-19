import { createClient } from '@/lib/supabase/server'
import { ExecutionClient } from './execution-client'

export default async function ExecutionPage() {
  const supabase = await createClient()

  // Budgets eligibles à l'exécution (locked, transmitted, consolidated, final)
  const { data: budgetsRaw } = await supabase
    .from('budgets')
    .select('id, title, status, organization_id, fiscal_year_id, currency_code, total_amount_htva')
    .in('status', ['locked', 'transmitted', 'consolidated', 'final'])
    .order('created_at', { ascending: false })

  const budgetIds = (budgetsRaw ?? []).map((b: Record<string, unknown>) => b.id as string)
  const orgIds = [...new Set((budgetsRaw ?? []).map((b: Record<string, unknown>) => b.organization_id as string))]
  const fyIds  = [...new Set((budgetsRaw ?? []).map((b: Record<string, unknown>) => b.fiscal_year_id as string))]

  const [
    { data: orgsRaw },
    { data: fyRaw },
    { data: linesRaw },
    { data: creditsRaw },
  ] = await Promise.all([
    orgIds.length > 0
      ? supabase.from('organizations').select('id, name, code').in('id', orgIds)
      : { data: [] },
    fyIds.length > 0
      ? supabase.from('fiscal_years').select('id, code, name').in('id', fyIds)
      : { data: [] },
    budgetIds.length > 0
      ? supabase.from('budget_lines').select('id, budget_id, amount_htva').in('budget_id', budgetIds)
      : { data: [] },
    budgetIds.length > 0
      ? supabase
          .from('credit_openings')
          .select('id, budget_line_id, amount')
          .in('budget_line_id',
            (await supabase.from('budget_lines').select('id').in('budget_id', budgetIds)).data?.map(l => (l as Record<string, unknown>).id as string) ?? []
          )
      : { data: [] },
  ])

  // Engagements pour calcul taux
  const creditIds = (creditsRaw ?? []).map((c: Record<string, unknown>) => c.id as string)
  const { data: engagementsRaw } = creditIds.length > 0
    ? await supabase.from('engagements').select('id, credit_opening_id, amount, status').in('credit_opening_id', creditIds)
    : { data: [] }

  return (
    <ExecutionClient
      budgets={(budgetsRaw ?? []) as Record<string, unknown>[]}
      organizations={(orgsRaw ?? []) as Array<{ id: string; name: string; code: string }>}
      fiscalYears={(fyRaw ?? []) as Array<{ id: string; code: string; name: string }>}
      lines={(linesRaw ?? []) as Array<{ id: string; budget_id: string; amount_htva: number }>}
      credits={(creditsRaw ?? []) as Array<{ id: string; budget_line_id: string; amount: number }>}
      engagements={(engagementsRaw ?? []) as Array<{ id: string; credit_opening_id: string; amount: number; status: string }>}
    />
  )
}
