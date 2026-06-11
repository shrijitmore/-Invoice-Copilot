import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../lib/api';
import type { UserProfile } from '../types/api';

interface AuthContextValue {
  /** The signed-in user, or null when unauthenticated. */
  user: UserProfile | null;
  /** True while the initial session check is in flight. */
  loading: boolean;
  /** Re-fetches the profile (after profile/settings edits). */
  refreshUser: () => Promise<void>;
  /** Logs out server-side and clears local state. */
  logout: () => Promise<void>;
  /** Replaces the cached user (optimistic updates). */
  setUser: (user: UserProfile | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Provides the authenticated session to the app. Hydrates from
 * `GET /auth/me` on mount and reacts to forced expiry events emitted by
 * the API layer when refresh fails.
 */
export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async (): Promise<void> => {
    try {
      const { data } = await api.get<UserProfile>('/auth/me');
      setUser(data);
    } catch {
      setUser(null);
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    void refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  useEffect(() => {
    const onExpired = (): void => setUser(null);
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const value = useMemo(
    () => ({ user, loading, refreshUser, logout, setUser }),
    [user, loading, refreshUser, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Accesses the auth session; must be used inside {@link AuthProvider}.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
