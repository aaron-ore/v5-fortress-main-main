import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { showError, showSuccess } from "@/utils/toast";
import { useProfile } from "./ProfileContext";

export interface Vendor {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  organizationId: string | null;
  createdAt: string;
}

interface VendorContextType {
  vendors: Vendor[];
  addVendor: (vendor: Omit<Vendor, "id" | "createdAt" | "organizationId">) => Promise<void>;
  updateVendor: (updatedVendor: Vendor) => Promise<void>;
  deleteVendor: (vendorId: string) => Promise<void>;
  refreshVendors: () => Promise<void>;
}

const VendorContext = createContext<VendorContextType | undefined>(undefined);

export const VendorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const { profile, isLoadingProfile } = useProfile();

  const fetchVendors = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !profile?.organizationId) {
      setVendors([]);
      return;
    }

    const { data, error } = await supabase
      .from("vendors")
      .select("*")
      .eq("organization_id", profile.organizationId)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching vendors:", error);
      showError("Failed to load vendors.");
      setVendors([]);
    } else {
      const fetchedVendors: Vendor[] = data.map((vendor: any) => ({
        id: vendor.id,
        name: vendor.name,
        contactPerson: vendor.contact_person || undefined,
        email: vendor.email || undefined,
        phone: vendor.phone || undefined,
        address: vendor.address || undefined,
        notes: vendor.notes || undefined,
        organizationId: vendor.organization_id,
        createdAt: vendor.created_at,
      }));
      setVendors(fetchedVendors);
    }
  }, [profile?.organizationId]);

  useEffect(() => {
    if (!isLoadingProfile) {
      fetchVendors();
    }
  }, [fetchVendors, isLoadingProfile]);

  const addVendor = async (vendor: Omit<Vendor, "id" | "createdAt" | "organizationId">) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !profile?.organizationId) {
      showError("You must be logged in and have an organization ID to add vendors.");
      return;
    }

    const { data, error } = await supabase
      .from("vendors")
      .insert({
        name: vendor.name,
        contact_person: vendor.contactPerson,
        email: vendor.email,
        phone: vendor.phone,
        address: vendor.address,
        notes: vendor.notes,
        user_id: session.user.id,
        organization_id: profile.organizationId,
      })
      .select();

    if (error) {
      console.error("Error adding vendor:", error);
      showError(`Failed to add vendor: ${error.message}`);
    } else if (data && data.length > 0) {
      const newVendor: Vendor = {
        id: data[0].id,
        name: data[0].name,
        contactPerson: data[0].contact_person || undefined,
        email: data[0].email || undefined,
        phone: data[0].phone || undefined,
        address: data[0].address || undefined,
        notes: data[0].notes || undefined,
        organizationId: data[0].organization_id,
        createdAt: data[0].created_at,
      };
      setVendors((prevVendors) => [...prevVendors, newVendor]);
      showSuccess(`Vendor "${vendor.name}" added successfully!`);
    }
  };

  const updateVendor = async (updatedVendor: Vendor) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !profile?.organizationId) {
      showError("You must be logged in and have an organization ID to update vendors.");
      return;
    }

    const { data, error } = await supabase
      .from("vendors")
      .update({
        name: updatedVendor.name,
        contact_person: updatedVendor.contactPerson,
        email: updatedVendor.email,
        phone: updatedVendor.phone,
        address: updatedVendor.address,
        notes: updatedVendor.notes,
      })
      .eq("id", updatedVendor.id)
      .eq("organization_id", profile.organizationId)
      .select();

    if (error) {
      console.error("Error updating vendor:", error);
      showError(`Failed to update vendor: ${error.message}`);
    } else if (data && data.length > 0) {
      const updatedVendorFromDB: Vendor = {
        id: data[0].id,
        name: data[0].name,
        contactPerson: data[0].contact_person || undefined,
        email: data[0].email || undefined,
        phone: data[0].phone || undefined,
        address: data[0].address || undefined,
        notes: data[0].notes || undefined,
        organizationId: data[0].organization_id,
        createdAt: data[0].created_at,
      };
      setVendors((prevVendors) =>
        prevVendors.map((vendor) =>
          vendor.id === updatedVendorFromDB.id ? updatedVendorFromDB : vendor,
        ),
      );
      showSuccess(`Vendor "${updatedVendor.name}" updated successfully!`);
    }
  };

  const deleteVendor = async (vendorId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !profile?.organizationId) {
      showError("You must be logged in and have an organization ID to delete vendors.");
      return;
    }

    const vendorToDelete = vendors.find(v => v.id === vendorId); // Kept as it's used in showSuccess

    const { error } = await supabase
      .from("vendors")
      .delete()
      .eq("id", vendorId)
      .eq("organization_id", profile.organizationId);

    if (error) {
      console.error("Error deleting vendor:", error);
      showError(`Failed to delete vendor: ${error.message}`);
    } else {
      setVendors((prevVendors) => prevVendors.filter(vendor => vendor.id !== vendorId));
      showSuccess("Vendor deleted successfully!");
    }
  };

  const refreshVendors = async () => {
    await fetchVendors();
  };

  return (
    <VendorContext.Provider value={{ vendors, addVendor, updateVendor, deleteVendor, refreshVendors }}>
      {children}
    </VendorContext.Provider>
  );
};

export const useVendors = () => {
  const context = useContext(VendorContext);
  if (context === undefined) {
    throw new Error("useVendors must be used within a VendorProvider");
  }
  return context;
};