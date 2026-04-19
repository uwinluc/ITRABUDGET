'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, Plus, Calendar, CheckCircle2, XCircle, Clock,
  Building2, Vote, Eye, Loader2, AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { formatDate, cn } from '@/lib/utils'

const DECISION_CONFIG: Record<string, { label: string; color: string }> = {
  approve: { label: 'Approuvé',  color: 'bg-green-100 text-green-700' },
  reject:  { label: 'Rejeté',   color: 'bg-red-100 text-red-700' },
  abstain: { label: 'Abstention', color: 'bg-gray-100 text-gray-600' },
}

interface Props {
  sessions: Record<string, unknown>[]
  organizations: Array<{ id: string; name: string; code: string; level: string }>
  members: Array<{ id: string; organization_id: string; user_id: string; role: string; is_active: boolean }>
  budgets: Array<{ id: string; title: string; status: string }>
  votes: Array<{ session_id: string; decision: string }>
  currentUserId: string
  currentUserRoles: string[]
}

export function CopilClient({
  sessions, organizations, members, budgets, votes,
  currentUserId, currentUserRoles
}: Props) {
  const router = useRouter()
  const [filterOrg, setFilterOrg] = useState<string>('all')
  const [createDialog, setCreateDialog] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    organization_id: '',
    budget_id: '',
    session_date: '',
    notes: '',
  })

  // Organisations pour lesquelles l'utilisateur peut convoquer (DG filiale ou admin)
  const canConvene = currentUserRoles.some(r => ['admin', 'dg_holding', 'dg_subsidiary'].includes(r))

  // Budgets disponibles pour les sessions (filtrés par org et non encore en COPIL)
  const [availableBudgets, setAvailableBudgets] = useState<typeof budgets>([])

  const loadBudgetsForOrg = async (orgId: string) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('budgets')
      .select('id, title, status')
      .eq('organization_id', orgId)
      .in('status', ['approved', 'under_review', 'submitted'])
      .order('created_at', { ascending: false })
    setAvailableBudgets((data ?? []) as typeof budgets)
  }

  const handleOrgChange = (orgId: string) => {
    setForm(f => ({ ...f, organization_id: orgId, budget_id: '' }))
    if (orgId) loadBudgetsForOrg(orgId)
  }

  const filteredSessions = filterOrg === 'all'
    ? sessions
    : sessions.filter(s => s.organization_id === filterOrg)

  const getVoteCount = (sessionId: string) => {
    const sessionVotes = votes.filter(v => v.session_id === sessionId)
    return {
      approve: sessionVotes.filter(v => v.decision === 'approve').length,
      reject:  sessionVotes.filter(v => v.decision === 'reject').length,
      abstain: sessionVotes.filter(v => v.decision === 'abstain').length,
      total:   sessionVotes.length,
    }
  }

  const getMemberCount = (orgId: string) =>
    members.filter(m => m.organization_id === orgId && m.is_active).length

  const getOrgName = (orgId: string) =>
    organizations.find(o => o.id === orgId)?.name ?? 'Organisation inconnue'

  const getBudgetTitle = (budgetId: string) =>
    budgets.find(b => b.id === budgetId)?.title ?? 'Budget inconnu'

  const handleCreate = async () => {
    if (!form.organization_id || !form.budget_id) {
      toast.error('Organisation et budget requis')
      return
    }

    setLoading(true)
    const supabase = createClient()
    try {
      // Récupérer l'exercice fiscal du budget
      const { data: budget } = await supabase
        .from('budgets')
        .select('fiscal_year_id')
        .eq('id', form.budget_id)
        .single()

      const { error } = await supabase.from('copil_sessions').insert({
        organization_id: form.organization_id,
        budget_id: form.budget_id,
        fiscal_year_id: (budget as Record<string, unknown> | null)?.fiscal_year_id ?? '',
        convened_by: currentUserId,
        session_date: form.session_date || null,
        notes: form.notes || null,
        quorum_met: false,
      })

      if (error) throw error

      toast.success('Session COPIL créée')
      setCreateDialog(false)
      setForm({ organization_id: '', budget_id: '', session_date: '', notes: '' })
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  // Stats globales
  const totalSessions = sessions.length
  const pendingSessions = sessions.filter(s => !s.final_decision).length
  const approvedSessions = sessions.filter(s => s.final_decision === 'approve').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Sessions COPIL
          </h1>
          <p className="text-muted-foreground mt-1">
            Comités de Pilotage — Validation finale des budgets
          </p>
        </div>
        {canConvene && (
          <Button onClick={() => setCreateDialog(true)}>
            <Plus className="h-4 w-4" />
            Convoquer COPIL
          </Button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalSessions}</div>
            <p className="text-xs text-muted-foreground mt-1">Total sessions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">{pendingSessions}</div>
            <p className="text-xs text-muted-foreground mt-1">En attente de décision</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{approvedSessions}</div>
            <p className="text-xs text-muted-foreground mt-1">Budgets approuvés</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtre org */}
      {organizations.length > 1 && (
        <div className="flex items-center gap-3">
          <Label className="text-sm text-muted-foreground shrink-0">Filiale :</Label>
          <Select value={filterOrg} onValueChange={setFilterOrg}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les filiales</SelectItem>
              {organizations.map(o => (
                <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Liste des sessions */}
      {filteredSessions.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Vote className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Aucune session COPIL</p>
            {canConvene && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setCreateDialog(true)}
              >
                <Plus className="h-4 w-4" />
                Convoquer la première session
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredSessions.map(session => {
            const vc = getVoteCount(session.id as string)
            const memberCount = getMemberCount(session.organization_id as string)
            const quorumThreshold = Math.ceil(memberCount / 2)
            const hasQuorum = vc.total >= quorumThreshold

            return (
              <Card key={session.id as string} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{getBudgetTitle(session.budget_id as string)}</span>
                        {session.final_decision ? (
                          <span className={cn(
                            'text-xs px-2 py-0.5 rounded-full font-medium',
                            DECISION_CONFIG[session.final_decision as string]?.color
                          )}>
                            {DECISION_CONFIG[session.final_decision as string]?.label}
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-yellow-100 text-yellow-700">
                            En délibération
                          </span>
                        )}
                        {hasQuorum ? (
                          <Badge variant="outline" className="text-xs text-green-700 border-green-400">
                            Quorum atteint
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-orange-600 border-orange-400">
                            Quorum partiel
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {getOrgName(session.organization_id as string)}
                        </span>
                        {(session.session_date as string | null) && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(session.session_date as string)}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Vote className="h-3 w-3" />
                          {vc.total}/{memberCount} votes
                        </span>
                      </div>

                      {/* Barre de votes */}
                      {vc.total > 0 && (
                        <div className="flex items-center gap-3 mt-2 text-xs">
                          <div className="flex items-center gap-1 text-green-700">
                            <CheckCircle2 className="h-3 w-3" />
                            {vc.approve} pour
                          </div>
                          <div className="flex items-center gap-1 text-red-600">
                            <XCircle className="h-3 w-3" />
                            {vc.reject} contre
                          </div>
                          {vc.abstain > 0 && (
                            <div className="flex items-center gap-1 text-gray-500">
                              <Clock className="h-3 w-3" />
                              {vc.abstain} abstention{vc.abstain > 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/copil/${session.id as string}`)}
                    >
                      <Eye className="h-4 w-4" />
                      Ouvrir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Dialog création session */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Convoquer une session COPIL
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-sm text-blue-700">
                Une session COPIL est requise pour valider définitivement un budget avant verrouillage.
                Le vote doit être unanime.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Filiale <span className="text-destructive">*</span></Label>
              <Select value={form.organization_id} onValueChange={handleOrgChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une filiale..." />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map(o => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({getMemberCount(o.id)} membres)
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Budget à valider <span className="text-destructive">*</span></Label>
              <Select
                value={form.budget_id}
                onValueChange={v => setForm(f => ({ ...f, budget_id: v }))}
                disabled={!form.organization_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={form.organization_id ? 'Sélectionner un budget...' : 'Choisir une filiale d\'abord'} />
                </SelectTrigger>
                <SelectContent>
                  {availableBudgets.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">Aucun budget disponible</div>
                  ) : (
                    availableBudgets.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date de la session</Label>
              <Input
                type="datetime-local"
                value={form.session_date}
                onChange={e => setForm(f => ({ ...f, session_date: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Notes (optionnel)</Label>
              <Textarea
                placeholder="Ordre du jour, remarques..."
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(false)}>Annuler</Button>
            <Button
              disabled={loading || !form.organization_id || !form.budget_id}
              onClick={handleCreate}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Convoquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
