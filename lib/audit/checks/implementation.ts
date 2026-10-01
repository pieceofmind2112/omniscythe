/**
 * Implementation checks — success events, eVars, classifications, processing rules.
 */

import { buildCheck, nothingToReport, plural, cappedTable, table } from "@/lib/audit/helpers";
import type { AuditContext } from "@/lib/audit/context";
import type { AuditCheck } from "@/types/audit";

const CAT = "Implementation";

export function checkSuccessEventsConfig(ctx: AuditContext): AuditCheck {
  const enabled = ctx.successEvents.filter((e) => e.enabled);
  return buildCheck({
    id: "success-events-config",
    name: "Success Events Configured",
    category: CAT,
    severity: "advice",
    status: enabled.length > 0 ? "pass" : "fail",
    value: `${plural(enabled.length, "success event")} enabled`,
    description: "At least one success event (conversion) should be configured and enabled.",
    reason: enabled.length === 0 ? "No success events are enabled." : undefined,
    detail: enabled.length > 0
      ? cappedTable(["ID", "Name", "Type"], enabled.map((e) => [e.id, e.name, e.type]))
      : undefined,
  });
}

export function checkSuccessEventCoverage(ctx: AuditContext): AuditCheck {
  const enabled = ctx.successEvents.filter((e) => e.enabled);
  if (enabled.length === 0) {
    return nothingToReport("success-event-coverage", "Success Event Coverage", CAT, "No enabled success events to check.");
  }

  const silent = enabled.filter((e) => {
    const count = ctx.successEventCoverage.get(e.id);
    return count !== undefined && count === 0;
  });

  return buildCheck({
    id: "success-event-coverage",
    name: "Success Event Coverage",
    category: CAT,
    severity: "warning",
    status: silent.length === 0 ? "pass" : "fail",
    value: silent.length === 0
      ? "All events are firing"
      : `${plural(silent.length, "event")} with no data`,
    description: "All configured success events should be firing within the selected date range.",
    reason: silent.length > 0 ? `${plural(silent.length, "success event")} recorded 0 occurrences.` : undefined,
    detail: silent.length > 0
      ? table(["ID", "Name"], silent.map((e) => [e.id, e.name]))
      : undefined,
  });
}

export function checkSuccessEventNaming(ctx: AuditContext): AuditCheck {
  const BAD_NAME = /^event\d+$/i;
  const unnamed = ctx.successEvents.filter(
    (e) => e.enabled && (!e.name || BAD_NAME.test(e.name.trim()))
  );
  return buildCheck({
    id: "success-event-naming",
    name: "Success Event Naming",
    category: CAT,
    severity: "advice",
    status: unnamed.length === 0 ? "pass" : "fail",
    value: unnamed.length === 0
      ? "All events named meaningfully"
      : `${plural(unnamed.length, "event")} with generic name`,
    description: "Success events should have descriptive names — not the default \"Event N\" label.",
    reason: unnamed.length > 0 ? `${plural(unnamed.length, "event")} still use the default generated name.` : undefined,
    detail: unnamed.length > 0
      ? table(["ID", "Name"], unnamed.map((e) => [e.id, e.name ?? "(blank)"]))
      : undefined,
  });
}

export function checkEvarsConfigured(ctx: AuditContext): AuditCheck {
  const enabled = ctx.evars.filter((e) => e.enabled);
  return buildCheck({
    id: "evars-configured",
    name: "eVars Configured",
    category: CAT,
    severity: "info",
    status: "pass",
    value: `${plural(enabled.length, "eVar")} enabled of ${ctx.evars.length} total`,
    description: "Informational count of configured eVars (conversion variables).",
    detail: enabled.length > 0
      ? cappedTable(["ID", "Name", "Type"], enabled.map((e) => [e.id, e.name, e.type]))
      : undefined,
  });
}

export function checkUnusedEvars(ctx: AuditContext): AuditCheck {
  const unused = ctx.evarUsage.filter((e) => e.inUse === false);
  const probed = ctx.evarUsage.length;
  if (probed === 0) return nothingToReport("unused-evars", "Unused eVars", CAT, "No eVars to check.");

  return buildCheck({
    id: "unused-evars",
    name: "Unused eVars",
    category: CAT,
    severity: "info",
    status: "pass",
    value: unused.length === 0
      ? `All ${probed} probed eVars have data`
      : `${plural(unused.length, "eVar")} with no data (of ${probed} probed)`,
    description: `Checks which of the first ${probed} enabled eVars have no data in the date range. Enabled-but-empty eVars may indicate stale configuration.`,
    detail: unused.length > 0
      ? table(["ID", "Name"], unused.map((e) => [e.evarId, e.displayName]))
      : undefined,
  });
}

export function checkClassifications(ctx: AuditContext): AuditCheck | null {
  if (!ctx.classifications.ok) {
    return nothingToReport("classifications", "Classifications", CAT, "Classification data was not accessible.");
  }
  const count = ctx.classifications.data.length;
  return buildCheck({
    id: "classifications",
    name: "Classifications",
    category: CAT,
    severity: "info",
    status: "pass",
    value: plural(count, "classification set"),
    description: "Classifications (lookup tables on eVars) enable content grouping and enrichment.",
    detail: count > 0
      ? cappedTable(["ID", "Name", "Dimension"], ctx.classifications.data.map((c) => [c.id, c.name, c.dimension]))
      : undefined,
  });
}

export function checkProcessingRules(ctx: AuditContext): AuditCheck | null {
  if (!ctx.processingRules.ok) {
    return nothingToReport("processing-rules", "Processing Rules", CAT, "Processing rule data was not accessible.");
  }
  const count = ctx.processingRules.data.length;
  return buildCheck({
    id: "processing-rules",
    name: "Processing Rules",
    category: CAT,
    severity: "advice",
    status: "pass",
    value: plural(count, "rule"),
    description: "Server-side rules that copy, set, or delete variable values. More rules indicate richer data transformation.",
  });
}

export function checkSiteSearchTracking(ctx: AuditContext): AuditCheck {
  const hasSearch = ctx.searchKeywordRows.length > 0;
  const totalSearchVisits = ctx.searchKeywordRows.reduce((s, r) => s + (r.data[0] ?? 0), 0);
  return buildCheck({
    id: "site-search-tracking",
    name: "Site Search Tracking",
    category: CAT,
    severity: "info",
    status: hasSearch ? "pass" : "fail",
    value: hasSearch
      ? `${totalSearchVisits.toLocaleString()} visits with search keywords`
      : "No search keyword data",
    description: "Internal site search keywords should be captured to understand what visitors look for.",
    reason: hasSearch ? undefined : "No search keyword data found in the selected date range.",
  });
}
