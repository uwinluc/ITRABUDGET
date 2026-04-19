import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await request.json()
  const { delegate_id, role, organization_id, reason, valid_from, valid_until } = body

  if (!delegate_id || !role || !organization_id || !reason || !valid_from || !valid_until) {
    return NextResponse.json({ error: 'Tous les champs sont requis.' }, { status: 400 })
  }

  if (delegate_id === user.id) {
    return NextResponse.json({ error: 'Vous ne pouvez pas vous déléguer à vous-même.' }, { status: 400 })
  }

  const { error } = await supabase.from('delegations').insert({
    delegator_id: user.id,
    delegate_id,
    role,
    organization_id,
    reason,
    valid_from,
    valid_until,
    is_active: true,
    created_by: user.id,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
