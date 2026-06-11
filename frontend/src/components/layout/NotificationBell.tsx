import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { AlertTriangle, Bell, CalendarClock, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, getErrorMessage } from '../../lib/api';
import { cn } from '../../lib/utils';
import type { AppNotification, NotificationType } from '../../types/api';

const typeIcons: Record<NotificationType, typeof Bell> = {
  due_soon: CalendarClock,
  overdue: AlertTriangle,
  system: Info,
};

const typeColors: Record<NotificationType, string> = {
  due_soon: 'text-amber-500',
  overdue: 'text-red-500',
  system: 'text-navy-500',
};

/**
 * Notification bell with unread badge and a dropdown list supporting
 * per-item and mark-all read actions. Unread count polls every minute.
 */
export function NotificationBell(): JSX.Element {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: countData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => (await api.get<{ count: number }>('/notifications/unread-count')).data,
    refetchInterval: 60_000,
  });

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: async () => (await api.get<AppNotification[]>('/notifications')).data,
    enabled: open,
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: invalidate,
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const markAllRead = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: invalidate,
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    const onClickOutside = (event: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const unread = countData?.count ?? 0;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
        aria-expanded={open}
        className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
      >
        <Bell className="h-5 w-5" aria-hidden />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-lg animate-fade-in dark:border-slate-700 dark:bg-slate-800 sm:w-96">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <h3 className="font-semibold">Notifications</h3>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                className="text-sm font-medium text-navy-600 hover:underline dark:text-navy-200"
              >
                Mark all as read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto scrollbar-thin">
            {isLoading && (
              <p className="px-4 py-6 text-center text-slate-500">Loading…</p>
            )}
            {!isLoading && (notifications?.length ?? 0) === 0 && (
              <p className="px-4 py-8 text-center text-slate-500">
                You're all caught up. Alerts about due and overdue invoices appear here.
              </p>
            )}
            {notifications?.map((notification) => {
              const Icon = typeIcons[notification.type];
              return (
                <button
                  key={notification._id}
                  type="button"
                  onClick={() => {
                    if (!notification.read) {
                      markRead.mutate(notification._id);
                    }
                  }}
                  className={cn(
                    'flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/60',
                    !notification.read && 'bg-navy-50/60 dark:bg-navy-800/40',
                  )}
                >
                  <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', typeColors[notification.type])} aria-hidden />
                  <span className="min-w-0">
                    <span className="block font-medium">{notification.title}</span>
                    <span className="block text-sm text-slate-500 dark:text-slate-400">
                      {notification.message}
                    </span>
                    <span className="mt-1 block text-xs text-slate-400">
                      {formatDistanceToNow(parseISO(notification.createdAt), { addSuffix: true })}
                    </span>
                  </span>
                  {!notification.read && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-navy-500" aria-label="Unread" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
