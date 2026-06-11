import { NavLink } from 'react-router-dom';
import {
  FileText,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Upload,
  User,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/chat', label: 'AI Copilot', icon: MessageSquare },
  { to: '/invoices', label: 'Invoices', icon: FileText },
  { to: '/invoices/upload', label: 'Upload', icon: Upload },
  { to: '/profile', label: 'Profile', icon: User },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const;

export interface SidebarProps {
  /** Mobile drawer visibility. */
  open: boolean;
  onClose: () => void;
}

/**
 * Primary navigation: fixed rail on desktop, slide-over drawer on mobile.
 */
export function Sidebar({ open, onClose }: SidebarProps): JSX.Element {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden"
          onClick={onClose}
          role="presentation"
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-navy-900 text-white transition-transform duration-200 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Main navigation"
      >
        <div className="flex h-16 items-center justify-between px-5">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-navy-200" aria-hidden />
            <span className="text-lg font-bold tracking-tight">Invoice Copilot</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="rounded-lg p-1.5 text-navy-200 hover:bg-navy-800 lg:hidden"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/' || to === '/invoices'}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium transition-colors',
                  isActive
                    ? 'bg-navy-700 text-white'
                    : 'text-navy-100 hover:bg-navy-800 hover:text-white',
                )
              }
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 text-sm text-navy-300">
          AI-powered invoice management
        </div>
      </aside>
    </>
  );
}
