import { useEffect, useState } from 'react';

/**
 * Debounces a changing value, returning the latest value only after it has
 * been stable for `delayMs`.
 *
 * @param value - The rapidly changing input value.
 * @param delayMs - Quiet period before the value propagates.
 */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
