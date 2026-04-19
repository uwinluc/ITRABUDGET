'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Building2, Loader2, Pencil, ToggleLeft, ToggleRight, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface Props {
  vendors: Record<string, unknown>[]
  organizations: Array<{ id: string; name: string; code: string; level: string }>
}

const EMPTY_FORM = {
  name: '', code: '', organization_id: '', country_code: '',
  email: '', phone: '', address: '', tax_number: '',
}

export function VendorsClient({ vendors, organizations }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filterOrg, setFilterOrg] = useState('all')
  const [dialog, setDialog] = useState<{ mode: 'create' | 'edit'; vendor?: Record<string, unknown> } | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(false)

  const setField = (k: keyof typeof EMPTY_FORM, v: string) =>
    setForm(f => ({ ...f, [k]: v }))

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setDialog({ mode: 'create' })
  }

  const openEdit = (v: Record<string, unknown>) => {
    setForm({
      name:            (v.name as string) ?? '',
      code:            (v.code as string) ?? '',
      organization_id: (v.organization_id as string) ?? '',
      country_code:    (v.country_code as string) ?? '',
      email:           (v.email as string) ?? '',
      phone:           (v.phone as string) ?? '',
      address:         (v.address as string) ?? '',
      tax_number:      (v.tax_number as string) ?? '',
    })
    setDialog({ mode: 'edit', vendor: v })
  }

  const filtered = vendors
    .filter(v => filterOrg === 'all' || v.organization_id === filterOrg)
    .filter(v => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        (v.name as string)?.toLowerCase().includes(q) ||
        (v.code as string)?.toLowerCase().includes(q)
      )
    })

  const getOrgName = (id: string) => organizations.find(o => o.id === id)?.name ?? '—'

  const handleSave = async () => {
    if (!form.name || !form.code || !form.organization_id) {
      toast.error('Nom, code et organisation requis')
      return
    }
    setLoading(true)
    const supabase = createClient()
    try {
      if (dialog?.mode === 'create') {
        const { error } = await supabase.from('vendors').insert({
          name:            form.name,
          code:            form.code,
          organization_id: form.organization_id,
          country_code:    form.country_code || null,
          email:           form.email || null,
          phone:           form.phone || null,
          address:         form.address || null,
          tax_number:      form.tax_number || null,
        })
        if (error) throw error
        toast.success('Fournisseur créé')
      } else if (dialog?.vendor) {
        const { error } = await supabase.from('vendors').update({
          name:       form.name,
          code:       form.code,
          country_code: form.country_code || null,
          email:      form.email || null,
          phone:      form.phone || null,
          address:    form.address || null,
          tax_number: form.tax_number || null,
        }).eq('id', dialog.vendor.id as string)
        if (error) throw error
        toast.success('Fournisseur mis à jour')
      }
      setDialog(null)
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (vendor: Record<string, unknown>) => {
    const supabase = createClient()
    const { error } = await supabase
      .from('vendors')
      .update({ is_active: !(vendor.is_active as boolean) })
      .eq('id', vendor.id as string)
    if (error) { toast.error(error.message); return }
    toast.success((vendor.is_active as boolean) ? 'Fournisseur désactivé' : 'Fournisseur activé')
    router.refresh()
  }

  const activeCount   = vendors.filter(v => v.is_active).length
  const inactiveCount = vendors.length - activeCount

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Truck className="h-6 w-6" />
            Fournisseurs
          </h1>
          <p className="text-muted-foreground mt-1">Gestion des fournisseurs par organisation</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nouveau fournisseur
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-6">
          <div className="text-2xl font-bold">{vendors.length}</div>
          <p className="text-xs text-muted-foreground mt-1">Total fournisseurs</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="text-2xl font-bold text-green-600">{activeCount}</div>
          <p className="text-xs text-muted-foreground mt-1">Actifs</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="text-2xl font-bold text-gray-400">{inactiveCount}</div>
          <p className="text-xs text-muted-foreground mt-1">Inactifs</p>
        </CardContent></Card>
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            className="pl-8"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterOrg} onValueChange={setFilterOrg}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes organisations</SelectItem>
            {organizations.map(o => (
              <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Truck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Aucun fournisseur</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="divide-y">
            {filtered.map(vendor => (
              <div key={vendor.id as string} className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{vendor.name as string}</span>
                    <Badge variant="outline" className="text-xs">{vendor.code as string}</Badge>
                    {!(vendor.is_active as boolean) && (
                      <Badge variant="secondary" className="text-xs">Inactif</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {getOrgName(vendor.organization_id as string)}
                    </span>
                    {(vendor.email as string | null) && <span>{vendor.email as string}</span>}
                    {(vendor.phone as string | null) && <span>{vendor.phone as string}</span>}
                    {(vendor.country_code as string | null) && <span>🌍 {vendor.country_code as string}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(vendor)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleToggle(vendor)}>
                    {vendor.is_active
                      ? <ToggleRight className="h-4 w-4 text-green-600" />
                      : <ToggleLeft className="h-4 w-4 text-gray-400" />
                    }
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Dialog */}
      <Dialog open={!!dialog} onOpenChange={() => setDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              {dialog?.mode === 'create' ? 'Nouveau fournisseur' : 'Modifier le fournisseur'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nom <span className="text-destructive">*</span></Label>
                <Input value={form.name} onChange={e => setField('name', e.target.value)} placeholder="Nom du fournisseur" />
              </div>
              <div className="space-y-2">
                <Label>Code <span className="text-destructive">*</span></Label>
                <Input value={form.code} onChange={e => setField('code', e.target.value.toUpperCase())} placeholder="FOUR-001" />
              </div>
            </div>
            {dialog?.mode === 'create' && (
              <div className="space-y-2">
                <Label>Organisation <span className="text-destructive">*</span></Label>
                <Select value={form.organization_id} onValueChange={v => setField('organization_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                  <SelectContent>
                    {organizations.map(o => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => setField('email', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input value={form.phone} onChange={e => setField('phone', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Code pays (ISO)</Label>
                <Input value={form.country_code} onChange={e => setField('country_code', e.target.value.toUpperCase())} maxLength={2} placeholder="CD" />
              </div>
              <div className="space-y-2">
                <Label>N° Fiscal / RCCM</Label>
                <Input value={form.tax_number} onChange={e => setField('tax_number', e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Adresse</Label>
              <Textarea rows={2} value={form.address} onChange={e => setField('address', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Annuler</Button>
            <Button disabled={loading} onClick={handleSave}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {dialog?.mode === 'create' ? 'Créer' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
