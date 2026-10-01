import type { AuditCheck, AuditDetail, CheckStatus, Severity } from "@/types/audit";

// ── Row helpers ────────────────────────────────────────────────────────────

export interface ReportRow {
  itemId: string;
  value: string;
  data: number[];
}

/** Dimension value for a row */
export const dim = (row: ReportRow): string => row.value;

/** Metric value at index (default 0) */
export const metric = (row: ReportRow, index = 0): number =>
  row.data[index] ?? 0;

// ── Check builder ──────────────────────────────────────────────────────────

interface CheckArgs {
  id: string;
  name: string;
  category: string;
  severity: Severity;
  status: CheckStatus;
  value: string;
  target?: number;
  percentOfTarget?: number;
  description: string;
  reason?: string;
  detail?: AuditDetail;
}

export function buildCheck(args: CheckArgs): AuditCheck {
  return { ...args };
}

export function nothingToReport(
  id: string,
  name: string,
  category: string,
  description: string
): AuditCheck {
  return buildCheck({
    id,
    name,
    category,
    severity: "info",
    status: "not_applicable",
    value: "No data",
    description,
  });
}

// ── Formatting ─────────────────────────────────────────────────────────────

export function percentOf(part: number, whole: number): number {
  if (whole === 0) return 0;
  return Math.round((part / whole) * 10000) / 100;
}

export function plural(n: number, singular: string, pluralStr?: string): string {
  return n === 1 ? `${n} ${singular}` : `${n} ${pluralStr ?? singular + "s"}`;
}

// ── Table builders ─────────────────────────────────────────────────────────

export function table(columns: string[], rows: string[][]): AuditDetail {
  return { type: "table", columns, rows };
}

export function cappedTable(
  columns: string[],
  rows: string[][],
  cap = 25
): AuditDetail {
  return table(columns, rows.slice(0, cap));
}

// ── Date helpers ───────────────────────────────────────────────────────────

/**
 * Adobe API requires ISO 8601 with time component:
 * "2024-01-01T00:00:00.000/2024-01-31T23:59:59.999"
 */
export function toAdobeDateRange(startDate: string, endDate: string): string {
  return `${startDate}T00:00:00.000/${endDate}T23:59:59.999`;
}

export function daysAgoDate(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
