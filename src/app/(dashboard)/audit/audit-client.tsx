'use client'

import { useState, useMemo } from 'react'
import { Search, Shield, Filter, ChevronDown, ChevronRight, Clock, User, Building2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { cn, formatDate } from '@/lib/utils'
import type { AuditLog } from '@/types/database'

interface AuditLogEnriched extends AuditLog {
  profile?: { first_name: string; last_name: string } | null
  organization?: { name: string; code: string } | null
}

interface Props {
  logs: AuditLogEnriched[]
  organizations: Array<{ id: string; name: string; code: string }>
  currentUserRoles: string[]
}

const ACTION_COLORS: Record<string, string> = {
  INSERT: 'bg-green-100 text-green-800',
  UPDATE: 'bg-blue-100 text-blue-800',
  DELETE: 'bg-red-100 text-red-800',
  LOGIN: 'bg-purple-100 text-purple-800',
  LOGOUT: 'bg-gray-100 text-gray-700',
  SUBMIT: 'bg-indigo-100 text-indigo-800',
  APPROVE: 'bg-teal-100 text-teal-800',
  REJECT: 'bg-orange-100 text-orange-800',
  LOCK: 'bg-yellow-100 text-yellow-800',
  EXPORT: 'bg-pink-100 text-pink-800',
}

function getActionColor(action: string): string {
  const key = Object.keys(ACTION_COLORS).find(k => action.toUpperCase().includes(k))
  return key ? ACTION_COLORS[key] : 'bg-muted text-muted-foreground'
}

export function AuditClient({ logs, organizations, currentUserRoles }: Props) {
  const [search, setSearch] = useState('')
  const [entityFilter, setEntityFilter] = useState('all')
  const [orgFilter, setOrgFilter] = useState('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const entityTypes = useMemo(() => {
    const types = new Set(logs.map(l => l.entity_type))
    return Array.from(types).sort()
  }, [logs])

  const filtered = useMemo(() => {
    return logs.filter(l => {
      if (search) {
        const q = search.toLowerCase()
        const name = l.profile ? `${l.profile.first_name} ${l.profile.last_name}`.toLowerCase() : ''
        if (!l.action.toLowerCase().includes(q) && !l.entity_type.toLowerCase().includes(q) && !name.includes(q) && !(l.entity_id ?? '').includes(q)) {
          return false
        }
      }
      if (entityFilter !== 'all' && l.entity_type !== entityFilter) return false
      if (orgFilter !== 'all' && l.organization_id !== orgFilter) return false
      return true
    })
  }, [logs, search, entityFilter, orgFilter])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-slate-600" />
          Journal d&apos;audit
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Traçabilité complète de toutes les actions système — lecture seule
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Entrées totales', value: logs.length },
          { label: 'Aujourd\'hui', value: logs.filter(l => l.created_at.startsWith(new Date().toISOString().slice(0, 10))).length },
          { label: 'Types d\'entités', value: entityTypes.length },
          { label: 'Résultats filtrés', value: filtered.length },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-slate-700">{s.value}</p>
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
            placeholder="Rechercher action, entité, utilisateur..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Type d'entité" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {entityTypes.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
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
        {(search || entityFilter !== 'all' || orgFilter !== 'all') && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setEntityFilter('all'); setOrgFilter('all') }}>
            Réinitialiser
          </Button>
        )}
      </div>

      {/* Log table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center text-muted-foreground">
            <Shield className="h-12 w-12 mb-3 opacity-20" />
            <p className="font-medium">Aucun journal trouvé</p>
            <p className="text-sm mt-1">Modifiez vos filtres pour afficher des entrées.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-normal">
              {filtered.length} entrée(s) — ordre chronologique décroissant
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {filtered.map(log => {
                const isExpanded = expandedId === log.id
                const hasDetails = log.before_value || log.after_value

                return (
                  <div key={log.id} className="hover:bg-muted/30 transition-colors">
                    <div
                      className={cn('flex items-start gap-3 px-4 py-3', hasDetails && 'cursor-pointer')}
                      onClick={() => hasDetails && setExpandedId(isExpanded ? null : log.id)}
                    >
                      {/* Toggle icon */}
                      <div className="mt-0.5 shrink-0 w-4">
                        {hasDetails ? (
                          isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        ) : null}
                      </div>

                      {/* Action badge */}
                      <span className={cn('shrink-0 px-2 py-0.5 rounded text-xs font-mono font-semibold', getActionColor(log.action))}>
                        {log.action}
                      </span>

                      {/* Entity */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          <span className="text-sm font-medium">{log.entity_type}</span>
                          {log.entity_id && (
                            <span className="text-xs font-mono text-muted-foreground truncate max-w-[140px]">{log.entity_id}</span>
                          )}
                          {log.organization && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Building2 className="h-3 w-3" />{log.organization.name}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {log.profile ? `${log.profile.first_name} ${log.profile.last_name}` : 'Système'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(log.created_at)}
                          </span>
                          {log.ip_address && (
                            <span className="font-mono">{log.ip_address}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded diff */}
                    {isExpanded && (
                      <div className="px-11 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {log.before_value && (
                          <div>
                            <p className="text-xs font-semibold text-red-600 mb-1">Avant</p>
                            <pre className="text-xs bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-300 rounded p-2 overflow-auto max-h-40 border border-red-200 dark:border-red-800">
                              {JSON.stringify(log.before_value, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.after_value && (
                          <div>
                            <p className="text-xs font-semibold text-green-600 mb-1">Après</p>
                            <pre className="text-xs bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-300 rounded p-2 overflow-auto max-h-40 border border-green-200 dark:border-green-800">
                              {JSON.stringify(log.after_value, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
