import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('is_active', true)
  const allowed = ['admin', 'consolidation_officer', 'dg_holding', 'dga_holding']
  const hasRole = (roles ?? []).some((r: Record<string, string>) => allowed.includes(r.role))
  if (!hasRole) return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })

  const { fiscal_year_id, notes } = await request.json()
  if (!fiscal_year_id) return NextResponse.json({ error: 'Exercice fiscal requis.' }, { status: 400 })

  const { error } = await supabase.from('consolidations').insert({
    fiscal_year_id,
    reference_currency: 'USD',
    status: 'draft',
    prepared_by: user.id,
    notes: notes ?? null,
    prepared_at: new Date().toISOString(),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
