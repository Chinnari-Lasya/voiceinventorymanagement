import { useCallback, useEffect, useState } from "react";

export type Envelope<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

export async function api<T>(path: string, init?: RequestInit): Promise<Envelope<T>> {
  try {
    const res = await fetch(path, { ...init, headers: { "content-type": "application/json" }, cache: "no-store" });
    if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/api/auth/")) {
      // Session expired: a full navigation on purpose, so all client state is reset.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/signin";
    }
    return (await res.json()) as Envelope<T>;
  } catch {
    return { ok: false, error: { code: "network", message: "Can't reach the server. Try again in a moment." } };
  }
}

export const post = <T,>(path: string, body: unknown = {}) => api<T>(path, { method: "POST", body: JSON.stringify(body) });

/** GET a JSON endpoint; `reload()` refetches. */
export function useApi<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    void api<T>(path).then((r) => {
      if (!live) return;
      if (r.ok) {
        setData(r.data);
        setError(null);
      } else setError(r.error.message);
    });
    return () => {
      live = false;
    };
  }, [path, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading: data === null && error === null, reload };
}

/** "5 min ago" / "Today, 3:42 PM" style timestamp for ledger rows (ISO UTC input). */
export function formatWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return `Today, ${time}`;
  return `${d.toLocaleDateString([], { day: "numeric", month: "short" })}, ${time}`;
}
