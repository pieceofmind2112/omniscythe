// AuditCheck, AuditScoreboard, and shared types
// Platform-agnostic — used by both the Adobe audit engine and any future adapters.

export type Severity = "info" | "advice" | "warning" | "critical";
export type CheckStatus = "pass" | "fail" | "not_applicable";

export interface AuditCheck {
  id: string;
  name: string;
  category: string;
  severity: Severity;
  status: CheckStatus;
  /** Human-readable value or summary, e.g. "12 / 50 eVars in use" */
  value: string;
  /** Numeric benchmark the value is compared to */
  target?: number;
  percentOfTarget?: number;
  description: string;
  /** Why it failed (only on status = "fail") */
  reason?: string;
  /** Extra rows, table data, or supplemental text */
  detail?: AuditDetail;
}

export interface AuditDetail {
  type: "table" | "list" | "text";
  columns?: string[];
  rows?: string[][];
  items?: string[];
  text?: string;
}

export interface AuditScoreboard {
  property: string;
  runAt: string; // ISO 8601
  checks: AuditCheck[];
  summary: {
    total: number;
    passing: number;
    failing: number;
    notApplicable: number;
  };
  dateRange?: { startDate: string; endDate: string };
  comparison?: { startDate: string; endDate: string };
  skippedCheckIds?: string[];
}

export interface AuditNote {
  id: string;
  checkId: string;
  rsid: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditStatusOverride {
  id: string;
  checkId: string;
  rsid: string;
  overrideStatus: CheckStatus;
  reason: string;
  createdAt: string;
}

/** Each audit check module is a pure function: context → check or null */
export type CheckModule<TContext> = (ctx: TContext) => AuditCheck | null;
