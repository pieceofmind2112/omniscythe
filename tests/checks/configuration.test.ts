import { describe, it, expect } from "vitest";
import { checkReportSuiteStatus, checkBotFiltering, checkInternalUrlFilters } from "@/lib/audit/checks/configuration";
import type { AuditContext } from "@/lib/audit/context";

function makeCtx(overrides: Partial<AuditContext> = {}): AuditContext {
  return {
    rsid: "test-rsid",
    dateRange: { startDate: "2026-09-01", endDate: "2026-09-30" },
    reportSuiteDetails: { rsid: "test-rsid", name: "Test Suite", timezone: "US/Pacific", currency: "USD" },
    successEvents: [],
    evars: [],
    props: [],
    classifications: { ok: true, data: [] },
    processingRules: { ok: true, data: [] },
    botRules: { ok: true, data: [] },
    ipExclusions: { ok: true, data: [] },
    internalUrlFilters: { ok: true, data: [] },
    dataFeeds: { ok: true, data: [] },
    botFilteringEnabled: false,
    pageRows: [],
    referrerDomainRows: [],
    entryPageRows: [],
    searchKeywordRows: [],
    dailyRows: [],
    totals: { visits: 0, pageviews: 0, occurrences: 0 },
    evarUsage: [],
    successEventCoverage: new Map(),
    currencyCode: "USD",
    timeZone: "US/Pacific",
    siteDomains: [],
    ...overrides,
  };
}

describe("checkReportSuiteStatus", () => {
  it("passes when visits > 0", () => {
    const ctx = makeCtx({ totals: { visits: 1000, pageviews: 3000, occurrences: 4000 } });
    const check = checkReportSuiteStatus(ctx);
    expect(check.status).toBe("pass");
  });

  it("fails when visits = 0", () => {
    const ctx = makeCtx({ totals: { visits: 0, pageviews: 0, occurrences: 0 } });
    const check = checkReportSuiteStatus(ctx);
    expect(check.status).toBe("fail");
  });
});

describe("checkBotFiltering", () => {
  it("passes when IAB bot filtering is enabled", () => {
    const ctx = makeCtx({ botFilteringEnabled: true });
    const check = checkBotFiltering(ctx);
    expect(check.status).toBe("pass");
  });

  it("fails when IAB bot filtering is disabled", () => {
    const ctx = makeCtx({ botFilteringEnabled: false });
    const check = checkBotFiltering(ctx);
    expect(check.status).toBe("fail");
    expect(check.severity).toBe("warning");
  });
});

describe("checkInternalUrlFilters", () => {
  it("passes when filters are configured", () => {
    const ctx = makeCtx({ internalUrlFilters: { ok: true, data: ["gofurther.com", "www.gofurther.com"] } });
    const check = checkInternalUrlFilters(ctx);
    expect(check?.status).toBe("pass");
    expect(check?.value).toContain("2 filter");
  });

  it("fails when no filters exist", () => {
    const ctx = makeCtx({ internalUrlFilters: { ok: true, data: [] } });
    const check = checkInternalUrlFilters(ctx);
    expect(check?.status).toBe("fail");
  });

  it("returns not_applicable when the endpoint was inaccessible", () => {
    const ctx = makeCtx({ internalUrlFilters: { ok: false, error: "403 Forbidden" } });
    const check = checkInternalUrlFilters(ctx);
    expect(check?.status).toBe("not_applicable");
  });
});
