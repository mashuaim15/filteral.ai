import { Tier, RecommendationMode } from "@prisma/client";

export { RecommendationMode };

export const TIER_PRICES = {
  FREE: { monthly: 0, yearly: 0 },
  PRO: { monthly: 0, yearly: 0 },
  MAX: { monthly: 1.99, yearly: 15 },
} as const;

export const TIER_LIMITS = {
  FREE: {
    maxConnections: Infinity,
    dailyRecommendations: 30,
    recommendationModes: ['AI_MIXED'] as RecommendationMode[],
    aiMixedOptions: [10, 20, 30] as number[],
    emailEnabled: true,
    apiAccess: false,
  },
  PRO: {
    maxConnections: Infinity,
    dailyRecommendations: 30,
    recommendationModes: ['AI_MIXED'] as RecommendationMode[],
    aiMixedOptions: [10, 20, 30] as number[],
    emailEnabled: true,
    apiAccess: false,
  },
  MAX: {
    maxConnections: Infinity,
    dailyRecommendations: 30,
    recommendationModes: ['AI_MIXED'] as RecommendationMode[],
    aiMixedOptions: [10, 20, 30] as number[],
    emailEnabled: true,
    apiAccess: false,
  },
} as const;

export function getTierLimits(tier: Tier) {
  return TIER_LIMITS[tier];
}

export function canConnectMoreAccounts(tier: Tier, currentConnections: number): boolean {
  const limits = getTierLimits(tier);
  return currentConnections < limits.maxConnections;
}

export function getMaxRecommendations(tier: Tier): number {
  return getTierLimits(tier).dailyRecommendations;
}

export function canUseEmail(tier: Tier): boolean {
  return getTierLimits(tier).emailEnabled;
}

export function canUseApi(tier: Tier): boolean {
  return getTierLimits(tier).apiAccess;
}

export function getRecommendationModes(tier: Tier): RecommendationMode[] {
  return TIER_LIMITS[tier].recommendationModes;
}

export function canChooseRecommendationMode(tier: Tier): boolean {
  return TIER_LIMITS[tier].recommendationModes.length > 1;
}

// Site-specific configuration
export const SITE_CONFIG = {
  BILIBILI: {
    name: 'Bilibili',
    icon: '📺',
    contentType: 'videos',
    // 70% from subscriptions, 30% from general/trending
    subscribedRatio: 0.7,
    explorationRatio: 0.3,
  },
  YOUTUBE: {
    name: 'YouTube',
    icon: '▶️',
    contentType: 'videos',
    subscribedRatio: 0.7,
    explorationRatio: 0.3,
  },
  REDDIT: {
    name: 'Reddit',
    icon: '🔴',
    contentType: 'posts',
    // 70% from joined subreddits, 30% from exploration (r/all, r/popular)
    subscribedRatio: 0.7,
    explorationRatio: 0.3,
  },
} as const;
