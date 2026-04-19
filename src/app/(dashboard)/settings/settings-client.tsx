'use client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Save, Loader2, Calendar, DollarSign, Layers, List, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { formatDate, cn } from '@/lib/utils'

type Tab = 'fiscal_years' | 'exchange_rates' | 'rubrics' | 'units'

const FY_STATUS_COLORS: Record<string, string> = {
  preparation: 'bg-yellow-100 text-yellow-700',
  active:      'bg-green-100 text-green-700',
  closed:      'bg-gray-100 text-gray-600',
  archived:    'bg-gray-100 text-gray-400',
}

const fySchema = z.object({
  code: z.string().min(2, 'Ex: 2025'),
  name: z.string().min(3),
  organization_id: z.string().uuid('Requis'),
  start_date: z.string(),
  end_date: z.string(),
  status: z.enum(['preparation', 'active', 'closed', 'archived']).default('preparation'),
  reference_currency: z.string().length(3).default('USD'),
  budget_deadline: z.string().optional(),
})
type FyForm = z.infer<typeof fySchema>

const rateSchema = z.object({
  from_currency: z.string().length(3),
  to_currency: z.string().length(3),
  rate: z.number({ coerce: true }).positive('Taux doit être > 0'),
  effective_date: z.string(),
  notes: z.string().optional(),
})
type RateForm = z.infer<typeof rateSchema>

const rubricSchema = z.object({
  code: z.string().min(2),
  name_fr: z.string().min(2),
  name_en: z.string().min(2),
  name_pt: z.string().min(2),
  category: z.enum(['operating', 'investment', 'revenue', 'project', 'other']),
  organization_id: z.string().optional(),
})
type RubricForm = z.infer<typeof rubricSchema>

const CATEGORIES = [
  { value: 'operating',   label: 'Fonctionnement' },
  { value: 'investment',  label: 'Investissement' },
  { value: 'revenue',     label: 'Recette' },
  { value: 'project',     label: 'Projet' },
  { value: 'other',       label: 'Autre' },
]

interface Props {
  fiscalYears: Record<string, unknown>[]
  organizations: Array<{ id: string; name: string; code: string; level: string }>
  currencies: Record<string, unknown>[]
  exchangeRates: Record<string, unknown>[]
  units: Record<string, unknown>[]
  rubrics: Record<string, unknown>[]
}

export function SettingsClient({ fiscalYears, organizations, currencies, exchangeRates, rubrics }: Props) {
  const [tab, setTab] = useState<Tab>('fiscal_years')
  const [fyDialogOpen, setFyDialogOpen] = useState(false)
  const [rateDialogOpen, setRateDialogOpen] = useState(false)
  const [rubricDialogOpen, setRubricDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const fyForm = useForm<FyForm>({ resolver: zodResolver(fySchema), defaultValues: { status: 'preparation', reference_currency: 'USD' } })
  const rateForm = useForm<RateForm>({ resolver: zodResolver(rateSchema), defaultValues: { from_currency: 'USD', to_currency: 'USD', effective_date: new Date().toISOString().split('T')[0] } })
  const rubricForm = useForm<RubricForm>({ resolver: zodResolver(rubricSchema) })

  const createFiscalYear = async (data: FyForm) => {
    setLoading(true)
    const supabase = createClient()
    try {
      const { error } = await supabase.from('fiscal_years').insert({
        ...data,
        organization_id: data.organization_id,
        budget_deadline: data.budget_deadline || null,
      })
      if (error) throw error
      toast.success('Exercice fiscal créé')
      setFyDialogOpen(false)
      fyForm.reset()
      window.location.reload()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erreur') }
    finally { setLoading(false) }
  }

  const createExchangeRate = async (data: RateForm) => {
    setLoading(true)
    const supabase = createClient()
    try {
      if (data.from_currency === data.to_currency) throw new Error('Les devises doivent être différentes')
      const { error } = await supabase.from('exchange_rates').insert(data)
      if (error) throw error
      toast.success('Taux de change enregistré')
      setRateDialogOpen(false)
      rateForm.reset()
      window.location.reload()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erreur') }
    finally { setLoading(false) }
  }

  const createRubric = async (data: RubricForm) => {
    setLoading(true)
    const supabase = createClient()
    try {
      const { error } = await supabase.from('budget_rubrics').insert({
        ...data,
        organization_id: data.organization_id || null,
      })
      if (error) throw error
      toast.success('Rubrique créée')
      setRubricDialogOpen(false)
      rubricForm.reset()
      window.location.reload()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erreur') }
    finally { setLoading(false) }
  }

  const TABS = [
    { key: 'fiscal_years', label: 'Exercices fiscaux', icon: Calendar, count: fiscalYears.length },
    { key: 'exchange_rates', label: 'Taux de change', icon: DollarSign, count: exchangeRates.length },
    { key: 'rubrics', label: 'Rubriques', icon: Layers, count: rubrics.length },
    { key: 'units', label: 'Unités', icon: List, count: 25 },
  ] as const

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings2 className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold">Paramètres</h1>
          <p className="text-muted-foreground">Configuration du système budgétaire</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key as Tab)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                tab === t.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
              <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">{t.count}</span>
            </button>
          )
        })}
      </div>

      {/* Exercices fiscaux */}
      {tab === 'fiscal_years' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setFyDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Nouvel exercice
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Organisation</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead>Devise réf.</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Deadline</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fiscalYears.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun exercice créé</TableCell></TableRow>
                ) : fiscalYears.map(fy => {
                  const org = organizations.find(o => o.id === fy.organization_id)
                  return (
                    <TableRow key={fy.id as string}>
                      <TableCell className="font-mono font-semibold">{fy.code as string}</TableCell>
                      <TableCell>{fy.name as string}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{org?.name ?? '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(fy.start_date as string)} → {formatDate(fy.end_date as string)}
                      </TableCell>
                      <TableCell><Badge variant="outline" className="font-mono text-xs">{fy.reference_currency as string}</Badge></TableCell>
                      <TableCell>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', FY_STATUS_COLORS[fy.status as string] ?? 'bg-gray-100')}>
                          {fy.status as string}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {fy.budget_deadline ? formatDate(fy.budget_deadline as string) : '—'}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {/* Taux de change */}
      {tab === 'exchange_rates' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setRateDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Nouveau taux
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>De</TableHead>
                  <TableHead>Vers</TableHead>
                  <TableHead>Taux</TableHead>
                  <TableHead>Date d'effet</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exchangeRates.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucun taux enregistré</TableCell></TableRow>
                ) : exchangeRates.map(r => (
                  <TableRow key={r.id as string}>
                    <TableCell><Badge variant="outline" className="font-mono">{r.from_currency as string}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className="font-mono">{r.to_currency as string}</Badge></TableCell>
                    <TableCell className="font-semibold">{(r.rate as number).toLocaleString('fr-FR', { minimumFractionDigits: 6 })}</TableCell>
                    <TableCell className="text-sm">{formatDate(r.effective_date as string)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{(r.notes as string) || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {/* Rubriques */}
      {tab === 'rubrics' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setRubricDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Nouvelle rubrique
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Nom (FR)</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Portée</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rubrics.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Aucune rubrique créée</TableCell></TableRow>
                ) : rubrics.map(r => (
                  <TableRow key={r.id as string}>
                    <TableCell className="font-mono text-sm">{r.code as string}</TableCell>
                    <TableCell className="font-medium">{r.name_fr as string}</TableCell>
                    <TableCell>
                      <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                        {CATEGORIES.find(c => c.value === r.category)?.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.organization_id ? 'Filiale' : 'Globale'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {/* Unités */}
      {tab === 'units' && (
        <Card>
          <CardHeader>
            <CardTitle>Unités de mesure</CardTitle>
            <CardDescription>25 unités prédéfinies — gestion via Supabase Studio</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {['Pièce','Mois','Année','Jour','Heure','Semaine','Licence','Session','Unité','Litre',
                'Kg','m²','m³','km','Lot','Contrat','Voyage','Personne','Équipe','Rapport',
                'Formation','Boîte','Paquet','Véhicule','Équipement'].map(u => (
                <div key={u} className="px-3 py-2 rounded-lg bg-muted text-sm text-center">{u}</div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog Exercice fiscal */}
      <Dialog open={fyDialogOpen} onOpenChange={setFyDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nouvel exercice fiscal</DialogTitle></DialogHeader>
          <form onSubmit={fyForm.handleSubmit(createFiscalYear)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code <span className="text-destructive">*</span></Label>
                <Input placeholder="2025" {...fyForm.register('code')} />
              </div>
              <div className="space-y-2">
                <Label>Nom <span className="text-destructive">*</span></Label>
                <Input placeholder="Exercice 2025" {...fyForm.register('name')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Organisation <span className="text-destructive">*</span></Label>
              <Select onValueChange={v => fyForm.setValue('organization_id', v)}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  {organizations.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {fyForm.formState.errors.organization_id && <p className="text-xs text-destructive">{fyForm.formState.errors.organization_id.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date de début <span className="text-destructive">*</span></Label>
                <Input type="date" {...fyForm.register('start_date')} />
              </div>
              <div className="space-y-2">
                <Label>Date de fin <span className="text-destructive">*</span></Label>
                <Input type="date" {...fyForm.register('end_date')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Devise de référence</Label>
                <Select onValueChange={v => fyForm.setValue('reference_currency', v)} defaultValue="USD">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(currencies as Array<{ code: string; name_fr: string }>).filter(c => c).map(c => (
                      <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Statut</Label>
                <Select onValueChange={v => fyForm.setValue('status', v as 'preparation')} defaultValue="preparation">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preparation">Préparation</SelectItem>
                    <SelectItem value="active">Actif</SelectItem>
                    <SelectItem value="closed">Clôturé</SelectItem>
                    <SelectItem value="archived">Archivé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Date limite de soumission des budgets</Label>
              <Input type="date" {...fyForm.register('budget_deadline')} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFyDialogOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Créer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Taux de change */}
      <Dialog open={rateDialogOpen} onOpenChange={setRateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nouveau taux de change</DialogTitle></DialogHeader>
          <form onSubmit={rateForm.handleSubmit(createExchangeRate)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Devise source</Label>
                <Select onValueChange={v => rateForm.setValue('from_currency', v)} defaultValue="USD">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(currencies as Array<{ code: string }>).map(c => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Devise cible</Label>
                <Select onValueChange={v => rateForm.setValue('to_currency', v)}>
                  <SelectTrigger><SelectValue placeholder="Cible..." /></SelectTrigger>
                  <SelectContent>
                    {(currencies as Array<{ code: string }>).map(c => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Taux <span className="text-destructive">*</span></Label>
                <Input type="number" step="0.000001" placeholder="1.000000" {...rateForm.register('rate', { valueAsNumber: true })} />
                {rateForm.formState.errors.rate && <p className="text-xs text-destructive">{rateForm.formState.errors.rate.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Date d'effet <span className="text-destructive">*</span></Label>
                <Input type="date" {...rateForm.register('effective_date')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input placeholder="Source du taux, contexte..." {...rateForm.register('notes')} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRateDialogOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                <Save className="h-4 w-4" />
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Rubrique */}
      <Dialog open={rubricDialogOpen} onOpenChange={setRubricDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nouvelle rubrique budgétaire</DialogTitle></DialogHeader>
          <form onSubmit={rubricForm.handleSubmit(createRubric)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code <span className="text-destructive">*</span></Label>
                <Input placeholder="COM-001" {...rubricForm.register('code')} />
              </div>
              <div className="space-y-2">
                <Label>Catégorie <span className="text-destructive">*</span></Label>
                <Select onValueChange={v => rubricForm.setValue('category', v as 'operating')}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nom en Français <span className="text-destructive">*</span></Label>
              <Input placeholder="Communication et publicité" {...rubricForm.register('name_fr')} />
            </div>
            <div className="space-y-2">
              <Label>Nom en Anglais <span className="text-destructive">*</span></Label>
              <Input placeholder="Communication and advertising" {...rubricForm.register('name_en')} />
            </div>
            <div className="space-y-2">
              <Label>Nom en Portugais <span className="text-destructive">*</span></Label>
              <Input placeholder="Comunicação e publicidade" {...rubricForm.register('name_pt')} />
            </div>
            <div className="space-y-2">
              <Label>Organisation (optionnel — si vide = globale)</Label>
              <Select onValueChange={v => rubricForm.setValue('organization_id', v)}>
                <SelectTrigger><SelectValue placeholder="Toutes les organisations..." /></SelectTrigger>
                <SelectContent>
                  {organizations.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRubricDialogOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Créer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
