// src/utils/planUtils.ts

/**
 * Defines the hierarchical order of subscription plans.
 * Plans listed earlier have fewer features than those listed later.
 */
export const planOrder = ["free", "standard", "premium", "ultimate", "enterprise"];

/**
 * Checks if a user's current plan meets or exceeds a required plan level for a specific feature.
 *
 * @param currentUserPlanId The ID of the user's current plan (e.g., 'free', 'premium').
 * @param requiredPlanId The ID of the plan required for the feature (e.g., 'premium').
 * @returns `true` if the user has access, `false` otherwise.
 */
export const hasPlanAccess = (currentUserPlanId: string | undefined, requiredPlanId: string): boolean => {
  if (!currentUserPlanId) {
    // If the user has no plan assigned (e.g., during initial loading or an unassigned state), deny access.
    return false;
  }

  const currentUserPlanIndex = planOrder.indexOf(currentUserPlanId.toLowerCase());
  const requiredPlanIndex = planOrder.indexOf(requiredPlanId.toLowerCase());

  if (currentUserPlanIndex === -1) {
    console.warn(`[PlanAccess] Unknown current plan ID: '${currentUserPlanId}'. Denying access.`);
    return false;
  }
  if (requiredPlanIndex === -1) {
    console.warn(`[PlanAccess] Unknown required plan ID: '${requiredPlanId}'. Denying access.`);
    return false;
  }

  // User has access if their plan's index is greater than or equal to the required plan's index.
  return currentUserPlanIndex >= requiredPlanIndex;
};