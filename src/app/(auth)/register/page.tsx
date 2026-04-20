'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2, Lock, Mail, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import Link from 'next/link'

const schema = z.object({
  first_name: z.string().min(2, 'Minimum 2 caractères'),
  last_name:  z.string().min(2, 'Minimum 2 caractères'),
  email:      z.string().email('Email invalide'),
  password:   z.string().min(8, 'Minimum 8 caractères'),
  confirm:    z.string(),
}).refine(d => d.password === d.confirm, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirm'],
})

type Form = z.infer<typeof schema>

export default function RegisterPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm]   = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: Form) => {
    setLoading(true)
    const supabase = createClient()
    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email:    data.email,
        password: data.password,
        options: {
          data: {
            first_name: data.first_name,
            last_name:  data.last_name,
          },
        },
      })

      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('Cet email est déjà utilisé')
        } else {
          toast.error(error.message)
        }
        return
      }

      // Créer le profil si l'utilisateur est confirmé immédiatement
      if (authData.user && !authData.user.email_confirmed_at) {
        setDone(true)
        toast.success('Vérifiez votre email pour confirmer votre compte')
      } else if (authData.user) {
        await supabase.from('profiles').upsert({
          id:         authData.user.id,
          first_name: data.first_name,
          last_name:  data.last_name,
          email:      data.email,
        })
        toast.success('Compte créé avec succès !')
        router.push('/dashboard')
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500 shadow-xl">
            <span className="text-2xl font-bold text-white">IB</span>
          </div>
          <h1 className="text-2xl font-bold text-white">ITRABUDGET</h1>
          <p className="text-slate-400 text-sm">Système de gestion budgétaire</p>
        </div>

        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
          {done ? (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-green-500/20">
                  <Mail className="h-7 w-7 text-green-400" />
                </div>
                <CardTitle className="text-white">Vérifiez votre email</CardTitle>
                <CardDescription className="text-slate-400">
                  Un lien de confirmation a été envoyé à votre adresse email.
                  Cliquez dessus pour activer votre compte.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/login">
                  <Button variant="outline" className="w-full border-slate-600 text-slate-300 hover:bg-slate-700">
                    Retour à la connexion
                  </Button>
                </Link>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle className="text-white">Créer un compte</CardTitle>
                <CardDescription className="text-slate-400">Remplissez les informations ci-dessous</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  {/* Prénom + Nom */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Prénom</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder="Jean"
                          className="pl-10 bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                          {...register('first_name')}
                        />
                      </div>
                      {errors.first_name && <p className="text-xs text-destructive">{errors.first_name.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Nom</Label>
                      <Input
                        placeholder="Dupont"
                        className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                        {...register('last_name')}
                      />
                      {errors.last_name && <p className="text-xs text-destructive">{errors.last_name.message}</p>}
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <Label className="text-slate-300">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        type="email"
                        placeholder="votre@email.com"
                        className="pl-10 bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                        {...register('email')}
                      />
                    </div>
                    {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                  </div>

                  {/* Mot de passe */}
                  <div className="space-y-2">
                    <Label className="text-slate-300">Mot de passe</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        className="pl-10 pr-10 bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                        {...register('password')}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
                  </div>

                  {/* Confirmation */}
                  <div className="space-y-2">
                    <Label className="text-slate-300">Confirmer le mot de passe</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        type={showConfirm ? 'text' : 'password'}
                        placeholder="••••••••"
                        className="pl-10 pr-10 bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                        {...register('confirm')}
                      />
                      <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300">
                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.confirm && <p className="text-xs text-destructive">{errors.confirm.message}</p>}
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Créer mon compte
                  </Button>

                  <p className="text-center text-sm text-slate-400">
                    Déjà un compte ?{' '}
                    <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium">
                      Se connecter
                    </Link>
                  </p>
                </form>
              </CardContent>
            </>
          )}
        </Card>

        <p className="text-center text-xs text-slate-600">
          © {new Date().getFullYear()} ITRABUDGET — Tous droits réservés
        </p>
      </div>
    </div>
  )
}
