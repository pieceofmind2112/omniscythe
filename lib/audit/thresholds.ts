/**
 * Configurable thresholds for audit checks.
 * Adobe-specific where they differ from GA4 norms.
 */
export const THRESHOLDS = {
  // Traffic quality
  MISSING_ENTRY_PAGE_PERCENT: 2,      // fail if > 2% of visits lack entry page
  HIGH_BOUNCE_RATE_PERCENT: 70,       // flag pages above 70% bounce rate
  HIGH_BOUNCE_RATE_MIN_VISITS: 100,   // only flag if page has >= 100 visits
  SELF_REFERRAL_PERCENT: 1,           // fail if > 1% of referrers are own domain
  NOT_FOUND_PAGE_PERCENT: 0.1,        // fail if > 0.1% of pageviews are 404s
  MIXED_CASE_PERCENT: 5,              // warn if > 5% of sampled pages have case variants

  // Implementation
  UNUSED_EVAR_CAP: 30,                // probe at most 30 eVars for usage data
  SUCCESS_EVENT_COVERAGE_DAYS: 30,    // look back this many days for coverage check

  // Report limits
  PAGE_ROWS_LIMIT: 200,
  REFERRER_ROWS_LIMIT: 200,
  ENTRY_PAGE_ROWS_LIMIT: 200,
  SEARCH_KEYWORD_ROWS_LIMIT: 100,
  DAILY_ROWS_LIMIT: 90,
} as const;
