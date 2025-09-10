import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { showError, showSuccess } from '@/utils/toast';
import { isValid } from 'date-fns';

export interface CompanyProfile {
  id: string;
  organizationId: string;
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
  companyCurrency: string;
  companyLogoUrl?: string;
  organizationTheme: string;
  organizationCode?: string; // Added organizationCode to CompanyProfile
  createdAt: string;
}

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  address?: string;
  avatarUrl?: string;
  role: 'admin' | 'inventory_manager' | 'viewer';
  organizationId?: string;
  createdAt: string;
  quickbooksAccessToken?: string;
  quickbooksRefreshToken?: string;
  quickbooksRealmId?: string;
  shopifyAccessToken?: string;
  shopifyStoreName?: string;
  companyProfile?: CompanyProfile; // Added nested CompanyProfile for easier access
}

interface ProfileContextType {
  profile: UserProfile | null;
  isLoadingProfile: boolean;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  updateCompanyProfile: (updates: Partial<CompanyProfile>, uniqueCode?: string) => Promise<void>;
  updateOrganizationTheme: (newTheme: string) => Promise<void>;
  updateUserRole: (targetUserId: string, newRole: string, organizationId: string) => Promise<void>; // Added updateUserRole
  fetchProfile: () => Promise<void>;
  allProfiles: UserProfile[];
  fetchAllProfiles: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, session } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>([]);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setIsLoadingProfile(false);
      return;
    }

    setIsLoadingProfile(true);
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) {
        if (profileError.code === 'PGRST116') {
          console.warn("Profile not found for user, likely new user.");
          setProfile(null);
        } else {
          throw profileError;
        }
      } else if (profileData) {
        let mappedProfile: UserProfile = {
          id: profileData.id,
          fullName: profileData.full_name,
          email: user.email || '',
          phone: profileData.phone,
          address: profileData.address,
          avatarUrl: profileData.avatar_url,
          role: profileData.role,
          organizationId: profileData.organization_id || undefined,
          createdAt: profileData.created_at,
          quickbooksAccessToken: profileData.quickbooks_access_token,
          quickbooksRefreshToken: profileData.quickbooks_refresh_token,
          quickbooksRealmId: profileData.quickbooks_realm_id,
        };

        if (profileData.organization_id) {
          const { data: organizationData, error: organizationError } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', profileData.organization_id)
            .single();

          if (organizationError) {
            throw organizationError;
          }

          if (organizationData) {
            const mappedCompanyProfile: CompanyProfile = {
              id: organizationData.id,
              organizationId: organizationData.id,
              companyName: organizationData.name,
              companyAddress: organizationData.address || undefined,
              companyPhone: organizationData.phone || undefined,
              companyEmail: organizationData.email || undefined,
              companyWebsite: organizationData.website || undefined,
              companyCurrency: organizationData.currency,
              companyLogoUrl: organizationData.company_logo_url || undefined,
              organizationTheme: organizationData.default_theme || 'dark',
              organizationCode: organizationData.unique_code || undefined,
              createdAt: organizationData.created_at,
            };
            mappedProfile.companyProfile = mappedCompanyProfile;
            mappedProfile.shopifyAccessToken = organizationData.shopify_access_token || undefined;
            mappedProfile.shopifyStoreName = organizationData.shopify_store_name || undefined;
          }
        }
        setProfile(mappedProfile);
      }
    } catch (error: any) {
      console.error("Error fetching profile or company profile:", error);
      showError("Failed to load user or company profile: " + error.message);
      setProfile(null);
    } finally {
      setIsLoadingProfile(false);
    }
  }, [user]);

  const fetchAllProfiles = useCallback(async () => {
    if (!profile?.organizationId) {
      setAllProfiles([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('organization_id', profile.organizationId);

      if (error) {
        throw error;
      }

      const mappedProfiles: UserProfile[] = data.map((p: any) => ({
        id: p.id,
        fullName: p.full_name,
        email: p.email,
        phone: p.phone,
        address: p.address,
        avatarUrl: p.avatar_url,
        role: p.role,
        organizationId: p.organization_id || undefined,
        createdAt: p.created_at,
        quickbooksAccessToken: p.quickbooks_access_token,
        quickbooksRefreshToken: p.quickbooks_refresh_token,
        quickbooksRealmId: p.quickbooks_realm_id,
      }));
      setAllProfiles(mappedProfiles);
    } catch (error: any) {
      console.error("Error fetching all profiles:", error);
      showError("Failed to load all user profiles: " + error.message);
      setAllProfiles([]);
    }
  }, [profile?.organizationId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile, user]);

  useEffect(() => {
    if (profile?.organizationId) {
      fetchAllProfiles();
    }
  }, [profile?.organizationId, fetchAllProfiles]);

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!profile) {
      showError("No profile to update.");
      return;
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          full_name: updates.fullName,
          phone: updates.phone,
          address: updates.address,
          avatar_url: updates.avatarUrl,
          role: updates.role,
          quickbooks_access_token: updates.quickbooksAccessToken,
          quickbooks_refresh_token: updates.quickbooksRefreshToken,
          quickbooks_realm_id: updates.quickbooksRealmId,
        })
        .eq('id', profile.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        setProfile(prev => prev ? {
          ...prev,
          fullName: data.full_name,
          phone: data.phone,
          address: data.address,
          avatarUrl: data.avatar_url,
          role: data.role,
          quickbooksAccessToken: data.quickbooks_access_token,
          quickbooksRefreshToken: data.quickbooks_refresh_token,
          quickbooksRealmId: data.quickbooks_realm_id,
        } : null);
        showSuccess("Profile updated successfully!");
      }
    } catch (error: any) {
      console.error("Error updating profile:", error);
      showError("Failed to update profile: " + error.message);
    }
  };

  const updateCompanyProfile = async (updates: Partial<CompanyProfile>, uniqueCode?: string) => {
    if (!profile?.organizationId) {
      showError("No organization found to update company profile.");
      return;
    }
    try {
      const { data, error } = await supabase
        .from('organizations')
        .update({
          name: updates.companyName,
          address: updates.companyAddress,
          phone: updates.companyPhone,
          email: updates.companyEmail,
          website: updates.companyWebsite,
          currency: updates.companyCurrency,
          company_logo_url: updates.companyLogoUrl,
          default_theme: updates.organizationTheme,
          unique_code: uniqueCode,
        })
        .eq('id', profile.organizationId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        setProfile(prev => prev ? {
          ...prev,
          companyProfile: {
            ...prev.companyProfile,
            id: data.id,
            organizationId: data.id,
            companyName: data.name,
            companyAddress: data.address || undefined,
            companyPhone: data.phone || undefined,
            companyEmail: data.email || undefined,
            companyWebsite: data.website || undefined,
            companyCurrency: data.currency,
            companyLogoUrl: data.company_logo_url || undefined,
            organizationTheme: data.default_theme || 'dark',
            organizationCode: data.unique_code || undefined,
            createdAt: data.created_at,
          }
        } : null);
        showSuccess("Company profile updated successfully!");
      }
    } catch (error: any) {
      console.error("Error updating company profile:", error);
      showError("Failed to update company profile: " + error.message);
    }
  };

  const updateOrganizationTheme = async (newTheme: string) => {
    if (!profile?.organizationId) {
      showError("No organization found to update theme.");
      return;
    }
    try {
      const { data, error } = await supabase
        .from('organizations')
        .update({ default_theme: newTheme })
        .eq('id', profile.organizationId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        setProfile(prev => prev ? {
          ...prev,
          companyProfile: prev.companyProfile ? { ...prev.companyProfile, organizationTheme: data.default_theme } : undefined
        } : null);
        showSuccess("Organization theme updated successfully!");
      }
    } catch (error: any) {
      console.error("Error updating organization theme:", error);
      showError("Failed to update organization theme: " + error.message);
    }
  };

  const updateUserRole = async (targetUserId: string, newRole: string, organizationId: string) => {
    if (!profile?.id || profile.role !== 'admin') {
      showError("Only administrators can update user roles.");
      return;
    }

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        throw new Error("User session not found. Please log in again.");
      }

      const { data, error } = await supabase.functions.invoke('update-user-profile', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({ targetUserId, newRole, organizationId }),
      });

      if (error) {
        throw error;
      }
      if (data.error) {
        throw new Error(data.error);
      }

      showSuccess(`User role updated to ${newRole} successfully!`);
      fetchAllProfiles(); // Refresh the list of all profiles
    } catch (error: any) {
      console.error("Error updating user role:", error);
      showError(`Failed to update user role: ${error.message}`);
    }
  };

  return (
    <ProfileContext.Provider
      value={{
        profile,
        isLoadingProfile,
        updateProfile,
        updateCompanyProfile,
        updateOrganizationTheme,
        updateUserRole,
        fetchProfile,
        allProfiles,
        fetchAllProfiles,
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