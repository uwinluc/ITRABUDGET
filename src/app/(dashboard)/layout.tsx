import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import type { UserRole } from '@/types/database'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [
    { data: profile },
    { data: rolesData },
    { data: notifsData },
  ] = await Promise.all([
    supabase.from('profiles').select('first_name, last_name, avatar_url').eq('id', user.id).single(),
    supabase.from('user_roles').select('role').eq('user_id', user.id).eq('is_active', true),
    supabase
      .from('notifications')
      .select('id, title, body, is_read, created_at, entity_type, entity_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const userRoles = ((rolesData ?? []) as Array<{ role: string }>).map(r => r.role) as UserRole[]

  async function handleLogout() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        userRoles={userRoles}
        profile={profile ?? undefined}
        onLogout={handleLogout}
      />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar notifications={(notifsData ?? []) as Parameters<typeof Topbar>[0]['notifications']} />
        <main className="flex-1 overflow-y-auto bg-background p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
