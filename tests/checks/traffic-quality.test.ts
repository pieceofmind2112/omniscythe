import { describe, it, expect } from "vitest";
import {
  checkPiiInPageNames,
  checkSpamReferrals,
  checkMissingEntryPages,
} from "@/lib/audit/checks/traffic-quality";
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

describe("checkPiiInPageNames", () => {
  it("passes when no PII is in page names", () => {
    const ctx = makeCtx({
      pageRows: [
        { itemId: "1", value: "/home", data: [500, 1200, 100, 0.4] },
        { itemId: "2", value: "/products", data: [300, 900, 80, 0.3] },
      ],
    });
    expect(checkPiiInPageNames(ctx).status).toBe("pass");
  });

  it("fails when an email appears in a page name", () => {
    const ctx = makeCtx({
      pageRows: [
        { itemId: "1", value: "/profile?email=john.doe@example.com", data: [50, 100, 10, 0.5] },
      ],
    });
    const check = checkPiiInPageNames(ctx);
    expect(check.status).toBe("fail");
    expect(check.severity).toBe("critical");
  });
});

describe("checkSpamReferrals", () => {
  it("passes when no spam domains are in referrer data", () => {
    const ctx = makeCtx({
      referrerDomainRows: [
        { itemId: "1", value: "google.com", data: [2000] },
        { itemId: "2", value: "bing.com", data: [500] },
      ],
    });
    expect(checkSpamReferrals(ctx).status).toBe("pass");
  });

  it("fails when a known spam domain appears", () => {
    const ctx = makeCtx({
      referrerDomainRows: [
        { itemId: "1", value: "google.com", data: [2000] },
        { itemId: "2", value: "semalt.com", data: [42] },
      ],
    });
    const check = checkSpamReferrals(ctx);
    expect(check.status).toBe("fail");
    expect(check.severity).toBe("warning");
  });
});

describe("checkMissingEntryPages", () => {
  it("passes when missing entry pages are below threshold", () => {
    const ctx = makeCtx({
      totals: { visits: 10000, pageviews: 30000, occurrences: 40000 },
      entryPageRows: [
        { itemId: "1", value: "/home", data: [9800, 9800] },
        { itemId: "2", value: "(not set)", data: [150, 150] }, // 1.5%
      ],
    });
    expect(checkMissingEntryPages(ctx).status).toBe("pass");
  });

  it("fails when missing entry pages exceed 2%", () => {
    const ctx = makeCtx({
      totals: { visits: 10000, pageviews: 30000, occurrences: 40000 },
      entryPageRows: [
        { itemId: "1", value: "/home", data: [9500, 9500] },
        { itemId: "2", value: "(not set)", data: [500, 500] }, // 5%
      ],
    });
    const check = checkMissingEntryPages(ctx);
    expect(check.status).toBe("fail");
    expect(check.severity).toBe("critical");
  });
});
