import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({
  first_name: z.string(),
  last_name: z.string(),
  email: z.string().email(),
  phone: z.string().optional(),
  preferred_language: z.enum(['fr', 'en', 'pt']).default('fr'),
  roles: z.array(z.object({ role: z.string(), organization_id: z.string() })),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const data = schema.parse(body)

    const supabase = await createAdminClient()

    // Créer l'utilisateur dans Supabase Auth avec invitation
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: data.email,
      email_confirm: false,
      user_metadata: { first_name: data.first_name, last_name: data.last_name },
    })

    if (authError) throw authError

    // Mettre à jour le profil
    await supabase.from('profiles').update({
      first_name: data.first_name,
      last_name: data.last_name,
      phone: data.phone || null,
      preferred_language: data.preferred_language,
    }).eq('id', authUser.user.id)

    // Assigner les rôles
    if (data.roles.length > 0) {
      await supabase.from('user_roles').insert(
        data.roles.map(r => ({
          user_id: authUser.user.id,
          role: r.role,
          organization_id: r.organization_id,
          is_active: true,
        }))
      )
    }

    // Envoyer invitation par email
    await supabase.auth.admin.inviteUserByEmail(data.email, {
      data: { first_name: data.first_name, last_name: data.last_name },
    })

    return NextResponse.json({ success: true, user_id: authUser.user.id })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erreur inconnue'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
