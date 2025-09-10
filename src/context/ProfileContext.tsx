import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { showError, showSuccess } from '@/utils/toast';
import { isValid } from 'date-fns'; // Keep isValid as it's used in other contexts

export interface CompanyProfile {
  id: string;
  organizationId: string;
  companyName: string;
  companyAddress?: string; // Made optional
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
  companyCurrency: string;
  companyLogoUrl?: string;
  organizationTheme: string;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  address?: string;
  avatarUrl?: string;
  role: 'admin' | 'manager' | 'staff';
  organizationId: string;
  createdAt: string;
  quickbooksAccessToken?: string;
  quickbooksRefreshToken?: string;
  quickbooksRealmId?: string;
}

interface ProfileContextType {
  profile: UserProfile | null;
  companyProfile: CompanyProfile | null;
  isLoadingProfile: boolean;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  updateCompanyProfile: (updates: Partial<CompanyProfile>) => Promise<void>;
  fetchProfile: () => Promise<void>;
  allProfiles: UserProfile[];
  fetchAllProfiles: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, session } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>([]);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setCompanyProfile(null);
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
        if (profileError.code === 'PGRST116') { // No rows found
          console.warn("Profile not found for user, likely new user. Will create default profile.");
          // This case is now handled by the auth.onAuthStateChange listener in AuthContext
          // which triggers the onboarding flow.
          setProfile(null);
          setCompanyProfile(null);
        } else {
          throw profileError;
        }
      } else if (profileData) {
        const mappedProfile: UserProfile = {
          id: profileData.id,
          fullName: profileData.full_name,
          email: user.email || '',
          phone: profileData.phone,
          address: profileData.address,
          avatarUrl: profileData.avatar_url,
          role: profileData.role,
          organizationId: profileData.organization_id,
          createdAt: profileData.created_at,
          quickbooksAccessToken: profileData.quickbooks_access_token,
          quickbooksRefreshToken: profileData.quickbooks_refresh_token,
          quickbooksRealmId: profileData.quickbooks_realm_id,
        };
        setProfile(mappedProfile);

        if (profileData.organization_id) {
          const { data: companyData, error: companyError } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', profileData.organization_id)
            .single();

          if (companyError) {
            throw companyError;
          }

          if (companyData) {
            const mappedCompanyProfile: CompanyProfile = {
              id: companyData.id,
              organizationId: companyData.id,
              companyName: companyData.company_name,
              companyAddress: companyData.company_address,
              companyPhone: companyData.company_phone,
              companyEmail: companyData.company_email,
              companyWebsite: companyData.company_website,
              companyCurrency: companyData.company_currency,
              companyLogoUrl: companyData.company_logo_url,
              organizationTheme: companyData.organization_theme,
              createdAt: companyData.created_at,
            };
            setCompanyProfile(mappedCompanyProfile);
          }
        } else {
          setCompanyProfile(null);
        }
      }
    } catch (error: any) {
      console.error("Error fetching profile or company profile:", error);
      showError("Failed to load user or company profile: " + error.message);
      setProfile(null);
      setCompanyProfile(null);
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
        organizationId: p.organization_id,
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
  }, [fetchProfile, user]); // Re-fetch profile if user changes

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
        const updatedMappedProfile: UserProfile = {
          id: data.id,
          fullName: data.full_name,
          email: user?.email || '',
          phone: data.phone,
          address: data.address,
          avatarUrl: data.avatar_url,
          role: data.role,
          organizationId: data.organization_id,
          createdAt: data.created_at,
          quickbooksAccessToken: data.quickbooks_access_token,
          quickbooksRefreshToken: data.quickbooks_refresh_token,
          quickbooksRealmId: data.quickbooks_realm_id,
        };
        setProfile(updatedMappedProfile);
        showSuccess("Profile updated successfully!");
      }
    } catch (error: any) {
      console.error("Error updating profile:", error);
      showError("Failed to update profile: " + error.message);
    }
  };

  const updateCompanyProfile = async (updates: Partial<CompanyProfile>) => {
    if (!companyProfile?.id) {
      showError("No company profile to update.");
      return;
    }
    try {
      const { data, error } = await supabase
        .from('organizations')
        .update({
          company_name: updates.companyName,
          company_address: updates.companyAddress,
          company_phone: updates.companyPhone,
          company_email: updates.companyEmail,
          company_website: updates.companyWebsite,
          company_currency: updates.companyCurrency,
          company_logo_url: updates.companyLogoUrl,
          organization_theme: updates.organizationTheme,
        })
        .eq('id', companyProfile.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        const updatedMappedCompanyProfile: CompanyProfile = {
          id: data.id,
          organizationId: data.id,
          companyName: data.company_name,
          companyAddress: data.company_address,
          companyPhone: data.company_phone,
          companyEmail: data.company_email,
          companyWebsite: data.company_website,
          companyCurrency: data.company_currency,
          companyLogoUrl: data.company_logo_url,
          organizationTheme: data.organization_theme,
          createdAt: data.created_at,
        };
        setCompanyProfile(updatedMappedCompanyProfile);
        showSuccess("Company profile updated successfully!");
      }
    } catch (error: any) {
      console.error("Error updating company profile:", error);
      showError("Failed to update company profile: " + error.message);
    }
  };

  return (
    <ProfileContext.Provider
      value={{
        profile,
        companyProfile,
        isLoadingProfile,
        updateProfile,
        updateCompanyProfile,
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