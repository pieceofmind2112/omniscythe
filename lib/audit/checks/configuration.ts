/**
 * Configuration checks — report suite setup and feature flags.
 */

import { buildCheck, nothingToReport, plural, table } from "@/lib/audit/helpers";
import type { AuditContext } from "@/lib/audit/context";
import type { AuditCheck } from "@/types/audit";

const CAT = "Configuration";

export function checkReportSuiteStatus(ctx: AuditContext): AuditCheck {
  const active = ctx.totals.visits > 0;
  return buildCheck({
    id: "report-suite-status",
    name: "Report Suite Status",
    category: CAT,
    severity: "info",
    status: active ? "pass" : "fail",
    value: active ? `Active (${ctx.totals.visits.toLocaleString()} visits)` : "No visits recorded",
    description: "Report suite is actively collecting hits (visits > 0 in the selected date range).",
    reason: active ? undefined : "No visits were recorded for this report suite in the selected date range.",
  });
}

export function checkBotFiltering(ctx: AuditContext): AuditCheck {
  const iabEnabled = ctx.botFilteringEnabled;
  const customRules = ctx.botRules.ok ? ctx.botRules.data.length : 0;
  const status = iabEnabled ? "pass" : "fail";

  return buildCheck({
    id: "bot-filtering",
    name: "Bot Filtering",
    category: CAT,
    severity: "warning",
    status,
    value: iabEnabled
      ? `IAB list enabled${customRules > 0 ? ` + ${plural(customRules, "custom rule")}` : ""}`
      : "IAB list disabled",
    description: "IAB bot list should be enabled; custom bot rules are a bonus.",
    reason: iabEnabled ? undefined : "IAB bot filtering is not enabled for this report suite.",
  });
}

export function checkIpExclusions(ctx: AuditContext): AuditCheck | null {
  if (!ctx.ipExclusions.ok) return nothingToReport("ip-exclusions", "IP Exclusions", CAT, "IP exclusion data was not accessible.");
  const count = ctx.ipExclusions.data.length;
  return buildCheck({
    id: "ip-exclusions",
    name: "IP Exclusions",
    category: CAT,
    severity: "info",
    status: count > 0 ? "pass" : "fail",
    value: plural(count, "rule"),
    description: "Internal/office IP addresses should be excluded from tracking.",
    reason: count === 0 ? "No IP exclusion rules are configured." : undefined,
  });
}

export function checkInternalUrlFilters(ctx: AuditContext): AuditCheck | null {
  if (!ctx.internalUrlFilters.ok) return nothingToReport("internal-url-filters", "Internal URL Filters", CAT, "Internal URL filter data was not accessible.");
  const count = ctx.internalUrlFilters.data.length;
  return buildCheck({
    id: "internal-url-filters",
    name: "Internal URL Filters",
    category: CAT,
    severity: "warning",
    status: count > 0 ? "pass" : "fail",
    value: plural(count, "filter"),
    description: "Own domains must be listed as internal URL filters to prevent self-referral inflation.",
    reason: count === 0 ? "No internal URL filters configured — own-domain referrals will inflate traffic source data." : undefined,
    detail: count > 0 ? table(["Domain"], ctx.internalUrlFilters.data.map((f) => [f])) : undefined,
  });
}

export function checkDataFeeds(ctx: AuditContext): AuditCheck | null {
  if (!ctx.dataFeeds.ok) return nothingToReport("data-feeds", "Data Feeds", CAT, "Data feed configuration was not accessible.");
  const active = ctx.dataFeeds.data.filter((f) => (f.status ?? "active") === "active");
  return buildCheck({
    id: "data-feeds",
    name: "Data Feeds",
    category: CAT,
    severity: "advice",
    status: active.length > 0 ? "pass" : "fail",
    value: `${active.length} active${ctx.dataFeeds.data.length !== active.length ? ` of ${ctx.dataFeeds.data.length} total` : ""}`,
    description: "At least one active raw-data feed (export to S3/FTP) should be configured for data portability.",
    reason: active.length === 0 ? "No active data feeds found." : undefined,
  });
}

export function checkLinkTracking(ctx: AuditContext): AuditCheck {
  // Heuristic: if any prop has link-type data in its name, or occurrences > 0
  const hasOccurrences = ctx.totals.occurrences > 0;
  return buildCheck({
    id: "link-tracking",
    name: "Link Tracking",
    category: CAT,
    severity: "info",
    status: hasOccurrences ? "pass" : "fail",
    value: hasOccurrences ? `${ctx.totals.occurrences.toLocaleString()} occurrences tracked` : "No occurrences recorded",
    description: "Custom link, download link, and exit link events should be firing to capture user interactions.",
  });
}

export function checkDataRetention(ctx: AuditContext): AuditCheck {
  // Data retention is a contract setting not surfaced in the standard API
  return buildCheck({
    id: "data-retention",
    name: "Data Retention",
    category: CAT,
    severity: "warning",
    status: "not_applicable",
    value: "Contract-defined",
    description: "Data retention period is set by Adobe contract and is not exposed via the Analytics API. Verify your retention period in your Adobe agreement.",
  });
}

export function checkAdvertisingAnalytics(ctx: AuditContext): AuditCheck {
  // Check for AMO presence via referrer or campaign eVar data
  const hasCampaignData = ctx.successEventCoverage.size > 0;
  return buildCheck({
    id: "advertising-analytics",
    name: "Advertising Analytics",
    category: CAT,
    severity: "info",
    status: "not_applicable",
    value: "Manual verification required",
    description: "Advertising Analytics (AMO / Search, Social & Commerce) linkage must be verified in the Adobe Developer Console — not exposed via the Analytics API.",
  });
}
