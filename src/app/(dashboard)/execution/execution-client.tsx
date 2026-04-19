'use client'
import { useRouter } from 'next/navigation'
import { PlayCircle, Building2, Calendar, TrendingUp, Eye, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  locked:       { label: 'Verrouillé',  color: 'bg-purple-100 text-purple-700' },
  transmitted:  { label: 'Transmis',    color: 'bg-indigo-100 text-indigo-700' },
  consolidated: { label: 'Consolidé',   color: 'bg-teal-100 text-teal-700' },
  final:        { label: 'Final',       color: 'bg-emerald-100 text-emerald-700' },
}

interface Props {
  budgets: Record<string, unknown>[]
  organizations: Array<{ id: string; name: string; code: string }>
  fiscalYears: Array<{ id: string; code: string; name: string }>
  lines: Array<{ id: string; budget_id: string; amount_htva: number }>
  credits: Array<{ id: string; budget_line_id: string; amount: number }>
  engagements: Array<{ id: string; credit_opening_id: string; amount: number; status: string }>
}

export function ExecutionClient({ budgets, organizations, fiscalYears, lines, credits, engagements }: Props) {
  const router = useRouter()

  const getOrg = (id: string) => organizations.find(o => o.id === id)
  const getFY  = (id: string) => fiscalYears.find(f => f.id === id)

  // Calcul taux d'exécution par budget
  const getBudgetStats = (budgetId: string) => {
    const budgetLines = lines.filter(l => l.budget_id === budgetId)
    const totalBudget = budgetLines.reduce((s, l) => s + (l.amount_htva ?? 0), 0)

    const lineIds = budgetLines.map(l => l.id)
    const budgetCredits = credits.filter(c => lineIds.includes(c.budget_line_id))
    const totalCredited = budgetCredits.reduce((s, c) => s + (c.amount ?? 0), 0)

    const creditIds = budgetCredits.map(c => c.id)
    const budgetEngagements = engagements.filter(e => creditIds.includes(e.credit_opening_id))
    const totalEngaged = budgetEngagements.reduce((s, e) => s + (e.amount ?? 0), 0)

    const execRate = totalBudget > 0 ? (totalEngaged / totalBudget) * 100 : 0
    const creditRate = totalBudget > 0 ? (totalCredited / totalBudget) * 100 : 0

    return { totalBudget, totalCredited, totalEngaged, execRate, creditRate, linesCount: budgetLines.length }
  }

  const totalBudgets = budgets.length
  const budgetsWithCredit = budgets.filter(b => {
    const stats = getBudgetStats(b.id as string)
    return stats.totalCredited > 0
  }).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <PlayCircle className="h-6 w-6" />
          Exécution Budgétaire
        </h1>
        <p className="text-muted-foreground mt-1">
          Suivi des crédits, engagements, liquidations et paiements
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalBudgets}</div>
            <p className="text-xs text-muted-foreground mt-1">Budgets en exécution</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{budgetsWithCredit}</div>
            <p className="text-xs text-muted-foreground mt-1">Avec crédits ouverts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              {credits.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Crédits ouverts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-600">
              {engagements.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Engagements actifs</p>
          </CardContent>
        </Card>
      </div>

      {/* Liste budgets */}
      {budgets.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">Aucun budget en phase d&apos;exécution</p>
            <p className="text-sm text-muted-foreground mt-1">
              Les budgets doivent être verrouillés pour entrer en phase d&apos;exécution.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {budgets.map(budget => {
            const org = getOrg(budget.organization_id as string)
            const fy  = getFY(budget.fiscal_year_id as string)
            const stats = getBudgetStats(budget.id as string)
            const statusCfg = STATUS_CONFIG[budget.status as string] ?? STATUS_CONFIG.locked

            return (
              <Card key={budget.id as string} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold">{budget.title as string}</span>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusCfg.color)}>
                          {statusCfg.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                        {org && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {org.name}
                          </span>
                        )}
                        {fy && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {fy.code}
                          </span>
                        )}
                        <span>{stats.linesCount} ligne{stats.linesCount > 1 ? 's' : ''}</span>
                      </div>

                      {/* Progression exécution */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            Taux d&apos;engagement
                          </span>
                          <span className="font-medium">{stats.execRate.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-500 transition-all"
                            style={{ width: `${Math.min(stats.execRate, 100)}%` }}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <p className="text-muted-foreground">Budget</p>
                            <p className="font-medium">{stats.totalBudget.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Crédits</p>
                            <p className="font-medium text-blue-600">{stats.totalCredited.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Engagé</p>
                            <p className="font-medium text-green-600">{stats.totalEngaged.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/execution/${budget.id as string}`)}
                    >
                      <Eye className="h-4 w-4" />
                      Exécuter
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
