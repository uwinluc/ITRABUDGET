'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, Bell, Shield, Key, Save, AlertCircle, CheckCircle2, Building2, Mail, Phone } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { Profile, UserRoleRow } from '@/types/database'

interface Props {
  profile: Profile | null
  email: string
  userRoles: Array<UserRoleRow & { organization?: { name: string; code: string } | null }>
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrateur',
  dg_holding: 'DG Holding',
  dga_holding: 'DGA Holding',
  consolidation_officer: 'Officier de consolidation',
  legal_officer: 'Officier juridique',
  audit_director: 'Directeur audit',
  dg_subsidiary: 'DG Filiale',
  dga_subsidiary: 'DGA Filiale',
  director: 'Directeur',
  service_chief: 'Chef de service',
  copil_president: 'Président COPIL',
  copil_member: 'Membre COPIL',
}

const LANG_OPTIONS = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
  { value: 'pt', label: 'Português' },
]

export function ProfileClient({ profile, email, userRoles }: Props) {
  const router = useRouter()
  const [form, setForm] = useState({
    first_name: profile?.first_name ?? '',
    last_name: profile?.last_name ?? '',
    phone: profile?.phone ?? '',
    preferred_language: profile?.preferred_language ?? 'fr',
    notification_email: profile?.notification_email ?? true,
    notification_sms: profile?.notification_sms ?? false,
    notification_in_app: profile?.notification_in_app ?? true,
    theme: profile?.theme ?? 'light',
  })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSaved, setPwSaved] = useState(false)

  async function handleSave() {
    setError('')
    setSaved(false)
    if (!form.first_name || !form.last_name) {
      setError('Le prénom et le nom sont requis.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setSaved(true)
        router.refresh()
        setTimeout(() => setSaved(false), 3000)
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Erreur lors de la sauvegarde.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handlePasswordChange() {
    setPwError('')
    setPwSaved(false)
    if (!pwForm.current || !pwForm.next) {
      setPwError('Tous les champs sont requis.')
      return
    }
    if (pwForm.next !== pwForm.confirm) {
      setPwError('Les mots de passe ne correspondent pas.')
      return
    }
    if (pwForm.next.length < 8) {
      setPwError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    setPwLoading(true)
    try {
      const res = await fetch('/api/profile/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: pwForm.current, new_password: pwForm.next }),
      })
      if (res.ok) {
        setPwSaved(true)
        setPwForm({ current: '', next: '', confirm: '' })
        setTimeout(() => setPwSaved(false), 3000)
      } else {
        const data = await res.json().catch(() => ({}))
        setPwError(data.error ?? 'Erreur lors du changement de mot de passe.')
      }
    } finally {
      setPwLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <User className="h-6 w-6 text-blue-500" />
          Mon profil
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gérez vos informations personnelles et vos préférences
        </p>
      </div>

      {/* Informations personnelles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Informations personnelles
          </CardTitle>
          <CardDescription>Votre identité dans la plateforme</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950 rounded p-3">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          {saved && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 dark:bg-green-950 rounded p-3">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Profil mis à jour avec succès.
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Prénom *</Label>
              <Input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Nom *</Label>
              <Input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />Email</Label>
            <Input value={email} disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground">L'email ne peut pas être modifié ici.</p>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />Téléphone</Label>
            <Input
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="+243 ..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Langue préférée</Label>
              <Select value={form.preferred_language} onValueChange={v => setForm(f => ({ ...f, preferred_language: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANG_OPTIONS.map(l => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Thème</Label>
              <Select value={form.theme} onValueChange={v => setForm(f => ({ ...f, theme: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Clair</SelectItem>
                  <SelectItem value="dark">Sombre</SelectItem>
                  <SelectItem value="system">Système</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={loading} className="gap-2">
              <Save className="h-4 w-4" />
              {loading ? 'Sauvegarde...' : 'Sauvegarder'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Préférences de notification
          </CardTitle>
          <CardDescription>Choisissez comment vous souhaitez être notifié</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: 'notification_email' as const, label: 'Email', desc: 'Recevoir les alertes par email' },
            { key: 'notification_sms' as const, label: 'SMS', desc: 'Recevoir les alertes par SMS' },
            { key: 'notification_in_app' as const, label: 'In-app', desc: 'Notifications dans la plateforme' },
          ].map(n => (
            <div key={n.key} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{n.label}</p>
                <p className="text-xs text-muted-foreground">{n.desc}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form[n.key]}
                onClick={() => setForm(f => ({ ...f, [n.key]: !f[n.key] }))}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none',
                  form[n.key] ? 'bg-primary' : 'bg-input'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                    form[n.key] ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>
          ))}
          <div className="flex justify-end pt-1">
            <Button onClick={handleSave} disabled={loading} variant="outline" size="sm" className="gap-2">
              <Save className="h-3.5 w-3.5" />
              Sauvegarder les préférences
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Rôles & organisations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Rôles et organisations
          </CardTitle>
          <CardDescription>Vos droits d'accès dans la plateforme (lecture seule)</CardDescription>
        </CardHeader>
        <CardContent>
          {userRoles.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun rôle assigné.</p>
          ) : (
            <div className="space-y-2">
              {userRoles.map(r => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge variant={r.is_active ? 'default' : 'secondary'}>
                      {ROLE_LABELS[r.role] ?? r.role}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {r.organization?.name ?? r.organization_id}
                    </span>
                  </div>
                  <span className={cn('text-xs', r.is_active ? 'text-green-600' : 'text-muted-foreground')}>
                    {r.is_active ? 'Actif' : 'Inactif'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Changer mot de passe */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" />
            Changer le mot de passe
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {pwError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950 rounded p-3">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {pwError}
            </div>
          )}
          {pwSaved && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 dark:bg-green-950 rounded p-3">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Mot de passe changé avec succès.
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Mot de passe actuel</Label>
            <Input type="password" value={pwForm.current} onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nouveau mot de passe</Label>
              <Input type="password" value={pwForm.next} onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Confirmer</Label>
              <Input type="password" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handlePasswordChange} disabled={pwLoading} variant="outline" className="gap-2">
              <Key className="h-4 w-4" />
              {pwLoading ? 'Changement...' : 'Changer le mot de passe'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sécurité 2FA */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Authentification à deux facteurs
          </CardTitle>
          <CardDescription>Renforcez la sécurité de votre compte avec le 2FA</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                Statut: {' '}
                <span className={profile?.two_factor_enabled ? 'text-green-600' : 'text-muted-foreground'}>
                  {profile?.two_factor_enabled ? '✓ Activé' : 'Désactivé'}
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {profile?.two_factor_enabled
                  ? 'Votre compte est protégé par le 2FA.'
                  : 'Activez le 2FA pour une meilleure sécurité.'}
              </p>
            </div>
            <Button variant="outline" size="sm" disabled>
              {profile?.two_factor_enabled ? 'Désactiver' : 'Activer'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
