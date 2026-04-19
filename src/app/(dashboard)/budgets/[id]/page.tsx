import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { BudgetDetailClient } from './budget-detail-client'

export default async function BudgetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: budget } = await supabase
    .from('budgets')
    .select('*')
    .eq('id', id)
    .single()

  if (!budget) notFound()

  const [
    { data: linesRaw },
    { data: transactionsRaw },
    { data: org },
    { data: fy },
    { data: currenciesRaw },
    { data: approvalsRaw },
    { data: userRolesRaw },
  ] = await Promise.all([
    supabase.from('budget_lines').select('*').eq('budget_id', id).order('line_number'),
    supabase.from('budget_transactions').select('*').eq('budget_id', id).order('created_at'),
    supabase
      .from('organizations')
      .select('id, name, code, level, has_copil')
      .eq('id', (budget as Record<string, unknown>).organization_id as string)
      .single(),
    supabase
      .from('fiscal_years')
      .select('id, code, name, status')
      .eq('id', (budget as Record<string, unknown>).fiscal_year_id as string)
      .single(),
    supabase.from('currencies').select('code, name_fr, symbol').eq('is_active', true),
    supabase
      .from('budget_approvals')
      .select('id, step_order, step_label, required_role, approver_org_id, approver_id, decision, comment, decided_at, deadline')
      .eq('budget_id', id)
      .order('step_order'),
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user?.id ?? '')
      .eq('is_active', true),
  ])

  // Récupérer infos auteurs des transactions + approbateurs
  const authorIds = [...new Set([
    ...(transactionsRaw ?? []).map((t: Record<string, unknown>) => t.performed_by as string),
    ...(approvalsRaw ?? []).filter((a: Record<string, unknown>) => a.approver_id).map((a: Record<string, unknown>) => a.approver_id as string),
  ])]

  const { data: authors } = authorIds.length > 0
    ? await supabase.from('profiles').select('id, first_name, last_name').in('id', authorIds)
    : { data: [] }

  const currentUserRoles = (userRolesRaw ?? []).map((r: Record<string, unknown>) => r.role as string)

  return (
    <BudgetDetailClient
      budget={budget as Record<string, unknown>}
      lines={(linesRaw ?? []) as Record<string, unknown>[]}
      transactions={(transactionsRaw ?? []) as Record<string, unknown>[]}
      organization={org as Record<string, unknown> | null}
      fiscalYear={fy as Record<string, unknown> | null}
      currencies={(currenciesRaw ?? []) as Array<{ code: string; name_fr: string; symbol: string }>}
      authors={(authors ?? []) as Array<{ id: string; first_name: string; last_name: string }>}
      approvals={(approvalsRaw ?? []) as Array<{
        id: string
        step_order: number
        step_label: string
        required_role: string
        approver_org_id: string | null
        approver_id: string | null
        decision: string
        comment: string | null
        decided_at: string | null
        deadline: string | null
      }>}
      currentUserId={user?.id ?? ''}
      currentUserRoles={currentUserRoles}
    />
  )
}
