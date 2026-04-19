'use client'

import Link from 'next/link'
import { Bell, Globe, Moon, Sun, CheckCheck, Search } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel
} from '@/components/ui/dropdown-menu'
import { cn, formatDate } from '@/lib/utils'

interface NotifPreview {
  id: string
  title: string
  body: string
  is_read: boolean
  created_at: string
  entity_type?: string | null
  entity_id?: string | null
}

interface TopbarProps {
  title?: string
  notifications?: NotifPreview[]
  currentLocale?: string
  onLocaleChange?: (locale: string) => void
}

const LOCALES = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'pt', label: 'Português', flag: '🇵🇹' },
]

export function Topbar({ title, notifications = [], currentLocale = 'fr', onLocaleChange }: TopbarProps) {
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const unreadCount = notifications.filter(n => !n.is_read).length

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
    startTransition(() => router.refresh())
  }

  async function markAllRead() {
    await fetch('/api/notifications/read-all', { method: 'PATCH' })
    startTransition(() => router.refresh())
  }

  return (
    <header className="h-16 border-b bg-background/80 backdrop-blur-sm flex items-center justify-between px-6 shrink-0 sticky top-0 z-10">
      {/* Left */}
      <div className="flex items-center gap-3">
        {title && <h1 className="text-base font-semibold">{title}</h1>}
        {/* Search bar */}
        <div className="hidden md:flex items-center gap-2 h-9 px-3 rounded-xl bg-muted border border-transparent hover:border-border transition-colors text-sm text-muted-foreground cursor-pointer min-w-[200px]">
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span>Rechercher...</span>
          <kbd className="ml-auto text-[10px] bg-background border border-border rounded px-1.5 py-0.5 font-mono">⌘K</kbd>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1">
        {/* Langue */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
              <Globe className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-2xl">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Langue</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {LOCALES.map(l => (
              <DropdownMenuItem
                key={l.code}
                onClick={() => onLocaleChange?.(l.code)}
                className={cn('rounded-xl cursor-pointer', currentLocale === l.code && 'font-semibold text-primary')}
              >
                <span className="mr-2">{l.flag}</span>
                {l.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Thème */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-xl"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl relative">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-4 w-4 rounded-full gradient-brand text-white text-[9px] flex items-center justify-center font-bold leading-none shadow">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 rounded-2xl p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div>
                <p className="text-sm font-semibold">Notifications</p>
                {unreadCount > 0 && (
                  <p className="text-xs text-muted-foreground">{unreadCount} non lue{unreadCount > 1 ? 's' : ''}</p>
                )}
              </div>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-primary rounded-lg" onClick={markAllRead} disabled={isPending}>
                  <CheckCheck className="h-3 w-3" />
                  Tout lire
                </Button>
              )}
            </div>
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-20" />
                Aucune notification
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto divide-y">
                {notifications.slice(0, 10).map(n => (
                  <div
                    key={n.id}
                    className={cn(
                      'flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer',
                      !n.is_read && 'bg-primary/5'
                    )}
                  >
                    <div className={cn(
                      'h-2 w-2 rounded-full mt-2 shrink-0',
                      n.is_read ? 'bg-transparent' : 'gradient-brand'
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-xs leading-snug', !n.is_read && 'font-semibold')}>{n.title}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{n.body}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{formatDate(n.created_at)}</p>
                    </div>
                    {!n.is_read && (
                      <button
                        className="shrink-0 h-6 w-6 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        onClick={() => markRead(n.id)}
                      >
                        <CheckCheck className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="p-2 border-t">
              <Link href="/notifications">
                <Button variant="ghost" size="sm" className="w-full text-xs rounded-xl text-primary">
                  Voir toutes les notifications
                </Button>
              </Link>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
