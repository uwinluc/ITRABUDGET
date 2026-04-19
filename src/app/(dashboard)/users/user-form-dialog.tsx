'use client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Organization, UserRole } from '@/types/database'

const ALL_ROLES: { value: UserRole; label: string; level: 'holding' | 'subsidiary' | 'any' }[] = [
  { value: 'admin', label: 'Administrateur système', level: 'any' },
  { value: 'dg_holding', label: 'DG Holding', level: 'holding' },
  { value: 'dga_holding', label: 'DGA Holding', level: 'holding' },
  { value: 'consolidation_officer', label: 'Chargé consolidation', level: 'holding' },
  { value: 'legal_officer', label: 'Chargé opérations juridiques', level: 'holding' },
  { value: 'audit_director', label: 'Directeur d\'audit', level: 'holding' },
  { value: 'dg_subsidiary', label: 'DG Filiale', level: 'subsidiary' },
  { value: 'dga_subsidiary', label: 'DGA Filiale', level: 'subsidiary' },
  { value: 'director', label: 'Directeur', level: 'subsidiary' },
  { value: 'service_chief', label: 'Chef de service', level: 'subsidiary' },
  { value: 'copil_president', label: 'Président du COPIL', level: 'subsidiary' },
  { value: 'copil_member', label: 'Membre du COPIL', level: 'subsidiary' },
]

const schema = z.object({
  first_name: z.string().min(2, 'Minimum 2 caractères'),
  last_name: z.string().min(2, 'Minimum 2 caractères'),
  email: z.string().email('Email invalide'),
  phone: z.string().optional(),
  preferred_language: z.enum(['fr', 'en', 'pt']).default('fr'),
})
type FormData = z.infer<typeof schema>

interface RoleAssignment { role: UserRole; organization_id: string }

interface Props {
  open: boolean
  onClose: () => void
  user?: { id: string; first_name: string; last_name: string; phone?: string | null; user_roles?: Array<{ role: UserRole; organization?: { id: string } | null }> }
  organizations: Pick<Organization, 'id' | 'name' | 'code' | 'level'>[]
}

export function UserFormDialog({ open, onClose, user, organizations }: Props) {
  const isEdit = !!user
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [roles, setRoles] = useState<RoleAssignment[]>(
    user?.user_roles?.map(r => ({ role: r.role, organization_id: r.organization?.id ?? '' })) ?? []
  )
  const [newRole, setNewRole] = useState<UserRole | ''>('')
  const [newOrgId, setNewOrgId] = useState('')

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: user ? { first_name: user.first_name, last_name: user.last_name, phone: user.phone ?? '' } : {},
  })

  const addRole = () => {
    if (!newRole || !newOrgId) return
    if (roles.some(r => r.role === newRole && r.organization_id === newOrgId)) {
      toast.error('Ce rôle est déjà assigné pour cette organisation')
      return
    }
    setRoles([...roles, { role: newRole as UserRole, organization_id: newOrgId }])
    setNewRole('')
    setNewOrgId('')
  }

  const removeRole = (idx: number) => setRoles(roles.filter((_, i) => i !== idx))

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      if (isEdit) {
        const { error } = await supabase.from('profiles').update({
          first_name: data.first_name,
          last_name: data.last_name,
          phone: data.phone || null,
        }).eq('id', user!.id)
        if (error) throw error

        // Désactiver anciens rôles et recréer
        await supabase.from('user_roles').update({ is_active: false }).eq('user_id', user!.id)
        if (roles.length > 0) {
          await supabase.from('user_roles').insert(
            roles.map(r => ({ user_id: user!.id, role: r.role, organization_id: r.organization_id, is_active: true }))
          )
        }
        toast.success('Utilisateur modifié')
      } else {
        // Créer compte Supabase Auth
        const res = await fetch('/api/admin/create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, roles }),
        })
        if (!res.ok) throw new Error(await res.text())
        toast.success('Utilisateur créé — email d\'invitation envoyé')
      }
      onClose()
      window.location.reload()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  const getOrgLabel = (id: string) => {
    const org = organizations.find(o => o.id === id)
    return org ? `${org.name} (${org.code})` : id
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prénom <span className="text-destructive">*</span></Label>
              <Input placeholder="Jean" {...register('first_name')} />
              {errors.first_name && <p className="text-xs text-destructive">{errors.first_name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Nom <span className="text-destructive">*</span></Label>
              <Input placeholder="Dupont" {...register('last_name')} />
              {errors.last_name && <p className="text-xs text-destructive">{errors.last_name.message}</p>}
            </div>
          </div>

          {!isEdit && (
            <div className="space-y-2">
              <Label>Email <span className="text-destructive">*</span></Label>
              <Input type="email" placeholder="jean.dupont@groupe.com" {...register('email')} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input placeholder="+255 123 456 789" {...register('phone')} />
            </div>
            <div className="space-y-2">
              <Label>Langue préférée</Label>
              <Select onValueChange={v => {}} defaultValue="fr">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fr">🇫🇷 Français</SelectItem>
                  <SelectItem value="en">🇬🇧 English</SelectItem>
                  <SelectItem value="pt">🇵🇹 Português</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label className="text-base font-semibold">Assignation des rôles</Label>

            {/* Rôles existants */}
            {roles.length > 0 && (
              <div className="space-y-2">
                {roles.map((r, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-muted p-2 rounded-lg">
                    <div className="text-sm">
                      <span className="font-medium">{ALL_ROLES.find(ar => ar.value === r.role)?.label}</span>
                      <span className="text-muted-foreground mx-2">→</span>
                      <span className="text-muted-foreground">{getOrgLabel(r.organization_id)}</span>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeRole(idx)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Ajouter rôle */}
            <div className="flex gap-2">
              <Select value={newRole} onValueChange={v => setNewRole(v as UserRole)}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Sélectionner un rôle..." /></SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={newOrgId} onValueChange={setNewOrgId}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Organisation..." /></SelectTrigger>
                <SelectContent>
                  {organizations.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.name} ({o.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="icon" onClick={addRole}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? 'Modifier' : 'Créer et inviter'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
