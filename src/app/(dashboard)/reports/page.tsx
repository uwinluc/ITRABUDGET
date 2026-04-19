import { createClient } from '@/lib/supabase/server'
import { ReportsClient } from './reports-client'

export default async function ReportsPage() {
  const supabase = await createClient()

  const [
    { data: budgetsRaw },
    { data: orgsRaw },
    { data: fyRaw },
    { data: linesRaw },
  ] = await Promise.all([
    supabase
      .from('budgets')
      .select('id, title, status, organization_id, fiscal_year_id, currency_code, total_amount_htva, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('organizations').select('id, name, code, level').eq('is_active', true).order('name'),
    supabase.from('fiscal_years').select('id, code, name, status').order('start_date', { ascending: false }),
    supabase.from('budget_lines').select('id, budget_id, amount_htva, category'),
  ])

  const lineIds = (linesRaw ?? []).map((l: Record<string, unknown>) => l.id as string)

  const { data: creditsRaw } = lineIds.length > 0
    ? await supabase.from('credit_openings').select('id, budget_line_id, amount').in('budget_line_id', lineIds)
    : { data: [] }

  const creditIds = (creditsRaw ?? []).map((c: Record<string, unknown>) => c.id as string)

  const { data: engagementsRaw } = creditIds.length > 0
    ? await supabase.from('engagements').select('id, credit_opening_id, amount').in('credit_opening_id', creditIds)
    : { data: [] }

  const engagementIds = (engagementsRaw ?? []).map((e: Record<string, unknown>) => e.id as string)

  const { data: liqRaw } = engagementIds.length > 0
    ? await supabase.from('liquidations').select('id, engagement_id, amount').in('engagement_id', engagementIds)
    : { data: [] }

  const liqIds = (liqRaw ?? []).map((l: Record<string, unknown>) => l.id as string)

  const { data: ordRaw } = liqIds.length > 0
    ? await supabase.from('ordonnances').select('id, liquidation_id, amount').in('liquidation_id', liqIds)
    : { data: [] }

  const ordIds = (ordRaw ?? []).map((o: Record<string, unknown>) => o.id as string)

  const { data: paymentsRaw } = ordIds.length > 0
    ? await supabase.from('payments').select('id, ordonnance_id, amount').in('ordonnance_id', ordIds)
    : { data: [] }

  return (
    <ReportsClient
      budgets={(budgetsRaw ?? []) as Record<string, unknown>[]}
      organizations={(orgsRaw ?? []) as Array<{ id: string; name: string; code: string; level: string }>}
      fiscalYears={(fyRaw ?? []) as Array<{ id: string; code: string; name: string; status: string }>}
      lines={(linesRaw ?? []) as Array<{ id: string; budget_id: string; amount_htva: number; category: string }>}
      credits={(creditsRaw ?? []) as Array<{ id: string; budget_line_id: string; amount: number }>}
      engagements={(engagementsRaw ?? []) as Array<{ id: string; credit_opening_id: string; amount: number }>}
      payments={(paymentsRaw ?? []) as Array<{ id: string; ordonnance_id: string; amount: number }>}
    />
  )
}
