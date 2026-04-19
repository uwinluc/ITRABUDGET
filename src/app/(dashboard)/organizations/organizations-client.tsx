'use client'
import { useState } from 'react'
import { Plus, ChevronRight, ChevronDown, Building2, Globe, Landmark, Briefcase, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { OrgFormDialog } from './org-form-dialog'
import type { Organization, OrgLevel } from '@/types/database'
import { cn } from '@/lib/utils'

interface Props { initialOrganizations: Organization[] }

const LEVEL_ICONS: Record<OrgLevel, React.ElementType> = {
  holding: Landmark,
  country: Globe,
  subsidiary: Building2,
  direction: Briefcase,
  service: Layers,
}

const LEVEL_COLORS: Record<OrgLevel, string> = {
  holding: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  country: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  subsidiary: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  direction: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  service: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
}

const LEVEL_LABELS: Record<OrgLevel, string> = {
  holding: 'Holding',
  country: 'Pays',
  subsidiary: 'Filiale',
  direction: 'Direction',
  service: 'Service',
}

function buildTree(orgs: Organization[]): Organization[] {
  return orgs.filter(o => !o.parent_id)
}

function getChildren(orgs: Organization[], parentId: string): Organization[] {
  return orgs.filter(o => o.parent_id === parentId)
}

function OrgNode({ org, allOrgs, depth = 0 }: { org: Organization; allOrgs: Organization[]; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2)
  const [editOpen, setEditOpen] = useState(false)
  const children = getChildren(allOrgs, org.id)
  const hasChildren = children.length > 0
  const Icon = LEVEL_ICONS[org.level]

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg p-3 hover:bg-muted/50 transition-colors group',
          depth > 0 && 'ml-6 border-l border-dashed border-muted-foreground/20 pl-6'
        )}
      >
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn('shrink-0 text-muted-foreground', !hasChildren && 'invisible')}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{org.name}</span>
            <span className="text-xs text-muted-foreground font-mono">{org.code}</span>
            <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', LEVEL_COLORS[org.level])}>
              {LEVEL_LABELS[org.level]}
            </span>
            {org.has_copil && (
              <Badge variant="outline" className="text-xs h-5">COPIL</Badge>
            )}
            {!org.is_active && (
              <Badge variant="destructive" className="text-xs h-5">Inactif</Badge>
            )}
          </div>
          {(org.country_code || org.currency_code) && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {org.country_code && `🌍 ${org.country_code}`}
              {org.country_code && org.currency_code && ' · '}
              {org.currency_code && `💱 ${org.currency_code}`}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditOpen(true)}>
            Modifier
          </Button>
        </div>
      </div>

      {expanded && hasChildren && (
        <div>
          {children.map(child => (
            <OrgNode key={child.id} org={child} allOrgs={allOrgs} depth={depth + 1} />
          ))}
        </div>
      )}

      <OrgFormDialog open={editOpen} onClose={() => setEditOpen(false)} organization={org} allOrgs={allOrgs} />
    </div>
  )
}

export function OrganizationsClient({ initialOrganizations }: Props) {
  const [orgs, setOrgs] = useState(initialOrganizations)
  const [createOpen, setCreateOpen] = useState(false)
  const roots = buildTree(orgs)

  const stats = {
    holding: orgs.filter(o => o.level === 'holding').length,
    countries: orgs.filter(o => o.level === 'country').length,
    subsidiaries: orgs.filter(o => o.level === 'subsidiary').length,
    directions: orgs.filter(o => o.level === 'direction').length,
    services: orgs.filter(o => o.level === 'service').length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Organisations</h1>
          <p className="text-muted-foreground">Gérez la hiérarchie du groupe — {orgs.length} organisations</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Nouvelle organisation
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Holding', value: stats.holding, color: LEVEL_COLORS.holding },
          { label: 'Pays', value: stats.countries, color: LEVEL_COLORS.country },
          { label: 'Filiales', value: stats.subsidiaries, color: LEVEL_COLORS.subsidiary },
          { label: 'Directions', value: stats.directions, color: LEVEL_COLORS.direction },
          { label: 'Services', value: stats.services, color: LEVEL_COLORS.service },
        ].map(s => (
          <Card key={s.label} className="text-center p-4">
            <div className="text-2xl font-bold">{s.value}</div>
            <div className={cn('text-xs font-medium mt-1 px-2 py-0.5 rounded-full inline-block', s.color)}>{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Tree */}
      <Card>
        <CardHeader>
          <CardTitle>Arborescence</CardTitle>
          <CardDescription>Structure hiérarchique complète du groupe</CardDescription>
        </CardHeader>
        <CardContent>
          {roots.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Aucune organisation créée</p>
              <Button variant="outline" className="mt-4" onClick={() => setCreateOpen(true)}>
                Créer la Holding
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              {roots.map(org => (
                <OrgNode key={org.id} org={org} allOrgs={orgs} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <OrgFormDialog open={createOpen} onClose={() => setCreateOpen(false)} allOrgs={orgs} />
    </div>
  )
}
