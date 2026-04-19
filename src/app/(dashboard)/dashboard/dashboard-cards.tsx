'use client'
import Link from 'next/link'
import { Building2, Users, FileText, Clock, TrendingUp, AlertCircle, ArrowRight, BarChart3, ArrowUpRight } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn, formatDate } from '@/lib/utils'
import type { UserRole, BudgetStatus } from '@/types/database'

const STATUS_CONFIG: Record<BudgetStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' }> = {
  draft:         { label: 'Brouillon',   variant: 'secondary' },
  submitted:     { label: 'Soumis',      variant: 'info' },
  under_review:  { label: 'En révision', variant: 'warning' },
  approved:      { label: 'Approuvé',    variant: 'success' },
  rejected:      { label: 'Rejeté',      variant: 'destructive' },
  locked:        { label: 'Verrouillé',  variant: 'default' },
  transmitted:   { label: 'Transmis',    variant: 'info' },
  consolidated:  { label: 'Consolidé',   variant: 'success' },
  final:         { label: 'Final',       variant: 'success' },
}

const STATUS_CHART_COLORS: Record<string, string> = {
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

interface Props {
  profile: { first_name: string; last_name: string } | null
  userRoles: UserRole[]
  isHolding: boolean
  stats: { orgCount: number; userCount: number; budgetCount: number; pendingCount: number }
  recentBudgets: Array<{ id: string; title: string; status: string; created_at: string; organization?: { name: string } | null }>
  statusBreakdown: Record<string, number>
}

const QUICK_ACTIONS: Array<{ label: string; href: string; icon: React.ElementType; roles?: UserRole[]; gradient: string; desc: string }> = [
  { label: 'Nouveau budget',  href: '/budgets/new',    icon: FileText,   gradient: 'stat-blue',   desc: 'Créer un budget prévisionnel' },
  { label: 'Organisations',   href: '/organizations',  icon: Building2,  gradient: 'stat-violet', desc: 'Gérer la structure du groupe', roles: ['admin','dg_holding','dga_holding'] },
  { label: 'Utilisateurs',    href: '/users',          icon: Users,      gradient: 'stat-teal',   desc: 'Gérer les accès', roles: ['admin','dg_holding','dga_holding'] },
  { label: 'Consolidation',   href: '/consolidation',  icon: TrendingUp, gradient: 'stat-orange', desc: 'Vue consolidée du groupe', roles: ['admin','dg_holding','dga_holding','consolidation_officer'] },
]

export function DashboardCards({ profile, userRoles, isHolding, stats, recentBudgets, statusBreakdown }: Props) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'

  const visibleActions = QUICK_ACTIONS.filter(a => !a.roles || a.roles.some(r => userRoles.includes(r)))

  const kpiCards = [
    { label: 'Organisations', value: stats.orgCount,    icon: Building2, gradient: 'stat-violet', href: '/organizations', show: isHolding, change: '+2 ce mois' },
    { label: 'Utilisateurs',  value: stats.userCount,   icon: Users,     gradient: 'stat-teal',   href: '/users',         show: isHolding, change: 'actifs' },
    { label: 'Budgets créés', value: stats.budgetCount, icon: FileText,  gradient: 'stat-blue',   href: '/budgets',       show: true,      change: 'total' },
    { label: 'En attente',    value: stats.pendingCount,icon: Clock,     gradient: 'stat-orange', href: '/budgets',       show: true,      change: 'action requise' },
  ].filter(c => c.show)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {greeting},{' '}
            <span className="gradient-brand-text">{profile?.first_name ?? 'Utilisateur'}</span> 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Voici un aperçu de votre activité budgétaire</p>
        </div>
        <Link href="/budgets/new">
          <Button size="lg" className="gap-2 shadow-md">
            <FileText className="h-4 w-4" />
            Nouveau budget
          </Button>
        </Link>
      </div>

      {/* KPI Cards — gradient */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map(card => {
          const Icon = card.icon
          return (
            <Link href={card.href} key={card.label}>
              <div className={cn('rounded-2xl p-5 text-white cursor-pointer hover:opacity-90 hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5', card.gradient)}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-white/80">{card.label}</p>
                    <p className="text-3xl font-bold mt-1 leading-none">{card.value}</p>
                    <p className="text-xs text-white/60 mt-2">{card.change}</p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Budgets récents */}
        <Card className="lg:col-span-2 hover:card-shadow-hover transition-shadow">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Budgets récents</CardTitle>
                <CardDescription>Dernières activités budgétaires</CardDescription>
              </div>
              <Link href="/budgets">
                <Button variant="soft" size="sm" className="gap-1 text-xs">
                  Voir tout <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentBudgets.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                  <FileText className="h-6 w-6 opacity-40" />
                </div>
                <p className="text-sm font-medium">Aucun budget créé</p>
                <Link href="/budgets/new">
                  <Button variant="outline" size="sm" className="mt-3">Créer un budget</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-1">
                {recentBudgets.map(b => {
                  const status = b.status as BudgetStatus
                  const cfg = STATUS_CONFIG[status] ?? { label: status, variant: 'secondary' as const }
                  return (
                    <Link href={`/budgets/${b.id}`} key={b.id}>
                      <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/60 transition-colors group">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                            <FileText className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{b.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {b.organization?.name} · {formatDate(b.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={cfg.variant} className="text-xs">{cfg.label}</Badge>
                          <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Colonne droite */}
        <div className="space-y-4">
          {/* Donut chart */}
          {Object.keys(statusBreakdown).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Répartition
                  </CardTitle>
                  <Link href="/reports">
                    <span className="text-xs text-primary hover:underline">Rapports →</span>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {(() => {
                  const chartData = Object.entries(statusBreakdown).map(([status, count]) => ({
                    name: STATUS_CONFIG[status as BudgetStatus]?.label ?? status,
                    value: count,
                    color: STATUS_CHART_COLORS[status] ?? '#94a3b8',
                  }))
                  return (
                    <div className="flex items-center gap-3">
                      <ResponsiveContainer width={88} height={88}>
                        <PieChart>
                          <Pie data={chartData} cx="50%" cy="50%" innerRadius={26} outerRadius={42} dataKey="value" paddingAngle={3}>
                            {chartData.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v, n) => [v, n]} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex-1 space-y-1.5">
                        {chartData.slice(0, 5).map(d => (
                          <div key={d.name} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                              <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                              <span className="text-muted-foreground truncate max-w-[72px]">{d.name}</span>
                            </div>
                            <span className="font-semibold">{d.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </CardContent>
            </Card>
          )}

          {/* Actions rapides */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Actions rapides</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {visibleActions.map(action => {
                const Icon = action.icon
                return (
                  <Link href={action.href} key={action.label}>
                    <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/60 transition-colors cursor-pointer group">
                      <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-white', action.gradient)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-none">{action.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{action.desc}</p>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </Link>
                )
              })}

              {stats.pendingCount > 0 && (
                <div className="mt-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                        {stats.pendingCount} budget{stats.pendingCount > 1 ? 's' : ''} en attente
                      </p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Action requise</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
