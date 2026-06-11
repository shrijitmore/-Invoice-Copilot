import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

/** Base URL of the backend API. */
export const API_BASE_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000/api/v1';

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

/**
 * Shared axios instance: sends httpOnly auth cookies and transparently
 * refreshes the access token once on 401 before retrying the request.
 * Concurrent 401s share a single refresh round-trip.
 */
export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 60_000,
});

let refreshPromise: Promise<void> | null = null;

async function refreshSession(): Promise<void> {
  refreshPromise ??= axios
    .post(`${API_BASE_URL}/auth/refresh`, undefined, { withCredentials: true })
    .then(() => undefined)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const isAuthRoute = config?.url?.includes('/auth/');

    if (error.response?.status === 401 && config && !config._retried && !isAuthRoute) {
      config._retried = true;
      try {
        await refreshSession();
        return api.request(config);
      } catch {
        window.dispatchEvent(new CustomEvent('auth:expired'));
      }
    }
    return Promise.reject(error);
  },
);

/**
 * Extracts a human-readable message from an API error.
 *
 * @param error - Anything thrown by an api call.
 * @param fallback - Message used when the error carries no detail.
 */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string | string[] } | undefined;
    if (Array.isArray(data?.message)) {
      return data.message[0] ?? fallback;
    }
    if (typeof data?.message === 'string') {
      return data.message;
    }
    if (error.code === 'ERR_NETWORK') {
      return 'Cannot reach the server. Check your connection.';
    }
  }
  return fallback;
}

/**
 * Downloads a CSV (or other blob) from an authenticated endpoint and saves
 * it with the given filename.
 *
 * @param path - API path relative to the base URL.
 * @param filename - Suggested download filename.
 */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const response = await api.get<Blob>(path, { responseType: 'blob' });
  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
