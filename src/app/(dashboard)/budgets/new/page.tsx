import { createClient } from '@/lib/supabase/server'
import { BudgetNewClient } from './budget-new-client'

export default async function NewBudgetPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: orgsRaw } = await supabase
    .from('organizations')
    .select('id, name, code, level, currency_code')
    .eq('is_active', true)
    .order('name')

  const { data: fiscalYearsRaw } = await supabase
    .from('fiscal_years')
    .select('id, code, name, status, organization_id, reference_currency')
    .in('status', ['preparation', 'active'])
    .order('start_date', { ascending: false })

  const { data: currenciesRaw } = await supabase
    .from('currencies')
    .select('code, name_fr, symbol, is_active')
    .eq('is_active', true)
    .order('code')

  const { data: unitsRaw } = await supabase
    .from('budget_units')
    .select('id, code, name_fr')
    .eq('is_active', true)
    .order('name_fr')

  const { data: rubricsRaw } = await supabase
    .from('budget_rubrics')
    .select('id, code, name_fr, category')
    .eq('is_active', true)
    .order('name_fr')

  return (
    <BudgetNewClient
      organizations={(orgsRaw ?? []) as Array<{ id: string; name: string; code: string; level: string; currency_code: string | null }>}
      fiscalYears={(fiscalYearsRaw ?? []) as Array<{ id: string; code: string; name: string; status: string; organization_id: string; reference_currency: string }>}
      currencies={(currenciesRaw ?? []) as Array<{ code: string; name_fr: string; symbol: string }>}
      units={(unitsRaw ?? []) as Array<{ id: string; code: string; name_fr: string }>}
      rubrics={(rubricsRaw ?? []) as Array<{ id: string; code: string; name_fr: string; category: string }>}
      currentUserId={user?.id ?? ''}
    />
  )
}
