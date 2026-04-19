import { createClient } from '@/lib/supabase/server'
import { TransactionsClient } from './transactions-client'

export default async function TransactionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: txRaw },
    { data: orgsRaw },
    { data: userRolesRaw },
  ] = await Promise.all([
    supabase
      .from('budget_transactions')
      .select('*, profile:profiles(first_name, last_name), organization:organizations(name, code), budget:budgets(title)')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase.from('organizations').select('id, name, code').eq('is_active', true).order('name'),
    supabase.from('user_roles').select('role').eq('user_id', user?.id ?? '').eq('is_active', true),
  ])

  const currentUserRoles = (userRolesRaw ?? []).map((r: Record<string, unknown>) => r.role as string)

  return (
    <TransactionsClient
      transactions={(txRaw ?? []) as Parameters<typeof TransactionsClient>[0]['transactions']}
      organizations={(orgsRaw ?? []) as Array<{ id: string; name: string; code: string }>}
      currentUserRoles={currentUserRoles}
    />
  )
}
