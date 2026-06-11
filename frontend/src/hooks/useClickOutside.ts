import { useEffect, type RefObject } from 'react';

/**
 * Invokes a handler when a pointer-down lands outside the referenced
 * element. Used to dismiss dropdowns and popovers.
 *
 * @param ref - Element that defines the "inside" boundary.
 * @param handler - Called on outside clicks.
 * @param enabled - Attach the listener only while true (e.g. menu open).
 */
export function useClickOutside(
  ref: RefObject<HTMLElement>,
  handler: () => void,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const onPointerDown = (event: MouseEvent): void => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        handler();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [ref, handler, enabled]);
}
