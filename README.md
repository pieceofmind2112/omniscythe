# OmniScythe

**Adobe Analytics audit tool** — surfaces configuration gaps, implementation issues, and traffic quality problems across any report suite.

Built as a Next.js 15 App Router application with TypeScript, Tailwind CSS, and a pure-function audit engine modeled after the [GA4 Manager](../ga4-manager) pattern.

---

## Prerequisites

- Node.js 20+
- An Adobe Analytics account with API access
- An [Adobe Developer Console](https://developer.adobe.com/console) project with **Adobe Analytics** added (OAuth Server-to-Server credential)

---

## Adobe I/O project setup (one-time)

1. Go to [console.adobe.io](https://developer.adobe.com/console) and create a new project.
2. Click **Add API → Adobe Analytics**.
3. Choose **OAuth Server-to-Server** as the credential type.
4. Save the `client_id` and `client_secret`.
5. In **Adobe Admin Console** → Products → Adobe Analytics → [your product profile], grant the service account **Analytics Admin** access.
6. Discover your `globalCompanyId`:

```bash
TOKEN=$(curl -s -X POST "https://ims-na1.adobelogin.com/ims/token/v3" \
  -d "grant_type=client_credentials&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET&scope=openid,AdobeID,read_organizations,additional_info.projectedProductContext,analytics" \
  | jq -r .access_token)

curl -H "Authorization: Bearer $TOKEN" \
     -H "x-api-key: YOUR_CLIENT_ID" \
     https://analytics.adobe.io/discovery/me | jq '.imsOrgs[].companies[].globalCompanyId'
```

---

## Environment variables

Copy `.env.local.example` to `.env.local` and fill in the values:

| Variable | Description |
|---|---|
| `ADOBE_CLIENT_ID` | Client ID from Adobe Developer Console |
| `ADOBE_CLIENT_SECRET` | Client secret from Adobe Developer Console |
| `ADOBE_ORG_ID` | Your org ID in `orgId@AdobeOrg` format |
| `ADOBE_GLOBAL_COMPANY_ID` | From the `/discovery/me` endpoint (see above) |
| `DATABASE_URL` | SQLite path — default `file:./db.sqlite` |

```bash
cp .env.local.example .env.local
# edit .env.local with your credentials
```

---

## Development

```bash
npm install
npm run dev
```

App runs at [http://localhost:3000](http://localhost:3000).

---

## Testing

```bash
npm test
```

Unit tests live in `tests/checks/`. Each check module is tested with fixture data against the `AuditContext` shape — no real API calls required.

---

## Architecture

```
lib/
  adobe-client.ts        # Token cache, headers, semaphore, retry on 429
  audit-lists.ts         # Spam domains, PII patterns, AI traffic regexes
  audit/
    context.ts           # buildAdobeContext() — fires all queries in parallel
    run.ts               # runAudit() — context → AuditScoreboard
    registry.ts          # Ordered list of check modules
    helpers.ts           # dim(), metric(), buildCheck(), cappedTable() …
    thresholds.ts        # Numeric benchmarks
    soft-fetch.ts        # Wraps promises so 403/404 → not_applicable
    checks/
      configuration.ts   # Bot filtering, IP exclusions, data feeds …
      implementation.ts  # Success events, eVars, classifications …
      traffic-quality.ts # PII, spam referrals, bounce rates …
types/
  audit.ts               # AuditCheck, AuditScoreboard, CheckModule<T> …
lib/db/
  schema.ts              # Drizzle schema: audit_notes, audit_overrides
```

---

## API

### `GET /api/audit/run?rsid=<rsid>&startDate=<YYYY-MM-DD>&endDate=<YYYY-MM-DD>`

Returns an `AuditScoreboard` JSON object. `startDate` / `endDate` default to the last 30 days.

---

## Production path (not yet implemented)

Replace Server-to-Server OAuth with **IMS user OAuth (PKCE)** so each analyst logs in with their own Adobe ID. Scope: `openid,AdobeID,analytics`. This mirrors how ga4-manager uses Google OAuth and ensures per-user audit history.

---

## Roadmap

- Report suite comparison mode
- Analyst notes + status overrides (DB schema ready)
- CJA support (`?platform=cja`)
- User-facing IMS OAuth
- Readout document export
- Scheduled audits
