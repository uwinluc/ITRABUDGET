'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Users, CalendarDays, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn, formatDate } from '@/lib/utils'
import type { Delegation, UserRole } from '@/types/database'

interface DelegationEnriched extends Delegation {
  delegator_profile?: { first_name: string; last_name: string } | null
  delegate_profile?: { first_name: string; last_name: string } | null
  organization?: { name: string; code: string } | null
}

interface Props {
  delegations: DelegationEnriched[]
  users: Array<{ id: string; first_name: string; last_name: string; email?: string }>
  organizations: Array<{ id: string; name: string; code: string }>
  currentUserId: string
  currentUserRoles: string[]
  currentUserOrgIds: string[]
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

const DELEGABLE_ROLES: UserRole[] = [
  'dg_holding', 'dga_holding', 'dg_subsidiary', 'dga_subsidiary', 'director', 'service_chief',
]

function DelegationStatusBadge({ d }: { d: DelegationEnriched }) {
  const now = new Date()
  const from = new Date(d.valid_from)
  const until = new Date(d.valid_until)
  if (!d.is_active) return <Badge variant="secondary">Révoquée</Badge>
  if (until < now) return <Badge variant="destructive">Expirée</Badge>
  if (from > now) return <Badge variant="info">À venir</Badge>
  return <Badge variant="success">Active</Badge>
}

export function DelegationsClient({
  delegations,
  users,
  organizations,
  currentUserId,
  currentUserRoles,
}: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'all' | 'given' | 'received'>('all')
  const [showDialog, setShowDialog] = useState(false)
  const [form, setForm] = useState({
    delegate_id: '',
    role: '' as UserRole | '',
    organization_id: '',
    reason: '',
    valid_from: new Date().toISOString().slice(0, 10),
    valid_until: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const canCreate = currentUserRoles.some(r =>
    ['admin', 'dg_holding', 'dga_holding', 'dg_subsidiary', 'dga_subsidiary', 'director'].includes(r)
  )

  const filtered = delegations.filter(d => {
    if (tab === 'given') return d.delegator_id === currentUserId
    if (tab === 'received') return d.delegate_id === currentUserId
    return true
  })

  const activeCount = delegations.filter(d => {
    if (!d.is_active) return false
    const now = new Date()
    return new Date(d.valid_from) <= now && new Date(d.valid_until) >= now
  }).length

  async function handleCreate() {
    setError('')
    if (!form.delegate_id || !form.role || !form.organization_id || !form.valid_from || !form.valid_until || !form.reason) {
      setError('Tous les champs sont requis.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/delegations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Erreur lors de la création.')
      } else {
        setShowDialog(false)
        setForm({ delegate_id: '', role: '', organization_id: '', reason: '', valid_from: new Date().toISOString().slice(0, 10), valid_until: '' })
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  async function revokeDelegate(id: string) {
    try {
      const res = await fetch(`/api/delegations/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? 'Erreur lors de la révocation')
        return
      }
      toast.success('Délégation révoquée')
      router.refresh()
    } catch {
      toast.error('Erreur réseau — réessayez')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-violet-500" />
            Délégations
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestion des délégations temporaires de rôles et de signatures
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nouvelle délégation
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total délégations', value: delegations.length, icon: Users, color: 'text-violet-600' },
          { label: 'Actives maintenant', value: activeCount, icon: CheckCircle2, color: 'text-green-600' },
          { label: 'Données par moi', value: delegations.filter(d => d.delegator_id === currentUserId).length, icon: CalendarDays, color: 'text-blue-600' },
        ].map(s => {
          const Icon = s.icon
          return (
            <Card key={s.label}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    <Icon className={cn('h-5 w-5', s.color)} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(['all', 'given', 'received'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t === 'all' ? 'Toutes' : t === 'given' ? 'Données par moi' : 'Reçues par moi'}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center text-muted-foreground">
            <Users className="h-12 w-12 mb-3 opacity-20" />
            <p className="font-medium">Aucune délégation trouvée</p>
            {canCreate && (
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setShowDialog(true)}>
                Créer une délégation
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(d => {
            const isOwner = d.delegator_id === currentUserId
            const canRevoke = (isOwner || currentUserRoles.includes('admin')) && d.is_active

            return (
              <Card key={d.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <DelegationStatusBadge d={d} />
                        <Badge variant="outline">{ROLE_LABELS[d.role] ?? d.role}</Badge>
                        {d.organization && (
                          <Badge variant="secondary">{d.organization.name}</Badge>
                        )}
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">De </span>
                        <strong>{d.delegator_profile ? `${d.delegator_profile.first_name} ${d.delegator_profile.last_name}` : d.delegator_id}</strong>
                        <span className="text-muted-foreground"> → </span>
                        <strong>{d.delegate_profile ? `${d.delegate_profile.first_name} ${d.delegate_profile.last_name}` : d.delegate_id}</strong>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        Du {formatDate(d.valid_from)} au {formatDate(d.valid_until)}
                      </div>
                      {d.reason && (
                        <p className="text-xs text-muted-foreground italic">{d.reason}</p>
                      )}
                    </div>
                    {canRevoke && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-red-600 hover:text-red-700 hover:border-red-300"
                        onClick={() => revokeDelegate(d.id)}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Révoquer
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle délégation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded p-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Délégué *</Label>
              <Select value={form.delegate_id} onValueChange={v => setForm(f => ({ ...f, delegate_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un utilisateur" />
                </SelectTrigger>
                <SelectContent>
                  {users.filter(u => u.id !== currentUserId).map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.first_name} {u.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Rôle délégué *</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as UserRole }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Rôle à déléguer" />
                </SelectTrigger>
                <SelectContent>
                  {DELEGABLE_ROLES.map(r => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r] ?? r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Organisation *</Label>
              <Select value={form.organization_id} onValueChange={v => setForm(f => ({ ...f, organization_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Organisation concernée" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Début *</Label>
                <Input
                  type="date"
                  value={form.valid_from}
                  onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Fin *</Label>
                <Input
                  type="date"
                  value={form.valid_until}
                  onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Motif *</Label>
              <Textarea
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="Ex: Congé annuel, mission à l'étranger..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={loading}>
              {loading ? 'Création...' : 'Créer la délégation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
