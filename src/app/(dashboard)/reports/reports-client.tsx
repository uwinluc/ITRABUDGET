'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart3, Download, TrendingUp, FileText, Building2, DollarSign,
  CheckCircle2, Clock, Eye
} from 'lucide-react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { exportBudgetsReportToExcel, exportExecutionReportToExcel } from '@/lib/excel'

const STATUS_COLORS: Record<string, string> = {
  draft:        '#94a3b8',
  submitted:    '#60a5fa',
  under_review: '#fbbf24',
  approved:     '#34d399',
  rejected:     '#f87171',
  locked:       '#a78bfa',
  transmitted:  '#818cf8',
  consolidated: '#2dd4bf',
  final:        '#10b981',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon', submitted: 'Soumis', under_review: 'En révision',
  approved: 'Approuvé', rejected: 'Rejeté', locked: 'Verrouillé',
  transmitted: 'Transmis', consolidated: 'Consolidé', final: 'Final',
}

const CATEGORY_LABELS: Record<string, string> = {
  operating: 'Fonctionnement', investment: 'Investissement',
  revenue: 'Recette', project: 'Projet', other: 'Autre',
}

const CATEGORY_COLORS = ['#60a5fa', '#f97316', '#34d399', '#a78bfa', '#94a3b8']

interface Props {
  budgets: Record<string, unknown>[]
  organizations: Array<{ id: string; name: string; code: string; level: string }>
  fiscalYears: Array<{ id: string; code: string; name: string; status: string }>
  lines: Array<{ id: string; budget_id: string; amount_htva: number; category: string }>
  credits: Array<{ id: string; budget_line_id: string; amount: number }>
  engagements: Array<{ id: string; credit_opening_id: string; amount: number }>
  payments: Array<{ id: string; ordonnance_id: string; amount: number }>
}

type Section = 'overview' | 'execution' | 'budgets'

export function ReportsClient({
  budgets, organizations, fiscalYears, lines, credits, engagements, payments
}: Props) {
  const router = useRouter()
  const [section, setSection] = useState<Section>('overview')
  const [filterFY, setFilterFY] = useState<string>('all')

  // ── Filtrage par exercice ──────────────────────────────────
  const filteredBudgets = filterFY === 'all'
    ? budgets
    : budgets.filter(b => b.fiscal_year_id === filterFY)

  // ── KPIs globaux ──────────────────────────────────────────
  const totalBudgets = filteredBudgets.length
  const totalAmount  = filteredBudgets.reduce((s, b) => s + ((b.total_amount_htva as number) ?? 0), 0)

  const filteredLineIds = lines
    .filter(l => filteredBudgets.some(b => b.id === l.budget_id))
    .map(l => l.id)

  const filteredCredits = credits.filter(c => filteredLineIds.includes(c.budget_line_id))
  const filteredCreditIds = filteredCredits.map(c => c.id)
  const filteredEngagements = engagements.filter(e => filteredCreditIds.includes(e.credit_opening_id))
  const totalEngaged = filteredEngagements.reduce((s, e) => s + (e.amount ?? 0), 0)
  const totalPaid    = payments.reduce((s, p) => s + (p.amount ?? 0), 0)
  const execRate     = totalAmount > 0 ? (totalEngaged / totalAmount) * 100 : 0

  // ── Données donut par statut ───────────────────────────────
  const statusData = Object.entries(
    filteredBudgets.reduce<Record<string, number>>((acc, b) => {
      const s = b.status as string
      acc[s] = (acc[s] ?? 0) + 1
      return acc
    }, {})
  ).map(([status, count]) => ({
    name:   STATUS_LABELS[status] ?? status,
    value:  count,
    color:  STATUS_COLORS[status] ?? '#94a3b8',
    status,
  }))

  // ── Données bar par organisation ───────────────────────────
  const orgAmountData = organizations
    .map(org => {
      const orgBudgets = filteredBudgets.filter(b => b.organization_id === org.id)
      const amount = orgBudgets.reduce((s, b) => s + ((b.total_amount_htva as number) ?? 0), 0)
      if (amount === 0) return null
      return { name: org.code ?? org.name.slice(0, 10), fullName: org.name, amount, count: orgBudgets.length }
    })
    .filter(Boolean)
    .sort((a, b) => (b!.amount - a!.amount))
    .slice(0, 10) as Array<{ name: string; fullName: string; amount: number; count: number }>

  // ── Données bar par catégorie ──────────────────────────────
  const filteredLines = lines.filter(l => filteredBudgets.some(b => b.id === l.budget_id))
  const categoryData = Object.entries(
    filteredLines.reduce<Record<string, number>>((acc, l) => {
      const cat = l.category
      acc[cat] = (acc[cat] ?? 0) + (l.amount_htva ?? 0)
      return acc
    }, {})
  )
    .map(([cat, amount], i) => ({
      name:   CATEGORY_LABELS[cat] ?? cat,
      amount: Math.round(amount),
      color:  CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    }))
    .sort((a, b) => b.amount - a.amount)

  // ── Données exécution par org ──────────────────────────────
  const execData = organizations
    .map(org => {
      const orgBudgets  = filteredBudgets.filter(b => b.organization_id === org.id)
      const orgLines    = lines.filter(l => orgBudgets.some(b => b.id === l.budget_id))
      const orgLineIds  = orgLines.map(l => l.id)
      const orgCredits  = credits.filter(c => orgLineIds.includes(c.budget_line_id))
      const orgCreditIds = orgCredits.map(c => c.id)
      const orgEngaged  = engagements.filter(e => orgCreditIds.includes(e.credit_opening_id)).reduce((s, e) => s + (e.amount ?? 0), 0)
      const budget      = orgLines.reduce((s, l) => s + (l.amount_htva ?? 0), 0)
      if (budget === 0) return null
      return {
        name:    org.code ?? org.name.slice(0, 8),
        fullName: org.name,
        budget:  Math.round(budget),
        engage:  Math.round(orgEngaged),
      }
    })
    .filter(Boolean)
    .sort((a, b) => b!.budget - a!.budget)
    .slice(0, 8) as Array<{ name: string; fullName: string; budget: number; engage: number }>

  // ── Export Excel ───────────────────────────────────────────
  const handleExportBudgets = () => {
    exportBudgetsReportToExcel(filteredBudgets, organizations, fiscalYears)
  }

  const handleExportExecution = () => {
    exportExecutionReportToExcel(
      execData.map(d => ({
        org:      d.fullName,
        budget:   d.budget,
        credited: 0,
        engaged:  d.engage,
        paid:     0,
      }))
    )
  }

  // ── Top budgets ────────────────────────────────────────────
  const topBudgets = [...filteredBudgets]
    .sort((a, b) => ((b.total_amount_htva as number) ?? 0) - ((a.total_amount_htva as number) ?? 0))
    .slice(0, 10)

  const getOrgName = (id: string) => organizations.find(o => o.id === id)?.name ?? '—'
  const getFYCode  = (id: string) => fiscalYears.find(f => f.id === id)?.code ?? '—'

  const fmt = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 0 })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Rapports & Analyses
          </h1>
          <p className="text-muted-foreground mt-1">Tableaux de bord budgétaires consolidés</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground shrink-0">Exercice :</Label>
            <Select value={filterFY} onValueChange={setFilterFY}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {fiscalYears.map(f => (
                  <SelectItem key={f.id} value={f.id}>{f.code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportBudgets}>
            <Download className="h-4 w-4" />
            Export budgets
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExecution}>
            <Download className="h-4 w-4" />
            Export exécution
          </Button>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        {([
          { id: 'overview', label: 'Vue d\'ensemble' },
          { id: 'execution', label: 'Exécution' },
          { id: 'budgets',  label: 'Top Budgets' },
        ] as Array<{ id: Section; label: string }>).map(tab => (
          <button
            key={tab.id}
            onClick={() => setSection(tab.id)}
            className={cn(
              'px-4 py-1.5 text-sm rounded-md font-medium transition-all',
              section === tab.id
                ? 'bg-background shadow text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Budgets',    value: totalBudgets,  suffix: '',   icon: FileText,     color: 'text-blue-600' },
          { label: 'Total USD',  value: fmt(totalAmount),  suffix: '', icon: DollarSign, color: 'text-foreground', isStr: true },
          { label: 'Taux exec.', value: execRate.toFixed(1), suffix: '%', icon: TrendingUp, color: 'text-orange-600', isStr: true },
          { label: 'Payé USD',   value: fmt(totalPaid), suffix: '',   icon: CheckCircle2, color: 'text-green-600', isStr: true },
        ].map(({ label, value, suffix, icon: Icon, color, isStr }) => (
          <Card key={label}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className={cn('text-2xl font-bold', color)}>
                    {value}{suffix}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{label}</p>
                </div>
                <Icon className={cn('h-5 w-5 mt-0.5', color)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Vue d'ensemble ───────────────────────────────── */}
      {section === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Donut statuts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Budgets par statut</CardTitle>
              <CardDescription>{totalBudgets} budgets au total</CardDescription>
            </CardHeader>
            <CardContent>
              {statusData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                  Aucune donnée
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={180} height={180}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        dataKey="value"
                        paddingAngle={2}
                      >
                        {statusData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v, n) => [v, n]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1.5">
                    {statusData.map(d => (
                      <div key={d.status} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                          <span className="text-muted-foreground">{d.name}</span>
                        </div>
                        <span className="font-semibold">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bar catégories */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Montants par catégorie</CardTitle>
              <CardDescription>Total HTVA en devise locale</CardDescription>
            </CardHeader>
            <CardContent>
              {categoryData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Aucune donnée</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={categoryData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                    <Tooltip formatter={(v) => [(v as number)?.toLocaleString('fr-FR'), 'Montant']} />
                    <Bar dataKey="amount" radius={[3, 3, 0, 0]}>
                      {categoryData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Bar montants par org */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Budget total par organisation</CardTitle>
              <CardDescription>Top 10 organisations par montant budgétaire</CardDescription>
            </CardHeader>
            <CardContent>
              {orgAmountData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Aucune donnée</div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={orgAmountData} layout="vertical" margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={55} />
                    <Tooltip
                      formatter={(v) => [(v as number)?.toLocaleString('fr-FR'), 'Montant']}
                      labelFormatter={(_l, payload) => payload?.[0]?.payload?.fullName ?? _l}
                    />
                    <Bar dataKey="amount" fill="#60a5fa" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Exécution ────────────────────────────────────── */}
      {section === 'execution' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Budget vs Engagé par organisation</CardTitle>
              <CardDescription>Comparaison montant budgété et montant engagé</CardDescription>
            </CardHeader>
            <CardContent>
              {execData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                  Aucune donnée d&apos;exécution — les budgets doivent être verrouillés et avoir des crédits ouverts.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={execData} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                    <Tooltip
                      formatter={(v, n) => [(v as number)?.toLocaleString('fr-FR'), n === 'budget' ? 'Budget' : 'Engagé']}
                      labelFormatter={(_l, payload) => payload?.[0]?.payload?.fullName ?? _l}
                    />
                    <Legend formatter={v => v === 'budget' ? 'Budget' : 'Engagé'} />
                    <Bar dataKey="budget" fill="#94a3b8" name="budget" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="engage" fill="#f97316" name="engage" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Table taux exec */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Taux d&apos;exécution par organisation</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {execData.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Aucune donnée</div>
              ) : (
                <div className="divide-y">
                  {execData.map(d => {
                    const rate = d.budget > 0 ? (d.engage / d.budget) * 100 : 0
                    return (
                      <div key={d.name} className="flex items-center gap-4 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{d.fullName}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-orange-400 transition-all"
                                style={{ width: `${Math.min(rate, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-muted-foreground w-10 text-right">{rate.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div className="text-right text-xs text-muted-foreground shrink-0">
                          <p>{fmt(d.engage)} / {fmt(d.budget)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Top Budgets ──────────────────────────────────── */}
      {section === 'budgets' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 10 budgets par montant</CardTitle>
            <CardDescription>Classés par montant HTVA décroissant</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {topBudgets.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Aucun budget</div>
            ) : (
              <div className="divide-y">
                {topBudgets.map((b, idx) => (
                  <div key={b.id as string} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-sm font-bold shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{b.title as string}</span>
                        <span className={cn(
                          'text-xs px-1.5 py-0.5 rounded-full font-medium',
                          `bg-[${STATUS_COLORS[b.status as string]}20] text-[${STATUS_COLORS[b.status as string]}]`
                        )}>
                          {STATUS_LABELS[b.status as string] ?? b.status as string}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {getOrgName(b.organization_id as string)}
                        </span>
                        <span>{getFYCode(b.fiscal_year_id as string)}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-sm">
                        {((b.total_amount_htva as number) ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-muted-foreground">{b.currency_code as string}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => router.push(`/budgets/${b.id as string}`)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
