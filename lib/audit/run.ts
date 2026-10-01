import type { AuditScoreboard } from "@/types/audit";
import type { AuditContext } from "./context";
import { buildAdobeContext } from "./context";
import { CHECK_REGISTRY } from "./registry";

export async function runAudit(
  rsid: string,
  dateRange: { startDate: string; endDate: string }
): Promise<AuditScoreboard> {
  const ctx: AuditContext = await buildAdobeContext(rsid, dateRange);
  const checks = CHECK_REGISTRY.map((fn) => {
    try {
      return fn(ctx);
    } catch (err) {
      console.error(`[audit] check threw:`, err);
      return null;
    }
  }).filter((c) => c !== null);

  const passing = checks.filter((c) => c.status === "pass").length;
  const failing = checks.filter((c) => c.status === "fail").length;
  const notApplicable = checks.filter((c) => c.status === "not_applicable").length;

  return {
    property: ctx.reportSuiteDetails.name || rsid,
    runAt: new Date().toISOString(),
    checks,
    summary: {
      total: checks.length,
      passing,
      failing,
      notApplicable,
    },
    dateRange,
  };
}
