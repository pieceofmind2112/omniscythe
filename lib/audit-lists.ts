/**
 * Shared lookup lists used across audit checks.
 * These are identical to ga4-manager's lists — domain-agnostic.
 */

export const SPAM_REFERRAL_DOMAINS = new Set([
  "semalt.com",
  "buttons-for-website.com",
  "best-seo-solution.com",
  "100dollars-seo.com",
  "ilovevitaly.com",
  "darodar.com",
  "o-o-6-o-o.com",
  "hulfingtonpost.com",
  "success-seo.com",
  "trafficgenius.xyz",
  "seo-spam.net",
  "free-traffic.xyz",
]);

/** Regex patterns that indicate PII in page names / URLs */
export const PII_PATTERNS: RegExp[] = [
  // Email addresses
  /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i,
  // US Social Security Number
  /\b\d{3}-\d{2}-\d{4}\b/,
  // Credit card (simplified Luhn-passing check)
  /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11})\b/,
];

/** Domains / patterns that indicate AI platform referral traffic */
export const AI_TRAFFIC_PATTERN = /chatgpt\.com|perplexity\.ai|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com|phind\.com|you\.com/i;
