/**
 * softFetch — wraps a promise so that network / permission errors
 * become { ok: false } instead of throws.  Checks that receive
 * { ok: false } should return status: "not_applicable".
 */

export type SoftResult<T> =
  | { ok: true; data: T }
  | { ok: false; error?: string };

export async function softFetch<T>(
  fn: () => Promise<T>,
  label?: string
): Promise<SoftResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[softFetch] ${label ?? "?"} failed:`, msg);
    }
    return { ok: false, error: msg };
  }
}
