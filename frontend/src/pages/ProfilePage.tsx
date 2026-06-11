import { useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Camera, FileText, MessageSquare, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Skeleton } from '../components/ui/Skeleton';
import { useAuth } from '../context/AuthContext';
import { api, getErrorMessage } from '../lib/api';
import { ACCEPTED_AVATAR_MIME_TYPES, MAX_AVATAR_BYTES } from '../lib/constants';
import { formatCurrency, formatDate } from '../lib/format';
import type { AccountStats, UserProfile } from '../types/api';

/**
 * Profile page: edit display name, upload avatar, and view account stats.
 */
export function ProfilePage(): JSX.Element {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['users', 'stats'],
    queryFn: async () => (await api.get<AccountStats>('/users/me/stats')).data,
  });

  const updateName = useMutation({
    mutationFn: async (newName: string) =>
      (await api.patch<UserProfile>('/users/me', { name: newName })).data,
    onSuccess: (profile) => {
      setUser(profile);
      toast.success('Name updated');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('avatar', file);
      return (
        await api.post<UserProfile>('/users/me/avatar', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      ).data;
    },
    onSuccess: (profile) => {
      setUser(profile);
      toast.success('Avatar updated');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const onAvatarSelected = (file: File | undefined): void => {
    if (!file) {
      return;
    }
    if (!ACCEPTED_AVATAR_MIME_TYPES.includes(file.type)) {
      toast.error('Avatar must be a PNG, JPEG or WebP image.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error('Avatar must be under 2 MB.');
      return;
    }
    uploadAvatar.mutate(file);
  };

  const onSubmit = (event: FormEvent): void => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed && trimmed !== user?.name) {
      updateName.mutate(trimmed);
    }
  };

  if (!user) {
    return <div className="p-6" />;
  }

  const currency = user.settings.currency;

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-slate-500 dark:text-slate-400">Your account details and activity.</p>
      </div>

      <Card className="p-6">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <div className="relative">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                referrerPolicy="no-referrer"
                className="h-24 w-24 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-24 w-24 items-center justify-center rounded-full bg-navy-700 text-3xl font-bold text-white">
                {user.name.charAt(0).toUpperCase()}
              </span>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Change avatar"
              disabled={uploadAvatar.isPending}
              className="absolute -bottom-1 -right-1 rounded-full bg-navy-700 p-2 text-white shadow transition-colors hover:bg-navy-800 disabled:opacity-60"
            >
              <Camera className="h-4 w-4" aria-hidden />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => {
                onAvatarSelected(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2">
              <h2 className="truncate text-xl font-semibold">{user.name}</h2>
              {user.role === 'admin' && <Badge tone="navy">Admin</Badge>}
            </div>
            <p className="text-slate-500 dark:text-slate-400">{user.email}</p>
            <p className="mt-1 text-sm text-slate-400">
              Member since {formatDate(user.createdAt, user.settings.dateFormat)}
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
          <Input
            label="Display name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={200}
            required
          />
          <Button
            type="submit"
            loading={updateName.isPending}
            disabled={!name.trim() || name.trim() === user.name}
            className="shrink-0"
          >
            Save name
          </Button>
        </form>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {statsLoading ? (
          Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-28" />)
        ) : (
          <>
            <Card className="p-5">
              <FileText className="mb-2 h-5 w-5 text-navy-600 dark:text-navy-300" aria-hidden />
              <p className="text-2xl font-bold">{stats?.totalInvoices ?? 0}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Invoices tracked</p>
            </Card>
            <Card className="p-5">
              <Wallet className="mb-2 h-5 w-5 text-navy-600 dark:text-navy-300" aria-hidden />
              <p className="text-2xl font-bold">{formatCurrency(stats?.totalSpend ?? 0, currency)}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Total tracked spend</p>
            </Card>
            <Card className="p-5">
              <MessageSquare className="mb-2 h-5 w-5 text-navy-600 dark:text-navy-300" aria-hidden />
              <p className="text-2xl font-bold">{stats?.chatSessions ?? 0}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">AI conversations</p>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
