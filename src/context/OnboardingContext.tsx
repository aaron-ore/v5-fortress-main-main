import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from "react";
import { showSuccess, showError } from "@/utils/toast";
import { useProfile, CompanyProfile as ProfileCompanyProfile } from "./ProfileContext";
import { supabase } from "@/lib/supabaseClient";
import { generateUniqueCode } from "@/utils/numberGenerator";
import { logActivity } from "@/utils/logActivity";
import { getFilePathFromPublicUrl } from "@/integrations/supabase/storage";

export interface CompanyProfile {
  name: string;
  currency: string;
  address: string;
  companyLogoUrl?: string;
}

// Renamed from Location to InventoryFolder
export interface InventoryFolder {
  id: string;
  organizationId: string;
  name: string; // Folder name (e.g., "Main Warehouse", "Electronics")
  description?: string; // Folder description/notes
  parentId?: string; // For subfolders
  imageUrl?: string; // For folder icon/image
  color: string; // For visual coding
  createdAt: string;
  userId: string;
  tags?: string[]; // For folder tags
}

interface OnboardingContextType {
  isOnboardingComplete: boolean;
  companyProfile: ProfileCompanyProfile | null;
  inventoryFolders: InventoryFolder[]; // Renamed from locations to inventoryFolders
  isLoadingFolders: boolean; // NEW: Add isLoadingFolders
  markOnboardingComplete: () => void;
  setCompanyProfile: (profile: CompanyProfile, uniqueCode?: string) => Promise<void>;
  addInventoryFolder: (folder: Omit<InventoryFolder, "id" | "createdAt" | "userId" | "organizationId">) => Promise<InventoryFolder | null>; // Renamed from addLocation
  updateInventoryFolder: (folder: Omit<InventoryFolder, "createdAt" | "userId" | "organizationId">) => Promise<void>; // Renamed from updateLocation
  removeInventoryFolder: (folderId: string) => Promise<void>; // Renamed from removeLocation
  fetchInventoryFolders: () => Promise<void>; // Renamed from fetchLocations
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

  const companyProfile = profile?.companyProfile || null;

  const [inventoryFolders, setInventoryFolders] = useState<InventoryFolder[]>([]); // Renamed from locations
  const [isLoadingFolders, setIsLoadingFolders] = useState(true); // NEW: Add isLoadingFolders state

  useEffect(() => {
    if (!isLoadingProfile) {
      if (profile?.organizationId) {
        setIsOnboardingComplete(true);
      } else {
        setIsOnboardingComplete(localStorage.getItem("onboarding_skipped") === "true");
      }
    } else if (!isLoadingProfile && !profile) {
      setIsOnboardingComplete(false);
    }
  }, [profile, isLoadingProfile]);

  // Renamed from mapSupabaseLocationToLocation
  const mapSupabaseFolderToInventoryFolder = (data: any): InventoryFolder => ({
    id: data.id,
    organizationId: data.organization_id,
    name: data.name,
    description: data.description || undefined,
    parentId: data.parent_id || undefined,
    imageUrl: data.image_url || undefined,
    color: data.color,
    createdAt: data.created_at,
    userId: data.user_id,
    tags: data.tags || undefined,
  });

  // Renamed from fetchLocations
  const fetchInventoryFolders = useCallback(async () => {
    setIsLoadingFolders(true); // NEW: Set loading to true
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !profile?.organizationId) {
      setInventoryFolders([]);
      setIsLoadingFolders(false); // NEW: Set loading to false
      return;
    }

    const { data, error } = await supabase
      .from("inventory_folders") // Updated table name
      .select("*")
      .eq("organization_id", profile.organizationId)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching inventory folders:", error);
      showError("Failed to load inventory folders.");
      await logActivity("Inventory Folder Fetch Failed", `Failed to load inventory folders for organization ${profile.organizationId}.`, profile, { error_message: error.message }, true);
      setInventoryFolders([]);
    } else {
      setInventoryFolders(data.map(mapSupabaseFolderToInventoryFolder));
    }
    setIsLoadingFolders(false); // NEW: Set loading to false
  }, [profile?.organizationId, profile]);

  useEffect(() => {
    if (!isLoadingProfile && profile?.organizationId) {
      fetchInventoryFolders();
    } else if (!isLoadingProfile && !profile?.organizationId) {
      setInventoryFolders([]);
      setIsLoadingFolders(false); // NEW: Set loading to false
    }
  }, [isLoadingProfile, profile?.organizationId, fetchInventoryFolders]);


  const markOnboardingComplete = async () => {
    setIsOnboardingComplete(true);
    localStorage.setItem("onboarding_skipped", "true");
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

        const { data: existingOrg, error: fetchOrgError } = await supabase
          .from('organizations')
          .select('unique_code, company_logo_url, default_theme, plan') // NEW: Select plan
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
        if ((profileData.companyLogoUrl === undefined || profileData.companyLogoUrl === null || profileData.companyLogoUrl === "") && oldCompanyLogoUrl) {
            const oldFilePath = getFilePathFromPublicUrl(oldCompanyLogoUrl, 'company-logos');
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
          plan: existingOrg?.plan || 'free', // NEW: Include plan in update payload
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

  // Renamed from addLocation
  const addInventoryFolder = async (folder: Omit<InventoryFolder, "id" | "createdAt" | "userId" | "organizationId">): Promise<InventoryFolder | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !profile?.organizationId) {
      const errorMessage = "You must be logged in and have an organization ID to add inventory folders.";
      await logActivity("Add Inventory Folder Failed", errorMessage, profile, { folder_name: folder.name }, true);
      showError(errorMessage);
      return null;
    }

    const { data: existingDbFolder, error: fetchError } = await supabase
      .from("inventory_folders") // Updated table name
      .select("*")
      .eq("organization_id", profile.organizationId)
      .eq("name", folder.name) // Check by name for uniqueness
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error("Error checking for existing folder:", fetchError);
      await logActivity("Add Inventory Folder Failed", `Failed to check for existing folder: ${folder.name}.`, profile, { error_message: fetchError.message, folder_details: folder }, true);
      showError(`Failed to check for existing folder: ${fetchError.message}`);
      return null;
    }

    if (existingDbFolder) {
      console.log(`Folder "${folder.name}" already exists in DB. Skipping insert.`);
      const mappedExistingFolder = mapSupabaseFolderToInventoryFolder(existingDbFolder);
      setInventoryFolders(prev => {
        if (!prev.some(f => f.id === mappedExistingFolder.id)) {
          return [...prev, mappedExistingFolder];
        }
        return prev;
      });
      await logActivity("Add Inventory Folder Skipped", `Folder "${folder.name}" already exists.`, profile, { folder_id: mappedExistingFolder.id, folder_name: mappedExistingFolder.name });
      return mappedExistingFolder;
    }

    const { data, error } = await supabase
      .from("inventory_folders") // Updated table name
      .insert({
        organization_id: profile.organizationId,
        name: folder.name,
        description: folder.description,
        parent_id: folder.parentId,
        image_url: folder.imageUrl,
        color: folder.color,
        user_id: session.user.id,
        tags: folder.tags,
      })
      .select()
      .single();

    if (error) {
      console.error("Error adding inventory folder:", error);
      await logActivity("Add Inventory Folder Failed", `Failed to add folder: ${folder.name}.`, profile, { error_message: error.message, folder_details: folder }, true);
      showError(`Failed to add folder: ${error.message}`);
      return null;
    } else if (data) {
      const newFolder = mapSupabaseFolderToInventoryFolder(data);
      setInventoryFolders((prev) => [...prev, newFolder]);
      showSuccess(`Folder "${folder.name}" added.`);
      await logActivity("Add Inventory Folder Success", `Added new folder: ${newFolder.name}.`, profile, { folder_id: newFolder.id, folder_name: newFolder.name });
      return newFolder;
    }
    return null;
  };

  // Renamed from updateLocation
  const updateInventoryFolder = async (folder: Omit<InventoryFolder, "createdAt" | "userId" | "organizationId">) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !profile?.organizationId) {
      const errorMessage = "You must be logged in and have an organization ID to update inventory folders.";
      await logActivity("Update Inventory Folder Failed", errorMessage, profile, { folder_id: folder.id, folder_name: folder.name }, true);
      showError(errorMessage);
      return;
    }

    const { data, error } = await supabase
      .from("inventory_folders") // Updated table name
      .update({
        name: folder.name,
        description: folder.description,
        parent_id: folder.parentId,
        image_url: folder.imageUrl,
        color: folder.color,
        tags: folder.tags,
      })
      .eq("id", folder.id)
      .eq("organization_id", profile.organizationId)
      .select()
      .single();

    if (error) {
      console.error("Error updating inventory folder:", error);
      await logActivity("Update Inventory Folder Failed", `Failed to update folder: ${folder.name} (ID: ${folder.id}).`, profile, { error_message: error.message, folder_id: folder.id, updated_fields: folder }, true);
      showError(`Failed to update folder: ${error.message}`);
    } else if (data) {
      setInventoryFolders((prev) =>
        prev.map((f) => (f.id === data.id ? mapSupabaseFolderToInventoryFolder(data) : f))
      );
      showSuccess(`Folder "${folder.name}" updated.`);
      await logActivity("Update Inventory Folder Success", `Updated folder: ${folder.name} (ID: ${folder.id}).`, profile, { folder_id: folder.id, updated_fields: folder });
    }
  };

  // Renamed from removeLocation
  const removeInventoryFolder = async (folderId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !profile?.organizationId) {
      const errorMessage = "You must be logged in and have an an organization ID to remove inventory folders.";
      await logActivity("Remove Inventory Folder Failed", errorMessage, profile, { folder_id: folderId }, true);
      showError(errorMessage);
      return;
    }

    const folderToRemove = inventoryFolders.find(f => f.id === folderId);

    const { error } = await supabase
      .from("inventory_folders") // Updated table name
      .delete()
      .eq("id", folderId)
      .eq("organization_id", profile.organizationId);

    if (error) {
      console.error("Error removing inventory folder:", error);
      await logActivity("Remove Inventory Folder Failed", `Failed to remove folder: ${folderToRemove?.name} (ID: ${folderId}).`, profile, { error_message: error.message, folder_id: folderId }, true);
      showError(`Failed to remove folder: ${error.message}`);
    } else {
      setInventoryFolders((prev) => prev.filter((f) => f.id !== folderId));
      showSuccess(`Folder "${folderToRemove?.name}" removed.`);
      await logActivity("Remove Inventory Folder Success", `Removed folder: ${folderToRemove?.name} (ID: ${folderId}).`, profile, { folder_id: folderId });
    }
  };

  return (
    <OnboardingContext.Provider
      value={{
        isOnboardingComplete,
        companyProfile,
        inventoryFolders, // Renamed
        isLoadingFolders, // NEW: Provide isLoadingFolders
        markOnboardingComplete,
        setCompanyProfile,
        addInventoryFolder, // Renamed
        updateInventoryFolder, // Renamed
        removeInventoryFolder, // Renamed
        fetchInventoryFolders, // Renamed
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