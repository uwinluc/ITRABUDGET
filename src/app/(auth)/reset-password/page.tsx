'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Loader2, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import Link from 'next/link'

const schema = z.object({ email: z.string().email('Email invalide') })
type Form = z.infer<typeof schema>

export default function ResetPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: Form) => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/update-password`,
      })
      if (error) { toast.error('Erreur lors de l\'envoi'); return }
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500 shadow-xl">
            <span className="text-2xl font-bold text-white">IB</span>
          </div>
          <h1 className="text-2xl font-bold text-white">ITRABUDGET</h1>
        </div>

        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-white">Réinitialisation</CardTitle>
            <CardDescription className="text-slate-400">
              {sent ? 'Email envoyé avec succès' : 'Saisissez votre adresse email'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="space-y-4 text-center">
                <div className="flex justify-center">
                  <div className="h-16 w-16 rounded-full bg-green-900/50 flex items-center justify-center">
                    <Mail className="h-8 w-8 text-green-400" />
                  </div>
                </div>
                <p className="text-slate-300 text-sm">
                  Un lien de réinitialisation a été envoyé. Vérifiez votre boîte email.
                </p>
                <Link href="/login">
                  <Button variant="outline" className="w-full border-slate-600 text-slate-300">
                    <ArrowLeft className="h-4 w-4" />
                    Retour à la connexion
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Envoyer le lien
                </Button>

                <Link href="/login">
                  <Button variant="ghost" className="w-full text-slate-400">
                    <ArrowLeft className="h-4 w-4" />
                    Retour
                  </Button>
                </Link>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
