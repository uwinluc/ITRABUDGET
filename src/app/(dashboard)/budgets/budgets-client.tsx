'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Plus, Search, Filter, FileText, ArrowRight, Clock, CheckCircle2, XCircle, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate, cn } from '@/lib/utils'
import type { BudgetStatus } from '@/types/database'

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft:        { label: 'Brouillon',    color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',       icon: FileText },
  submitted:    { label: 'Soumis',       color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',       icon: ArrowRight },
  under_review: { label: 'En révision',  color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', icon: Clock },
  approved:     { label: 'Approuvé',     color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',   icon: CheckCircle2 },
  rejected:     { label: 'Rejeté',       color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',           icon: XCircle },
  locked:       { label: 'Verrouillé',   color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', icon: Lock },
  transmitted:  { label: 'Transmis',     color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300', icon: ArrowRight },
  consolidated: { label: 'Consolidé',    color: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300',       icon: CheckCircle2 },
  final:        { label: 'Final',        color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300', icon: CheckCircle2 },
}

interface Budget {
  id: string
  title: string
  status: string
  created_at: string
  submitted_at: string | null
  locked_at: string | null
  fiscal_year_id: string
  organization_id: string
  line_count: number
  organization?: { id: string; name: string; code: string }
  fiscal_year?: { id: string; code: string; name: string }
}

interface Props {
  budgets: Budget[]
  organizations: Array<{ id: string; name: string; code: string; level: string }>
  fiscalYears: Array<{ id: string; code: string; name: string; status: string }>
  currentUserId: string
}

export function BudgetsClient({ budgets, organizations, fiscalYears }: Props) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [orgFilter, setOrgFilter] = useState<string>('all')
  const [fyFilter, setFyFilter] = useState<string>('all')

  const filtered = budgets.filter(b => {
    const matchSearch = b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.organization?.name.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || b.status === statusFilter
    const matchOrg = orgFilter === 'all' || b.organization_id === orgFilter
    const matchFy = fyFilter === 'all' || b.fiscal_year_id === fyFilter
    return matchSearch && matchStatus && matchOrg && matchFy
  })

  const stats = {
    total: budgets.length,
    draft: budgets.filter(b => b.status === 'draft').length,
    pending: budgets.filter(b => ['submitted', 'under_review'].includes(b.status)).length,
    approved: budgets.filter(b => ['approved', 'locked'].includes(b.status)).length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Budgets de prévision</h1>
          <p className="text-muted-foreground">{budgets.length} budget{budgets.length > 1 ? 's' : ''} au total</p>
        </div>
        <Link href="/budgets/new">
          <Button>
            <Plus className="h-4 w-4" />
            Nouveau budget
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'text-foreground' },
          { label: 'Brouillons', value: stats.draft, color: 'text-gray-600' },
          { label: 'En attente', value: stats.pending, color: 'text-yellow-600' },
          { label: 'Approuvés', value: stats.approved, color: 'text-green-600' },
        ].map(s => (
          <Card key={s.label} className="p-4 text-center">
            <div className={cn('text-2xl font-bold', s.color)}>{s.value}</div>
            <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un budget..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-8"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-40">
                  <Filter className="h-3.5 w-3.5 mr-1" />
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={orgFilter} onValueChange={setOrgFilter}>
                <SelectTrigger className="h-8 w-44">
                  <SelectValue placeholder="Organisation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les orgs</SelectItem>
                  {organizations.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={fyFilter} onValueChange={setFyFilter}>
                <SelectTrigger className="h-8 w-36">
                  <SelectValue placeholder="Exercice" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  {fiscalYears.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.code} — {f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aucun budget trouvé</p>
              <Link href="/budgets/new">
                <Button variant="outline" size="sm" className="mt-4">Créer un budget</Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map(budget => {
                const cfg = STATUS_CONFIG[budget.status] ?? STATUS_CONFIG.draft
                const StatusIcon = cfg.icon
                return (
                  <Link href={`/budgets/${budget.id}`} key={budget.id}>
                    <div className="flex items-center gap-4 px-6 py-4 hover:bg-muted/40 transition-colors">
                      <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center shrink-0">
                        <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{budget.title}</span>
                          <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium', cfg.color)}>
                            <StatusIcon className="h-3 w-3" />
                            {cfg.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          {budget.organization && <span>🏢 {budget.organization.name}</span>}
                          {budget.fiscal_year && <span>📅 {budget.fiscal_year.code}</span>}
                          <span>{budget.line_count} ligne{budget.line_count > 1 ? 's' : ''}</span>
                          <span>Créé le {formatDate(budget.created_at)}</span>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
