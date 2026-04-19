import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const { code } = await request.json()
  const cookieStore = await cookies()
  const stored = cookieStore.get('2fa_code')?.value

  if (!stored) return NextResponse.json({ error: 'Code expiré' }, { status: 400 })

  const { code: storedCode, expiresAt } = JSON.parse(stored)

  if (Date.now() > expiresAt) {
    cookieStore.delete('2fa_code')
    return NextResponse.json({ error: 'Code expiré' }, { status: 400 })
  }

  if (code !== storedCode) {
    return NextResponse.json({ error: 'Code incorrect' }, { status: 400 })
  }

  cookieStore.delete('2fa_code')

  // Mettre à jour last_login_at
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    await supabase.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', user.id)
  }

  return NextResponse.json({ success: true })
}
