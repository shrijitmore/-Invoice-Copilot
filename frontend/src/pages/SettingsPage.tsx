import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input, Select } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import { api, downloadFile, getErrorMessage } from '../lib/api';
import type { Currency, DateFormat, UserProfile, UserSettings } from '../types/api';

const CURRENCY_OPTIONS: Array<{ value: Currency; label: string }> = [
  { value: 'USD', label: 'US Dollar (USD)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'GBP', label: 'British Pound (GBP)' },
  { value: 'INR', label: 'Indian Rupee (INR)' },
];

const DATE_OPTIONS: Array<{ value: DateFormat; label: string }> = [
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (06/15/2026)' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (15/06/2026)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2026-06-15)' },
];

/**
 * Toggle switch with an accessible label.
 */
function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}): JSX.Element {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-2">
      <span>
        <span className="block font-medium">{label}</span>
        <span className="block text-sm text-slate-500 dark:text-slate-400">{description}</span>
      </span>
      <span className="relative inline-flex shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span className="h-6 w-11 rounded-full bg-slate-300 transition-colors peer-checked:bg-navy-700 dark:bg-slate-600" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

/**
 * Settings page: currency and date format preferences, notification
 * toggles, full data export, and the danger zone (wipe data / delete
 * account).
 */
export function SettingsPage(): JSX.Element {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [wipeModalOpen, setWipeModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const updateSettings = useMutation({
    mutationFn: async (patch: Partial<UserSettings>) =>
      (await api.patch<UserProfile>('/users/me/settings', patch)).data,
    onSuccess: (profile) => {
      setUser(profile);
      toast.success('Settings saved');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const wipeData = useMutation({
    mutationFn: () => api.delete('/users/me/data'),
    onSuccess: () => {
      toast.success('All invoice and chat data deleted');
      setWipeModalOpen(false);
      setConfirmText('');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deleteAccount = useMutation({
    mutationFn: () => api.delete('/users/me'),
    onSuccess: async () => {
      toast.success('Your account has been deleted');
      await logout();
      navigate('/login');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const exportAll = async (): Promise<void> => {
    setExporting(true);
    try {
      await downloadFile('/invoices/export/csv', 'invoices-export.csv');
      toast.success('Export downloaded');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Export failed'));
    } finally {
      setExporting(false);
    }
  };

  if (!user) {
    return <div className="p-6" />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-slate-500 dark:text-slate-400">
          Preferences, notifications and data controls.
        </p>
      </div>

      <Card className="p-6">
        <h2 className="mb-4 font-semibold">Display preferences</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Currency"
            value={user.settings.currency}
            onChange={(event) => updateSettings.mutate({ currency: event.target.value as Currency })}
            options={CURRENCY_OPTIONS}
          />
          <Select
            label="Date format"
            value={user.settings.dateFormat}
            onChange={(event) =>
              updateSettings.mutate({ dateFormat: event.target.value as DateFormat })
            }
            options={DATE_OPTIONS}
          />
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-2 font-semibold">Notifications</h2>
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          <Toggle
            label="Due soon alerts"
            description="Notify me 3 days before an invoice is due"
            checked={user.settings.notifyDueSoon}
            onChange={(value) => updateSettings.mutate({ notifyDueSoon: value })}
          />
          <Toggle
            label="Overdue alerts"
            description="Notify me when an invoice goes past its due date"
            checked={user.settings.notifyOverdue}
            onChange={(value) => updateSettings.mutate({ notifyOverdue: value })}
          />
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-2 font-semibold">Your data</h2>
        <p className="mb-4 text-slate-500 dark:text-slate-400">
          Download every invoice you've tracked as a CSV spreadsheet.
        </p>
        <Button variant="secondary" onClick={() => void exportAll()} loading={exporting}>
          <Download className="h-4 w-4" aria-hidden />
          Export all invoices (CSV)
        </Button>
      </Card>

      <Card className="border-red-200 p-6 dark:border-red-900">
        <h2 className="mb-2 flex items-center gap-2 font-semibold text-red-700 dark:text-red-400">
          <AlertTriangle className="h-5 w-5" aria-hidden />
          Danger zone
        </h2>
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Delete all data</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Removes every invoice, chat and notification. Your account stays.
              </p>
            </div>
            <Button variant="danger" onClick={() => setWipeModalOpen(true)}>
              Delete all data
            </Button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Delete account</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Permanently removes your account and every piece of data.
              </p>
            </div>
            <Button variant="danger" onClick={() => setDeleteModalOpen(true)}>
              Delete account
            </Button>
          </div>
        </div>
      </Card>

      <Modal
        open={wipeModalOpen}
        onClose={() => {
          setWipeModalOpen(false);
          setConfirmText('');
        }}
        title="Delete all data?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setWipeModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={confirmText !== 'DELETE'}
              loading={wipeData.isPending}
              onClick={() => wipeData.mutate()}
            >
              Delete everything
            </Button>
          </>
        }
      >
        <p className="mb-4">
          Every invoice, chat conversation and notification will be permanently erased. This
          cannot be undone.
        </p>
        <Input
          label='Type "DELETE" to confirm'
          value={confirmText}
          onChange={(event) => setConfirmText(event.target.value)}
        />
      </Modal>

      <Modal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setConfirmText('');
        }}
        title="Delete your account?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={confirmText !== 'DELETE'}
              loading={deleteAccount.isPending}
              onClick={() => deleteAccount.mutate()}
            >
              Delete my account
            </Button>
          </>
        }
      >
        <p className="mb-4">
          Your account, invoices, chats and notifications will be permanently erased and you will
          be signed out. This cannot be undone.
        </p>
        <Input
          label='Type "DELETE" to confirm'
          value={confirmText}
          onChange={(event) => setConfirmText(event.target.value)}
        />
      </Modal>
    </div>
  );
}
