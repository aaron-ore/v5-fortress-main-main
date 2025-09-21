"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { showError, showSuccess } from '@/utils/toast';
import { logActivity } from '@/utils/logActivity';
import { getFilePathFromPublicUrl } from '@/integrations/supabase/storage';
import { deepEqual } from '@/lib/utils'; // Import deepEqual
import { useAuth } from './AuthContext'; // NEW: Import useAuth

export interface CompanyProfile {
  companyName: string;
  companyCurrency: string;
  companyAddress: string;
  companyLogoUrl?: string;
  organizationCode?: string;
  organizationTheme?: string;
  plan?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  trialEndsAt?: string;
  defaultReorderLevel?: number;
  enableAutoReorderNotifications?: boolean;
  enableAutoReorder?: boolean;
}

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  role: 'viewer' | 'inventory_manager' | 'admin';
  organizationId: string | null;
  phone?: string;
  address?: string;
  createdAt: string;
  quickbooksAccessToken?: string;
  quickbooksRefreshToken?: string;
  quickbooksRealmId?: string;
  shopifyAccessToken?: string;
  shopifyRefreshToken?: string;
  shopifyStoreName?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  companyProfile?: CompanyProfile;
  hasOnboardingWizardCompleted: boolean; // RENAMED: From hasOnboardingTutorialShown
  hasUiTutorialShown: boolean; // NEW: Separate flag for UI tutorial
}

interface ProfileContextType {
  profile: UserProfile | null;
  allProfiles: UserProfile[];
  isLoadingProfile: boolean;
  isLoadingAllProfiles: boolean;
  fetchProfile: () => Promise<void>;
  fetchAllProfiles: () => Promise<void>;
  updateProfile: (updates: Partial<Omit<UserProfile, 'id' | 'email' | 'role' | 'organizationId' | 'createdAt' | 'quickbooksAccessToken' | 'quickbooksRefreshToken' | 'quickbooksRealmId' | 'shopifyAccessToken' | 'shopifyRefreshToken' | 'shopifyStoreName' | 'stripeCustomerId' | 'stripeSubscriptionId' | 'hasOnboardingWizardCompleted' | 'hasUiTutorialShown'>>) => Promise<void>;
  updateUserRole: (userId: string, newRole: string, organizationId: string) => Promise<void>;
  updateCompanyProfile: (updates: Partial<CompanyProfile>, uniqueCode?: string) => Promise<void>;
  updateOrganizationTheme: (newTheme: string) => Promise<void>;
  markOnboardingWizardCompleted: () => Promise<void>; // NEW: Function to mark onboarding wizard as completed
  markTutorialAsShown: () => Promise<void>; // MODIFIED: Now marks UI tutorial as shown
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading: isLoadingAuth } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>([]);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingAllProfiles, setIsLoadingAllProfiles] = useState(true);

  const mapSupabaseProfileToUserProfile = (data: any, companyData: any | null): UserProfile => {
    const companyProfile: CompanyProfile | undefined = companyData ? {
      companyName: companyData.name,
      companyCurrency: companyData.currency,
      companyAddress: companyData.address,
      companyLogoUrl: companyData.company_logo_url || undefined,
      organizationCode: companyData.unique_code || undefined,
      organizationTheme: companyData.default_theme || undefined,
      plan: companyData.plan || undefined,
      stripeCustomerId: companyData.stripe_customer_id || undefined,
      stripeSubscriptionId: companyData.stripe_subscription_id || undefined,
      trialEndsAt: companyData.trial_ends_at ? new Date(companyData.trial_ends_at).toISOString() : undefined,
      defaultReorderLevel: companyData.default_reorder_level || 0,
      enableAutoReorderNotifications: companyData.enable_auto_reorder_notifications || false,
      enableAutoReorder: companyData.enable_auto_reorder || false,
    } : undefined;

    return {
      id: data.id,
      fullName: data.full_name || '',
      email: data.email || '',
      avatarUrl: data.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${data.full_name || data.email || 'User'}`,
      role: data.role || 'viewer',
      organizationId: data.organization_id,
      phone: data.phone || undefined,
      address: data.address || undefined,
      createdAt: data.created_at,
      quickbooksAccessToken: data.quickbooks_access_token || undefined,
      quickbooksRefreshToken: data.quickbooks_refresh_token || undefined,
      quickbooksRealmId: data.quickbooks_realm_id || undefined,
      shopifyAccessToken: companyData?.shopify_access_token || undefined,
      shopifyRefreshToken: companyData?.shopify_refresh_token || undefined,
      shopifyStoreName: companyData?.shopify_store_name || undefined,
      stripeCustomerId: companyData?.stripe_customer_id || undefined,
      stripeSubscriptionId: companyData?.stripe_subscription_id || undefined,
      companyProfile: companyProfile,
      hasOnboardingWizardCompleted: data.has_onboarding_wizard_completed ?? false, // Mapped from new column
      hasUiTutorialShown: data.has_ui_tutorial_shown ?? false, // Mapped from new column
    };
  };

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setIsLoadingProfile(false);
      return;
    }

    setIsLoadingProfile(true);
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        *,
        organizations(
          name,
          currency,
          address,
          unique_code,
          default_theme,
          company_logo_url,
          shopify_access_token,
          shopify_refresh_token,
          shopify_store_name,
          plan,
          stripe_customer_id,
          stripe_subscription_id,
          trial_ends_at,
          default_reorder_level,
          enable_auto_reorder_notifications,
          enable_auto_reorder
        )
      `)
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      showError('Failed to load user profile.');
      await logActivity("Profile Fetch Failed", `Failed to load user profile for user ${user.id}.`, profile, { error_message: error.message }, true);
      setProfile(null);
    } else if (data) {
      const newProfileData = mapSupabaseProfileToUserProfile(data, data.organizations);
      setProfile(prevProfile => {
        // Only update if the new profile data is actually different from the previous one
        if (deepEqual(prevProfile, newProfileData)) {
          return prevProfile; // No change, return previous object to prevent re-render
        }
        return newProfileData; // Data changed, update state
      });
    }
    setIsLoadingProfile(false);
  }, [user]); // Removed 'profile' from dependency array here.

  const fetchAllProfiles = useCallback(async () => {
    if (!profile?.organizationId) {
      setAllProfiles([]);
      setIsLoadingAllProfiles(false);
      return;
    }

    setIsLoadingAllProfiles(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('organization_id', profile.organizationId)
      .order('full_name', { ascending: true });

    if (error) {
      console.error('Error fetching all profiles:', error);
      showError('Failed to load all user profiles.');
      await logActivity("All Profiles Fetch Failed", `Failed to load all profiles for organization ${profile.organizationId}.`, profile, { error_message: error.message }, true);
      setAllProfiles([]);
    } else {
      const mappedProfiles: UserProfile[] = data.map((p: any) => mapSupabaseProfileToUserProfile(p, null));
      setAllProfiles(mappedProfiles);
    }
    setIsLoadingAllProfiles(false);
  }, [profile?.organizationId, profile]);

  useEffect(() => {
    if (!isLoadingAuth) {
      fetchProfile();
    }
  }, [isLoadingAuth, fetchProfile]);

  useEffect(() => {
    if (!isLoadingProfile && profile?.organizationId) {
      fetchAllProfiles();
    } else if (!isLoadingProfile && !profile?.organizationId) {
      setAllProfiles([]);
      setIsLoadingAllProfiles(false);
    }
  }, [isLoadingProfile, profile?.organizationId, fetchAllProfiles]);

  const updateProfile = async (updates: Partial<Omit<UserProfile, 'id' | 'email' | 'role' | 'organizationId' | 'createdAt' | 'quickbooksAccessToken' | 'quickbooksRefreshToken' | 'quickbooksRealmId' | 'shopifyAccessToken' | 'shopifyRefreshToken' | 'shopifyStoreName' | 'stripeCustomerId' | 'stripeSubscriptionId' | 'hasOnboardingWizardCompleted' | 'hasUiTutorialShown'>>) => {
    if (!profile) {
      const errorMessage = 'User profile not loaded.';
      await logActivity("Update User Profile Failed", errorMessage, profile, { updated_fields: updates }, true);
      showError(errorMessage);
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: updates.fullName,
        phone: updates.phone,
        address: updates.address,
        avatar_url: updates.avatarUrl,
      })
      .eq('id', profile.id);

    if (error) {
      console.error('Error updating profile:', error);
      await logActivity("Update User Profile Failed", `Failed to update user profile for ${profile.email}.`, profile, { error_message: error.message, updated_fields: updates }, true);
      showError(`Failed to update profile: ${error.message}`);
      throw error;
    } else {
      showSuccess('Profile updated successfully!');
      await logActivity("Update User Profile Success", `User profile for ${profile.email} updated.`, profile, { updated_fields: updates });
      await fetchProfile();
    }
  };

  const updateUserRole = async (userId: string, newRole: string, organizationId: string) => {
    if (!profile || profile.role !== 'admin' || profile.organizationId !== organizationId) {
      const errorMessage = 'You do not have permission to update user roles in this organization.';
      await logActivity("Update User Role Failed", errorMessage, profile, { target_user_id: userId, new_role: newRole, organization_id: organizationId }, true);
      showError(errorMessage);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('update-user-profile', {
        body: JSON.stringify({ targetUserId: userId, newRole, organizationId }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      showSuccess(`User role updated to ${newRole} for ${userId}.`);
      await logActivity("Update User Role Success", `User ${userId} role updated to ${newRole}.`, profile, { target_user_id: userId, new_role: newRole, organization_id: organizationId });
      await fetchAllProfiles();
    } catch (error: any) {
      console.error('Error updating user role:', error);
      await logActivity("Update User Role Failed", `Failed to update user role for ${userId}.`, profile, { error_message: error.message, target_user_id: userId, new_role: newRole, organization_id: organizationId }, true);
      showError(`Failed to update user role: ${error.message}`);
      throw error;
    }
  };

  const updateCompanyProfile = async (updates: Partial<CompanyProfile>, uniqueCode?: string) => {
    console.log("[OnboardingContext] setCompanyProfile called with profileData:", updates, "newUniqueCode:", uniqueCode);

    if (!profile || !profile.organizationId) {
      const errorMessage = 'Organization not found. Cannot update company profile.';
      await logActivity("Update Company Profile Failed", errorMessage, profile, { updated_fields: updates, unique_code: uniqueCode }, true);
      showError(errorMessage);
      return;
    }

    const payload: any = {
      name: updates.companyName,
      currency: updates.companyCurrency,
      address: updates.companyAddress,
      company_logo_url: updates.companyLogoUrl,
      plan: updates.plan,
      stripe_customer_id: updates.stripeCustomerId,
      stripe_subscription_id: updates.stripeSubscriptionId,
      trial_ends_at: updates.trialEndsAt,
      default_reorder_level: updates.defaultReorderLevel,
      enable_auto_reorder_notifications: updates.enableAutoReorderNotifications,
      enable_auto_reorder: updates.enableAutoReorder,
    };

    if (uniqueCode !== undefined) {
      payload.unique_code = uniqueCode;
    }

    const oldCompanyLogoUrl = profile.companyProfile?.companyLogoUrl; // Declare here
    if ((updates.companyLogoUrl === undefined || updates.companyLogoUrl === null || updates.companyLogoUrl === "") && oldCompanyLogoUrl) {
        const oldFilePath = getFilePathFromPublicUrl(oldCompanyLogoUrl, 'company-logos');
        if (oldFilePath) {
            const { error: deleteError } = await supabase.storage
                .from('company-logos')
                .remove([oldFilePath]);

            if (deleteError) {
                console.error("[OnboardingContext] Error deleting old company logo from storage:", deleteError);
                showError(`Failed to delete old company logo from storage: ${deleteError.message}`);
                await logActivity("Company Logo Delete Failed", `Failed to delete old company logo for organization ${profile.organizationId}.`, profile, { error_message: deleteError.message, old_logo_url: oldCompanyLogoUrl }, true);
            } else {
                console.log(`[OnboardingContext] Old logo file ${oldFilePath} deleted successfully.`);
                await logActivity("Company Logo Delete Success", `Old company logo deleted for organization ${profile.organizationId}.`, profile, { old_logo_url: oldCompanyLogoUrl });
            }
        }
    }

    const { error } = await supabase
      .from('organizations')
      .update(payload)
      .eq('id', profile.organizationId);

    if (error) {
      console.error('Error updating company profile:', error);
      await logActivity("Update Company Profile Failed", `Failed to update company profile for organization ${profile.organizationId}.`, profile, { error_message: error.message, updated_fields: payload }, true);
      showError(`Failed to update company profile: ${error.message}`);
      throw error;
    } else {
      showSuccess('Company profile updated successfully!');
      await logActivity("Update Company Profile Success", `Company profile for organization ${profile.organizationId} updated.`, profile, { updated_fields: payload });
      await fetchProfile();
    }
  };

  const updateOrganizationTheme = async (newTheme: string) => {
    if (!profile || profile.role !== 'admin' || !profile.organizationId) {
      const errorMessage = 'You do not have permission to update the organization theme.';
      await logActivity("Update Organization Theme Failed", errorMessage, profile, { new_theme: newTheme }, true);
      showError(errorMessage);
      return;
    }

    const { error } = await supabase
      .from('organizations')
      .update({ default_theme: newTheme })
      .eq('id', profile.organizationId);

    if (error) {
      console.error('Error updating organization theme:', error);
      await logActivity("Update Organization Theme Failed", `Failed to update organization theme for organization ${profile.organizationId}.`, profile, { error_message: error.message, new_theme: newTheme }, true);
      showError(`Failed to update theme: ${error.message}`);
      throw error;
    } else {
      showSuccess('Organization theme updated successfully!');
      await logActivity("Update Organization Theme Success", `Organization theme updated to ${newTheme} for organization ${profile.organizationId}.`, profile, { new_theme: newTheme });
      await fetchProfile();
    }
  };

  const markOnboardingWizardCompleted = async () => {
    if (!profile) {
      console.warn("Cannot mark onboarding wizard as completed: User profile not loaded.");
      return;
    }
    if (profile.hasOnboardingWizardCompleted) {
      console.log("Onboarding wizard already marked as completed for this user.");
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ has_onboarding_wizard_completed: true })
      .eq('id', profile.id);

    if (error) {
      console.error("Error marking onboarding wizard as completed:", error);
      await logActivity("Mark Onboarding Wizard Completed Failed", `Failed to mark onboarding wizard as completed for user ${profile.id}.`, profile, { error_message: error.message }, true);
    } else {
      console.log("Onboarding wizard marked as completed for user:", profile.id);
      await logActivity("Mark Onboarding Wizard Completed Success", `Onboarding wizard marked as completed for user ${profile.id}.`, profile);
      // Optimistically update local state
      setProfile(prev => prev ? { ...prev, hasOnboardingWizardCompleted: true } : null);
    }
  };

  const markTutorialAsShown = async () => {
    if (!profile) {
      console.warn("Cannot mark UI tutorial as shown: User profile not loaded.");
      return;
    }
    if (profile.hasUiTutorialShown) {
      console.log("UI tutorial already marked as shown for this user.");
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ has_ui_tutorial_shown: true })
      .eq('id', profile.id);

    if (error) {
      console.error("Error marking UI tutorial as shown:", error);
      await logActivity("Mark UI Tutorial Shown Failed", `Failed to mark UI tutorial as shown for user ${profile.id}.`, profile, { error_message: error.message }, true);
    } else {
      console.log("UI tutorial marked as shown for user:", profile.id);
      await logActivity("Mark UI Tutorial Shown Success", `UI tutorial marked as shown for user ${profile.id}.`, profile);
      // Optimistically update local state
      setProfile(prev => prev ? { ...prev, hasUiTutorialShown: true } : null);
    }
  };

  return (
    <ProfileContext.Provider
      value={{
        profile,
        allProfiles,
        isLoadingProfile,
        isLoadingAllProfiles,
        fetchProfile,
        fetchAllProfiles,
        updateProfile,
        updateUserRole,
        updateCompanyProfile,
        updateOrganizationTheme,
        markOnboardingWizardCompleted,
        markTutorialAsShown,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};