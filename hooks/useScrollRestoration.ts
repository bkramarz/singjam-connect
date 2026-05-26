import { useEffect, useRef } from "react";

export function useScrollRestoration(
  key: string,
  ready: boolean,
  getExtras?: () => Record<string, unknown>,
) {
  // Keep getExtras current without requiring it as an effect dep
  const getExtrasRef = useRef(getExtras);
  useEffect(() => { getExtrasRef.current = getExtras; });

  // Restore scroll position once data is ready
  useEffect(() => {
    if (!ready) return;
    const raw = sessionStorage.getItem(key);
    if (!raw) return;
    sessionStorage.removeItem(key);
    try {
      const { y } = JSON.parse(raw);
      if (typeof y === "number" && y > 0) window.scrollTo({ top: y, behavior: "instant" });
    } catch {}
  }, [key, ready]);

  // Save scroll position on unmount — fires however the user left the page
  useEffect(() => {
    return () => {
      const extras = getExtrasRef.current?.() ?? {};
      sessionStorage.setItem(key, JSON.stringify({ y: Math.round(window.scrollY), ...extras }));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
