'use client'

import { useState, useTransition } from 'react'
import { Bell, CheckCheck, Trash2, ExternalLink, Mail, MessageSquare, Smartphone } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn, formatDate } from '@/lib/utils'
import type { Notification, NotifChannel } from '@/types/database'

interface Props {
  notifications: Notification[]
}

const CHANNEL_ICON: Record<NotifChannel, React.ElementType> = {
  email:  Mail,
  sms:    Smartphone,
  in_app: MessageSquare,
}

const CHANNEL_LABEL: Record<NotifChannel, string> = {
  email:  'Email',
  sms:    'SMS',
  in_app: 'In-app',
}

export function NotificationsClient({ notifications }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const filtered = notifications.filter(n => filter === 'all' || !n.is_read)
  const unreadCount = notifications.filter(n => !n.is_read).length

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
    startTransition(() => router.refresh())
  }

  async function markAllRead() {
    await fetch('/api/notifications/read-all', { method: 'PATCH' })
    startTransition(() => router.refresh())
  }

  async function deleteNotif(id: string) {
    await fetch(`/api/notifications/${id}`, { method: 'DELETE' })
    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6 text-blue-500" />
            Notifications
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-xs">{unreadCount}</Badge>
            )}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Vos alertes et messages de la plateforme
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead} disabled={isPending} className="gap-2">
            <CheckCheck className="h-4 w-4" />
            Tout marquer lu
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {([['all', 'Toutes'], ['unread', 'Non lues']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              filter === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
            {key === 'unread' && unreadCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground text-xs">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center text-muted-foreground">
            <Bell className="h-12 w-12 mb-3 opacity-20" />
            <p className="font-medium">
              {filter === 'unread' ? 'Aucune notification non lue' : 'Aucune notification'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(n => {
            const ChannelIcon = CHANNEL_ICON[n.channel as NotifChannel] ?? Bell
            return (
              <Card
                key={n.id}
                className={cn(
                  'transition-all hover:shadow-sm',
                  !n.is_read && 'border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'h-9 w-9 rounded-full flex items-center justify-center shrink-0',
                      n.is_read ? 'bg-muted' : 'bg-blue-100 dark:bg-blue-900'
                    )}>
                      <ChannelIcon className={cn('h-4 w-4', n.is_read ? 'text-muted-foreground' : 'text-blue-600')} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className={cn('text-sm', !n.is_read && 'font-semibold')}>{n.title}</p>
                          <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                            <span>{formatDate(n.created_at)}</span>
                            <Badge variant="outline" className="text-xs px-1.5 py-0">
                              {CHANNEL_LABEL[n.channel as NotifChannel] ?? n.channel}
                            </Badge>
                            {n.is_read && n.read_at && (
                              <span>Lu le {formatDate(n.read_at)}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {n.entity_type && n.entity_id && (
                            <Link href={`/${n.entity_type.toLowerCase()}s/${n.entity_id}`}>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Voir">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                          )}
                          {!n.is_read && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-blue-600"
                              title="Marquer comme lu"
                              onClick={() => markRead(n.id)}
                              disabled={isPending}
                            >
                              <CheckCheck className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            title="Supprimer"
                            onClick={() => deleteNotif(n.id)}
                            disabled={isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
