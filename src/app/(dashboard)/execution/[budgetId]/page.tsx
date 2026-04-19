import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ExecutionDetailClient } from './execution-detail-client'

export default async function ExecutionDetailPage({ params }: { params: Promise<{ budgetId: string }> }) {
  const { budgetId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: budget } = await supabase
    .from('budgets')
    .select('*')
    .eq('id', budgetId)
    .single()

  if (!budget) notFound()

  const orgId = (budget as Record<string, unknown>).organization_id as string

  const [
    { data: linesRaw },
    { data: org },
    { data: fy },
    { data: creditsRaw },
    { data: vendorsRaw },
    { data: currenciesRaw },
  ] = await Promise.all([
    supabase.from('budget_lines').select('*').eq('budget_id', budgetId).order('line_number'),
    supabase.from('organizations').select('id, name, code').eq('id', orgId).single(),
    supabase
      .from('fiscal_years')
      .select('id, code, name')
      .eq('id', (budget as Record<string, unknown>).fiscal_year_id as string)
      .single(),
    supabase
      .from('credit_openings')
      .select('*')
      .in('budget_line_id', (await supabase.from('budget_lines').select('id').eq('budget_id', budgetId)).data?.map(l => (l as Record<string, unknown>).id as string) ?? []),
    supabase.from('vendors').select('id, name, code').eq('organization_id', orgId).eq('is_active', true).order('name'),
    supabase.from('currencies').select('code, name_fr, symbol').eq('is_active', true).order('code'),
  ])

  const creditIds = (creditsRaw ?? []).map((c: Record<string, unknown>) => c.id as string)

  const [
    { data: engagementsRaw },
  ] = await Promise.all([
    creditIds.length > 0
      ? supabase.from('engagements').select('*').in('credit_opening_id', creditIds).order('created_at')
      : { data: [] },
  ])

  const engagementIds = (engagementsRaw ?? []).map((e: Record<string, unknown>) => e.id as string)

  const [
    { data: liquidationsRaw },
  ] = await Promise.all([
    engagementIds.length > 0
      ? supabase.from('liquidations').select('*').in('engagement_id', engagementIds).order('created_at')
      : { data: [] },
  ])

  const liquidationIds = (liquidationsRaw ?? []).map((l: Record<string, unknown>) => l.id as string)

  const [
    { data: ordonnancesRaw },
  ] = await Promise.all([
    liquidationIds.length > 0
      ? supabase.from('ordonnances').select('*').in('liquidation_id', liquidationIds).order('created_at')
      : { data: [] },
  ])

  const ordonnanceIds = (ordonnancesRaw ?? []).map((o: Record<string, unknown>) => o.id as string)

  const { data: paymentsRaw } = ordonnanceIds.length > 0
    ? await supabase.from('payments').select('*').in('ordonnance_id', ordonnanceIds).order('created_at')
    : { data: [] }

  return (
    <ExecutionDetailClient
      budget={budget as Record<string, unknown>}
      lines={(linesRaw ?? []) as Record<string, unknown>[]}
      organization={org as Record<string, unknown> | null}
      fiscalYear={fy as Record<string, unknown> | null}
      credits={(creditsRaw ?? []) as Record<string, unknown>[]}
      engagements={(engagementsRaw ?? []) as Record<string, unknown>[]}
      liquidations={(liquidationsRaw ?? []) as Record<string, unknown>[]}
      ordonnances={(ordonnancesRaw ?? []) as Record<string, unknown>[]}
      payments={(paymentsRaw ?? []) as Record<string, unknown>[]}
      vendors={(vendorsRaw ?? []) as Array<{ id: string; name: string; code: string }>}
      currencies={(currenciesRaw ?? []) as Array<{ code: string; name_fr: string; symbol: string }>}
      currentUserId={user?.id ?? ''}
    />
  )
}
