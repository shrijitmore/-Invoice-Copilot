import { Navigate } from 'react-router-dom';
import { BarChart3, FileText, MessageSquare, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../lib/api';

const FEATURES = [
  { icon: FileText, text: 'Upload invoices — AI extracts every detail automatically' },
  { icon: MessageSquare, text: 'Ask questions in plain English, get instant answers' },
  { icon: BarChart3, text: 'See spending trends, cash flow and overdue bills at a glance' },
  { icon: ShieldCheck, text: 'Bank-grade security with Google sign-in' },
] as const;

/**
 * Public landing/login page with Google OAuth sign-in.
 */
export function LoginPage(): JSX.Element {
  const { user, loading } = useAuth();

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="flex flex-1 flex-col justify-center bg-navy-900 px-8 py-12 text-white lg:px-16">
        <div className="mx-auto w-full max-w-lg">
          <div className="mb-8 flex items-center gap-3">
            <FileText className="h-8 w-8 text-navy-200" aria-hidden />
            <span className="text-2xl font-bold">Invoice Copilot</span>
          </div>
          <h1 className="mb-4 text-3xl font-bold leading-tight lg:text-4xl">
            Your invoices, managed by AI.
          </h1>
          <p className="mb-10 text-lg text-navy-100">
            Upload bills, track what's due, and ask your business anything — no spreadsheets
            required.
          </p>
          <ul className="space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-navy-300" aria-hidden />
                <span className="text-navy-50">{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-surface-light px-8 py-12 dark:bg-surface-dark">
        <div className="w-full max-w-sm text-center">
          <h2 className="mb-2 text-2xl font-bold">Welcome</h2>
          <p className="mb-8 text-slate-500 dark:text-slate-400">
            Sign in with your Google account to get started in seconds.
          </p>
          <a
            href={`${API_BASE_URL}/auth/google`}
            className="flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white text-base font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Continue with Google
          </a>
          <p className="mt-6 text-sm text-slate-400">
            By signing in you agree to keep your own invoice data private and secure.
          </p>
        </div>
      </div>
    </div>
  );
}
