'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Send, Lock, XCircle, CheckCircle2, AlertCircle,
  FileText, Clock, Building2, Calendar, Hash, ChevronDown, ChevronUp,
  Loader2, MessageSquare, CheckCheck, Circle, MinusCircle, Users,
  Download, Printer
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { formatDate, cn } from '@/lib/utils'
import { exportBudgetLinesToExcel } from '@/lib/excel'

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:        { label: 'Brouillon',   color: 'bg-gray-100 text-gray-700' },
  submitted:    { label: 'Soumis',      color: 'bg-blue-100 text-blue-700' },
  under_review: { label: 'En révision', color: 'bg-yellow-100 text-yellow-700' },
  approved:     { label: 'Approuvé',    color: 'bg-green-100 text-green-700' },
  rejected:     { label: 'Rejeté',      color: 'bg-red-100 text-red-700' },
  locked:       { label: 'Verrouillé',  color: 'bg-purple-100 text-purple-700' },
  transmitted:  { label: 'Transmis',    color: 'bg-indigo-100 text-indigo-700' },
  consolidated: { label: 'Consolidé',   color: 'bg-teal-100 text-teal-700' },
  final:        { label: 'Final',       color: 'bg-emerald-100 text-emerald-700' },
}

const TRANSACTION_LABELS: Record<string, string> = {
  creation:      '📝 Budget créé',
  submission:    '📤 Budget soumis',
  validation:    '✅ Budget validé',
  rejection:     '❌ Budget rejeté',
  adjustment:    '✏️ Ajustement',
  locking:       '🔒 Budget verrouillé',
  transmission:  '📨 Transmis à la Holding',
  consolidation: '🔗 Consolidé',
  amendment:     '📋 Avenant',
  transfer:      '↔️ Virement budgétaire',
}

const CATEGORY_LABELS: Record<string, string> = {
  operating: 'Fonctionnement',
  investment: 'Investissement',
  revenue: 'Recette',
  project: 'Projet',
  other: 'Autre',
}

const ROLE_LABELS: Record<string, string> = {
  admin:               'Administrateur',
  dg_holding:          'DG Holding',
  dga_holding:         'DGA Holding',
  consolidation_officer: 'Responsable Consolidation',
  legal_officer:       'Juriste',
  audit_director:      'Directeur Audit',
  dg_subsidiary:       'DG Filiale',
  dga_subsidiary:      'DGA Filiale',
  director:            'Directeur',
  service_chief:       'Chef de Service',
  copil_president:     'Président COPIL',
  copil_member:        'Membre COPIL',
}

interface ApprovalStep {
  id: string
  step_order: number
  step_label: string
  required_role: string
  approver_org_id: string | null
  approver_id: string | null
  decision: string
  comment: string | null
  decided_at: string | null
  deadline: string | null
}

interface Props {
  budget: Record<string, unknown>
  lines: Record<string, unknown>[]
  transactions: Record<string, unknown>[]
  organization: Record<string, unknown> | null
  fiscalYear: Record<string, unknown> | null
  currencies: Array<{ code: string; name_fr: string; symbol: string }>
  authors: Array<{ id: string; first_name: string; last_name: string }>
  approvals: ApprovalStep[]
  currentUserId: string
  currentUserRoles: string[]
}

type SimpleAction = 'submit' | 'lock' | 'transmit'
type ApprovalAction = 'approve' | 'reject'
type ActionDialog = SimpleAction | ApprovalAction

export function BudgetDetailClient({
  budget, lines, transactions, organization, fiscalYear,
  authors, approvals, currentUserId, currentUserRoles
}: Props) {
  const router = useRouter()
  const [expandedLines, setExpandedLines] = useState<Record<number, boolean>>({})
  const [actionDialog, setActionDialog] = useState<ActionDialog | null>(null)
  const [activeApprovalId, setActiveApprovalId] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)

  const status = budget.status as string
  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft
  const budgetId = budget.id as string

  // Identifier l'étape en attente que cet utilisateur peut traiter
  const sortedApprovals = [...approvals].sort((a, b) => a.step_order - b.step_order)
  const pendingSteps = sortedApprovals.filter(a => a.decision === 'pending')
  const currentStep = pendingSteps[0] ?? null
  const canActOnCurrentStep = currentStep !== null
    && currentUserRoles.includes(currentStep.required_role)
    && (status === 'submitted' || status === 'under_review')

  const getAuthorName = (userId: string) => {
    const a = authors.find(a => a.id === userId)
    return a ? `${a.first_name} ${a.last_name}` : 'Inconnu'
  }

  const totalByCategory = lines.reduce<Record<string, number>>((acc, line) => {
    const cat = line.category as string
    const amount = (line.amount_htva as number) ?? 0
    acc[cat] = (acc[cat] ?? 0) + amount
    return acc
  }, {})

  const grandTotal = lines.reduce((acc, l) => acc + ((l.amount_htva as number) ?? 0), 0)

  const callWorkflowAPI = async (
    action: string,
    opts: { approvalId?: string; comment?: string } = {}
  ) => {
    const res = await fetch(`/api/budgets/${budgetId}/workflow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, comment: opts.comment ?? null, approvalId: opts.approvalId }),
    })
    const json = await res.json() as { error?: string }
    if (!res.ok) throw new Error(json.error ?? 'Erreur serveur')
    return json
  }

  const handleSimpleAction = async (action: SimpleAction) => {
    setLoading(true)
    try {
      await callWorkflowAPI(action, { comment: comment || undefined })
      const labels: Record<SimpleAction, string> = {
        submit: 'Budget soumis au workflow',
        lock: 'Budget verrouillé',
        transmit: 'Budget transmis à la Holding',
      }
      toast.success(labels[action])
      setActionDialog(null)
      setComment('')
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  const handleApprovalAction = async (action: ApprovalAction) => {
    if (!activeApprovalId) return
    setLoading(true)
    try {
      await callWorkflowAPI(action, { approvalId: activeApprovalId, comment: comment || undefined })
      toast.success(action === 'approve' ? 'Étape approuvée' : 'Budget rejeté')
      setActionDialog(null)
      setActiveApprovalId(null)
      setComment('')
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  const openApprovalDialog = (action: ApprovalAction, approvalId: string) => {
    setActiveApprovalId(approvalId)
    setComment('')
    setActionDialog(action)
  }

  const handleExportExcel = () => {
    exportBudgetLinesToExcel(budget, lines)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">{budget.title as string}</h1>
              <span className={cn('text-sm px-2.5 py-0.5 rounded-full font-medium', statusCfg.color)}>
                {statusCfg.label}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
              {organization && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  {organization.name as string}
                </span>
              )}
              {fiscalYear && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {fiscalYear.code as string}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Hash className="h-3.5 w-3.5" />
                {lines.length} ligne{lines.length > 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatDate(budget.created_at as string)}
              </span>
            </div>
          </div>
        </div>

        {/* Actions directes */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <Download className="h-4 w-4" />
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="print:hidden">
            <Printer className="h-4 w-4" />
            Imprimer
          </Button>
          {status === 'draft' && (
            <Button size="sm" onClick={() => { setComment(''); setActionDialog('submit') }}>
              <Send className="h-4 w-4" />
              Soumettre
            </Button>
          )}
          {status === 'approved' && currentUserRoles.some(r => ['dg_subsidiary', 'dg_holding', 'admin'].includes(r)) && (
            <Button size="sm" onClick={() => { setComment(''); setActionDialog('lock') }}>
              <Lock className="h-4 w-4" />
              Verrouiller
            </Button>
          )}
          {status === 'locked' && currentUserRoles.some(r => ['dg_subsidiary', 'dg_holding', 'admin'].includes(r)) && (
            <Button size="sm" onClick={() => { setComment(''); setActionDialog('transmit') }}>
              <Send className="h-4 w-4" />
              Transmettre
            </Button>
          )}
          {canActOnCurrentStep && (
            <>
              <Button
                size="sm"
                variant="default"
                className="bg-green-600 hover:bg-green-700"
                onClick={() => openApprovalDialog('approve', currentStep.id)}
              >
                <CheckCircle2 className="h-4 w-4" />
                Approuver
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => openApprovalDialog('reject', currentStep.id)}
              >
                <XCircle className="h-4 w-4" />
                Rejeter
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne principale */}
        <div className="lg:col-span-2 space-y-4">

          {/* Panel workflow d'approbation */}
          {approvals.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Chaîne d&apos;approbation
                </CardTitle>
                <CardDescription>
                  {sortedApprovals.filter(a => a.decision === 'approved').length} / {sortedApprovals.length} étapes validées
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {sortedApprovals.map((step, idx) => {
                    const isCurrentPending = step.decision === 'pending' && idx === sortedApprovals.findIndex(s => s.decision === 'pending')
                    return (
                      <div
                        key={step.id}
                        className={cn(
                          'flex items-start gap-3 px-4 py-3',
                          isCurrentPending && 'bg-yellow-50 dark:bg-yellow-950/20'
                        )}
                      >
                        <div className="mt-0.5 shrink-0">
                          {step.decision === 'approved' && (
                            <CheckCheck className="h-5 w-5 text-green-600" />
                          )}
                          {step.decision === 'rejected' && (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                          {step.decision === 'pending' && isCurrentPending && (
                            <AlertCircle className="h-5 w-5 text-yellow-500" />
                          )}
                          {step.decision === 'pending' && !isCurrentPending && (
                            <Circle className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium">{step.step_label}</p>
                            <Badge
                              variant={
                                step.decision === 'approved' ? 'success' :
                                step.decision === 'rejected' ? 'destructive' : 'outline'
                              }
                              className="text-xs shrink-0"
                            >
                              {step.decision === 'approved' ? 'Approuvé' :
                               step.decision === 'rejected' ? 'Rejeté' : 'En attente'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Rôle requis : {ROLE_LABELS[step.required_role] ?? step.required_role}
                          </p>
                          {step.approver_id && (
                            <p className="text-xs text-muted-foreground">
                              Par : {getAuthorName(step.approver_id)}
                              {step.decided_at && ` · ${formatDate(step.decided_at)}`}
                            </p>
                          )}
                          {step.decision === 'pending' && step.deadline && (
                            <p className="text-xs text-muted-foreground">
                              Délai : {formatDate(step.deadline)}
                            </p>
                          )}
                          {(step.comment as string | null) && (
                            <div className="mt-1.5 flex items-start gap-1">
                              <MessageSquare className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                              <p className="text-xs italic text-muted-foreground">{step.comment}</p>
                            </div>
                          )}
                        </div>
                        {/* Boutons si c'est l'étape active ET que l'utilisateur peut agir */}
                        {isCurrentPending && canActOnCurrentStep && step.id === currentStep?.id && (
                          <div className="flex gap-1.5 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-green-500 text-green-700 hover:bg-green-50"
                              onClick={() => openApprovalDialog('approve', step.id)}
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Approuver
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-red-400 text-red-600 hover:bg-red-50"
                              onClick={() => openApprovalDialog('reject', step.id)}
                            >
                              <MinusCircle className="h-3 w-3" />
                              Rejeter
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Lignes budgétaires */}
          <Card>
            <CardHeader>
              <CardTitle>Lignes budgétaires</CardTitle>
              <CardDescription>
                Total : <strong>{grandTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} USD</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {lines.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Aucune ligne</div>
              ) : (
                <div className="divide-y">
                  {lines.map((line, idx) => {
                    const isExpanded = !!expandedLines[idx]
                    const htva = (line.amount_htva as number) ?? 0
                    const tvac = (line.amount_tvac as number) ?? 0
                    return (
                      <div key={line.id as string}>
                        <div
                          className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 cursor-pointer transition-colors"
                          onClick={() => setExpandedLines(prev => ({ ...prev, [idx]: !prev[idx] }))}
                        >
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold shrink-0">
                            {(line.line_number as number) ?? idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{line.title as string}</span>
                              <span className="text-xs text-muted-foreground">
                                {CATEGORY_LABELS[line.category as string]}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {(line.quantity as number)?.toLocaleString()} × {(line.unit_price as number)?.toLocaleString('fr-FR')} {line.currency_code as string}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-semibold text-sm">{htva.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {line.currency_code as string}</p>
                            {(line.vat_rate as number) > 0 && (
                              <p className="text-xs text-muted-foreground">TVAC: {tvac.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</p>
                            )}
                          </div>
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                        </div>

                        {isExpanded && (
                          <div className="px-4 py-3 bg-muted/20 space-y-3 border-t">
                            {(line.description as string | null) && (
                              <p className="text-sm text-muted-foreground">{line.description as string}</p>
                            )}
                            {(line.paa as string | null) && (
                              <p className="text-xs"><span className="font-medium">PAA:</span> {line.paa as string}</p>
                            )}
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              <div>
                                <span className="font-medium text-muted-foreground">Priorité:</span>{' '}
                                {line.priority as string}
                              </div>
                              {(line.period_start as string | null) && (
                                <div>
                                  <span className="font-medium text-muted-foreground">Période:</span>{' '}
                                  {formatDate(line.period_start as string)} → {line.period_end ? formatDate(line.period_end as string) : '?'}
                                </div>
                              )}
                            </div>
                            <Separator />
                            <div className="space-y-2">
                              <p className="text-xs font-medium">Justification — Pourquoi ?</p>
                              <p className="text-xs text-muted-foreground bg-muted p-2 rounded">{line.justification_why as string}</p>
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs font-medium">Conséquence si refusé</p>
                              <p className="text-xs text-muted-foreground bg-muted p-2 rounded">{line.justification_consequence as string}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Récapitulatif par catégorie */}
          {Object.keys(totalByCategory).length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Récapitulatif par catégorie</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(totalByCategory).map(([cat, amount]) => (
                    <div key={cat} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{CATEGORY_LABELS[cat] ?? cat}</span>
                      <span className="font-medium">{amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex items-center justify-between font-semibold">
                    <span>Total HTVA</span>
                    <span>{grandTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Colonne droite : historique */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Historique des actions</CardTitle>
              <CardDescription>{transactions.length} transaction{transactions.length > 1 ? 's' : ''}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="relative">
                {transactions.map((tx, idx) => (
                  <div key={tx.id as string} className="flex gap-3 px-4 py-3">
                    <div className="flex flex-col items-center">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-sm">
                        {idx + 1}
                      </div>
                      {idx < transactions.length - 1 && (
                        <div className="w-px flex-1 bg-border mt-1 min-h-[1rem]" />
                      )}
                    </div>
                    <div className="flex-1 pb-2 min-w-0">
                      <p className="text-sm font-medium">{TRANSACTION_LABELS[tx.type as string] ?? tx.type as string}</p>
                      <p className="text-xs text-muted-foreground">{getAuthorName(tx.performed_by as string)}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(tx.created_at as string)}</p>
                      {(tx.comment as string | null) && (
                        <div className="mt-1.5 flex items-start gap-1.5">
                          <MessageSquare className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                          <p className="text-xs italic text-muted-foreground">{tx.comment as string}</p>
                        </div>
                      )}
                      {(tx.from_status as string | null) && (tx.to_status as string | null) && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className={cn('text-xs px-1.5 py-0.5 rounded-full', STATUS_CONFIG[tx.from_status as string]?.color ?? 'bg-gray-100')}>
                            {STATUS_CONFIG[tx.from_status as string]?.label}
                          </span>
                          <span className="text-xs text-muted-foreground">→</span>
                          <span className={cn('text-xs px-1.5 py-0.5 rounded-full', STATUS_CONFIG[tx.to_status as string]?.color ?? 'bg-gray-100')}>
                            {STATUS_CONFIG[tx.to_status as string]?.label}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Info approvals résumé */}
          {approvals.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Progression workflow
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {sortedApprovals.map(step => (
                    <div key={step.id} className="flex items-center gap-2 text-xs">
                      {step.decision === 'approved' && <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />}
                      {step.decision === 'rejected' && <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                      {step.decision === 'pending' && <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                      <span className={cn(
                        step.decision === 'approved' && 'text-green-700',
                        step.decision === 'rejected' && 'text-red-600',
                        step.decision === 'pending' && 'text-muted-foreground',
                      )}>
                        {step.step_label}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dialogs d'action */}

      {/* Soumettre */}
      <Dialog open={actionDialog === 'submit'} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" /> Soumettre le budget
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-sm text-blue-700">
                La chaîne d&apos;approbation sera générée automatiquement depuis la hiérarchie de l&apos;organisation.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Commentaire (optionnel)</Label>
              <Textarea
                placeholder="Message pour les approbateurs..."
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Annuler</Button>
            <Button disabled={loading} onClick={() => handleSimpleAction('submit')}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Soumettre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verrouiller */}
      <Dialog open={actionDialog === 'lock'} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" /> Verrouiller le budget
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200">
              <AlertCircle className="h-4 w-4 text-purple-600 mt-0.5 shrink-0" />
              <p className="text-sm text-purple-700">
                Le budget sera verrouillé. Aucune modification ne sera possible après cette action.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Commentaire (optionnel)</Label>
              <Textarea
                placeholder="Notes de verrouillage..."
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Annuler</Button>
            <Button disabled={loading} onClick={() => handleSimpleAction('lock')}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Verrouiller
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transmettre */}
      <Dialog open={actionDialog === 'transmit'} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" /> Transmettre à la Holding
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Commentaire (optionnel)</Label>
              <Textarea
                placeholder="Notes de transmission..."
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Annuler</Button>
            <Button disabled={loading} onClick={() => handleSimpleAction('transmit')}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Transmettre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approuver étape */}
      <Dialog open={actionDialog === 'approve'} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" /> Approuver cette étape
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {activeApprovalId && (() => {
              const step = sortedApprovals.find(a => a.id === activeApprovalId)
              return step ? (
                <div className="p-3 rounded-lg bg-muted text-sm">
                  <p className="font-medium">{step.step_label}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    Rôle requis : {ROLE_LABELS[step.required_role] ?? step.required_role}
                  </p>
                </div>
              ) : null
            })()}
            <div className="space-y-2">
              <Label>Commentaire (optionnel)</Label>
              <Textarea
                placeholder="Remarques sur l'approbation..."
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Annuler</Button>
            <Button
              disabled={loading}
              className="bg-green-600 hover:bg-green-700"
              onClick={() => handleApprovalAction('approve')}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmer l&apos;approbation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejeter étape */}
      <Dialog open={actionDialog === 'reject'} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" /> Rejeter le budget
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-sm text-destructive">
                Le budget sera rejeté. Toutes les étapes en attente seront annulées.
                L&apos;initiateur devra soumettre une nouvelle version.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Motif de rejet <span className="text-destructive">*</span></Label>
              <Textarea
                placeholder="Expliquez les raisons du rejet..."
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Annuler</Button>
            <Button
              variant="destructive"
              disabled={loading || !comment.trim()}
              onClick={() => handleApprovalAction('reject')}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
