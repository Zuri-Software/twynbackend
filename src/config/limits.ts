// Usage limits configuration
export const USAGE_LIMITS = {
  free: {
    models: 10,
    monthlyGenerations: 100,
  },
  pro: {
    models: -1, // unlimited
    monthlyGenerations: -1, // unlimited
  }
} as const;

export type SubscriptionTier = keyof typeof USAGE_LIMITS;

// Helper function to get limits for a user
export function getUserLimits(subscriptionTier: SubscriptionTier) {
  return USAGE_LIMITS[subscriptionTier];
}

// Helper function to check if user can perform an action
export function canUserCreateModel(userModelCount: number, subscriptionTier: SubscriptionTier): boolean {
  const limits = getUserLimits(subscriptionTier);
  return limits.models === -1 || userModelCount < limits.models;
}

export function canUserGenerateImages(userMonthlyGenerations: number, subscriptionTier: SubscriptionTier, requestedCount: number = 1): boolean {
  const limits = getUserLimits(subscriptionTier);
  return limits.monthlyGenerations === -1 || (userMonthlyGenerations + requestedCount) <= limits.monthlyGenerations;
}