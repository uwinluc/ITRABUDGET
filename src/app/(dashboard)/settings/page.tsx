import { createClient } from '@/lib/supabase/server'
import { SettingsClient } from './settings-client'

export default async function SettingsPage() {
  const supabase = await createClient()

  const { data: fiscalYearsRaw } = await supabase
    .from('fiscal_years')
    .select('*')
    .order('start_date', { ascending: false })

  const { data: orgsRaw } = await supabase
    .from('organizations')
    .select('id, name, code, level')
    .eq('is_active', true)
    .order('name')

  const { data: currenciesRaw } = await supabase
    .from('currencies')
    .select('*')
    .order('code')

  const { data: exchangeRatesRaw } = await supabase
    .from('exchange_rates')
    .select('*')
    .order('effective_date', { ascending: false })
    .limit(50)

  const { data: unitsRaw } = await supabase
    .from('budget_units')
    .select('*')
    .order('name_fr')

  const { data: rubricsRaw } = await supabase
    .from('budget_rubrics')
    .select('*')
    .order('name_fr')

  return (
    <SettingsClient
      fiscalYears={(fiscalYearsRaw ?? []) as Record<string, unknown>[]}
      organizations={(orgsRaw ?? []) as Array<{ id: string; name: string; code: string; level: string }>}
      currencies={(currenciesRaw ?? []) as Record<string, unknown>[]}
      exchangeRates={(exchangeRatesRaw ?? []) as Record<string, unknown>[]}
      units={(unitsRaw ?? []) as Record<string, unknown>[]}
      rubrics={(rubricsRaw ?? []) as Record<string, unknown>[]}
    />
  )
}
