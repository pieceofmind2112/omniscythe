import { describe, it, expect } from "vitest";
import {
  checkSuccessEventsConfig,
  checkSuccessEventNaming,
  checkSuccessEventCoverage,
} from "@/lib/audit/checks/implementation";
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

describe("checkSuccessEventsConfig", () => {
  it("passes when at least one event is enabled", () => {
    const ctx = makeCtx({
      successEvents: [{ id: "event1", name: "Purchase", type: "currency", enabled: true }],
    });
    expect(checkSuccessEventsConfig(ctx).status).toBe("pass");
  });

  it("fails when no events are enabled", () => {
    const ctx = makeCtx({ successEvents: [] });
    expect(checkSuccessEventsConfig(ctx).status).toBe("fail");
  });
});

describe("checkSuccessEventNaming", () => {
  it("passes when all events have meaningful names", () => {
    const ctx = makeCtx({
      successEvents: [
        { id: "event1", name: "Purchase Complete", type: "currency", enabled: true },
        { id: "event2", name: "Form Submit", type: "counter", enabled: true },
      ],
    });
    expect(checkSuccessEventNaming(ctx).status).toBe("pass");
  });

  it("fails when events have default generated names", () => {
    const ctx = makeCtx({
      successEvents: [
        { id: "event1", name: "Event1", type: "counter", enabled: true },
        { id: "event2", name: "Checkout", type: "currency", enabled: true },
      ],
    });
    const check = checkSuccessEventNaming(ctx);
    expect(check.status).toBe("fail");
    expect(check.value).toContain("1 event");
  });
});

describe("checkSuccessEventCoverage", () => {
  it("passes when all events have data", () => {
    const ctx = makeCtx({
      successEvents: [
        { id: "event1", name: "Purchase", type: "currency", enabled: true },
      ],
      successEventCoverage: new Map([["event1", 142]]),
    });
    expect(checkSuccessEventCoverage(ctx).status).toBe("pass");
  });

  it("fails when some events have zero data", () => {
    const ctx = makeCtx({
      successEvents: [
        { id: "event1", name: "Purchase", type: "currency", enabled: true },
        { id: "event2", name: "Lead Form", type: "counter", enabled: true },
      ],
      successEventCoverage: new Map([["event1", 142], ["event2", 0]]),
    });
    const check = checkSuccessEventCoverage(ctx);
    expect(check.status).toBe("fail");
    expect(check.value).toContain("1 event with no data");
  });
});
