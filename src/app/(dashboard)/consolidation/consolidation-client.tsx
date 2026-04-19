'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3, CheckCircle2, Clock, FileDown, Lock, Plus, TrendingUp, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { cn, formatDate } from '@/lib/utils'
import type { Consolidation, FiscalYear, IntercompanyTransaction, Organization } from '@/types/database'

interface ConsolidationWithProfile extends Consolidation {
  prepared_by_profile?: { first_name: string; last_name: string } | null
  validated_by_profile?: { first_name: string; last_name: string } | null
  fiscal_year?: { code: string; name: string } | null
}

interface Props {
  consolidations: ConsolidationWithProfile[]
  fiscalYears: Array<{ id: string; code: string; name: string }>
  organizations: Array<{ id: string; name: string; code: string }>
  intercoTransactions: IntercompanyTransaction[]
  currentUserId: string
  currentUserRoles: string[]
  budgetSummary: Array<{
    organization_id: string
    organization_name: string
    total_budget_usd: number
    total_consumed_usd: number
    budget_count: number
  }>
}

const ROLE_LABELS: Record<string, string> = {
  consolidation_officer: 'Officier de consolidation',
  dg_holding: 'DG Holding',
  dga_holding: 'DGA Holding',
  admin: 'Administrateur',
}

function formatUSD(amount: number | null): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount)
}

export function ConsolidationClient({
  consolidations,
  fiscalYears,
  organizations,
  intercoTransactions,
  currentUserId,
  currentUserRoles,
  budgetSummary,
}: Props) {
  const router = useRouter()
  const [selectedFY, setSelectedFY] = useState<string>('all')
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [newFY, setNewFY] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const canCreate = currentUserRoles.some(r => ['admin', 'consolidation_officer', 'dg_holding', 'dga_holding'].includes(r))

  const filtered = consolidations.filter(c =>
    selectedFY === 'all' || c.fiscal_year_id === selectedFY
  )

  const intercoMatched = intercoTransactions.filter(t => t.status === 'matched').length
  const intercoEliminated = intercoTransactions.filter(t => t.status === 'eliminated').length
  const intercoDisputed = intercoTransactions.filter(t => t.status === 'disputed').length

  const totalBudgetUSD = budgetSummary.reduce((s, b) => s + (b.total_budget_usd ?? 0), 0)
  const totalConsumedUSD = budgetSummary.reduce((s, b) => s + (b.total_consumed_usd ?? 0), 0)

  async function handleCreate() {
    if (!newFY) return
    setLoading(true)
    try {
      const res = await fetch('/api/consolidation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fiscal_year_id: newFY, notes }),
      })
      if (res.ok) {
        setShowNewDialog(false)
        setNewFY('')
        setNotes('')
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-orange-500" />
            Consolidation groupe
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Consolidation budgétaire multi-entités avec élimination des transactions interco
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowNewDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nouvelle consolidation
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Budget total groupe', value: formatUSD(totalBudgetUSD), icon: BarChart3, color: 'text-blue-600' },
          { label: 'Consommé total', value: formatUSD(totalConsumedUSD), icon: TrendingUp, color: 'text-green-600' },
          { label: 'Interco appariées', value: intercoMatched.toString(), icon: CheckCircle2, color: 'text-teal-600' },
          { label: 'Interco disputées', value: intercoDisputed.toString(), icon: XCircle, color: 'text-red-600' },
        ].map(card => {
          const Icon = card.icon
          return (
            <Card key={card.label}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{card.label}</p>
                    <p className={cn('text-xl font-bold mt-1', card.color)}>{card.value}</p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                    <Icon className={cn('h-5 w-5', card.color)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Budget par entité */}
      {budgetSummary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Budgets par entité</CardTitle>
            <CardDescription>Vue consolidée des budgets approuvés par organisation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {budgetSummary.map(b => {
                const pct = b.total_budget_usd > 0 ? (b.total_consumed_usd / b.total_budget_usd) * 100 : 0
                return (
                  <div key={b.organization_id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{b.organization_name}</span>
                      <span className="text-muted-foreground">
                        {formatUSD(b.total_consumed_usd)} / {formatUSD(b.total_budget_usd)}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-orange-400' : 'bg-green-500')}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{pct.toFixed(1)}% consommé · {b.budget_count} budget(s)</p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtre + liste consolidations */}
      <div className="flex items-center gap-3">
        <Select value={selectedFY} onValueChange={setSelectedFY}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Exercice fiscal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les exercices</SelectItem>
            {fiscalYears.map(fy => (
              <SelectItem key={fy.id} value={fy.id}>{fy.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filtered.length} consolidation(s)</span>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center text-muted-foreground">
            <TrendingUp className="h-12 w-12 mb-3 opacity-20" />
            <p className="font-medium">Aucune consolidation trouvée</p>
            <p className="text-sm mt-1">
              {canCreate ? 'Lancez une nouvelle consolidation pour regrouper les données du groupe.' : 'Aucune consolidation disponible pour votre profil.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <Card key={c.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={c.status === 'final' ? 'success' : 'warning'}>
                        {c.status === 'final' ? 'Final' : 'Brouillon'}
                      </Badge>
                      <span className="font-semibold text-sm">
                        Exercice: {c.fiscal_year?.name ?? c.fiscal_year_id}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Budget: <strong className="text-foreground">{formatUSD(c.total_budget_usd)}</strong></span>
                      <span>Consommé: <strong className="text-foreground">{formatUSD(c.total_consumed_usd)}</strong></span>
                      <span>Interco éliminé: <strong className="text-foreground">{formatUSD(c.interco_eliminated)}</strong></span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Préparé par {c.prepared_by_profile ? `${c.prepared_by_profile.first_name} ${c.prepared_by_profile.last_name}` : '—'} · {formatDate(c.prepared_at)}
                      {c.validated_by_profile && (
                        <span> · Validé par {c.validated_by_profile.first_name} {c.validated_by_profile.last_name} le {formatDate(c.validated_at!)}</span>
                      )}
                    </div>
                    {c.notes && <p className="text-xs italic text-muted-foreground">{c.notes}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" className="gap-1">
                      <FileDown className="h-3.5 w-3.5" />
                      Export
                    </Button>
                    {c.status === 'draft' && canCreate && (
                      <Button size="sm" variant="default" className="gap-1">
                        <Lock className="h-3.5 w-3.5" />
                        Finaliser
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Transactions interco */}
      {intercoTransactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Transactions intercompagnies</CardTitle>
            <CardDescription>Statut des transactions entre entités du groupe</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'En attente', count: intercoTransactions.filter(t => t.status === 'pending').length, color: 'bg-yellow-100 text-yellow-800' },
                { label: 'Appariées', count: intercoMatched, color: 'bg-teal-100 text-teal-800' },
                { label: 'Éliminées', count: intercoEliminated, color: 'bg-green-100 text-green-800' },
                { label: 'Disputées', count: intercoDisputed, color: 'bg-red-100 text-red-800' },
              ].map(s => (
                <div key={s.label} className={cn('rounded-lg px-4 py-3 text-center', s.color)}>
                  <p className="text-2xl font-bold">{s.count}</p>
                  <p className="text-xs font-medium mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog nouvelle consolidation */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle consolidation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Exercice fiscal *</Label>
              <Select value={newFY} onValueChange={setNewFY}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un exercice" />
                </SelectTrigger>
                <SelectContent>
                  {fiscalYears.map(fy => (
                    <SelectItem key={fy.id} value={fy.id}>{fy.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Observations ou contexte..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={!newFY || loading}>
              {loading ? 'Création...' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
