import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const code = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = Date.now() + 10 * 60 * 1000

  const cookieStore = await cookies()
  cookieStore.set('2fa_code', JSON.stringify({ code, expiresAt, userId: user.id }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
    sameSite: 'lax',
  })

  if (resend && user.email) {
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'ITRABUDGET <noreply@itrabudget.com>',
      to: user.email,
      subject: 'Code de vérification ITRABUDGET',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
          <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
            <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700">ITRABUDGET</h1>
            <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px">Gestion budgétaire</p>
          </div>
          <h2 style="font-size:18px;color:#1e293b;margin-bottom:8px">Code de vérification</h2>
          <p style="color:#64748b;font-size:14px;margin-bottom:24px">
            Utilisez ce code pour vous connecter. Il expire dans <strong>10 minutes</strong>.
          </p>
          <div style="background:#f1f5f9;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
            <span style="font-size:36px;font-weight:800;letter-spacing:12px;color:#6366f1">${code}</span>
          </div>
          <p style="color:#94a3b8;font-size:12px;text-align:center">
            Si vous n'avez pas demandé ce code, ignorez cet email.
          </p>
        </div>
      `,
    })
    if (error) {
      console.error('[2FA] Resend error:', error)
      return NextResponse.json({ error: 'Échec envoi email' }, { status: 500 })
    }
  } else if (process.env.NODE_ENV === 'development') {
    console.log(`[2FA DEV] Code pour ${user.email}: ${code}`)
  }

  return NextResponse.json({ success: true })
}
