import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { showError, showSuccess } from '@/utils/toast';
import { logActivity } from '@/utils/logActivity'; // NEW: Import logActivity
import { getFilePathFromPublicUrl } from '@/integrations/supabase/storage'; // NEW: Import getFilePathFromPublicUrl

export interface CompanyProfile {
  companyName: string;
  companyCurrency: string;
  companyAddress: string;
  companyLogoUrl?: string;
  organizationCode?: string;
  organizationTheme?: string;
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
  companyProfile?: CompanyProfile;
}

interface ProfileContextType {
  profile: UserProfile | null;
  allProfiles: UserProfile[];
  isLoadingProfile: boolean;
  fetchProfile: () => Promise<void>;
  fetchAllProfiles: () => Promise<void>;
  updateProfile: (updates: Partial<Omit<UserProfile, 'id' | 'email' | 'role' | 'organizationId' | 'createdAt' | 'quickbooksAccessToken' | 'quickbooksRefreshToken' | 'quickbooksRealmId' | 'shopifyAccessToken' | 'shopifyRefreshToken' | 'shopifyStoreName'>>) => Promise<void>;
  updateUserRole: (userId: string, newRole: string, organizationId: string) => Promise<void>;
  updateCompanyProfile: (updates: Partial<CompanyProfile>, uniqueCode?: string) => Promise<void>;
  updateOrganizationTheme: (newTheme: string) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading: isLoadingAuth } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>([]);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  const mapSupabaseProfileToUserProfile = (data: any, companyData: any | null): UserProfile => {
    const companyProfile: CompanyProfile | undefined = companyData ? {
      companyName: companyData.name,
      companyCurrency: companyData.currency,
      companyAddress: companyData.address,
      companyLogoUrl: companyData.company_logo_url || undefined,
      organizationCode: companyData.unique_code || undefined,
      organizationTheme: companyData.default_theme || undefined,
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
      companyProfile: companyProfile,
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
          shopify_store_name
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
      setProfile(mapSupabaseProfileToUserProfile(data, data.organizations));
    }
    setIsLoadingProfile(false);
  }, [user, profile]); // Added profile to dependency array

  const fetchAllProfiles = useCallback(async () => {
    if (!profile?.organizationId) {
      setAllProfiles([]);
      return;
    }

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
      const mappedProfiles: UserProfile[] = data.map(p => mapSupabaseProfileToUserProfile(p, null));
      setAllProfiles(mappedProfiles);
    }
  }, [profile?.organizationId, profile]); // Added profile to dependency array

  useEffect(() => {
    if (!isLoadingAuth) {
      fetchProfile();
    }
  }, [isLoadingAuth, fetchProfile]);

  const updateProfile = async (updates: Partial<Omit<UserProfile, 'id' | 'email' | 'role' | 'organizationId' | 'createdAt' | 'quickbooksAccessToken' | 'quickbooksRefreshToken' | 'quickbooksRealmId' | 'shopifyAccessToken' | 'shopifyRefreshToken' | 'shopifyStoreName'>>) => {
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
    };

    if (uniqueCode !== undefined) {
      payload.unique_code = uniqueCode;
    }

    // Handle logo deletion if companyLogoUrl is explicitly set to null/undefined/empty
    if ((updates.companyLogoUrl === undefined || updates.companyLogoUrl === null || updates.companyLogoUrl === "") && profile.companyProfile?.companyLogoUrl) {
      const oldFilePath = getFilePathFromPublicUrl(profile.companyProfile.companyLogoUrl, 'company-logos');
      if (oldFilePath) {
        const { error: deleteError } = await supabase.storage.from('company-logos').remove([oldFilePath]);
        if (deleteError) {
          console.warn("Failed to delete old company logo from storage:", deleteError);
          await logActivity("Company Logo Delete Failed", `Failed to delete old company logo for organization ${profile.organizationId}.`, profile, { error_message: deleteError.message, old_logo_url: profile.companyProfile.companyLogoUrl }, true);
        } else {
          await logActivity("Company Logo Delete Success", `Old company logo deleted for organization ${profile.organizationId}.`, profile, { old_logo_url: profile.companyProfile.companyLogoUrl });
        }
      }
    }

    const { error } = await supabase
      .from('organizations')
      .update(payload)
      .eq('id', profile.organizationId);

    if (error) {
      console.error('Error updating company profile:', error);
      await logActivity("Update Company Profile Failed", `Failed to update company profile for organization ${profile.organizationId}.`, profile, { error_message: error.message, updated_fields: updates, unique_code: uniqueCode }, true);
      showError(`Failed to update company profile: ${error.message}`);
      throw error;
    } else {
      showSuccess('Company profile updated successfully!');
      await logActivity("Update Company Profile Success", `Company profile for organization ${profile.organizationId} updated.`, profile, { updated_fields: updates, unique_code: uniqueCode });
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

  return (
    <ProfileContext.Provider
      value={{
        profile,
        allProfiles,
        isLoadingProfile,
        fetchProfile,
        fetchAllProfiles,
        updateProfile,
        updateUserRole,
        updateCompanyProfile,
        updateOrganizationTheme,
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