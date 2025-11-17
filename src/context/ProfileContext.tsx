"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, startTransition } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { showError, showSuccess } from '@/utils/toast';
import { logActivity } from '@/utils/logActivity';
import { getPublicUrlFromSupabase } from '@/integrations/supabase/storage';
import { deepEqual } from '@/lib/utils';
import { useAuth } from './AuthContext';


export interface CompanyProfile {
  companyName: string;
  companyCurrency: string;
  companyAddress: string;
  companyLogoUrl?: string; // This will now be a PUBLIC URL for UI consumption
  organizationCode?: string;
  organizationTheme?: string;
  plan?: string;
  dodoCustomerId?: string; // NEW: Dodo Customer ID
  dodoSubscriptionId?: string; // NEW: Dodo Subscription ID
  trialEndsAt?: string; // NEW: Trial end date
  defaultReorderLevel?: number;
  enableAutoReorderNotifications?: boolean;
  enableAutoReorder?: boolean; // Corrected typo here
  shopifyAccessToken?: string; // NEW: Shopify Access Token
  shopifyRefreshToken?: string; // NEW: Shopify Refresh Token
  shopifyStoreName?: string; // NEW: Shopify Store Name
  perpetualFeatures?: string[]; // NEW: List of feature IDs for perpetual license
  perpetualLicenseVersion?: string; // NEW: Version at time of perpetual license purchase
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
  companyProfile?: CompanyProfile;
  hasOnboardingWizardCompleted: boolean;
  hasSeenUpgradePrompt: boolean;
}

interface ProfileContextType {
  profile: UserProfile | null;
  allProfiles: UserProfile[];
  isLoadingProfile: boolean;
  isLoadingAllProfiles: boolean;
  fetchProfile: () => Promise<void>;
  fetchAllProfiles: () => Promise<void>;
  updateProfile: (updates: Partial<Omit<UserProfile, 'id' | 'email' | 'role' | 'organizationId' | 'createdAt' | 'quickbooksAccessToken' | 'quickbooksRefreshToken' | 'quickbooksRealmId' | 'hasOnboardingWizardCompleted' | 'hasSeenUpgradePrompt'>>) => Promise<void>;
  updateUserRole: (userId: string, newRole: string, organizationId: string) => Promise<void>;
  updateCompanyProfile: (updates: Partial<CompanyProfile>, uniqueCode?: string) => Promise<void>;
  updateOrganizationTheme: (newTheme: string) => Promise<void>;
  markOnboardingWizardCompleted: () => Promise<void>;
  markUpgradePromptSeen: () => Promise<void>;
  updateProfileLocally: (updates: Partial<UserProfile>) => void;
  transferAdminRole: (newAdminUserId: string) => Promise<void>; // NEW: Added transferAdminRole
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading: isLoadingAuth } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>([]
);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingAllProfiles, setIsLoadingAllProfiles] = useState(true);

  const mapSupabaseProfileToUserProfile = (data: any, companyData: any | null): UserProfile => {
    console.log(`[ProfileContext] mapSupabaseProfileToUserProfile: Processing user ID: ${data.id}, Raw company_logo_url from DB: "${companyData?.company_logo_url}" (Type: ${typeof companyData?.company_logo_url})`);

    // NEW: Check if company_logo_url is already a public URL before converting
    const finalCompanyLogoUrl = companyData?.company_logo_url
      ? (companyData.company_logo_url.startsWith('http') ? companyData.company_logo_url : getPublicUrlFromSupabase(companyData.company_logo_url, 'company-logos'))
      : undefined;
    
    console.log(`[ProfileContext] mapSupabaseProfileToUserProfile: Final companyLogoUrl for context: "${finalCompanyLogoUrl}" (Type: ${typeof finalCompanyLogoUrl})`);

    const companyProfile: CompanyProfile | undefined = companyData ? {
      companyName: companyData.name,
      companyCurrency: companyData.currency,
      companyAddress: companyData.address,
      companyLogoUrl: finalCompanyLogoUrl, // Use the intelligently determined URL
      organizationCode: companyData.unique_code || undefined,
      organizationTheme: companyData.default_theme || undefined,
      plan: companyData.plan || undefined,
      dodoCustomerId: companyData.dodo_customer_id || undefined, // NEW: Map Dodo Customer ID
      dodoSubscriptionId: companyData.dodo_subscription_id || undefined, // NEW: Map Dodo Subscription ID
      trialEndsAt: companyData.trial_ends_at ? new Date(companyData.trial_ends_at).toISOString() : undefined, // NEW: Map trial end date
      defaultReorderLevel: companyData.default_reorder_level || 0,
      enableAutoReorderNotifications: companyData.enable_auto_reorder_notifications || false,
      enableAutoReorder: companyData.enable_auto_reorder || false, // Corrected typo here
      shopifyAccessToken: companyData.shopify_access_token || undefined, // NEW: Map Shopify Access Token
      shopifyRefreshToken: companyData.shopify_refresh_token || undefined, // NEW: Map Shopify Refresh Token
      shopifyStoreName: companyData.shopify_store_name || undefined, // NEW: Map Shopify Store Name
      perpetualFeatures: companyData.perpetual_features || undefined, // NEW: Map perpetual features
      perpetualLicenseVersion: companyData.perpetual_license_version || undefined, // NEW: Map perpetual license version
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
      companyProfile: companyProfile,
      hasOnboardingWizardCompleted: data.has_onboarding_wizard_completed ?? false,
      hasSeenUpgradePrompt: data.has_seen_upgrade_prompt ?? false,
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
      .select('*, organizations(name,currency,address,unique_code,default_theme,company_logo_url,shopify_access_token,shopify_refresh_token,shopify_store_name,plan,dodo_customer_id,dodo_subscription_id,trial_ends_at,default_reorder_level,enable_auto_reorder_notifications,enable_auto_reorder,perpetual_features,perpetual_license_version)') // NEW: Added dodo_customer_id, dodo_subscription_id, trial_ends_at
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      // NEW: Check for 401 Unauthorized error and force sign out
      if ((error as any).status === 401) { // Cast to any to access status
        console.warn('Profile fetch failed with 401 Unauthorized. Attempting to sign out to clear stale session.');
        await supabase.auth.signOut(); // Force sign out
        showError('Session expired. Please log in again.');
      } else {
        showError('Failed to load profile.');
      }
      await logActivity("Profile Fetch Failed", `Failed to load user profile for user ${user.id}.`, profile, { error_message: error.message, error_status: (error as any).status }, true); // Cast to any
      setProfile(null);
    } else if (data) {
      const newProfileData = mapSupabaseProfileToUserProfile(data, data.organizations);
      startTransition(() => { // Wrap the state update in startTransition
        setProfile(prevProfile => {
          if (deepEqual(prevProfile, newProfileData)) {
            return prevProfile;
          }
          return newProfileData;
        });
      });
    }
    setIsLoadingProfile(false);
  }, [user, isLoadingAuth]);

  const fetchAllProfiles = useCallback(async () => {
    if (!profile?.organizationId) {
      setAllProfiles([]);
      setIsLoadingAllProfiles(false);
      return;
    }

    setIsLoadingAllProfiles(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url, role, organization_id, phone, address, created_at, quickbooks_access_token, quickbooks_refresh_token, quickbooks_realm_id, has_onboarding_wizard_completed, has_seen_upgrade_prompt')
      .eq('organization_id', profile.organizationId)
      .order('full_name', { ascending: true });

    if (error) {
      console.error('Error fetching all profiles:', error);
      showError('Failed to load all profiles.');
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

  const updateProfileLocally = useCallback((updates: Partial<UserProfile>) => {
    setProfile(prev => {
      if (!prev) return null;
      const newProfile = { ...prev, ...updates };
      // Deep compare to prevent unnecessary re-renders if the content is effectively the same
      if (deepEqual(prev, newProfile)) {
        return prev;
      }
      return newProfile;
    });
  }, []);

  const updateProfile = async (updates: Partial<Omit<UserProfile, 'id' | 'email' | 'role' | 'organizationId' | 'createdAt' | 'quickbooksAccessToken' | 'quickbooksRefreshToken' | 'quickbooksRealmId' | 'hasOnboardingWizardCompleted' | 'hasSeenUpgradePrompt'>>) => {
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
      showSuccess('Profile updated!');
      await logActivity("Update User Profile Success", `User profile for ${profile.email} updated.`, profile, { updated_fields: updates });
      await fetchProfile();
    }
  };

  const updateUserRole = async (userId: string, newRole: string, organizationId: string) => {
    if (!profile || profile.role !== 'admin' || profile.organizationId !== organizationId) {
      const errorMessage = 'You do not have permission to update roles.';
      await logActivity("Update User Role Failed", errorMessage, profile, { target_user_id: userId, new_role: newRole, organization_id: organizationId }, true);
      showError(errorMessage);
      return;
    }

    // Prevent an admin from demoting themselves if they are the only admin
    if (userId === profile.id && newRole !== 'admin') {
      const otherAdminsCount = allProfiles.filter(u => u.role === 'admin' && u.id !== profile.id).length;
      if (otherAdminsCount === 0) {
        showError("You are the only administrator. Please transfer your role to another user before changing your own role.");
        return;
      }
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

      showSuccess(`Role updated to ${newRole} for ${userId}.`);
      await logActivity("Update User Role Success", `User ${userId} role updated to ${newRole}.`, profile, { target_user_id: userId, new_role: newRole, organization_id: organizationId });
      await fetchAllProfiles();
    } catch (error: any) {
      console.error('Error updating user role:', error);
      await logActivity("Update User Role Failed", `Failed to update user role: ${error.message}.`, profile, { error_message: error.message, target_user_id: userId, new_role: newRole, organization_id: organizationId }, true);
      showError(`Failed to update user role: ${error.message}`);
      throw error;
    }
  };

  const updateCompanyProfile = async (updates: Partial<CompanyProfile>, uniqueCode?: string) => {
    console.log("[ProfileContext] updateCompanyProfile called with updates:", updates, "uniqueCode:", uniqueCode);
    if (!profile || !profile.organizationId) {
      const errorMessage = 'Organization not found. Cannot update profile.';
      await logActivity("Update Company Profile Failed", errorMessage, profile, { updated_fields: updates, unique_code: uniqueCode }, true);
      showError(errorMessage);
      return;
    }

    // updates.companyLogoUrl is expected to be the INTERNAL PATH or null
    const companyLogoUrlForDb = updates.companyLogoUrl === null ? null : updates.companyLogoUrl;
    console.log("[ProfileContext] updateCompanyProfile: Final companyLogoUrlForDb before DB update (internal path):", companyLogoUrlForDb);

    const payload: any = {
      name: updates.companyName,
      currency: updates.companyCurrency,
      address: updates.companyAddress,
      company_logo_url: companyLogoUrlForDb, // Store internal path or null
      plan: updates.plan,
      dodo_customer_id: updates.dodoCustomerId, // NEW: Update Dodo Customer ID
      dodo_subscription_id: updates.dodoSubscriptionId, // NEW: Update Dodo Subscription ID
      trial_ends_at: updates.trialEndsAt, // NEW: Update trial end date
      default_reorder_level: updates.defaultReorderLevel,
      enable_auto_reorder_notifications: updates.enableAutoReorderNotifications,
      enable_auto_reorder: updates.enableAutoReorder, // Corrected typo here
      shopify_access_token: updates.shopifyAccessToken, // NEW: Update Shopify Access Token
      shopify_refresh_token: updates.shopifyRefreshToken, // NEW: Update Shopify Refresh Token
      shopify_store_name: updates.shopifyStoreName, // NEW: Update Shopify Store Name
      perpetual_features: updates.perpetualFeatures, // NEW: Update perpetual features
      perpetual_license_version: updates.perpetualLicenseVersion, // NEW: Update perpetual license version
    };

    if (uniqueCode !== undefined) {
      payload.unique_code = uniqueCode;
    }

    const { error } = await supabase
      .from('organizations')
      .update(payload)
      .eq('id', profile.organizationId);

    if (error) {
      console.error('Error updating company profile:', error);
      await logActivity("Update Company Profile Failed", `Failed to update company profile for organization ${profile.organizationId}.`, profile, { error_message: error.message, updated_fields: payload }, true);
      showError(`Failed to update profile: ${error.message}`);
      throw error;
    } else {
      showSuccess('Company profile updated!');
      await logActivity("Update Company Profile Success", `Company profile for organization ${profile.organizationId} updated.`, profile, { updated_fields: payload });
      await fetchProfile();
    }
  };

  const updateOrganizationTheme = async (newTheme: string) => {
    if (!profile || profile.role !== 'admin' || !profile.organizationId) {
      const errorMessage = 'You do not have permission to update theme.';
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
      showSuccess('Organization theme updated!');
      await logActivity("Update Organization Theme Success", `Organization theme updated to ${newTheme} for organization ${profile.organizationId}.`, profile, { new_theme: newTheme });
      await fetchProfile();
    }
  };

  const markOnboardingWizardCompleted = async () => {
    if (!profile) {
      console.warn("[ProfileContext] Cannot mark onboarding wizard as completed: User profile not loaded.");
      return;
    }
    if (profile.hasOnboardingWizardCompleted) {
      console.log("[ProfileContext] Onboarding wizard already marked as completed for this user.");
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ has_onboarding_wizard_completed: true })
      .eq('id', profile.id);

    if (error) {
      console.error("[ProfileContext] Error marking onboarding wizard as completed:", error);
      await logActivity("Mark Onboarding Wizard Completed Failed", `Failed to mark onboarding wizard as completed for user ${profile.id}.`, profile, { error_message: error.message }, true);
    } else {
      console.log("[ProfileContext] Onboarding wizard marked as completed for user:", profile.id);
      await logActivity("Mark Onboarding Wizard Completed Success", `Onboarding wizard marked as completed for user ${profile.id}.`, profile);
      setProfile(prev => prev ? { ...prev, hasOnboardingWizardCompleted: true } : null);
    }
  };

  const markUpgradePromptSeen = async () => {
    if (!profile) {
      console.warn("[ProfileContext] Cannot mark upgrade prompt as seen: User profile not loaded.");
      return;
    }
    if (profile.hasSeenUpgradePrompt) {
      console.log("[ProfileContext] Upgrade prompt already marked as seen for this user.");
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ has_seen_upgrade_prompt: true })
      .eq('id', profile.id);

    if (error) {
      console.error("[ProfileContext] Error marking upgrade prompt as seen:", error);
      await logActivity("Mark Upgrade Prompt Seen Failed", `Failed to mark upgrade prompt as seen for user ${profile.id}.`, profile, { error_message: error.message }, true);
    } else {
      console.log("[ProfileContext] Upgrade prompt marked as seen for user:", profile.id);
      await logActivity("Mark Upgrade Prompt Seen Success", `Upgrade prompt marked as seen for user ${profile.id}.`, profile);
      setProfile(prev => prev ? { ...prev, hasSeenUpgradePrompt: true } : null);
    }
  };

  const transferAdminRole = async (newAdminUserId: string) => {
    if (!profile || profile.role !== 'admin' || !profile.organizationId) {
      const errorMessage = 'You do not have permission to transfer admin roles.';
      await logActivity("Transfer Admin Role Failed", errorMessage, profile, { new_admin_user_id: newAdminUserId }, true);
      showError(errorMessage);
      throw new Error(errorMessage);
    }

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        throw new Error("Authentication session expired. Please log in again.");
      }

      const { data, error } = await supabase.functions.invoke('transfer-admin-role', {
        body: JSON.stringify({ newAdminUserId }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      showSuccess(data.message || "Admin role transferred successfully!");
      await logActivity("Transfer Admin Role Success", `Admin role transferred from ${profile.id} to ${newAdminUserId}.`, profile, { new_admin_user_id: newAdminUserId });
      await fetchProfile(); // Fetch current user's updated profile (now non-admin)
      await fetchAllProfiles(); // Refresh all users to show new admin
    } catch (error: any) {
      console.error('Error transferring admin role:', error);
      await logActivity("Transfer Admin Role Failed", `Failed to transfer admin role: ${error.message}.`, profile, { error_message: error.message, new_admin_user_id: newAdminUserId }, true);
      throw error;
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
        markUpgradePromptSeen,
        updateProfileLocally,
        transferAdminRole, // NEW: Provide transferAdminRole
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