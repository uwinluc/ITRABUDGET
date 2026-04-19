'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Repeat, Plus, CheckCircle2, XCircle, Clock, AlertCircle,
  Building2, Calendar, Loader2, ArrowRight, Link2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { formatDate, cn } from '@/lib/utils'

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:                { label: 'En attente',           color: 'bg-gray-100 text-gray-600',    icon: Clock },
  validated_by_sender:    { label: 'Validé émetteur',      color: 'bg-blue-100 text-blue-700',    icon: CheckCircle2 },
  validated_by_receiver:  { label: 'Validé récepteur',     color: 'bg-yellow-100 text-yellow-700', icon: CheckCircle2 },
  matched:                { label: 'Rapproché',            color: 'bg-green-100 text-green-700',  icon: Link2 },
  eliminated:             { label: 'Éliminé',             color: 'bg-purple-100 text-purple-700', icon: CheckCircle2 },
  disputed:               { label: 'Litigieux',           color: 'bg-red-100 text-red-700',      icon: XCircle },
}

const makeRef = () => `ICT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,5).toUpperCase()}`

interface Props {
  transactions: Record<string, unknown>[]
  organizations: Array<{ id: string; name: string; code: string; level: string }>
  fiscalYears: Array<{ id: string; code: string; name: string }>
  budgetLines: Array<{ id: string; title: string; budget_id: string }>
  currencies: Array<{ code: string; name_fr: string; symbol: string }>
  currentUserId: string
  currentUserRoles: string[]
  currentUserOrgIds: string[]
}

export function IntercompanyClient({
  transactions, organizations, fiscalYears, budgetLines, currencies,
  currentUserId, currentUserRoles, currentUserOrgIds
}: Props) {
  const router = useRouter()
  const [createDialog, setCreateDialog] = useState(false)
  const [disputeDialog, setDispute] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')
  const [form, setForm] = useState({
    fiscal_year_id: '', sender_org_id: '', receiver_org_id: '', budget_line_id_sender: '',
    description: '', amount: '', currency_code: '', notes: '',
  })

  const setField = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))
  const isAdmin = currentUserRoles.some(r => ['admin', 'dg_holding', 'dga_holding'].includes(r))

  const getOrg = (id: string) => organizations.find(o => o.id === id)

  const handleCreate = async () => {
    if (!form.fiscal_year_id || !form.sender_org_id || !form.receiver_org_id || !form.description || !form.amount || !form.currency_code) {
      toast.error('Tous les champs obligatoires sont requis'); return
    }
    setLoading(true)
    const supabase = createClient()
    try {
      const { error } = await supabase.from('intercompany_transactions').insert({
        reference:              makeRef(),
        fiscal_year_id:         form.fiscal_year_id,
        sender_org_id:          form.sender_org_id,
        receiver_org_id:        form.receiver_org_id,
        budget_line_id_sender:  form.budget_line_id_sender || null,
        description:            form.description,
        amount:                 parseFloat(form.amount),
        currency_code:          form.currency_code,
        status:                 'pending',
        created_by:             currentUserId,
        notes:                  form.notes || null,
      })
      if (error) throw error
      toast.success('Transaction inter-filiales créée')
      setCreateDialog(false)
      setForm({ fiscal_year_id: '', sender_org_id: '', receiver_org_id: '', budget_line_id_sender: '', description: '', amount: '', currency_code: '', notes: '' })
      router.refresh()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erreur') }
    finally { setLoading(false) }
  }

  const handleValidate = async (tx: Record<string, unknown>) => {
    const isSender   = currentUserOrgIds.includes(tx.sender_org_id as string)
    const isReceiver = currentUserOrgIds.includes(tx.receiver_org_id as string)
    const status     = tx.status as string

    let newStatus = status
    const update: Record<string, unknown> = {}

    if (isSender && status === 'pending') {
      newStatus = 'validated_by_sender'
      update.validated_by_sender = currentUserId
      update.validated_sender_at = new Date().toISOString()
    } else if (isReceiver && status === 'validated_by_sender') {
      newStatus = 'matched'
      update.validated_by_receiver = currentUserId
      update.validated_receiver_at = new Date().toISOString()
      update.matched_at = new Date().toISOString()
    } else if (isReceiver && status === 'pending') {
      newStatus = 'validated_by_receiver'
      update.validated_by_receiver = currentUserId
      update.validated_receiver_at = new Date().toISOString()
    } else if (isSender && status === 'validated_by_receiver') {
      newStatus = 'matched'
      update.validated_by_sender = currentUserId
      update.validated_sender_at = new Date().toISOString()
      update.matched_at = new Date().toISOString()
    } else {
      toast.error('Vous n\'êtes pas autorisé à valider cette transaction'); return
    }

    const supabase = createClient()
    const { error } = await supabase.from('intercompany_transactions').update({ status: newStatus, ...update }).eq('id', tx.id as string)
    if (error) { toast.error(error.message); return }
    toast.success(newStatus === 'matched' ? 'Transaction rapprochée !' : 'Validation enregistrée')
    router.refresh()
  }

  const handleDispute = async () => {
    if (!disputeDialog || !disputeReason.trim()) { toast.error('Motif requis'); return }
    const supabase = createClient()
    const { error } = await supabase.from('intercompany_transactions').update({
      status: 'disputed', dispute_reason: disputeReason
    }).eq('id', disputeDialog.id as string)
    if (error) { toast.error(error.message); return }
    toast.success('Litige signalé')
    setDispute(null)
    setDisputeReason('')
    router.refresh()
  }

  const canValidate = (tx: Record<string, unknown>) => {
    const s = tx.status as string
    return (
      (currentUserOrgIds.includes(tx.sender_org_id as string) && (s === 'pending' || s === 'validated_by_receiver')) ||
      (currentUserOrgIds.includes(tx.receiver_org_id as string) && (s === 'pending' || s === 'validated_by_sender'))
    ) && !['matched', 'eliminated', 'disputed'].includes(s)
  }

  const pendingCount  = transactions.filter(t => !['matched','eliminated'].includes(t.status as string)).length
  const matchedCount  = transactions.filter(t => t.status === 'matched').length
  const totalAmount   = transactions.reduce((s, t) => s + ((t.amount as number) ?? 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Repeat className="h-6 w-6" />
            Transactions Inter-Filiales
          </h1>
          <p className="text-muted-foreground mt-1">Flux financiers entre entités du groupe</p>
        </div>
        {(isAdmin || currentUserOrgIds.length > 0) && (
          <Button onClick={() => setCreateDialog(true)}>
            <Plus className="h-4 w-4" />
            Nouvelle transaction
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-6">
          <div className="text-2xl font-bold">{transactions.length}</div>
          <p className="text-xs text-muted-foreground mt-1">Total transactions</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
          <p className="text-xs text-muted-foreground mt-1">En attente de rapprochement</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="text-2xl font-bold text-green-600">{matchedCount}</div>
          <p className="text-xs text-muted-foreground mt-1">Rapprochées</p>
        </CardContent></Card>
      </div>

      {transactions.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <Repeat className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Aucune transaction inter-filiales</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {transactions.map(tx => {
            const sc = STATUS_CONFIG[tx.status as string] ?? STATUS_CONFIG.pending
            const Icon = sc.icon
            const sender   = getOrg(tx.sender_org_id as string)
            const receiver = getOrg(tx.receiver_org_id as string)
            return (
              <Card key={tx.id as string} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Icon className={cn('h-5 w-5 mt-0.5 shrink-0', tx.status === 'matched' ? 'text-green-600' : tx.status === 'disputed' ? 'text-red-500' : 'text-muted-foreground')} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{tx.reference as string}</span>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', sc.color)}>
                          {sc.label}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{tx.description as string}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {sender?.name ?? '?'}
                        </span>
                        <ArrowRight className="h-3 w-3" />
                        <span>{receiver?.name ?? '?'}</span>
                        <span className="font-medium text-foreground">
                          {(tx.amount as number).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {tx.currency_code as string}
                        </span>
                        <span>{formatDate(tx.created_at as string)}</span>
                      </div>
                      {(tx.dispute_reason as string | null) && (
                        <p className="text-xs text-red-600 mt-1">Litige : {tx.dispute_reason as string}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {canValidate(tx) && (
                        <Button size="sm" variant="outline" className="h-7 text-xs border-green-500 text-green-700" onClick={() => handleValidate(tx)}>
                          <CheckCircle2 className="h-3 w-3" />
                          Valider
                        </Button>
                      )}
                      {tx.status !== 'disputed' && tx.status !== 'matched' && tx.status !== 'eliminated' &&
                        (currentUserOrgIds.includes(tx.receiver_org_id as string) || isAdmin) && (
                        <Button size="sm" variant="outline" className="h-7 text-xs border-red-400 text-red-600" onClick={() => { setDispute(tx); setDisputeReason('') }}>
                          <XCircle className="h-3 w-3" />
                          Litige
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Dialog créer transaction */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Repeat className="h-5 w-5" />Nouvelle transaction inter-filiales</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Exercice fiscal <span className="text-destructive">*</span></Label>
              <Select value={form.fiscal_year_id} onValueChange={v => setField('fiscal_year_id', v)}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>{fiscalYears.map(f => <SelectItem key={f.id} value={f.id}>{f.code} — {f.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Organisation émettrice <span className="text-destructive">*</span></Label>
                <Select value={form.sender_org_id} onValueChange={v => setField('sender_org_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Émetteur..." /></SelectTrigger>
                  <SelectContent>{organizations.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Organisation réceptrice <span className="text-destructive">*</span></Label>
                <Select value={form.receiver_org_id} onValueChange={v => setField('receiver_org_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Récepteur..." /></SelectTrigger>
                  <SelectContent>{organizations.filter(o => o.id !== form.sender_org_id).map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description <span className="text-destructive">*</span></Label>
              <Input placeholder="Nature de la transaction..." value={form.description} onChange={e => setField('description', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Montant <span className="text-destructive">*</span></Label>
                <Input type="number" step="0.01" value={form.amount} onChange={e => setField('amount', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Devise <span className="text-destructive">*</span></Label>
                <Select value={form.currency_code} onValueChange={v => setField('currency_code', v)}>
                  <SelectTrigger><SelectValue placeholder="Devise..." /></SelectTrigger>
                  <SelectContent>{currencies.map(c => <SelectItem key={c.code} value={c.code}>{c.code} — {c.name_fr}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes} onChange={e => setField('notes', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(false)}>Annuler</Button>
            <Button disabled={loading} onClick={handleCreate}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog litige */}
      <Dialog open={!!disputeDialog} onOpenChange={() => setDispute(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><XCircle className="h-5 w-5 text-red-500" />Signaler un litige</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-sm text-destructive">La transaction sera marquée comme litigieuse et devra être résolue manuellement.</p>
            </div>
            <div className="space-y-2">
              <Label>Motif du litige <span className="text-destructive">*</span></Label>
              <Textarea rows={3} placeholder="Expliquez le désaccord..." value={disputeReason} onChange={e => setDisputeReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDispute(null)}>Annuler</Button>
            <Button variant="destructive" disabled={!disputeReason.trim()} onClick={handleDispute}>Signaler</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
