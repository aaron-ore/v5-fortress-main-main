import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { showError, showSuccess } from '@/utils/toast';

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
  companyProfile?: CompanyProfile; // Nested company profile
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
      setProfile(null);
    } else if (data) {
      setProfile(mapSupabaseProfileToUserProfile(data, data.organizations));
    }
    setIsLoadingProfile(false);
  }, [user]);

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
      setAllProfiles([]);
    } else {
      const mappedProfiles: UserProfile[] = data.map(p => mapSupabaseProfileToUserProfile(p, null)); // Pass null for companyData as it's not needed for other users' profiles
      setAllProfiles(mappedProfiles);
    }
  }, [profile?.organizationId]);

  useEffect(() => {
    if (!isLoadingAuth) {
      fetchProfile();
    }
  }, [isLoadingAuth, fetchProfile]);

  const updateProfile = async (updates: Partial<Omit<UserProfile, 'id' | 'email' | 'role' | 'organizationId' | 'createdAt' | 'quickbooksAccessToken' | 'quickbooksRefreshToken' | 'quickbooksRealmId' | 'shopifyAccessToken' | 'shopifyRefreshToken' | 'shopifyStoreName'>>) => {
    if (!profile) {
      showError('User profile not loaded.');
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
      showError(`Failed to update profile: ${error.message}`);
      throw error;
    } else {
      showSuccess('Profile updated successfully!');
      await fetchProfile(); // Re-fetch to get the latest data
    }
  };

  const updateUserRole = async (userId: string, newRole: string, organizationId: string) => {
    if (!profile || profile.role !== 'admin' || profile.organizationId !== organizationId) {
      showError('You do not have permission to update user roles in this organization.');
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
      await fetchAllProfiles(); // Refresh all profiles to show updated role
    } catch (error: any) {
      console.error('Error updating user role:', error);
      showError(`Failed to update user role: ${error.message}`);
      throw error;
    }
  };

  const updateCompanyProfile = async (updates: Partial<CompanyProfile>, uniqueCode?: string) => {
    if (!profile || !profile.organizationId) {
      showError('Organization not found. Cannot update company profile.');
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

    const { error } = await supabase
      .from('organizations')
      .update(payload)
      .eq('id', profile.organizationId);

    if (error) {
      console.error('Error updating company profile:', error);
      showError(`Failed to update company profile: ${error.message}`);
      throw error;
    } else {
      showSuccess('Company profile updated successfully!');
      await fetchProfile(); // Re-fetch to get the latest data
    }
  };

  const updateOrganizationTheme = async (newTheme: string) => {
    if (!profile || profile.role !== 'admin' || !profile.organizationId) {
      showError('You do not have permission to update the organization theme.');
      return;
    }

    const { error } = await supabase
      .from('organizations')
      .update({ default_theme: newTheme })
      .eq('id', profile.organizationId);

    if (error) {
      console.error('Error updating organization theme:', error);
      showError(`Failed to update theme: ${error.message}`);
      throw error;
    } else {
      showSuccess('Organization theme updated successfully!');
      await fetchProfile(); // Re-fetch to update local state and trigger ThemeInitializer
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