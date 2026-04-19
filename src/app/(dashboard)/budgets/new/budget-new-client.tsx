'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, Loader2, ChevronDown, ChevronUp, Paperclip, Save, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const CATEGORIES = [
  { value: 'operating',   label: 'Fonctionnement' },
  { value: 'investment',  label: 'Investissement' },
  { value: 'revenue',     label: 'Recette' },
  { value: 'project',     label: 'Projet' },
  { value: 'other',       label: 'Autre' },
]

const PRIORITIES = [
  { value: 'low',      label: 'Faible',    color: 'bg-gray-100 text-gray-700' },
  { value: 'medium',   label: 'Moyenne',   color: 'bg-blue-100 text-blue-700' },
  { value: 'high',     label: 'Haute',     color: 'bg-orange-100 text-orange-700' },
  { value: 'critical', label: 'Critique',  color: 'bg-red-100 text-red-700' },
]

const lineSchema = z.object({
  title: z.string().min(2, 'Requis'),
  description: z.string().optional(),
  category: z.enum(['operating', 'investment', 'revenue', 'project', 'other']),
  rubric_id: z.string().optional(),
  paa: z.string().optional(),
  period_start: z.string().optional(),
  period_end: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  quantity: z.number({ coerce: true }).positive('> 0'),
  unit_id: z.string().optional(),
  unit_label: z.string().optional(),
  unit_price: z.number({ coerce: true }).min(0),
  price_type: z.enum(['htva', 'tvac']).default('htva'),
  vat_rate: z.number({ coerce: true }).min(0).max(100).default(0),
  currency_code: z.string().length(3),
  justification_why: z.string().min(10, 'Minimum 10 caractères'),
  justification_consequence: z.string().min(10, 'Minimum 10 caractères'),
  is_recurring: z.boolean().default(false),
})

const budgetSchema = z.object({
  title: z.string().min(3, 'Minimum 3 caractères'),
  organization_id: z.string().uuid('Requis'),
  fiscal_year_id: z.string().uuid('Requis'),
  lines: z.array(lineSchema).min(1, 'Ajoutez au moins une ligne budgétaire'),
})

type BudgetForm = z.infer<typeof budgetSchema>
type LineForm = z.infer<typeof lineSchema>

interface Props {
  organizations: Array<{ id: string; name: string; code: string; level: string; currency_code: string | null }>
  fiscalYears: Array<{ id: string; code: string; name: string; status: string; organization_id: string; reference_currency: string }>
  currencies: Array<{ code: string; name_fr: string; symbol: string }>
  units: Array<{ id: string; code: string; name_fr: string }>
  rubrics: Array<{ id: string; code: string; name_fr: string; category: string }>
  currentUserId: string
}

function computeAmounts(line: Partial<LineForm>) {
  const qty = Number(line.quantity) || 0
  const price = Number(line.unit_price) || 0
  const vat = Number(line.vat_rate) || 0
  const htva = qty * price
  const tvac = htva * (1 + vat / 100)
  return { htva, tvac }
}

export function BudgetNewClient({ organizations, fiscalYears, currencies, units, rubrics, currentUserId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [expandedLines, setExpandedLines] = useState<Record<number, boolean>>({ 0: true })
  const [submitMode, setSubmitMode] = useState<'draft' | 'submit'>('draft')

  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<BudgetForm>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      title: '',
      organization_id: '',
      fiscal_year_id: '',
      lines: [{
        title: '', description: '', category: 'operating', priority: 'medium',
        quantity: 1, unit_price: 0, price_type: 'htva', vat_rate: 0,
        currency_code: 'USD', justification_why: '', justification_consequence: '',
        is_recurring: false,
      }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })
  const watchedLines = watch('lines')
  const watchedOrgId = watch('organization_id')

  const filteredFY = fiscalYears.filter(f =>
    !watchedOrgId || f.organization_id === watchedOrgId
  )

  const toggleLine = (idx: number) =>
    setExpandedLines(prev => ({ ...prev, [idx]: !prev[idx] }))

  const addLine = () => {
    const defaultCurrency = organizations.find(o => o.id === watchedOrgId)?.currency_code ?? 'USD'
    append({
      title: '', description: '', category: 'operating', priority: 'medium',
      quantity: 1, unit_price: 0, price_type: 'htva', vat_rate: 0,
      currency_code: defaultCurrency, justification_why: '', justification_consequence: '',
      is_recurring: false,
    })
    setExpandedLines(prev => ({ ...prev, [fields.length]: true }))
  }

  const onSubmit = async (data: BudgetForm) => {
    setLoading(true)
    const supabase = createClient()
    try {
      // 1. Créer le budget
      const { data: budget, error: budgetErr } = await supabase
        .from('budgets')
        .insert({
          title: data.title,
          organization_id: data.organization_id,
          fiscal_year_id: data.fiscal_year_id,
          status: submitMode === 'submit' ? 'submitted' : 'draft',
          created_by: currentUserId,
          submitted_at: submitMode === 'submit' ? new Date().toISOString() : null,
        })
        .select('id')
        .single()

      if (budgetErr || !budget) throw budgetErr ?? new Error('Erreur création budget')

      // 2. Créer les lignes budgétaires
      const linesInsert = data.lines.map((line, idx) => ({
        budget_id: budget.id,
        title: line.title,
        description: line.description || null,
        category: line.category,
        rubric_id: line.rubric_id || null,
        paa: line.paa || null,
        period_start: line.period_start || null,
        period_end: line.period_end || null,
        priority: line.priority,
        quantity: line.quantity,
        unit_id: line.unit_id || null,
        unit_label: line.unit_label || null,
        unit_price: line.unit_price,
        price_type: line.price_type,
        vat_rate: line.vat_rate,
        currency_code: line.currency_code,
        justification_why: line.justification_why,
        justification_consequence: line.justification_consequence,
        is_recurring: line.is_recurring,
        line_number: idx + 1,
        created_by: currentUserId,
      }))

      const { error: linesErr } = await supabase.from('budget_lines').insert(linesInsert)
      if (linesErr) throw linesErr

      // 3. Créer la transaction immuable
      await supabase.from('budget_transactions').insert({
        budget_id: budget.id,
        type: submitMode === 'submit' ? 'submission' : 'creation',
        from_status: null,
        to_status: submitMode === 'submit' ? 'submitted' : 'draft',
        performed_by: currentUserId,
        organization_id: data.organization_id,
        comment: submitMode === 'submit' ? 'Soumission initiale du budget' : 'Création du budget en brouillon',
      })

      toast.success(submitMode === 'submit' ? 'Budget soumis avec succès !' : 'Budget sauvegardé en brouillon')
      router.push(`/budgets/${budget.id}`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur lors de la création')
    } finally {
      setLoading(false)
    }
  }

  const totalByCategory = (watchedLines ?? []).reduce((acc, line) => {
    const cat = line.category ?? 'other'
    const { htva } = computeAmounts(line)
    acc[cat] = (acc[cat] ?? 0) + htva
    return acc
  }, {} as Record<string, number>)

  const grandTotal = Object.values(totalByCategory).reduce((a, b) => a + b, 0)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Nouveau budget</h1>
          <p className="text-muted-foreground">Saisissez les lignes budgétaires de prévision</p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>Annuler</Button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Informations générales */}
        <Card>
          <CardHeader>
            <CardTitle>Informations générales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Intitulé du budget <span className="text-destructive">*</span></Label>
              <Input placeholder="Ex: Budget Fonctionnement 2025 — Direction SI" {...register('title')} />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Organisation <span className="text-destructive">*</span></Label>
                <Select onValueChange={v => { setValue('organization_id', v); setValue('fiscal_year_id', '') }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une organisation..." />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map(o => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name} <span className="text-muted-foreground ml-1 text-xs">({o.code})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.organization_id && <p className="text-xs text-destructive">{errors.organization_id.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Exercice fiscal <span className="text-destructive">*</span></Label>
                <Select onValueChange={v => setValue('fiscal_year_id', v)} disabled={!watchedOrgId}>
                  <SelectTrigger>
                    <SelectValue placeholder={watchedOrgId ? 'Sélectionner...' : "Choisir d'abord une organisation"} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredFY.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.code} — {f.name}</SelectItem>
                    ))}
                    {filteredFY.length === 0 && (
                      <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                        Aucun exercice disponible.<br />
                        <a href="/settings/fiscal-years" className="text-primary underline">Créer un exercice</a>
                      </div>
                    )}
                  </SelectContent>
                </Select>
                {errors.fiscal_year_id && <p className="text-xs text-destructive">{errors.fiscal_year_id.message}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lignes budgétaires */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Lignes budgétaires</h2>
              <p className="text-sm text-muted-foreground">{fields.length} ligne{fields.length > 1 ? 's' : ''}</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="h-4 w-4" />
              Ajouter une ligne
            </Button>
          </div>

          {errors.lines && typeof errors.lines.message === 'string' && (
            <p className="text-sm text-destructive">{errors.lines.message}</p>
          )}

          {fields.map((field, idx) => {
            const line = watchedLines?.[idx] ?? {}
            const { htva, tvac } = computeAmounts(line)
            const isExpanded = expandedLines[idx] !== false
            const lineErrors = errors.lines?.[idx]
            const hasError = !!lineErrors

            return (
              <Card key={field.id} className={cn('overflow-hidden', hasError && 'border-destructive')}>
                {/* Header ligne */}
                <div
                  className="flex items-center gap-3 px-4 py-3 bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors"
                  onClick={() => toggleLine(idx)}
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm">
                      {line.title || <span className="text-muted-foreground italic">Nouvelle ligne...</span>}
                    </span>
                    {line.category && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {CATEGORIES.find(c => c.value === line.category)?.label}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {htva > 0 && (
                      <span className="text-sm font-semibold">
                        {htva.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {line.currency_code}
                      </span>
                    )}
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                        onClick={(e) => { e.stopPropagation(); remove(idx) }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>

                {/* Contenu ligne */}
                {isExpanded && (
                  <CardContent className="pt-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Intitulé <span className="text-destructive">*</span></Label>
                        <Input placeholder="Ex: Achat carburant véhicules" {...register(`lines.${idx}.title`)} />
                        {lineErrors?.title && <p className="text-xs text-destructive">{lineErrors.title.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label>PAA (Plan d'Action Annuel)</Label>
                        <Input placeholder="Ex: PAA-2025-IT-001" {...register(`lines.${idx}.paa`)} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea placeholder="Description détaillée du besoin..." rows={2} {...register(`lines.${idx}.description`)} />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label>Catégorie <span className="text-destructive">*</span></Label>
                        <Select onValueChange={v => setValue(`lines.${idx}.category`, v as 'operating')} defaultValue="operating">
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Rubrique</Label>
                        <Select onValueChange={v => setValue(`lines.${idx}.rubric_id`, v)}>
                          <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                          <SelectContent>
                            {rubrics.filter(r => !line.category || r.category === line.category).map(r => (
                              <SelectItem key={r.id} value={r.id}>{r.name_fr}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Priorité</Label>
                        <Select onValueChange={v => setValue(`lines.${idx}.priority`, v as 'medium')} defaultValue="medium">
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Devise <span className="text-destructive">*</span></Label>
                        <Select onValueChange={v => setValue(`lines.${idx}.currency_code`, v)} defaultValue="USD">
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {currencies.map(c => (
                              <SelectItem key={c.code} value={c.code}>{c.code} — {c.name_fr}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Période */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Début de période</Label>
                        <Input type="date" {...register(`lines.${idx}.period_start`)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Fin de période</Label>
                        <Input type="date" {...register(`lines.${idx}.period_end`)} />
                      </div>
                    </div>

                    {/* Quantité / Prix */}
                    <div className="p-4 rounded-lg bg-muted/50 space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <Label>Quantité <span className="text-destructive">*</span></Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            {...register(`lines.${idx}.quantity`, { valueAsNumber: true })}
                          />
                          {lineErrors?.quantity && <p className="text-xs text-destructive">{lineErrors.quantity.message}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label>Unité</Label>
                          <Select onValueChange={v => {
                            if (v === '_other') { setValue(`lines.${idx}.unit_id`, undefined) }
                            else setValue(`lines.${idx}.unit_id`, v)
                          }}>
                            <SelectTrigger><SelectValue placeholder="Unité..." /></SelectTrigger>
                            <SelectContent>
                              {units.map(u => <SelectItem key={u.id} value={u.id}>{u.name_fr}</SelectItem>)}
                              <SelectItem value="_other">Autre (saisir librement)</SelectItem>
                            </SelectContent>
                          </Select>
                          {!line.unit_id && (
                            <Input placeholder="Unité libre" {...register(`lines.${idx}.unit_label`)} className="mt-1 h-7 text-xs" />
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>Prix unitaire <span className="text-destructive">*</span></Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            {...register(`lines.${idx}.unit_price`, { valueAsNumber: true })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Type de prix</Label>
                          <Select onValueChange={v => setValue(`lines.${idx}.price_type`, v as 'htva')} defaultValue="htva">
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="htva">HTVA</SelectItem>
                              <SelectItem value="tvac">TVAC</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {line.price_type === 'htva' && (
                        <div className="grid grid-cols-2 gap-4 items-center">
                          <div className="space-y-2">
                            <Label>Taux TVA (%)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="100"
                              {...register(`lines.${idx}.vat_rate`, { valueAsNumber: true })}
                            />
                          </div>
                        </div>
                      )}

                      {/* Totaux calculés */}
                      <div className="flex items-center justify-end gap-6 pt-2 border-t">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Montant HTVA</p>
                          <p className="font-semibold">{htva.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {line.currency_code}</p>
                        </div>
                        {(line.vat_rate ?? 0) > 0 && (
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Montant TVAC</p>
                            <p className="font-semibold text-primary">{tvac.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {line.currency_code}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Récurrence */}
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id={`recurring-${idx}`}
                        {...register(`lines.${idx}.is_recurring`)}
                        className="h-4 w-4 rounded"
                      />
                      <Label htmlFor={`recurring-${idx}`} className="cursor-pointer text-sm">
                        Ligne récurrente (se reproduit chaque exercice)
                      </Label>
                    </div>

                    <Separator />

                    {/* Justifications obligatoires */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        Justifications obligatoires
                        <span className="text-xs text-muted-foreground font-normal">(requis pour validation)</span>
                      </h4>
                      <div className="space-y-2">
                        <Label>1. Pourquoi ce budget est-il nécessaire ? <span className="text-destructive">*</span></Label>
                        <Textarea
                          placeholder="Expliquez le besoin, le contexte et les objectifs visés..."
                          rows={3}
                          {...register(`lines.${idx}.justification_why`)}
                        />
                        {lineErrors?.justification_why && (
                          <p className="text-xs text-destructive">{lineErrors.justification_why.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>2. Conséquence si ce budget est refusé <span className="text-destructive">*</span></Label>
                        <Textarea
                          placeholder="Décrivez l'impact opérationnel, les risques et les conséquences d'un refus..."
                          rows={3}
                          {...register(`lines.${idx}.justification_consequence`)}
                        />
                        {lineErrors?.justification_consequence && (
                          <p className="text-xs text-destructive">{lineErrors.justification_consequence.message}</p>
                        )}
                      </div>
                    </div>

                    {/* Pièces jointes */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Paperclip className="h-4 w-4" />
                      <span>Pièces jointes (contrat, spec. technique...) — disponible après création</span>
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}

          <Button type="button" variant="outline" className="w-full border-dashed" onClick={addLine}>
            <Plus className="h-4 w-4" />
            Ajouter une ligne budgétaire
          </Button>
        </div>

        {/* Récapitulatif total */}
        {watchedLines && watchedLines.some(l => (l.quantity ?? 0) * (l.unit_price ?? 0) > 0) && (
          <Card className="bg-muted/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Récapitulatif</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(totalByCategory).filter(([, v]) => v > 0).map(([cat, amount]) => (
                  <div key={cat} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{CATEGORIES.find(c => c.value === cat)?.label}</span>
                    <span className="font-medium">{amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {watchedLines[0]?.currency_code}</span>
                  </div>
                ))}
                <Separator />
                <div className="flex items-center justify-between font-semibold">
                  <span>Total HTVA</span>
                  <span className="text-lg">{grandTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {watchedLines[0]?.currency_code}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pb-8">
          <Button
            type="submit"
            variant="outline"
            disabled={loading}
            onClick={() => setSubmitMode('draft')}
          >
            {loading && submitMode === 'draft' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Sauvegarder en brouillon
          </Button>
          <Button
            type="submit"
            disabled={loading}
            onClick={() => setSubmitMode('submit')}
          >
            {loading && submitMode === 'submit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Soumettre pour validation
          </Button>
        </div>
      </form>
    </div>
  )
}
