/**
 * Registry — ordered list of all check modules.
 * Each module is a function: (ctx: AuditContext) → AuditCheck | null
 */

import type { AuditContext } from "@/lib/audit/context";
import type { AuditCheck } from "@/types/audit";

// Configuration
import {
  checkReportSuiteStatus,
  checkBotFiltering,
  checkIpExclusions,
  checkInternalUrlFilters,
  checkDataFeeds,
  checkLinkTracking,
  checkDataRetention,
  checkAdvertisingAnalytics,
} from "./checks/configuration";

// Implementation
import {
  checkSuccessEventsConfig,
  checkSuccessEventCoverage,
  checkSuccessEventNaming,
  checkEvarsConfigured,
  checkUnusedEvars,
  checkClassifications,
  checkProcessingRules,
  checkSiteSearchTracking,
} from "./checks/implementation";

// Traffic Quality
import {
  checkMissingEntryPages,
  checkHighBouncePages,
  checkSelfReferrals,
  checkNotFoundPages,
  checkMixedCasePages,
  checkSpamReferrals,
  checkPiiInPageNames,
  checkAiPlatformTraffic,
  checkUntaggedCampaigns,
} from "./checks/traffic-quality";

export const CHECK_REGISTRY: Array<(ctx: AuditContext) => AuditCheck | null> = [
  // Configuration
  checkReportSuiteStatus,
  checkBotFiltering,
  checkIpExclusions,
  checkInternalUrlFilters,
  checkDataFeeds,
  checkLinkTracking,
  checkDataRetention,
  checkAdvertisingAnalytics,

  // Implementation
  checkSuccessEventsConfig,
  checkSuccessEventCoverage,
  checkSuccessEventNaming,
  checkEvarsConfigured,
  checkUnusedEvars,
  checkClassifications,
  checkProcessingRules,
  checkSiteSearchTracking,

  // Traffic Quality
  checkMissingEntryPages,
  checkHighBouncePages,
  checkSelfReferrals,
  checkNotFoundPages,
  checkMixedCasePages,
  checkSpamReferrals,
  checkPiiInPageNames,
  checkAiPlatformTraffic,
  checkUntaggedCampaigns,
];
