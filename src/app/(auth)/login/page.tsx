'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Minimum 6 caractères'),
})
type LoginForm = z.infer<typeof loginSchema>

const twoFaSchema = z.object({
  code: z.string().length(6, 'Le code doit contenir 6 chiffres').regex(/^\d+$/, 'Chiffres uniquement'),
})
type TwoFaForm = z.infer<typeof twoFaSchema>

export default function LoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<'login' | '2fa'>('login')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [, setPendingUserId] = useState<string | null>(null)

  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })
  const twoFaForm = useForm<TwoFaForm>({ resolver: zodResolver(twoFaSchema) })

  const onLogin = async (data: LoginForm) => {
    setLoading(true)
    const supabase = createClient()
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (error) { toast.error('Email ou mot de passe incorrect'); return }

      // Vérifier si 2FA est requis
      const { data: profileData } = await supabase
        .from('profiles')
        .select('two_factor_enabled')
        .eq('id', authData.user.id)
        .single()

      const profile = profileData as { two_factor_enabled: boolean } | null

      if (profile?.two_factor_enabled) {
        setPendingUserId(authData.user.id)
        // Envoyer code 2FA par email
        await fetch('/api/auth/send-2fa', { method: 'POST' })
        setStep('2fa')
        toast.info('Code de vérification envoyé à votre email')
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  const onVerify2FA = async (data: TwoFaForm) => {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: data.code }),
      })

      if (!res.ok) { toast.error('Code incorrect ou expiré'); return }

      router.push('/dashboard')
      router.refresh()
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
          {step === 'login' ? (
            <>
              <CardHeader>
                <CardTitle className="text-white">Connexion</CardTitle>
                <CardDescription className="text-slate-400">Connectez-vous à votre espace</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        type="email"
                        placeholder="votre@email.com"
                        className="pl-10 bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                        {...loginForm.register('email')}
                      />
                    </div>
                    {loginForm.formState.errors.email && (
                      <p className="text-xs text-destructive">{loginForm.formState.errors.email.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-300">Mot de passe</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        className="pl-10 pr-10 bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                        {...loginForm.register('password')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {loginForm.formState.errors.password && (
                      <p className="text-xs text-destructive">{loginForm.formState.errors.password.message}</p>
                    )}
                  </div>

                  <div className="text-right">
                    <a href="/reset-password" className="text-xs text-blue-400 hover:text-blue-300">
                      Mot de passe oublié ?
                    </a>
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Se connecter
                  </Button>
                </form>
                <p className="mt-4 text-center text-sm text-slate-400">
                  Pas de compte ?{' '}
                  <a href="/register" className="text-blue-400 hover:text-blue-300 font-medium">
                    S&apos;inscrire
                  </a>
                </p>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle className="text-white">Vérification</CardTitle>
                <CardDescription className="text-slate-400">
                  Saisissez le code à 6 chiffres envoyé à votre email
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={twoFaForm.handleSubmit(onVerify2FA)} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Code de vérification</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="000000"
                      className="text-center text-2xl tracking-[0.5em] bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 h-14"
                      {...twoFaForm.register('code')}
                    />
                    {twoFaForm.formState.errors.code && (
                      <p className="text-xs text-destructive">{twoFaForm.formState.errors.code.message}</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Vérifier
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-slate-400"
                    onClick={() => setStep('login')}
                  >
                    Retour
                  </Button>
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
