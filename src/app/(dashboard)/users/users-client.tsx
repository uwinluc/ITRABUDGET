'use client'
import { useState } from 'react'
import { Plus, Search, Shield, UserCheck, UserX, Key } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { UserFormDialog } from './user-form-dialog'
import type { Organization, UserRole } from '@/types/database'
import { formatDate } from '@/lib/utils'

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  dg_holding: 'DG Holding',
  dga_holding: 'DGA Holding',
  consolidation_officer: 'Consolidation',
  legal_officer: 'Juridique',
  audit_director: 'Audit',
  dg_subsidiary: 'DG Filiale',
  dga_subsidiary: 'DGA Filiale',
  director: 'Directeur',
  service_chief: 'Chef service',
  copil_president: 'Prés. COPIL',
  copil_member: 'Membre COPIL',
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-100 text-red-800',
  dg_holding: 'bg-purple-100 text-purple-800',
  dga_holding: 'bg-purple-100 text-purple-800',
  consolidation_officer: 'bg-blue-100 text-blue-800',
  legal_officer: 'bg-indigo-100 text-indigo-800',
  audit_director: 'bg-yellow-100 text-yellow-800',
  dg_subsidiary: 'bg-green-100 text-green-800',
  dga_subsidiary: 'bg-green-100 text-green-800',
  director: 'bg-teal-100 text-teal-800',
  service_chief: 'bg-gray-100 text-gray-800',
  copil_president: 'bg-orange-100 text-orange-800',
  copil_member: 'bg-orange-100 text-orange-800',
}

interface UserWithRoles {
  id: string
  first_name: string
  last_name: string
  phone?: string | null
  avatar_url?: string | null
  is_active: boolean
  two_factor_enabled: boolean
  last_login_at?: string | null
  user_roles?: Array<{ id: string; role: UserRole; is_active: boolean; organization?: { id: string; name: string; code: string } | null }>
}

interface Props {
  users: UserWithRoles[]
  organizations: Pick<Organization, 'id' | 'name' | 'code' | 'level'>[]
}

export function UsersClient({ users, organizations }: Props) {
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<UserWithRoles | null>(null)

  const filtered = users.filter(u =>
    `${u.first_name} ${u.last_name}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Utilisateurs</h1>
          <p className="text-muted-foreground">{users.length} utilisateurs enregistrés</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Nouvel utilisateur
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold">{users.length}</div>
          <div className="text-sm text-muted-foreground">Total</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{users.filter(u => u.is_active).length}</div>
          <div className="text-sm text-muted-foreground">Actifs</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{users.filter(u => u.two_factor_enabled).length}</div>
          <div className="text-sm text-muted-foreground">2FA activé</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{users.filter(u => !u.is_active).length}</div>
          <div className="text-sm text-muted-foreground">Inactifs</div>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4">
            <CardTitle>Liste des utilisateurs</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Rôles</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Sécurité</TableHead>
                <TableHead>Dernière connexion</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    Aucun utilisateur trouvé
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(user => {
                  const initials = `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
                  const activeRoles = user.user_roles?.filter(r => r.is_active) ?? []

                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={user.avatar_url ?? undefined} />
                            <AvatarFallback className="text-xs font-semibold bg-blue-100 text-blue-700">{initials}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm">{user.first_name} {user.last_name}</div>
                            {user.phone && <div className="text-xs text-muted-foreground">{user.phone}</div>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {activeRoles.slice(0, 3).map(r => (
                            <span key={r.id} className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ROLE_COLORS[r.role] ?? 'bg-gray-100 text-gray-800'}`}>
                              {ROLE_LABELS[r.role]}
                            </span>
                          ))}
                          {activeRoles.length > 3 && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                              +{activeRoles.length - 3}
                            </span>
                          )}
                          {activeRoles.length === 0 && <span className="text-xs text-muted-foreground italic">Aucun rôle</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.is_active ? 'success' : 'destructive'} className="text-xs">
                          {user.is_active ? 'Actif' : 'Inactif'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.two_factor_enabled ? (
                          <div className="flex items-center gap-1 text-green-600 text-xs font-medium">
                            <Shield className="h-3.5 w-3.5" />
                            2FA
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {user.last_login_at ? formatDate(user.last_login_at) : 'Jamais'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditUser(user)}>
                            Modifier
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <UserFormDialog open={createOpen} onClose={() => setCreateOpen(false)} organizations={organizations} />
      {editUser && (
        <UserFormDialog
          open={!!editUser}
          onClose={() => setEditUser(null)}
          user={editUser}
          organizations={organizations}
        />
      )}
    </div>
  )
}
