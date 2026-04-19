'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Building2, Users, FileText, ArrowRightLeft,
  PlayCircle, Repeat, BarChart3, FileSearch, Settings,
  TrendingUp, ChevronLeft, ChevronRight, LogOut, Vote, Truck,
  UserCircle, GitBranch, Bell
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import type { UserRole } from '@/types/database'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  roles?: UserRole[]
  badge?: number
  section?: string
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',    label: 'Tableau de bord', icon: LayoutDashboard, section: 'Principal' },
  { href: '/budgets',      label: 'Budgets',          icon: FileText,        section: 'Principal' },
  { href: '/transactions', label: 'Transactions',     icon: ArrowRightLeft,  section: 'Principal' },
  { href: '/execution',    label: 'Exécution',        icon: PlayCircle,      section: 'Principal' },

  { href: '/organizations', label: 'Organisations', icon: Building2, roles: ['admin','dg_holding','dga_holding','consolidation_officer'], section: 'Gestion' },
  { href: '/users',         label: 'Utilisateurs',  icon: Users,     roles: ['admin','dg_holding','dga_holding'], section: 'Gestion' },
  { href: '/vendors',       label: 'Fournisseurs',  icon: Truck,     section: 'Gestion' },
  { href: '/copil',         label: 'COPIL',         icon: Vote,      roles: ['admin','dg_holding','dga_holding','dg_subsidiary','dga_subsidiary','copil_president','copil_member'], section: 'Gestion' },
  { href: '/delegations',   label: 'Délégations',   icon: GitBranch, roles: ['admin','dg_holding','dga_holding','dg_subsidiary','dga_subsidiary','director'], section: 'Gestion' },

  { href: '/intercompany',  label: 'Inter-filiales', icon: Repeat,     roles: ['admin','dg_holding','dga_holding','consolidation_officer','dg_subsidiary','dga_subsidiary'], section: 'Groupe' },
  { href: '/consolidation', label: 'Consolidation',  icon: TrendingUp, roles: ['admin','dg_holding','dga_holding','consolidation_officer'], section: 'Groupe' },
  { href: '/reports',       label: 'Rapports',       icon: BarChart3,  section: 'Groupe' },
  { href: '/audit',         label: 'Audit',          icon: FileSearch, roles: ['admin','dg_holding','dga_holding','consolidation_officer','audit_director'], section: 'Groupe' },
]

interface SidebarProps {
  userRoles?: UserRole[]
  profile?: { first_name: string; last_name: string; avatar_url?: string | null }
  onLogout?: () => void
}

export function Sidebar({ userRoles = [], profile, onLogout }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const canAccess = (item: NavItem) =>
    !item.roles || item.roles.some(r => userRoles.includes(r))

  const visibleItems = NAV_ITEMS.filter(canAccess)

  const sections = Array.from(new Set(visibleItems.map(i => i.section)))

  const initials = profile
    ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
    : 'U'

  return (
    <aside className={cn(
      'flex flex-col h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 shrink-0',
      collapsed ? 'w-[68px]' : 'w-[240px]'
    )}>
      {/* Logo */}
      <div className={cn(
        'flex items-center h-16 px-4 border-b border-sidebar-border shrink-0',
        collapsed ? 'justify-center' : 'justify-between'
      )}>
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl gradient-brand flex items-center justify-center text-white font-bold text-sm shadow-md">
              IB
            </div>
            <div>
              <p className="font-bold text-sm text-white leading-none tracking-wide">ITRABUDGET</p>
              <p className="text-[10px] text-sidebar-foreground/50 leading-none mt-0.5">Gestion budgétaire</p>
            </div>
          </Link>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-xl gradient-brand flex items-center justify-center text-white font-bold text-sm shadow-md">
            IB
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="h-6 w-6 rounded-lg flex items-center justify-center text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-5">
        {sections.map(section => {
          const items = visibleItems.filter(i => i.section === section)
          return (
            <div key={section}>
              {!collapsed && (
                <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/35">
                  {section}
                </p>
              )}
              <div className="space-y-0.5">
                {items.map(item => {
                  const Icon = item.icon
                  const active = pathname === item.href || pathname.startsWith(item.href + '/')
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150 group relative',
                        active
                          ? 'bg-sidebar-accent text-white font-medium shadow-sm'
                          : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                        collapsed && 'justify-center px-0 py-2.5'
                      )}
                    >
                      {active && !collapsed && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full gradient-brand" />
                      )}
                      <Icon className={cn('shrink-0 transition-transform group-hover:scale-105', collapsed ? 'h-5 w-5' : 'h-4 w-4')} />
                      {!collapsed && <span className="flex-1">{item.label}</span>}
                      {!collapsed && item.badge ? (
                        <span className="ml-auto rounded-full gradient-brand text-white text-[10px] px-1.5 py-0.5 min-w-[1.25rem] text-center font-semibold">
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="shrink-0 border-t border-sidebar-border p-2 space-y-0.5">
        <Link
          href="/notifications"
          title={collapsed ? 'Notifications' : undefined}
          className={cn(
            'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-sidebar-foreground/65 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all',
            collapsed && 'justify-center px-0'
          )}
        >
          <Bell className={cn('shrink-0', collapsed ? 'h-5 w-5' : 'h-4 w-4')} />
          {!collapsed && <span>Notifications</span>}
        </Link>
        <Link
          href="/settings"
          title={collapsed ? 'Paramètres' : undefined}
          className={cn(
            'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-sidebar-foreground/65 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all',
            collapsed && 'justify-center px-0'
          )}
        >
          <Settings className={cn('shrink-0', collapsed ? 'h-5 w-5' : 'h-4 w-4')} />
          {!collapsed && <span>Paramètres</span>}
        </Link>
      </div>

      {/* User profile */}
      <div className={cn(
        'shrink-0 border-t border-sidebar-border p-3',
        collapsed ? 'flex justify-center' : 'flex items-center gap-3'
      )}>
        <Link href="/profile">
          <Avatar className="h-9 w-9 shrink-0 ring-2 ring-sidebar-accent hover:ring-primary transition-all">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="gradient-brand text-white text-xs font-bold">{initials}</AvatarFallback>
          </Avatar>
        </Link>
        {!collapsed && (
          <>
            <Link href="/profile" className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-sidebar-foreground truncate leading-none">
                {profile ? `${profile.first_name} ${profile.last_name}` : 'Utilisateur'}
              </p>
              <p className="text-[11px] text-sidebar-foreground/40 mt-0.5">Administrateur</p>
            </Link>
            <button
              onClick={onLogout}
              title="Déconnexion"
              className="h-7 w-7 rounded-lg flex items-center justify-center text-sidebar-foreground/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </aside>
  )
}
