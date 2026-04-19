import { createClient } from '@/lib/supabase/server'
import { IntercompanyClient } from './intercompany-client'

export default async function IntercompanyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: txRaw },
    { data: orgsRaw },
    { data: fyRaw },
    { data: userRolesRaw },
    { data: linesRaw },
    { data: currenciesRaw },
  ] = await Promise.all([
    supabase
      .from('intercompany_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('organizations').select('id, name, code, level').eq('is_active', true).order('name'),
    supabase.from('fiscal_years').select('id, code, name').eq('status', 'active').order('start_date', { ascending: false }),
    supabase.from('user_roles').select('role, organization_id').eq('user_id', user?.id ?? '').eq('is_active', true),
    supabase.from('budget_lines').select('id, title, budget_id').order('title').limit(500),
    supabase.from('currencies').select('code, name_fr, symbol').eq('is_active', true).order('code'),
  ])

  const userOrgIds = (userRolesRaw ?? []).map((r: Record<string, unknown>) => r.organization_id as string)
  const currentUserRoles = (userRolesRaw ?? []).map((r: Record<string, unknown>) => r.role as string)

  return (
    <IntercompanyClient
      transactions={(txRaw ?? []) as Record<string, unknown>[]}
      organizations={(orgsRaw ?? []) as Array<{ id: string; name: string; code: string; level: string }>}
      fiscalYears={(fyRaw ?? []) as Array<{ id: string; code: string; name: string }>}
      budgetLines={(linesRaw ?? []) as Array<{ id: string; title: string; budget_id: string }>}
      currencies={(currenciesRaw ?? []) as Array<{ code: string; name_fr: string; symbol: string }>}
      currentUserId={user?.id ?? ''}
      currentUserRoles={currentUserRoles}
      currentUserOrgIds={userOrgIds}
    />
  )
}
