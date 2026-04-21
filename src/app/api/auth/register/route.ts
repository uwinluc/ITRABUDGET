import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({
  email:      z.string().email(),
  password:   z.string().min(8),
  first_name: z.string().min(2),
  last_name:  z.string().min(2),
})

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
  }

  const { email, password, first_name, last_name } = parsed.data

  // Client admin (service role) pour créer l'utilisateur + profil
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Créer l'utilisateur dans auth
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // confirmer directement sans email
    user_metadata: { first_name, last_name },
  })

  if (authError) {
    const msg = authError.message.includes('already registered')
      ? 'Cet email est déjà utilisé'
      : authError.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  // Créer le profil manuellement (au cas où le trigger n'existe pas)
  const { error: profileError } = await admin
    .from('profiles')
    .upsert({
      id:         authData.user.id,
      first_name,
      last_name,
    })

  if (profileError) {
    // Profil déjà créé par le trigger → pas un problème
    if (!profileError.message.includes('duplicate')) {
      console.error('[register] profile error:', profileError.message)
    }
  }

  // Connecter l'utilisateur automatiquement
  const supabase = await createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

  if (signInError) {
    return NextResponse.json({ error: 'Compte créé — connectez-vous manuellement' }, { status: 206 })
  }

  return NextResponse.json({ success: true })
}
