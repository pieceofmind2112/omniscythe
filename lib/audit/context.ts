/**
 * buildAdobeContext — fires all admin + reporting queries in parallel
 * (bounded by the global semaphore) and returns an AuditContext.
 */

import { adobeGet, adobePost, globalSemaphore } from "@/lib/adobe-client";
import { softFetch, type SoftResult } from "@/lib/audit/soft-fetch";
import { toAdobeDateRange } from "@/lib/audit/helpers";
import { THRESHOLDS } from "@/lib/audit/thresholds";
import type { ReportRow } from "@/lib/audit/helpers";

// ── Adobe admin types ───────────────────────────────────────────────────────

export interface ReportSuiteDetails {
  rsid: string;
  name: string;
  timezone: string;
  currency: string;
}

export interface SuccessEvent {
  id: string;
  name: string;
  type: "counter" | "currency" | "numeric";
  enabled: boolean;
}

export interface EVar {
  id: string;
  name: string;
  type: string;
  expiration?: string;
  merchandising?: string;
  enabled: boolean;
}

export interface Prop {
  id: string;
  name: string;
  enabled: boolean;
  pathing?: boolean;
}

export interface Classification {
  id: string;
  name: string;
  dimension: string;
}

export interface ProcessingRule {
  id: string;
  description?: string;
}

export interface BotRule {
  id: string;
  name?: string;
}

export interface DataFeed {
  id: string;
  name?: string;
  status?: string;
}

export interface EvarUsage {
  evarId: string;
  displayName: string;
  inUse: boolean | null;
}

// ── Context shape ────────────────────────────────────────────────────────────

export interface AuditContext {
  rsid: string;
  dateRange: { startDate: string; endDate: string };

  // Admin
  reportSuiteDetails: ReportSuiteDetails;
  successEvents: SuccessEvent[];
  evars: EVar[];
  props: Prop[];
  classifications: SoftResult<Classification[]>;
  processingRules: SoftResult<ProcessingRule[]>;
  botRules: SoftResult<BotRule[]>;
  ipExclusions: SoftResult<string[]>;
  internalUrlFilters: SoftResult<string[]>;
  dataFeeds: SoftResult<DataFeed[]>;
  botFilteringEnabled: boolean;

  // Report data
  pageRows: ReportRow[];
  referrerDomainRows: ReportRow[];
  entryPageRows: ReportRow[];
  searchKeywordRows: ReportRow[];
  dailyRows: ReportRow[];

  // Derived
  totals: { visits: number; pageviews: number; occurrences: number };
  evarUsage: EvarUsage[];
  successEventCoverage: Map<string, number>; // eventId → total count

  // Metadata
  currencyCode: string;
  timeZone: string;
  siteDomains: string[];
}

// ── Report builder ───────────────────────────────────────────────────────────

const companyId = () => process.env.ADOBE_GLOBAL_COMPANY_ID!;

async function runReport(
  rsid: string,
  dimension: string,
  metrics: string[],
  dateRangeStr: string,
  limit = 200
): Promise<ReportRow[]> {
  const release = await globalSemaphore.acquire();
  try {
    const body = {
      rsid,
      globalFilters: [{ type: "dateRange", dateRange: dateRangeStr }],
      metricContainer: { metrics: metrics.map((id) => ({ id })) },
      dimension,
      settings: { limit, page: 0 },
    };
    const json = await adobePost<{ rows?: Array<{ itemId: string; value: string; data: number[] }> }>(
      `/api/${companyId()}/reports`,
      body
    );
    return (json.rows ?? []).map((r) => ({
      itemId: r.itemId,
      value: r.value,
      data: r.data,
    }));
  } finally {
    release();
  }
}

// ── Context builder ──────────────────────────────────────────────────────────

export async function buildAdobeContext(
  rsid: string,
  dateRange: { startDate: string; endDate: string }
): Promise<AuditContext> {
  const cid = companyId();
  const drStr = toAdobeDateRange(dateRange.startDate, dateRange.endDate);

  // ── Admin calls (parallel, softFetch where optional) ─────────────────────
  const [
    suitesRes,
    settingsRes,
    successEventsRes,
    evarsRes,
    propsRes,
    classificationsResult,
    processingRulesResult,
    botRulesResult,
    ipExclusionsResult,
    internalUrlFiltersResult,
    dataFeedsResult,
  ] = await Promise.all([
    softFetch(
      () => adobeGet<{ content: ReportSuiteDetails[] }>(`/api/${cid}/reportsuites/allreporsuites?rsids=${rsid}&limit=1`),
      "allreportsuites"
    ),
    softFetch(
      () => adobeGet<{ botDetection?: boolean; currency?: string; timezone?: string }>(`/api/${cid}/reportsuites/${rsid}/settings`),
      "settings"
    ),
    softFetch(
      () => adobeGet<SuccessEvent[]>(`/api/${cid}/reportsuites/${rsid}/successevents`),
      "successevents"
    ),
    softFetch(
      () => adobeGet<EVar[]>(`/api/${cid}/reportsuites/${rsid}/evars`),
      "evars"
    ),
    softFetch(
      () => adobeGet<Prop[]>(`/api/${cid}/reportsuites/${rsid}/props`),
      "props"
    ),
    softFetch(
      () => adobeGet<Classification[]>(`/api/${cid}/reportsuites/${rsid}/classifications`),
      "classifications"
    ),
    softFetch(
      () => adobeGet<ProcessingRule[]>(`/api/${cid}/reportsuites/${rsid}/processingrules`),
      "processingrules"
    ),
    softFetch(
      () => adobeGet<BotRule[]>(`/api/${cid}/reportsuites/${rsid}/botrules`),
      "botrules"
    ),
    softFetch(
      () => adobeGet<{ ipAddress: string }[]>(`/api/${cid}/reportsuites/${rsid}/ipexclusions`).then((r) => r.map((x) => x.ipAddress)),
      "ipexclusions"
    ),
    softFetch(
      () => adobeGet<{ filter: string }[]>(`/api/${cid}/reportsuites/${rsid}/internalurlfilters`).then((r) => r.map((x) => x.filter)),
      "internalurlfilters"
    ),
    softFetch(
      () => adobeGet<DataFeed[]>(`/api/${cid}/datafeeds?rsid=${rsid}`),
      "datafeeds"
    ),
  ]);

  // ── Report calls (parallel) ───────────────────────────────────────────────
  const [pageRows, referrerDomainRows, entryPageRows, searchKeywordRows, dailyRows] =
    await Promise.all([
      runReport(rsid, "variables/page", ["metrics/visits", "metrics/pageviews", "metrics/bounces", "metrics/bouncerate"], drStr, THRESHOLDS.PAGE_ROWS_LIMIT).catch(() => []),
      runReport(rsid, "variables/referrerdomain", ["metrics/visits"], drStr, THRESHOLDS.REFERRER_ROWS_LIMIT).catch(() => []),
      runReport(rsid, "variables/entrypage", ["metrics/visits", "metrics/entries"], drStr, THRESHOLDS.ENTRY_PAGE_ROWS_LIMIT).catch(() => []),
      runReport(rsid, "variables/searchkeyword", ["metrics/visits"], drStr, THRESHOLDS.SEARCH_KEYWORD_ROWS_LIMIT).catch(() => []),
      runReport(rsid, "variables/daterangeday", ["metrics/visits", "metrics/pageviews", "metrics/occurrences"], drStr, THRESHOLDS.DAILY_ROWS_LIMIT).catch(() => []),
    ]);

  // ── Totals ────────────────────────────────────────────────────────────────
  const visits = dailyRows.reduce((s, r) => s + (r.data[0] ?? 0), 0);
  const pageviews = dailyRows.reduce((s, r) => s + (r.data[1] ?? 0), 0);
  const occurrences = dailyRows.reduce((s, r) => s + (r.data[2] ?? 0), 0);

  // ── eVar usage (probe up to UNUSED_EVAR_CAP enabled evars) ───────────────
  const enabledEvars = (evarsRes.ok ? evarsRes.data : []).filter((e) => e.enabled).slice(0, THRESHOLDS.UNUSED_EVAR_CAP);
  const evarUsage: EvarUsage[] = await Promise.all(
    enabledEvars.map(async (ev): Promise<EvarUsage> => {
      try {
        const rows = await runReport(rsid, `variables/${ev.id}`, ["metrics/visits"], drStr, 1);
        return { evarId: ev.id, displayName: ev.name, inUse: rows.length > 0 };
      } catch {
        return { evarId: ev.id, displayName: ev.name, inUse: null };
      }
    })
  );

  // ── Success event coverage ────────────────────────────────────────────────
  const enabledEvents = (successEventsRes.ok ? successEventsRes.data : []).filter((e) => e.enabled);
  const coverageEntries = await Promise.all(
    enabledEvents.map(async (ev) => {
      const metricId = `metrics/${ev.id}`;
      try {
        const rows = await runReport(rsid, "variables/daterangeday", [metricId], drStr, 1);
        const count = rows.reduce((s, r) => s + (r.data[0] ?? 0), 0);
        return [ev.id, count] as [string, number];
      } catch {
        return [ev.id, -1] as [string, number];
      }
    })
  );

  // ── Suite details ─────────────────────────────────────────────────────────
  const suiteData = suitesRes.ok ? (suitesRes.data.content?.[0] ?? null) : null;
  const settings = settingsRes.ok ? settingsRes.data : {};
  const reportSuiteDetails: ReportSuiteDetails = {
    rsid,
    name: suiteData?.name ?? rsid,
    timezone: suiteData?.timezone ?? (settings as { timezone?: string }).timezone ?? "",
    currency: suiteData?.currency ?? (settings as { currency?: string }).currency ?? "USD",
  };

  const siteDomains = (internalUrlFiltersResult.ok ? internalUrlFiltersResult.data : []).map(
    (f) => f.replace(/^https?:\/\//, "").replace(/\/.*$/, "")
  );

  return {
    rsid,
    dateRange,
    reportSuiteDetails,
    successEvents: successEventsRes.ok ? successEventsRes.data : [],
    evars: evarsRes.ok ? evarsRes.data : [],
    props: propsRes.ok ? propsRes.data : [],
    classifications: classificationsResult,
    processingRules: processingRulesResult,
    botRules: botRulesResult,
    ipExclusions: ipExclusionsResult,
    internalUrlFilters: internalUrlFiltersResult,
    dataFeeds: dataFeedsResult,
    botFilteringEnabled: !!(settings as { botDetection?: boolean }).botDetection,
    pageRows,
    referrerDomainRows,
    entryPageRows,
    searchKeywordRows,
    dailyRows,
    totals: { visits, pageviews, occurrences },
    evarUsage,
    successEventCoverage: new Map(coverageEntries),
    currencyCode: reportSuiteDetails.currency,
    timeZone: reportSuiteDetails.timezone,
    siteDomains,
  };
}
