import { createClient } from '@/lib/supabase/server'
import { VendorsClient } from './vendors-client'

export default async function VendorsPage() {
  const supabase = await createClient()

  const [
    { data: vendorsRaw },
    { data: orgsRaw },
  ] = await Promise.all([
    supabase
      .from('vendors')
      .select('*')
      .order('name'),
    supabase
      .from('organizations')
      .select('id, name, code, level')
      .eq('is_active', true)
      .order('name'),
  ])

  return (
    <VendorsClient
      vendors={(vendorsRaw ?? []) as Record<string, unknown>[]}
      organizations={(orgsRaw ?? []) as Array<{ id: string; name: string; code: string; level: string }>}
    />
  )
}
