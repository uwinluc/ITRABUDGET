'use client'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Organization, OrgLevel, OrgType } from '@/types/database'

const LEVELS: { value: OrgLevel; label: string }[] = [
  { value: 'holding', label: 'Niveau 1 — Holding' },
  { value: 'country', label: 'Niveau 2 — Pays' },
  { value: 'subsidiary', label: 'Niveau 3 — Filiale' },
  { value: 'direction', label: 'Niveau 4 — Direction' },
  { value: 'service', label: 'Niveau 5 — Service' },
]

const TYPES_BY_LEVEL: Record<OrgLevel, { value: OrgType; label: string }[]> = {
  holding: [{ value: 'holding', label: 'Holding' }],
  country: [{ value: 'country', label: 'Pays' }],
  subsidiary: [
    { value: 'headquarters', label: 'Siège' },
    { value: 'agency', label: 'Agence' },
    { value: 'extension', label: 'Extension' },
  ],
  direction: [{ value: 'direction', label: 'Direction' }],
  service: [{ value: 'service', label: 'Service' }],
}

const CURRENCIES = ['USD', 'EUR', 'TZS', 'KES', 'UGX', 'XAF', 'XOF', 'MZN', 'AOA', 'RWF', 'BIF', 'CDF', 'GBP']

const schema = z.object({
  name: z.string().min(2, 'Minimum 2 caractères'),
  code: z.string().min(2).max(10).regex(/^[A-Z0-9_-]+$/, 'Majuscules, chiffres, - ou _ uniquement'),
  level: z.enum(['holding', 'country', 'subsidiary', 'direction', 'service']),
  type: z.string(),
  parent_id: z.string().optional(),
  country_code: z.string().length(2).optional().or(z.literal('')),
  currency_code: z.string().length(3).optional(),
  has_copil: z.boolean().default(false),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
})
type FormData = z.infer<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
  organization?: Organization
  allOrgs: Organization[]
}

export function OrgFormDialog({ open, onClose, organization, allOrgs }: Props) {
  const isEdit = !!organization
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [selectedLevel, setSelectedLevel] = useState<OrgLevel>(organization?.level ?? 'holding')

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: organization ? {
      name: organization.name,
      code: organization.code,
      level: organization.level,
      type: organization.type,
      parent_id: organization.parent_id ?? undefined,
      country_code: organization.country_code ?? '',
      currency_code: organization.currency_code ?? undefined,
      has_copil: organization.has_copil,
      email: organization.email ?? '',
      phone: organization.phone ?? '',
      address: organization.address ?? '',
    } : { level: 'holding', type: 'holding', has_copil: false },
  })

  const watchLevel = watch('level')
  useEffect(() => {
    if (watchLevel) {
      setSelectedLevel(watchLevel)
      const types = TYPES_BY_LEVEL[watchLevel]
      if (types.length === 1) setValue('type', types[0].value)
    }
  }, [watchLevel, setValue])

  const possibleParents = allOrgs.filter(o => {
    const parentLevelMap: Record<OrgLevel, OrgLevel> = {
      country: 'holding',
      subsidiary: 'country',
      direction: 'subsidiary',
      service: 'direction',
      holding: 'holding',
    }
    return o.level === parentLevelMap[selectedLevel]
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const payload = {
        ...data,
        parent_id: data.parent_id || null,
        country_code: data.country_code || null,
        currency_code: data.currency_code || null,
        email: data.email || null,
      }

      if (isEdit) {
        const { error } = await supabase.from('organizations').update(payload).eq('id', organization!.id)
        if (error) throw error
        toast.success('Organisation modifiée')
      } else {
        const { error } = await supabase.from('organizations').insert(payload)
        if (error) throw error
        toast.success('Organisation créée')
      }
      onClose()
      window.location.reload()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur inconnue'
      toast.error(msg.includes('unique') ? 'Ce code existe déjà' : `Erreur: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier l\'organisation' : 'Nouvelle organisation'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nom <span className="text-destructive">*</span></Label>
              <Input placeholder="Ex: Holding ITRA Group" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Code unique <span className="text-destructive">*</span></Label>
              <Input placeholder="Ex: ITRA-HLD" {...register('code')} className="font-mono uppercase" />
              {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Niveau <span className="text-destructive">*</span></Label>
              <Select onValueChange={v => setValue('level', v as OrgLevel)} defaultValue={organization?.level ?? 'holding'}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEVELS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type <span className="text-destructive">*</span></Label>
              <Select onValueChange={v => setValue('type', v)} defaultValue={organization?.type}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES_BY_LEVEL[selectedLevel].map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedLevel !== 'holding' && (
            <div className="space-y-2">
              <Label>Organisation parente <span className="text-destructive">*</span></Label>
              <Select onValueChange={v => setValue('parent_id', v)} defaultValue={organization?.parent_id ?? undefined}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  {possibleParents.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.code})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Code pays (ISO 2)</Label>
              <Input placeholder="Ex: TZ, KE, FR" maxLength={2} className="uppercase" {...register('country_code')} />
            </div>
            <div className="space-y-2">
              <Label>Devise locale</Label>
              <Select onValueChange={v => setValue('currency_code', v)} defaultValue={organization?.currency_code ?? undefined}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedLevel === 'subsidiary' && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
              <input type="checkbox" id="has_copil" {...register('has_copil')} className="h-4 w-4 rounded" />
              <Label htmlFor="has_copil" className="cursor-pointer">
                Cette filiale dispose d'un COPIL (Comité de Pilotage)
              </Label>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" placeholder="contact@org.com" {...register('email')} />
            </div>
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input placeholder="+255 123 456 789" {...register('phone')} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Adresse</Label>
            <Input placeholder="Adresse complète" {...register('address')} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
