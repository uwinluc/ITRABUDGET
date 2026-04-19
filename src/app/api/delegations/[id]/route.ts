import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id } = await params

  const { data: del } = await supabase.from('delegations').select('delegator_id').eq('id', id).single()
  if (!del) return NextResponse.json({ error: 'Délégation introuvable.' }, { status: 404 })

  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('is_active', true)
  const isAdmin = (roles ?? []).some((r: Record<string, string>) => r.role === 'admin')

  if (del.delegator_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })
  }

  const { error } = await supabase.from('delegations').update({ is_active: false }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
