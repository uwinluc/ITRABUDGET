'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Plus, ChevronDown, ChevronUp, Building2, Calendar,
  Loader2, AlertCircle, CheckCircle2, DollarSign, FileText, Truck,
  ClipboardList, CreditCard, TrendingUp
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { formatDate, cn } from '@/lib/utils'

const CATEGORY_LABELS: Record<string, string> = {
  operating: 'Fonctionnement',
  investment: 'Investissement',
  revenue: 'Recette',
  project: 'Projet',
  other: 'Autre',
}

const PAYMENT_METHODS = ['virement', 'chèque', 'espèces', 'mobile_money', 'autre']

type StageDialog =
  | { type: 'credit';     lineId: string }
  | { type: 'engagement'; creditId: string; lineId: string }
  | { type: 'liquidation'; engagementId: string }
  | { type: 'ordonnance';  liquidationId: string }
  | { type: 'payment';     ordonnanceId: string }
  | null

interface Props {
  budget: Record<string, unknown>
  lines: Record<string, unknown>[]
  organization: Record<string, unknown> | null
  fiscalYear: Record<string, unknown> | null
  credits: Record<string, unknown>[]
  engagements: Record<string, unknown>[]
  liquidations: Record<string, unknown>[]
  ordonnances: Record<string, unknown>[]
  payments: Record<string, unknown>[]
  vendors: Array<{ id: string; name: string; code: string }>
  currencies: Array<{ code: string; name_fr: string; symbol: string }>
  currentUserId: string
}

// Génère une référence unique
const makeRef = (prefix: string) =>
  `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

export function ExecutionDetailClient({
  budget, lines, organization, fiscalYear,
  credits, engagements, liquidations, ordonnances, payments,
  vendors, currencies, currentUserId
}: Props) {
  const router = useRouter()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [dialog, setDialog] = useState<StageDialog>(null)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})

  const setField = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  // ── Helpers de lookup ──────────────────────────────────────
  const creditsFor  = (lineId: string)   => credits.filter(c => c.budget_line_id === lineId)
  const engagedFor  = (creditId: string) => engagements.filter(e => e.credit_opening_id === creditId)
  const liquidFor   = (engId: string)    => liquidations.filter(l => l.engagement_id === engId)
  const ordFor      = (liqId: string)    => ordonnances.filter(o => o.liquidation_id === liqId)
  const paidFor     = (ordId: string)    => payments.filter(p => p.ordonnance_id === ordId)

  const lineStats = (line: Record<string, unknown>) => {
    const lineCredits = creditsFor(line.id as string)
    const credited = lineCredits.reduce((s, c) => s + ((c.amount as number) ?? 0), 0)
    const lineEngs = lineCredits.flatMap(c => engagedFor(c.id as string))
    const engaged  = lineEngs.reduce((s, e) => s + ((e.amount as number) ?? 0), 0)
    const lineLiqs = lineEngs.flatMap(e => liquidFor(e.id as string))
    const liquidated = lineLiqs.reduce((s, l) => s + ((l.amount as number) ?? 0), 0)
    const lineOrds = lineLiqs.flatMap(l => ordFor(l.id as string))
    const ordered  = lineOrds.reduce((s, o) => s + ((o.amount as number) ?? 0), 0)
    const linePays = lineOrds.flatMap(o => paidFor(o.id as string))
    const paid     = linePays.reduce((s, p) => s + ((p.amount as number) ?? 0), 0)
    const budget   = (line.amount_htva as number) ?? 0
    const available = credited - engaged
    return { budget, credited, engaged, liquidated, ordered, paid, available }
  }

  const grandStats = lines.reduce<{ budget: number; credited: number; engaged: number; liquidated: number; paid: number }>((acc, l) => {
    const s = lineStats(l)
    return {
      budget:     acc.budget + s.budget,
      credited:   acc.credited + s.credited,
      engaged:    acc.engaged + s.engaged,
      liquidated: acc.liquidated + s.liquidated,
      paid:       acc.paid + s.paid,
    }
  }, { budget: 0, credited: 0, engaged: 0, liquidated: 0, paid: 0 })

  // ── Réinitialiser le formulaire à chaque ouverture ─────────
  const openDialog = (d: StageDialog, defaults: Record<string, string> = {}) => {
    setForm(defaults)
    setDialog(d)
  }

  // ── Créer un crédit ────────────────────────────────────────
  const handleCredit = async () => {
    if (!dialog || dialog.type !== 'credit') return
    if (!form.amount || !form.currency_code) { toast.error('Montant et devise requis'); return }

    setLoading(true)
    const supabase = createClient()
    try {
      const { error } = await supabase.from('credit_openings').insert({
        budget_line_id:  dialog.lineId,
        organization_id: budget.organization_id,
        fiscal_year_id:  budget.fiscal_year_id,
        amount:          parseFloat(form.amount),
        currency_code:   form.currency_code,
        opened_by:       currentUserId,
        notes:           form.notes || null,
      })
      if (error) throw error
      toast.success('Crédit ouvert')
      setDialog(null)
      router.refresh()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erreur') }
    finally { setLoading(false) }
  }

  // ── Créer un engagement ────────────────────────────────────
  const handleEngagement = async () => {
    if (!dialog || dialog.type !== 'engagement') return
    if (!form.amount || !form.currency_code || !form.description) {
      toast.error('Montant, devise et description requis'); return
    }

    setLoading(true)
    const supabase = createClient()
    try {
      const { error } = await supabase.from('engagements').insert({
        credit_opening_id: dialog.creditId,
        vendor_id:         form.vendor_id || null,
        reference:         form.reference || makeRef('ENG'),
        description:       form.description,
        amount:            parseFloat(form.amount),
        currency_code:     form.currency_code,
        status:            'engaged',
        engaged_by:        currentUserId,
        expected_date:     form.expected_date || null,
        notes:             form.notes || null,
      })
      if (error) throw error
      toast.success('Engagement créé')
      setDialog(null)
      router.refresh()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erreur') }
    finally { setLoading(false) }
  }

  // ── Créer une liquidation ──────────────────────────────────
  const handleLiquidation = async () => {
    if (!dialog || dialog.type !== 'liquidation') return
    if (!form.amount || !form.currency_code || !form.invoice_ref || !form.invoice_date) {
      toast.error('Tous les champs obligatoires requis'); return
    }

    setLoading(true)
    const supabase = createClient()
    try {
      const { error } = await supabase.from('liquidations').insert({
        engagement_id: dialog.engagementId,
        invoice_ref:   form.invoice_ref,
        invoice_date:  form.invoice_date,
        amount:        parseFloat(form.amount),
        currency_code: form.currency_code,
        service_done_at: form.service_done_at || null,
        verified_by:   currentUserId,
        notes:         form.notes || null,
      })
      if (error) throw error

      // Mettre à jour le statut de l'engagement
      await supabase.from('engagements').update({ status: 'liquidated' }).eq('id', dialog.engagementId)

      toast.success('Liquidation enregistrée')
      setDialog(null)
      router.refresh()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erreur') }
    finally { setLoading(false) }
  }

  // ── Créer une ordonnance ───────────────────────────────────
  const handleOrdonnance = async () => {
    if (!dialog || dialog.type !== 'ordonnance') return
    if (!form.amount || !form.currency_code) { toast.error('Montant et devise requis'); return }

    setLoading(true)
    const supabase = createClient()
    try {
      const { error } = await supabase.from('ordonnances').insert({
        liquidation_id: dialog.liquidationId,
        reference:      form.reference || makeRef('ORD'),
        amount:         parseFloat(form.amount),
        currency_code:  form.currency_code,
        ordered_by:     currentUserId,
        payment_due:    form.payment_due || null,
        notes:          form.notes || null,
      })
      if (error) throw error
      toast.success('Ordonnance créée')
      setDialog(null)
      router.refresh()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erreur') }
    finally { setLoading(false) }
  }

  // ── Enregistrer un paiement ────────────────────────────────
  const handlePayment = async () => {
    if (!dialog || dialog.type !== 'payment') return
    if (!form.amount || !form.currency_code || !form.payment_date) {
      toast.error('Montant, devise et date de paiement requis'); return
    }

    setLoading(true)
    const supabase = createClient()
    try {
      const { error } = await supabase.from('payments').insert({
        ordonnance_id:   dialog.ordonnanceId,
        reference:       form.reference || makeRef('PAY'),
        amount:          parseFloat(form.amount),
        currency_code:   form.currency_code,
        payment_date:    form.payment_date,
        payment_method:  form.payment_method || null,
        paid_by:         currentUserId,
        bank_reference:  form.bank_reference || null,
        notes:           form.notes || null,
      })
      if (error) throw error

      // Mettre à jour statut de l'engagement → paid
      const ord = ordonnances.find(o => o.id === dialog.ordonnanceId)
      if (ord) {
        const liq = liquidations.find(l => l.id === ord.liquidation_id)
        if (liq) {
          await supabase.from('engagements').update({ status: 'paid' }).eq('id', liq.engagement_id)
        }
      }

      toast.success('Paiement enregistré')
      setDialog(null)
      router.refresh()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erreur') }
    finally { setLoading(false) }
  }

  const STAGE_ICONS = [DollarSign, FileText, Truck, ClipboardList, CreditCard]
  const STAGE_LABELS = ['Crédit', 'Engagement', 'Liquidation', 'Ordonnance', 'Paiement']

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">{budget.title as string}</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
            {organization && (
              <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{organization.name as string}</span>
            )}
            {fiscalYear && (
              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{fiscalYear.code as string}</span>
            )}
          </div>
        </div>
      </div>

      {/* KPIs globaux */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Budget', value: grandStats.budget, color: 'text-foreground' },
          { label: 'Crédits', value: grandStats.credited, color: 'text-blue-600' },
          { label: 'Engagé', value: grandStats.engaged, color: 'text-orange-600' },
          { label: 'Liquidé', value: grandStats.liquidated, color: 'text-yellow-600' },
          { label: 'Payé', value: grandStats.paid, color: 'text-green-600' },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-4">
              <p className={cn('text-xl font-bold', color)}>
                {value.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pipeline visuel */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-1">
            {STAGE_ICONS.map((Icon, i) => (
              <div key={i} className="flex items-center gap-1 flex-1">
                <div className={cn(
                  'flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full flex-1 justify-center',
                  i === 0 ? 'bg-blue-100 text-blue-700' :
                  i === 1 ? 'bg-orange-100 text-orange-700' :
                  i === 2 ? 'bg-yellow-100 text-yellow-700' :
                  i === 3 ? 'bg-purple-100 text-purple-700' :
                  'bg-green-100 text-green-700'
                )}>
                  <Icon className="h-3 w-3 shrink-0" />
                  {STAGE_LABELS[i]}
                </div>
                {i < 4 && <span className="text-muted-foreground text-xs shrink-0">→</span>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lignes budgétaires */}
      <div className="space-y-3">
        {lines.map(line => {
          const lineId = line.id as string
          const isExpanded = !!expanded[lineId]
          const stats = lineStats(line)
          const lineCredits = creditsFor(lineId)
          const engageRate = stats.budget > 0 ? (stats.engaged / stats.budget) * 100 : 0
          const payRate    = stats.budget > 0 ? (stats.paid / stats.budget) * 100 : 0

          return (
            <Card key={lineId}>
              {/* Ligne header */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpanded(e => ({ ...e, [lineId]: !e[lineId] }))}
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold shrink-0">
                  {(line.line_number as number) ?? 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{line.title as string}</span>
                    <span className="text-xs text-muted-foreground">{CATEGORY_LABELS[line.category as string]}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="relative h-full rounded-full">
                        <div className="absolute inset-0 bg-blue-300 rounded-full" style={{ width: `${Math.min(stats.credited / Math.max(stats.budget, 1) * 100, 100)}%` }} />
                        <div className="absolute inset-0 bg-green-500 rounded-full" style={{ width: `${Math.min(payRate, 100)}%` }} />
                        <div className="absolute inset-0 bg-orange-400 rounded-full" style={{ width: `${Math.min(engageRate, 100)}%` }} />
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{engageRate.toFixed(0)}% engagé</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold">{stats.budget.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} {line.currency_code as string}</p>
                  <p className="text-xs text-muted-foreground">Disponible : {stats.available.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}</p>
                </div>
                {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
              </div>

              {isExpanded && (
                <div className="border-t">
                  {/* Crédits */}
                  <div className="px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-blue-600" />
                        Crédits ouverts
                        <Badge variant="outline" className="text-xs">{lineCredits.length}</Badge>
                      </h4>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => openDialog(
                          { type: 'credit', lineId },
                          { currency_code: line.currency_code as string }
                        )}
                      >
                        <Plus className="h-3 w-3" />
                        Ouvrir crédit
                      </Button>
                    </div>

                    {lineCredits.length === 0 ? (
                      <p className="text-xs text-muted-foreground pl-6">Aucun crédit ouvert pour cette ligne.</p>
                    ) : (
                      <div className="space-y-3 pl-6">
                        {lineCredits.map(credit => {
                          const creditEngagements = engagedFor(credit.id as string)

                          return (
                            <div key={credit.id as string} className="border rounded-lg p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-blue-700">
                                    {(credit.amount as number).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {credit.currency_code as string}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{formatDate(credit.opened_at as string)}</p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => openDialog(
                                    { type: 'engagement', creditId: credit.id as string, lineId },
                                    { currency_code: credit.currency_code as string }
                                  )}
                                >
                                  <Plus className="h-3 w-3" />
                                  Engager
                                </Button>
                              </div>

                              {/* Engagements */}
                              {creditEngagements.length > 0 && (
                                <div className="space-y-2 pl-3 border-l-2 border-orange-200">
                                  {creditEngagements.map(eng => {
                                    const engLiqs = liquidFor(eng.id as string)
                                    return (
                                      <div key={eng.id as string} className="bg-orange-50 dark:bg-orange-950/20 rounded p-2 space-y-2">
                                        <div className="flex items-center justify-between">
                                          <div>
                                            <p className="text-xs font-medium text-orange-800">{eng.reference as string} — {eng.description as string}</p>
                                            <p className="text-xs text-muted-foreground">
                                              {(eng.amount as number).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {eng.currency_code as string}
                                              {' · '}
                                              <span className={cn(
                                                'font-medium',
                                                eng.status === 'paid' ? 'text-green-600' :
                                                eng.status === 'liquidated' ? 'text-yellow-600' : 'text-orange-600'
                                              )}>
                                                {eng.status as string}
                                              </span>
                                            </p>
                                          </div>
                                          {eng.status !== 'liquidated' && eng.status !== 'paid' && (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-6 text-xs"
                                              onClick={() => openDialog(
                                                { type: 'liquidation', engagementId: eng.id as string },
                                                { currency_code: eng.currency_code as string, amount: String(eng.amount) }
                                              )}
                                            >
                                              <Plus className="h-3 w-3" />
                                              Liquider
                                            </Button>
                                          )}
                                        </div>

                                        {/* Liquidations */}
                                        {engLiqs.length > 0 && (
                                          <div className="space-y-1 pl-2 border-l-2 border-yellow-300">
                                            {engLiqs.map(liq => {
                                              const liqOrds = ordFor(liq.id as string)
                                              return (
                                                <div key={liq.id as string} className="bg-yellow-50 dark:bg-yellow-950/20 rounded p-1.5 space-y-1">
                                                  <div className="flex items-center justify-between">
                                                    <p className="text-xs text-yellow-800">
                                                      Facture {liq.invoice_ref as string} — {(liq.amount as number).toLocaleString('fr-FR')} {liq.currency_code as string}
                                                    </p>
                                                    {liqOrds.length === 0 && (
                                                      <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-6 text-xs"
                                                        onClick={() => openDialog(
                                                          { type: 'ordonnance', liquidationId: liq.id as string },
                                                          { currency_code: liq.currency_code as string, amount: String(liq.amount) }
                                                        )}
                                                      >
                                                        <Plus className="h-3 w-3" />
                                                        Ordonner
                                                      </Button>
                                                    )}
                                                  </div>

                                                  {/* Ordonnances */}
                                                  {liqOrds.map(ord => {
                                                    const ordPays = paidFor(ord.id as string)
                                                    return (
                                                      <div key={ord.id as string} className="pl-2 border-l-2 border-purple-300">
                                                        <div className="flex items-center justify-between bg-purple-50 dark:bg-purple-950/20 rounded p-1">
                                                          <p className="text-xs text-purple-800">
                                                            Ord. {ord.reference as string} — {(ord.amount as number).toLocaleString('fr-FR')} {ord.currency_code as string}
                                                          </p>
                                                          {ordPays.length === 0 && (
                                                            <Button
                                                              size="sm"
                                                              variant="outline"
                                                              className="h-5 text-xs"
                                                              onClick={() => openDialog(
                                                                { type: 'payment', ordonnanceId: ord.id as string },
                                                                { currency_code: ord.currency_code as string, amount: String(ord.amount) }
                                                              )}
                                                            >
                                                              <Plus className="h-3 w-3" />
                                                              Payer
                                                            </Button>
                                                          )}
                                                        </div>

                                                        {/* Paiements */}
                                                        {ordPays.map(pay => (
                                                          <div key={pay.id as string} className="flex items-center gap-2 pl-2 py-0.5">
                                                            <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />
                                                            <p className="text-xs text-green-700">
                                                              Payé : {(pay.amount as number).toLocaleString('fr-FR')} {pay.currency_code as string} — {formatDate(pay.payment_date as string)}
                                                              {(pay.bank_reference as string | null) && ` · Réf: ${pay.bank_reference as string}`}
                                                            </p>
                                                          </div>
                                                        ))}
                                                      </div>
                                                    )
                                                  })}
                                                </div>
                                              )
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* ── Dialogs ─────────────────────────────────────────── */}

      {/* Ouvrir Crédit */}
      <Dialog open={dialog?.type === 'credit'} onOpenChange={() => setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-blue-600" />
              Ouvrir un crédit
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-sm text-blue-700">Le crédit ouvert doit être ≤ au montant de la ligne budgétaire.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Montant <span className="text-destructive">*</span></Label>
                <Input type="number" step="0.01" placeholder="0.00" value={form.amount ?? ''} onChange={e => setField('amount', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Devise <span className="text-destructive">*</span></Label>
                <Select value={form.currency_code ?? ''} onValueChange={v => setField('currency_code', v)}>
                  <SelectTrigger><SelectValue placeholder="Devise..." /></SelectTrigger>
                  <SelectContent>
                    {currencies.map(c => <SelectItem key={c.code} value={c.code}>{c.code} — {c.name_fr}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes (optionnel)</Label>
              <Textarea rows={2} value={form.notes ?? ''} onChange={e => setField('notes', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Annuler</Button>
            <Button disabled={loading} onClick={handleCredit}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Ouvrir le crédit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Engagement */}
      <Dialog open={dialog?.type === 'engagement'} onOpenChange={() => setDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-orange-600" />
              Créer un engagement
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Description <span className="text-destructive">*</span></Label>
              <Input placeholder="Objet de la dépense..." value={form.description ?? ''} onChange={e => setField('description', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fournisseur</Label>
              <Select value={form.vendor_id ?? ''} onValueChange={v => setField('vendor_id', v)}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un fournisseur..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sans fournisseur</SelectItem>
                  {vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name} ({v.code})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Montant <span className="text-destructive">*</span></Label>
                <Input type="number" step="0.01" placeholder="0.00" value={form.amount ?? ''} onChange={e => setField('amount', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Devise <span className="text-destructive">*</span></Label>
                <Select value={form.currency_code ?? ''} onValueChange={v => setField('currency_code', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {currencies.map(c => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Référence (auto si vide)</Label>
                <Input placeholder="ENG-XXXX" value={form.reference ?? ''} onChange={e => setField('reference', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Date prévue</Label>
                <Input type="date" value={form.expected_date ?? ''} onChange={e => setField('expected_date', e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes ?? ''} onChange={e => setField('notes', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Annuler</Button>
            <Button disabled={loading} onClick={handleEngagement}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Engager
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Liquidation */}
      <Dialog open={dialog?.type === 'liquidation'} onOpenChange={() => setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-yellow-600" />
              Liquider l&apos;engagement
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Réf. facture <span className="text-destructive">*</span></Label>
                <Input placeholder="FAC-2024-001" value={form.invoice_ref ?? ''} onChange={e => setField('invoice_ref', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Date facture <span className="text-destructive">*</span></Label>
                <Input type="date" value={form.invoice_date ?? ''} onChange={e => setField('invoice_date', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Montant <span className="text-destructive">*</span></Label>
                <Input type="number" step="0.01" value={form.amount ?? ''} onChange={e => setField('amount', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Devise <span className="text-destructive">*</span></Label>
                <Select value={form.currency_code ?? ''} onValueChange={v => setField('currency_code', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {currencies.map(c => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Date service rendu</Label>
              <Input type="date" value={form.service_done_at ?? ''} onChange={e => setField('service_done_at', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes ?? ''} onChange={e => setField('notes', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Annuler</Button>
            <Button disabled={loading} onClick={handleLiquidation}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Liquider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ordonnance */}
      <Dialog open={dialog?.type === 'ordonnance'} onOpenChange={() => setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-purple-600" />
              Créer une ordonnance de paiement
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Montant <span className="text-destructive">*</span></Label>
                <Input type="number" step="0.01" value={form.amount ?? ''} onChange={e => setField('amount', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Devise <span className="text-destructive">*</span></Label>
                <Select value={form.currency_code ?? ''} onValueChange={v => setField('currency_code', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {currencies.map(c => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Référence (auto si vide)</Label>
                <Input placeholder="ORD-XXXX" value={form.reference ?? ''} onChange={e => setField('reference', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Échéance paiement</Label>
                <Input type="date" value={form.payment_due ?? ''} onChange={e => setField('payment_due', e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes ?? ''} onChange={e => setField('notes', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Annuler</Button>
            <Button disabled={loading} onClick={handleOrdonnance}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Créer l&apos;ordonnance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Paiement */}
      <Dialog open={dialog?.type === 'payment'} onOpenChange={() => setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-green-600" />
              Enregistrer un paiement
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Montant <span className="text-destructive">*</span></Label>
                <Input type="number" step="0.01" value={form.amount ?? ''} onChange={e => setField('amount', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Devise <span className="text-destructive">*</span></Label>
                <Select value={form.currency_code ?? ''} onValueChange={v => setField('currency_code', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {currencies.map(c => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Date de paiement <span className="text-destructive">*</span></Label>
                <Input type="date" value={form.payment_date ?? ''} onChange={e => setField('payment_date', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Mode de paiement</Label>
                <Select value={form.payment_method ?? ''} onValueChange={v => setField('payment_method', v)}>
                  <SelectTrigger><SelectValue placeholder="Mode..." /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Référence bancaire</Label>
                <Input placeholder="TXN-XXXXX" value={form.bank_reference ?? ''} onChange={e => setField('bank_reference', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Référence paiement (auto)</Label>
                <Input placeholder="PAY-XXXX" value={form.reference ?? ''} onChange={e => setField('reference', e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes ?? ''} onChange={e => setField('notes', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Annuler</Button>
            <Button disabled={loading} className="bg-green-600 hover:bg-green-700" onClick={handlePayment}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Enregistrer le paiement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
