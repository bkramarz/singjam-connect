import { useCallback, useEffect } from "react";

export function useScrollRestoration(key: string, ready: boolean) {
  // Restore scroll once data is ready. RAF defers the scroll one frame so it
  // runs after any same-tick scroll-to-top the router performs on back navigation.
  useEffect(() => {
    if (!ready) return;
    const raw = sessionStorage.getItem(key);
    if (!raw) return;
    sessionStorage.removeItem(key);
    try {
      const { y } = JSON.parse(raw);
      if (typeof y === "number" && y > 0) {
        requestAnimationFrame(() => {
          window.scrollTo({ top: y, behavior: "instant" });
        });
      }
    } catch {}
  }, [key, ready]);

  // Call this on the link click — scroll position is correct at click time,
  // before the router has a chance to scroll the page.
  return useCallback((extras: Record<string, unknown> = {}) => {
    sessionStorage.setItem(key, JSON.stringify({ y: Math.round(window.scrollY), ...extras }));
  }, [key]);
}
