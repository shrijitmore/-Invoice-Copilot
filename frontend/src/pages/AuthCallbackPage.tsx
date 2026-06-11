import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

/**
 * Landing target after Google OAuth: the backend has already set the auth
 * cookies, so we hydrate the session and route into the app.
 */
export function AuthCallbackPage(): JSX.Element {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) {
      return;
    }
    ran.current = true;
    void refreshUser().then(() => {
      toast.success('Welcome back!');
      navigate('/', { replace: true });
    });
  }, [refreshUser, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4" role="status">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-navy-200 border-t-navy-700" />
      <p className="text-slate-500">Signing you in…</p>
    </div>
  );
}
