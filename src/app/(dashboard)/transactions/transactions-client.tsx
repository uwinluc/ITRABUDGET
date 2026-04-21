'use client'

import { useState, useMemo, useEffect } from 'react'
import { ArrowRightLeft, Search, ChevronDown, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { cn, formatDate } from '@/lib/utils'
import type { BudgetTransaction, TransactionType } from '@/types/database'

interface TxEnriched extends BudgetTransaction {
  profile?: { first_name: string; last_name: string } | null
  organization?: { name: string; code: string } | null
  budget?: { title: string } | null
}

interface Props {
  transactions: TxEnriched[]
  organizations: Array<{ id: string; name: string; code: string }>
  currentUserRoles: string[]
}

const TYPE_CONFIG: Record<TransactionType, { label: string; color: string }> = {
  creation:      { label: 'Création',      color: 'bg-blue-100 text-blue-800' },
  submission:    { label: 'Soumission',    color: 'bg-indigo-100 text-indigo-800' },
  validation:    { label: 'Validation',    color: 'bg-green-100 text-green-800' },
  rejection:     { label: 'Rejet',         color: 'bg-red-100 text-red-800' },
  adjustment:    { label: 'Ajustement',    color: 'bg-yellow-100 text-yellow-800' },
  locking:       { label: 'Verrouillage',  color: 'bg-purple-100 text-purple-800' },
  transmission:  { label: 'Transmission',  color: 'bg-cyan-100 text-cyan-800' },
  consolidation: { label: 'Consolidation', color: 'bg-teal-100 text-teal-800' },
  amendment:     { label: 'Amendement',    color: 'bg-orange-100 text-orange-800' },
  transfer:      { label: 'Transfert',     color: 'bg-pink-100 text-pink-800' },
}

const STATUS_FLOW: Record<string, string> = {
  draft: 'Brouillon', submitted: 'Soumis', under_review: 'En révision',
  approved: 'Approuvé', rejected: 'Rejeté', locked: 'Verrouillé',
  transmitted: 'Transmis', consolidated: 'Consolidé', final: 'Final',
}

function formatAmount(amount: number | null, currency: string | null): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency ?? 'USD', maximumFractionDigits: 0 }).format(amount)
}

const PAGE_SIZE = 50

export function TransactionsClient({ transactions, organizations }: Props) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [orgFilter, setOrgFilter] = useState('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const typeOptions = useMemo(() => {
    const types = new Set(transactions.map(t => t.type))
    return Array.from(types)
  }, [transactions])

  useEffect(() => { setPage(1) }, [search, typeFilter, orgFilter])

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (search) {
        const q = search.toLowerCase()
        const name = t.profile ? `${t.profile.first_name} ${t.profile.last_name}`.toLowerCase() : ''
        const budgetTitle = (t.budget?.title ?? '').toLowerCase()
        if (!name.includes(q) && !budgetTitle.includes(q) && !t.type.includes(q) && !(t.comment ?? '').toLowerCase().includes(q)) return false
      }
      if (typeFilter !== 'all' && t.type !== typeFilter) return false
      if (orgFilter !== 'all' && t.organization_id !== orgFilter) return false
      return true
    })
  }, [transactions, search, typeFilter, orgFilter])

  const totalUSD = transactions.reduce((s, t) => s + (t.amount_usd ?? 0), 0)
  const validations = transactions.filter(t => t.type === 'validation').length
  const rejections = transactions.filter(t => t.type === 'rejection').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ArrowRightLeft className="h-6 w-6 text-blue-500" />
          Transactions budgétaires
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Historique complet de toutes les opérations sur les budgets
        </p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total transactions', value: transactions.length },
          { label: 'Montant total (USD)', value: new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalUSD) },
          { label: 'Validations', value: validations },
          { label: 'Rejets', value: rejections },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 text-center">
              <p className="text-xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Rechercher budget, utilisateur, commentaire..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {typeOptions.map(t => (
              <SelectItem key={t} value={t}>{TYPE_CONFIG[t as TransactionType]?.label ?? t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={orgFilter} onValueChange={setOrgFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Organisation" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les orgs</SelectItem>
            {organizations.map(o => (
              <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(search || typeFilter !== 'all' || orgFilter !== 'all') && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setTypeFilter('all'); setOrgFilter('all'); setPage(1) }}>
            Réinitialiser
          </Button>
        )}
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center text-muted-foreground">
            <ArrowRightLeft className="h-12 w-12 mb-3 opacity-20" />
            <p className="font-medium">Aucune transaction trouvée</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-normal">
              {filtered.length} transaction(s)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {filtered.slice(0, page * PAGE_SIZE).map(tx => {
                const cfg = TYPE_CONFIG[tx.type as TransactionType] ?? { label: tx.type, color: 'bg-muted text-muted-foreground' }
                const isExpanded = expandedId === tx.id
                const hasComment = !!tx.comment

                return (
                  <div key={tx.id} className="hover:bg-muted/30 transition-colors">
                    <div
                      className={cn('flex items-start gap-3 px-4 py-3', hasComment && 'cursor-pointer')}
                      onClick={() => hasComment && setExpandedId(isExpanded ? null : tx.id)}
                    >
                      <div className="mt-0.5 shrink-0 w-4">
                        {hasComment ? (
                          isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        ) : null}
                      </div>

                      <span className={cn('shrink-0 px-2 py-0.5 rounded text-xs font-semibold', cfg.color)}>
                        {cfg.label}
                      </span>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          <span className="text-sm font-medium truncate">
                            {tx.budget?.title ?? tx.budget_id}
                          </span>
                          {tx.organization && (
                            <span className="text-xs text-muted-foreground">{tx.organization.name}</span>
                          )}
                          {tx.from_status && tx.to_status && (
                            <span className="text-xs text-muted-foreground">
                              {STATUS_FLOW[tx.from_status] ?? tx.from_status} → {STATUS_FLOW[tx.to_status] ?? tx.to_status}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                          <span>
                            {tx.profile ? `${tx.profile.first_name} ${tx.profile.last_name}` : 'Système'}
                          </span>
                          <span>{formatDate(tx.created_at)}</span>
                          {tx.amount != null && (
                            <span className="font-medium text-foreground">
                              {formatAmount(tx.amount, tx.currency_code)}
                              {tx.amount_usd != null && tx.currency_code !== 'USD' && (
                                <span className="text-muted-foreground ml-1">({formatAmount(tx.amount_usd, 'USD')})</span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isExpanded && tx.comment && (
                      <div className="px-11 pb-3">
                        <p className="text-xs bg-muted rounded p-2 text-muted-foreground italic">
                          {tx.comment}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {filtered.length > page * PAGE_SIZE && (
              <div className="p-4 text-center border-t">
                <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)}>
                  Voir plus ({filtered.length - page * PAGE_SIZE} restantes)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
