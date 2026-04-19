import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // Générer code 6 chiffres
  const code = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = Date.now() + 10 * 60 * 1000 // 10 minutes

  // Stocker en cookie sécurisé (en prod, utiliser Redis ou DB)
  const cookieStore = await cookies()
  cookieStore.set('2fa_code', JSON.stringify({ code, expiresAt, userId: user.id }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
    sameSite: 'lax',
  })

  // TODO: Envoyer via Resend (email) ou AT (SMS)
  // En développement, on log le code
  if (process.env.NODE_ENV === 'development') {
    console.log(`[2FA DEV] Code pour ${user.email}: ${code}`)
  }

  return NextResponse.json({ success: true })
}
