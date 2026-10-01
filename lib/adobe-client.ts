/**
 * Adobe Analytics API client.
 *
 * Handles:
 *  - Server-to-Server OAuth token exchange + in-memory caching
 *  - Required headers on every request
 *  - 429 retry with Retry-After
 *  - Bounded concurrency via a simple semaphore
 */

const IMS_TOKEN_URL = "https://ims-na1.adobelogin.com/ims/token/v3";
const AA_BASE = "https://analytics.adobe.io";
const REPORT_CONCURRENCY = 10;

// ── Token cache ────────────────────────────────────────────────────────────

interface TokenCache {
  accessToken: string;
  expiresAt: number; // epoch ms
}

let _tokenCache: TokenCache | null = null;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (_tokenCache && _tokenCache.expiresAt - now > 60_000) {
    return _tokenCache.accessToken;
  }

  const clientId = process.env.ADOBE_CLIENT_ID;
  const clientSecret = process.env.ADOBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("ADOBE_CLIENT_ID and ADOBE_CLIENT_SECRET must be set");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope:
      "openid,AdobeID,read_organizations,additional_info.projectedProductContext,analytics",
  });

  const res = await fetch(IMS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`IMS token exchange failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  _tokenCache = {
    accessToken: json.access_token,
    expiresAt: now + json.expires_in * 1000,
  };
  return _tokenCache.accessToken;
}

// ── Base request ────────────────────────────────────────────────────────────

async function adobeFetch(
  path: string,
  options: RequestInit = {},
  retries = 3
): Promise<Response> {
  const accessToken = await getAccessToken();
  const clientId = process.env.ADOBE_CLIENT_ID!;
  const globalCompanyId = process.env.ADOBE_GLOBAL_COMPANY_ID!;

  const url = path.startsWith("http") ? path : `${AA_BASE}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "x-api-key": clientId,
    "x-proxy-global-company-id": globalCompanyId,
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  const res = await fetch(url, { ...options, headers });

  if (res.status === 429 && retries > 0) {
    const retryAfter = parseInt(res.headers.get("Retry-After") ?? "2", 10);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return adobeFetch(path, options, retries - 1);
  }

  return res;
}

// ── Typed GET / POST ────────────────────────────────────────────────────────

export async function adobeGet<T>(path: string): Promise<T> {
  const res = await adobeFetch(path);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${path} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function adobePost<T>(path: string, body: unknown): Promise<T> {
  const res = await adobeFetch(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Semaphore ───────────────────────────────────────────────────────────────

export function createSemaphore(limit = REPORT_CONCURRENCY) {
  let active = 0;
  const queue: Array<() => void> = [];

  function release() {
    active--;
    if (queue.length > 0) {
      const next = queue.shift()!;
      active++;
      next();
    }
  }

  return {
    async acquire(): Promise<() => void> {
      if (active < limit) {
        active++;
        return release;
      }
      return new Promise((resolve) => {
        queue.push(() => resolve(release));
      });
    },
  };
}

export const globalSemaphore = createSemaphore(REPORT_CONCURRENCY);

// ── Discovery ───────────────────────────────────────────────────────────────

export async function discoverGlobalCompanyId(): Promise<string> {
  const res = await adobeFetch(`${AA_BASE}/discovery/me`);
  if (!res.ok) throw new Error(`/discovery/me failed (${res.status})`);
  const json = await res.json() as {
    imsOrgs: Array<{ companies: Array<{ globalCompanyId: string; companyName: string }> }>;
  };
  const companies = json.imsOrgs.flatMap((o) => o.companies ?? []);
  if (companies.length === 0) throw new Error("No companies found in discovery response");
  return companies[0].globalCompanyId;
}
