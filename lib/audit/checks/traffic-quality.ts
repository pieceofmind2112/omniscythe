/**
 * Traffic Quality checks — data integrity, self-referrals, PII, AI traffic.
 */

import { buildCheck, dim, metric, percentOf, plural, cappedTable } from "@/lib/audit/helpers";
import { THRESHOLDS } from "@/lib/audit/thresholds";
import { SPAM_REFERRAL_DOMAINS, PII_PATTERNS, AI_TRAFFIC_PATTERN } from "@/lib/audit-lists";
import type { AuditContext } from "@/lib/audit/context";
import type { AuditCheck } from "@/types/audit";

const CAT = "Traffic Quality";

export function checkMissingEntryPages(ctx: AuditContext): AuditCheck {
  const totalVisits = ctx.totals.visits;
  if (totalVisits === 0) {
    return buildCheck({ id: "missing-entry-pages", name: "Missing Entry Pages", category: CAT, severity: "critical", status: "not_applicable", value: "No traffic", description: "Percentage of visits without a captured entry page." });
  }
  const missingVisits = ctx.entryPageRows.filter((r) => dim(r) === "(not set)").reduce((s, r) => s + metric(r), 0);
  const pct = percentOf(missingVisits, totalVisits);
  return buildCheck({
    id: "missing-entry-pages",
    name: "Missing Entry Pages",
    category: CAT,
    severity: "critical",
    status: pct <= THRESHOLDS.MISSING_ENTRY_PAGE_PERCENT ? "pass" : "fail",
    value: `${pct.toFixed(1)}% of visits`,
    target: THRESHOLDS.MISSING_ENTRY_PAGE_PERCENT,
    percentOfTarget: pct,
    description: `Visits without a captured entry page should be < ${THRESHOLDS.MISSING_ENTRY_PAGE_PERCENT}%.`,
    reason: pct > THRESHOLDS.MISSING_ENTRY_PAGE_PERCENT
      ? `${pct.toFixed(1)}% of visits are missing an entry page — tracking may not fire on session start.`
      : undefined,
  });
}

export function checkHighBouncePages(ctx: AuditContext): AuditCheck {
  const highBounce = ctx.pageRows.filter(
    (r) => metric(r, 0) >= THRESHOLDS.HIGH_BOUNCE_RATE_MIN_VISITS && metric(r, 3) > THRESHOLDS.HIGH_BOUNCE_RATE_PERCENT
  );
  return buildCheck({
    id: "high-bounce-pages",
    name: "High Bounce Rate Pages",
    category: CAT,
    severity: "warning",
    status: highBounce.length === 0 ? "pass" : "fail",
    value: `${plural(highBounce.length, "page")} above ${THRESHOLDS.HIGH_BOUNCE_RATE_PERCENT}% bounce`,
    description: `Pages with ≥ ${THRESHOLDS.HIGH_BOUNCE_RATE_MIN_VISITS} visits and > ${THRESHOLDS.HIGH_BOUNCE_RATE_PERCENT}% bounce rate.`,
    reason: highBounce.length > 0 ? `${plural(highBounce.length, "page")} may need content or UX review.` : undefined,
    detail: highBounce.length > 0
      ? cappedTable(
          ["Page", "Visits", "Bounce Rate"],
          highBounce.map((r) => [dim(r), metric(r, 0).toLocaleString(), `${metric(r, 3).toFixed(1)}%`])
        )
      : undefined,
  });
}

export function checkSelfReferrals(ctx: AuditContext): AuditCheck {
  const siteDomainSet = new Set(ctx.siteDomains.map((d) => d.toLowerCase()));
  const totalVisits = ctx.totals.visits;
  if (totalVisits === 0 || siteDomainSet.size === 0) {
    return buildCheck({ id: "self-referrals", name: "Self-Referrals", category: CAT, severity: "warning", status: "not_applicable", value: "No data or domains", description: "Self-referral rate check." });
  }
  const selfVisits = ctx.referrerDomainRows
    .filter((r) => siteDomainSet.has(dim(r).toLowerCase()))
    .reduce((s, r) => s + metric(r), 0);
  const pct = percentOf(selfVisits, totalVisits);
  return buildCheck({
    id: "self-referrals",
    name: "Self-Referrals",
    category: CAT,
    severity: "warning",
    status: pct <= THRESHOLDS.SELF_REFERRAL_PERCENT ? "pass" : "fail",
    value: `${pct.toFixed(2)}% of visits`,
    target: THRESHOLDS.SELF_REFERRAL_PERCENT,
    percentOfTarget: pct,
    description: `Own-domain referrals should be < ${THRESHOLDS.SELF_REFERRAL_PERCENT}%. Configure internal URL filters to suppress these.`,
    reason: pct > THRESHOLDS.SELF_REFERRAL_PERCENT ? "Own domain appears in referrer data — internal URL filters may be misconfigured." : undefined,
  });
}

export function checkNotFoundPages(ctx: AuditContext): AuditCheck {
  const total404Views = ctx.pageRows
    .filter((r) => /404/i.test(dim(r)))
    .reduce((s, r) => s + metric(r, 1), 0);
  const totalPageviews = ctx.totals.pageviews;
  if (totalPageviews === 0) return buildCheck({ id: "not-found-pages", name: "404 Error Pages", category: CAT, severity: "warning", status: "not_applicable", value: "No pageviews", description: "404 error page traffic as a percentage of total pageviews." });
  const pct = percentOf(total404Views, totalPageviews);
  return buildCheck({
    id: "not-found-pages",
    name: "404 Error Pages",
    category: CAT,
    severity: "warning",
    status: pct <= THRESHOLDS.NOT_FOUND_PAGE_PERCENT ? "pass" : "fail",
    value: `${pct.toFixed(2)}% of pageviews`,
    target: THRESHOLDS.NOT_FOUND_PAGE_PERCENT,
    percentOfTarget: pct,
    description: `Traffic landing on pages with "404" in the name should be < ${THRESHOLDS.NOT_FOUND_PAGE_PERCENT}%.`,
  });
}

export function checkMixedCasePages(ctx: AuditContext): AuditCheck {
  const seenLower = new Map<string, number>(); // lowercase → total views
  for (const r of ctx.pageRows) {
    const key = dim(r).toLowerCase();
    seenLower.set(key, (seenLower.get(key) ?? 0) + metric(r, 1));
  }
  // Find page names that have case variants (same lower, different raw)
  const rawToLower = new Map<string, string[]>();
  for (const r of ctx.pageRows) {
    const key = dim(r).toLowerCase();
    const arr = rawToLower.get(key) ?? [];
    if (!arr.includes(dim(r))) arr.push(dim(r));
    rawToLower.set(key, arr);
  }
  const duplicated = [...rawToLower.entries()].filter(([, variants]) => variants.length > 1);
  const mixedViews = duplicated.reduce((s, [key]) => s + (seenLower.get(key) ?? 0), 0);
  const totalViews = ctx.totals.pageviews;
  const pct = totalViews > 0 ? percentOf(mixedViews, totalViews) : 0;

  return buildCheck({
    id: "uppercase-urls",
    name: "Mixed-Case Pages",
    category: CAT,
    severity: "info",
    status: pct <= THRESHOLDS.MIXED_CASE_PERCENT ? "pass" : "fail",
    value: `${pct.toFixed(1)}% of pageviews`,
    description: `Pages collected with inconsistent casing inflate unique page counts. Target < ${THRESHOLDS.MIXED_CASE_PERCENT}%.`,
    detail: duplicated.length > 0
      ? cappedTable(["Base (lowercased)", "Variants"], duplicated.slice(0, 10).map(([key, vs]) => [key, vs.join(" / ")]))
      : undefined,
  });
}

export function checkSpamReferrals(ctx: AuditContext): AuditCheck {
  const spamRows = ctx.referrerDomainRows.filter((r) => SPAM_REFERRAL_DOMAINS.has(dim(r).toLowerCase()));
  const spamVisits = spamRows.reduce((s, r) => s + metric(r), 0);
  return buildCheck({
    id: "spam-referrals",
    name: "Spam Referrals",
    category: CAT,
    severity: "warning",
    status: spamVisits === 0 ? "pass" : "fail",
    value: spamVisits === 0 ? "None detected" : `${spamVisits.toLocaleString()} visits from ${spamRows.length} spam domain(s)`,
    description: "Known spam/bot referrer domains should not appear in referral traffic.",
    reason: spamVisits > 0 ? "Spam referral domains detected. Enable bot filtering or exclude these domains." : undefined,
    detail: spamRows.length > 0
      ? cappedTable(["Domain", "Visits"], spamRows.map((r) => [dim(r), metric(r).toLocaleString()]))
      : undefined,
  });
}

export function checkPiiInPageNames(ctx: AuditContext): AuditCheck {
  const hits = ctx.pageRows.filter((r) => PII_PATTERNS.some((p) => p.test(dim(r))));
  return buildCheck({
    id: "pii-in-page-names",
    name: "PII in Page Names",
    category: CAT,
    severity: "critical",
    status: hits.length === 0 ? "pass" : "fail",
    value: hits.length === 0 ? "None detected" : `${plural(hits.length, "page")} with potential PII`,
    description: "Email addresses, SSNs, or credit card numbers must not appear in captured page names.",
    reason: hits.length > 0 ? "Potential PII found in page name data — immediate remediation required." : undefined,
    detail: hits.length > 0
      ? cappedTable(["Page Name", "Views"], hits.map((r) => [dim(r).slice(0, 80), metric(r, 1).toLocaleString()]))
      : undefined,
  });
}

export function checkAiPlatformTraffic(ctx: AuditContext): AuditCheck {
  const aiRows = ctx.referrerDomainRows.filter((r) => AI_TRAFFIC_PATTERN.test(dim(r)));
  const aiVisits = aiRows.reduce((s, r) => s + metric(r), 0);
  return buildCheck({
    id: "ai-platform-traffic",
    name: "AI Platform Traffic",
    category: CAT,
    severity: "info",
    status: "pass",
    value: aiVisits > 0 ? `${aiVisits.toLocaleString()} visits from AI platforms` : "None detected",
    description: "Informational: traffic referred from AI platforms (ChatGPT, Perplexity, etc.).",
    detail: aiRows.length > 0
      ? cappedTable(["Domain", "Visits"], aiRows.map((r) => [dim(r), metric(r).toLocaleString()]))
      : undefined,
  });
}

export function checkUntaggedCampaigns(ctx: AuditContext): AuditCheck {
  // Heuristic: paid search referrers present but no corresponding campaign eVar data
  const paidReferrers = ctx.referrerDomainRows.filter((r) =>
    /google\.com|bing\.com|yahoo\.com|facebook\.com|instagram\.com|linkedin\.com/i.test(dim(r))
  );
  const hasPaidTraffic = paidReferrers.reduce((s, r) => s + metric(r), 0) > 0;
  // Check if any success event coverage for campaign-related events exists
  const hasTrackingData = [...ctx.successEventCoverage.values()].some((v) => v > 0);

  return buildCheck({
    id: "untagged-campaigns",
    name: "Untagged Campaign Traffic",
    category: CAT,
    severity: "warning",
    status: hasPaidTraffic && !hasTrackingData ? "fail" : "pass",
    value: hasPaidTraffic
      ? `Paid referrer traffic detected; campaign tracking: ${hasTrackingData ? "present" : "not detected"}`
      : "No paid referrer traffic detected",
    description: "Paid traffic arriving without campaign tracking codes inflates direct/referral sources.",
    reason: hasPaidTraffic && !hasTrackingData
      ? "Paid referrer domains detected but no campaign eVar tracking data found. Implement campaign tracking codes."
      : undefined,
  });
}
