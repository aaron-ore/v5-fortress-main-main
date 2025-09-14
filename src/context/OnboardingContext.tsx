import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from "react";
import { showSuccess, showError } from "@/utils/toast";
import { useProfile, CompanyProfile as ProfileCompanyProfile } from "./ProfileContext";
import { supabase } from "@/lib/supabaseClient";
import { generateUniqueCode } from "@/utils/numberGenerator";
import { logActivity } from "@/utils/logActivity"; // NEW: Import logActivity
import { getFilePathFromPublicUrl } from "@/integrations/supabase/storage"; // NEW: Import getFilePathFromPublicUrl

export interface CompanyProfile {
  name: string;
  currency: string;
  address: string;
  companyLogoUrl?: string;
}

export interface Location {
  id: string;
  organizationId: string;
  fullLocationString: string;
  displayName?: string;
  area: string;
  row: string;
  bay: string;
  level: string;
  pos: string;
  color: string;
  createdAt: string;
  userId: string;
}

interface OnboardingContextType {
  isOnboardingComplete: boolean;
  companyProfile: ProfileCompanyProfile | null;
  locations: Location[];
  markOnboardingComplete: () => void;
  setCompanyProfile: (profile: CompanyProfile, uniqueCode?: string) => Promise<void>;
  addLocation: (location: Omit<Location, "id" | "createdAt" | "userId" | "organizationId">) => Promise<Location | null>;
  updateLocation: (location: Omit<Location, "createdAt" | "userId" | "organizationId">) => Promise<void>;
  removeLocation: (locationId: string) => Promise<void>;
  fetchLocations: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export const OnboardingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { profile, isLoadingProfile, fetchProfile } = useProfile();
  const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem("onboarding_skipped") === "true";
    }
    return false;
  });

  // Use companyProfile directly from ProfileContext
  const companyProfile = profile?.companyProfile || null;

  const [locations, setLocations] = useState<Location[]>([]);

  // Effect to check onboarding status
  useEffect(() => {
    if (!isLoadingProfile) {
      // Onboarding is considered complete if a profile exists and has an organization ID
      if (profile?.organizationId) {
        setIsOnboardingComplete(true);
      } else {
        // If no organizationId, check if onboarding was explicitly skipped
        setIsOnboardingComplete(localStorage.getItem("onboarding_skipped") === "true");
      }
    } else if (!isLoadingProfile && !profile) {
      setIsOnboardingComplete(false);
    }
  }, [profile, isLoadingProfile]);

  // Helper function to map Supabase data to Location interface
  const mapSupabaseLocationToLocation = (data: any): Location => ({
    id: data.id,
    organizationId: data.organization_id,
    fullLocationString: data.full_location_string,
    displayName: data.display_name || undefined,
    area: data.area,
    row: data.row,
    bay: data.bay,
    level: data.level,
    pos: data.pos,
    color: data.color,
    createdAt: data.created_at,
    userId: data.user_id,
  });

  // Fetch locations from Supabase
  const fetchLocations = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !profile?.organizationId) {
      setLocations([]);
      return;
    }

    const { data, error } = await supabase
      .from("locations")
      .select("*")
      .eq("organization_id", profile.organizationId)
      .order("full_location_string", { ascending: true });

    if (error) {
      console.error("Error fetching locations:", error);
      showError("Failed to load locations.");
      await logActivity("Location Fetch Failed", `Failed to load locations for organization ${profile.organizationId}.`, profile, { error_message: error.message }, true);
      setLocations([]);
    } else {
      setLocations(data.map(mapSupabaseLocationToLocation));
    }
  }, [profile?.organizationId, profile]); // Added profile to dependency array

  // Effect to fetch locations on profile load or change
  useEffect(() => {
    if (!isLoadingProfile && profile?.organizationId) {
      fetchLocations();
    } else if (!isLoadingProfile && !profile?.organizationId) {
      setLocations([]); // Clear locations if no organization
    }
  }, [isLoadingProfile, profile?.organizationId, fetchLocations]);


  const markOnboardingComplete = async () => {
    setIsOnboardingComplete(true);
    localStorage.setItem("onboarding_skipped", "true"); // Mark as skipped if user completes it
    showSuccess("Onboarding complete! Welcome to Fortress.");
    await logActivity("Onboarding Complete", "User completed the onboarding wizard.", profile);
  };

  const setCompanyProfile = async (profileData: CompanyProfile, newUniqueCode?: string) => {
    console.log("[OnboardingContext] setCompanyProfile called with profileData:", profileData, "newUniqueCode:", newUniqueCode);

    if (!profile) {
      console.warn("[OnboardingContext] Profile is null, cannot save company profile to Supabase.");
      const errorMessage = "User profile not loaded. Please log in again.";
      await logActivity("Set Company Profile Failed", errorMessage, profile, { profile_data: profileData }, true);
      showError(errorMessage);
      return;
    }

    try {
      let organizationIdToUse = profile.organizationId;
      let uniqueCodeToPersist = newUniqueCode;

      if (!profile.organizationId) {
        console.log("[OnboardingContext] User has no organization_id. Creating new organization.");
        if (!uniqueCodeToPersist) {
          uniqueCodeToPersist = generateUniqueCode();
        }
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .insert({ name: profileData.name, address: profileData.address, currency: profileData.currency, unique_code: uniqueCodeToPersist, company_logo_url: profileData.companyLogoUrl })
          .select()
          .single();

        if (orgError) throw orgError;

        organizationIdToUse = orgData.id;
        console.log("[OnboardingContext] New organization created:", orgData);

        const { error: profileUpdateError } = await supabase
          .from('profiles')
          .update({ organization_id: organizationIdToUse, role: 'admin' })
          .eq('id', profile.id);

        if (profileUpdateError) throw profileUpdateError;
        console.log("[OnboardingContext] Profile updated with new organization_id and role.");

        showSuccess(`Organization "${profileData.name}" created and assigned! You are now an admin. Your unique company code is: ${uniqueCodeToPersist}`);
        await logActivity("Organization Created", `New organization "${profileData.name}" created with code: ${uniqueCodeToPersist}.`, profile, { organization_id: organizationIdToUse, organization_name: profileData.name, unique_code: uniqueCodeToPersist });

      } else {
        console.log("[OnboardingContext] User already has organization_id:", profile.organizationId);

        // --- NEW CHECK FOR DUPLICATE ORGANIZATION NAME ---
        const { data: existingOrgWithName, error: checkNameError } = await supabase
          .from('organizations')
          .select('id')
          .eq('name', profileData.name)
          .neq('id', profile.organizationId)
          .single();

        if (checkNameError && checkNameError.code !== 'PGRST116') {
          throw checkNameError;
        }

        if (existingOrgWithName) {
          throw new Error(`An organization with the name "${profileData.name}" already exists. Please choose a different name.`);
        }
        // --- END NEW CHECK ---

        const { data: existingOrg, error: fetchOrgError } = await supabase
          .from('organizations')
          .select('unique_code, company_logo_url, default_theme')
          .eq('id', profile.organizationId)
          .single();

        if (fetchOrgError && fetchOrgError.code !== 'PGRST116') {
          throw fetchOrgError;
        }
        console.log("[OnboardingContext] Existing organization fetched:", existingOrg);

        if (!uniqueCodeToPersist) {
          if (!existingOrg?.unique_code) {
            uniqueCodeToPersist = generateUniqueCode();
            console.log(`[OnboardingContext] Generated missing unique_code: ${uniqueCodeToPersist} for organization ${profile.organizationId}`);
          } else {
            uniqueCodeToPersist = existingOrg.unique_code;
            console.log(`[OnboardingContext] Existing unique_code found: ${uniqueCodeToPersist}`);
          }
        } else {
           console.log(`[OnboardingContext] Using provided newUniqueCode: ${uniqueCodeToPersist}`);
        }

        const oldCompanyLogoUrl = existingOrg?.company_logo_url;
        // If the new logo URL is null/undefined/empty AND an old one existed, delete the old file
        if ((profileData.companyLogoUrl === undefined || profileData.companyLogoUrl === null || profileData.companyLogoUrl === "") && oldCompanyLogoUrl) {
            const oldFilePath = getFilePathFromPublicUrl(oldCompanyLogoUrl, 'company-logos'); // Pass bucket name
            if (oldFilePath) {
                console.log(`[OnboardingContext] Deleting old logo file: ${oldFilePath}`);
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

        const updatePayload = {
          name: profileData.name,
          address: profileData.address,
          currency: profileData.currency,
          unique_code: uniqueCodeToPersist,
          default_theme: existingOrg?.default_theme || 'dark',
          company_logo_url: profileData.companyLogoUrl,
        };
        console.log("[OnboardingContext] Update payload for organizations table:", updatePayload);

        const { error: updateOrgError } = await supabase
          .from('organizations')
          .update(updatePayload)
          .eq('id', profile.organizationId)
          .select()
          .single();

        if (updateOrgError) {
          console.error("[OnboardingContext] Error updating organization:", updateOrgError);
          throw updateOrgError;
        }
        console.log("[OnboardingContext] Organization updated successfully.");
        showSuccess(`Company profile for "${profileData.name}" updated successfully!`);
        await logActivity("Company Profile Update Success", `Company profile for "${profileData.name}" updated.`, profile, { organization_id: profile.organizationId, updated_fields: updatePayload });
      }
      
      console.log("[OnboardingContext] Calling fetchProfile to refresh user data.");
      await fetchProfile();
      console.log("[OnboardingContext] fetchProfile completed after organization update.");

    } catch (error: any) {
      console.error("[OnboardingContext] Error during organization setup/update:", error);
      await logActivity("Set Company Profile Failed", `Failed to set up/update organization profile.`, profile, { error_message: error.message, profile_data: profileData }, true);
      showError(`Failed to set up/update organization: ${error.message || 'Unknown error'}`);
      throw error;
    }
  };

  // Add a new structured location
  const addLocation = async (location: Omit<Location, "id" | "createdAt" | "userId" | "organizationId">): Promise<Location | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !profile?.organizationId) {
      const errorMessage = "You must be logged in and have an organization ID to add locations.";
      await logActivity("Add Location Failed", errorMessage, profile, { location_name: location.displayName || location.fullLocationString }, true);
      showError(errorMessage);
      return null;
    }

    // NEW: Check if location already exists in DB before inserting
    const { data: existingDbLocation, error: fetchError } = await supabase
      .from("locations")
      .select("*")
      .eq("organization_id", profile.organizationId)
      .eq("full_location_string", location.fullLocationString)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error("Error checking for existing location:", fetchError);
      await logActivity("Add Location Failed", `Failed to check for existing location: ${location.fullLocationString}.`, profile, { error_message: fetchError.message, location_details: location }, true);
      showError(`Failed to check for existing location: ${fetchError.message}`);
      return null;
    }

    if (existingDbLocation) {
      console.log(`Location "${location.fullLocationString}" already exists in DB. Skipping insert.`);
      const mappedExistingLocation = mapSupabaseLocationToLocation(existingDbLocation);
      // Ensure it's in the local state if not already
      setLocations(prev => {
        if (!prev.some(loc => loc.id === mappedExistingLocation.id)) {
          return [...prev, mappedExistingLocation];
        }
        return prev;
      });
      await logActivity("Add Location Skipped", `Location "${location.fullLocationString}" already exists.`, profile, { location_id: mappedExistingLocation.id, location_name: mappedExistingLocation.displayName || mappedExistingLocation.fullLocationString });
      return mappedExistingLocation;
    }

    const { data, error } = await supabase
      .from("locations")
      .insert({
        organization_id: profile.organizationId,
        full_location_string: location.fullLocationString,
        display_name: location.displayName,
        area: location.area,
        row: location.row,
        bay: location.bay,
        level: location.level,
        pos: location.pos,
        color: location.color,
        user_id: session.user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error adding location:", error);
      await logActivity("Add Location Failed", `Failed to add location: ${location.displayName || location.fullLocationString}.`, profile, { error_message: error.message, location_details: location }, true);
      showError(`Failed to add location: ${error.message}`);
      return null;
    } else if (data) {
      const newLocation = mapSupabaseLocationToLocation(data);
      setLocations((prev) => [...prev, newLocation]);
      showSuccess(`Location "${location.displayName || location.fullLocationString}" added.`);
      await logActivity("Add Location Success", `Added new location: ${newLocation.displayName || newLocation.fullLocationString}.`, profile, { location_id: newLocation.id, location_name: newLocation.displayName || newLocation.fullLocationString });
      return newLocation;
    }
    return null;
  };

  // Update an existing structured location
  const updateLocation = async (location: Omit<Location, "createdAt" | "userId" | "organizationId">) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !profile?.organizationId) {
      const errorMessage = "You must be logged in and have an organization ID to update locations.";
      await logActivity("Update Location Failed", errorMessage, profile, { location_id: location.id, location_name: location.displayName || location.fullLocationString }, true);
      showError(errorMessage);
      return;
    }

    const { data, error } = await supabase
      .from("locations")
      .update({
        full_location_string: location.fullLocationString,
        display_name: location.displayName,
        area: location.area,
        row: location.row,
        bay: location.bay,
        level: location.level,
        pos: location.pos,
        color: location.color,
      })
      .eq("id", location.id)
      .eq("organization_id", profile.organizationId)
      .select()
      .single();

    if (error) {
      console.error("Error updating location:", error);
      await logActivity("Update Location Failed", `Failed to update location: ${location.displayName || location.fullLocationString} (ID: ${location.id}).`, profile, { error_message: error.message, location_id: location.id, updated_fields: location }, true);
      showError(`Failed to update location: ${error.message}`);
    } else if (data) {
      setLocations((prev) =>
        prev.map((loc) => (loc.id === data.id ? mapSupabaseLocationToLocation(data) : loc))
      );
      showSuccess(`Location "${location.displayName || location.fullLocationString}" updated.`);
      await logActivity("Update Location Success", `Updated location: ${location.displayName || location.fullLocationString} (ID: ${location.id}).`, profile, { location_id: location.id, updated_fields: location });
    }
  };

  // Remove a structured location by ID
  const removeLocation = async (locationId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !profile?.organizationId) {
      const errorMessage = "You must be logged in and have an organization ID to remove locations.";
      await logActivity("Remove Location Failed", errorMessage, profile, { location_id: locationId }, true);
      showError(errorMessage);
      return;
    }

    const locationToRemove = locations.find(loc => loc.id === locationId);

    const { error } = await supabase
      .from("locations")
      .delete()
      .eq("id", locationId)
      .eq("organization_id", profile.organizationId);

    if (error) {
      console.error("Error removing location:", error);
      await logActivity("Remove Location Failed", `Failed to remove location: ${locationToRemove?.displayName || locationToRemove?.fullLocationString} (ID: ${locationId}).`, profile, { error_message: error.message, location_id: locationId }, true);
      showError(`Failed to remove location: ${error.message}`);
    } else {
      setLocations((prev) => prev.filter((loc) => loc.id !== locationId));
      showSuccess(`Location "${locationToRemove?.displayName || locationToRemove?.fullLocationString}" removed.`);
      await logActivity("Remove Location Success", `Removed location: ${locationToRemove?.displayName || locationToRemove?.fullLocationString} (ID: ${locationId}).`, profile, { location_id: locationId });
    }
  };

  return (
    <OnboardingContext.Provider
      value={{
        isOnboardingComplete,
        companyProfile,
        locations,
        markOnboardingComplete,
        setCompanyProfile,
        addLocation,
        updateLocation,
        removeLocation,
        fetchLocations,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return context;
};