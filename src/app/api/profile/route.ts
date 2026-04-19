import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await request.json()
  const allowed = ['first_name', 'last_name', 'phone', 'preferred_language', 'notification_email', 'notification_sms', 'notification_in_app', 'theme']
  const update = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)))

  const { error } = await supabase.from('profiles').update(update).eq('id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
