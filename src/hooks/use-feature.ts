import { useMemo } from "react";
import { useProfile } from "@/context/ProfileContext";
import { hasRequiredPlan, PlanLevel } from "@/utils/planUtils";
import { ALL_APP_FEATURES, AppFeature } from "@/lib/features";

/**
 * Determines if the current user has access to a specific application feature.
 * This hook checks the user's subscription plan and any perpetual license entitlements.
 *
 * @param featureId The unique ID of the feature to check.
 * @returns `true` if the user has access, `false` otherwise.
 */
export const useFeature = (featureId: string): boolean => {
  const { profile, isLoadingProfile } = useProfile();

  const hasAccess = useMemo(() => {
    if (isLoadingProfile || !profile) {
      return false; // Cannot determine access until profile is loaded
    }

    // Admins always have access to all features
    if (profile.role === 'admin') {
      return true;
    }

    const currentPlan = profile.companyProfile?.plan;
    const perpetualFeatures = profile.companyProfile?.perpetualFeatures;

    // Find the feature in our master list to get its required plan level (if any)
    const featureDefinition = ALL_APP_FEATURES.find(f => f.id === featureId);

    // If the feature isn't defined, assume no access by default (or handle as an error)
    if (!featureDefinition) {
      console.warn(`[useFeature] Feature ID '${featureId}' not found in ALL_APP_FEATURES.`);
      return false;
    }

    // Check if the user has a perpetual license and if this feature is included
    if (perpetualFeatures && perpetualFeatures.includes(featureId)) {
      return true;
    }

    // If not a perpetual license holder for this feature, check against subscription plan
    // For simplicity, we'll assume a mapping from feature ID to a minimum required plan level
    // This mapping should be maintained in `ALL_APP_FEATURES` or a separate config.
    // For now, we'll use a simplified logic: if a feature is not explicitly perpetual,
    // it requires a plan that includes it. This is a placeholder and needs refinement
    // based on your actual plan-feature mapping.

    // Example: If a feature is considered 'premium' or 'enterprise' level
    // This part needs to be customized based on how you map features to plans.
    // For demonstration, let's assume some features are 'premium' or 'enterprise' by default
    // if not covered by perpetual.
    let requiredPlanLevel: PlanLevel = 'free'; // Default to free for basic features

    if (featureId.startsWith('integrations_') || featureId === 'ai_report_summaries' || featureId === 'advanced_demand_forecast') {
      requiredPlanLevel = 'premium';
    } else if (featureId === 'automation_engine' || featureId === 'custom_roles_management' || featureId === 'transfer_admin_role' || featureId === 'activity_logs') {
      requiredPlanLevel = 'enterprise';
    }
    // Add more specific mappings as needed

    return hasRequiredPlan(currentPlan, requiredPlanLevel);

  }, [profile, isLoadingProfile, featureId]);

  return hasAccess;
};