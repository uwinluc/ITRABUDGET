import { createClient } from '@/lib/supabase/server'
import { OrganizationsClient } from './organizations-client'

export default async function OrganizationsPage() {
  const supabase = await createClient()

  const { data: organizations } = await supabase
    .from('organizations')
    .select('*')
    .order('level')
    .order('name')

  return <OrganizationsClient initialOrganizations={organizations ?? []} />
}
