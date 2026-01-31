"use client";

import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { showError, showSuccess } from "@/utils/toast";
import { useProfile } from "./ProfileContext";
import { logActivity } from "@/utils/logActivity";

export interface UnitOfMeasure {
  id: string;
  organizationId: string;
  name: string;
  abbreviation: string;
  baseUnitFactor: number; // Factor relative to a base unit (e.g., 1000 for 'gram' if base is 'kg')
  isBaseUnit: boolean;
  createdAt: string;
}

interface UnitOfMeasureContextType {
  units: UnitOfMeasure[];
  isLoadingUnits: boolean;
  addUnit: (unit: Omit<UnitOfMeasure, "id" | "createdAt" | "organizationId">) => Promise<void>;
  updateUnit: (updatedUnit: UnitOfMeasure) => Promise<void>;
  deleteUnit: (unitId: string) => Promise<void>;
  refreshUnits: () => Promise<void>;
  convertToBaseUnit: (quantity: number, unitId: string) => number;
  convertFromBaseUnit: (quantity: number, unitId: string) => number;
}

const UnitOfMeasureContext = createContext<UnitOfMeasureContextType | undefined>(undefined);

export const UnitOfMeasureProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [isLoadingUnits, setIsLoadingUnits] = useState(true);
  const { profile, isLoadingProfile } = useProfile();

  const mapSupabaseUnitToUnitOfMeasure = (data: any): UnitOfMeasure => ({
    id: data.id,
    organizationId: data.organization_id,
    name: data.name,
    abbreviation: data.abbreviation,
    baseUnitFactor: parseFloat(data.base_unit_factor),
    isBaseUnit: data.is_base_unit,
    createdAt: data.created_at,
  });

  const fetchUnits = useCallback(async () => {
    setIsLoadingUnits(true);
    if (!profile?.organizationId) {
      setUnits([]);
      setIsLoadingUnits(false);
      return;
    }

    const { data, error } = await supabase
      .from("units_of_measure")
      .select("*")
      .eq("organization_id", profile.organizationId)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching units of measure:", error);
      showError("Failed to load units of measure.");
      logActivity("UoM Fetch Failed", `Failed to load units for organization ${profile.organizationId}.`, profile, { error_message: error.message }, true);
      setUnits([]);
    } else {
      setUnits(data.map(mapSupabaseUnitToUnitOfMeasure));
    }
    setIsLoadingUnits(false);
  }, [profile]);

  useEffect(() => {
    if (!isLoadingProfile && profile?.organizationId) {
      fetchUnits();
    }
  }, [fetchUnits, isLoadingProfile, profile?.organizationId]);

  const addUnit = async (unit: Omit<UnitOfMeasure, "id" | "createdAt" | "organizationId">) => {
    if (!profile?.organizationId || !profile?.id) {
      showError("Login/org ID required.");
      return;
    }

    const { data, error } = await supabase
      .from("units_of_measure")
      .insert({
        organization_id: profile.organizationId,
        user_id: profile.id,
        name: unit.name.trim(),
        abbreviation: unit.abbreviation.trim(),
        base_unit_factor: unit.baseUnitFactor,
        is_base_unit: unit.isBaseUnit,
      })
      .select()
      .single();

    if (error) {
      console.error("Error adding unit:", error);
      logActivity("Add UoM Failed", `Failed to add unit: ${unit.name}.`, profile, { error_message: error.message, unit_details: unit }, true);
      showError(`Failed to add unit: ${error.message}`);
    } else if (data) {
      setUnits(prev => [...prev, mapSupabaseUnitToUnitOfMeasure(data)]);
      showSuccess(`Unit "${unit.name}" added.`);
      logActivity("Add UoM Success", `Added new unit: ${unit.name}.`, profile, { unit_id: data.id, unit_name: data.name });
    }
  };

  const updateUnit = async (updatedUnit: UnitOfMeasure) => {
    if (!profile?.organizationId) {
      showError("Organization ID required.");
      return;
    }

    const { data, error } = await supabase
      .from("units_of_measure")
      .update({
        name: updatedUnit.name.trim(),
        abbreviation: updatedUnit.abbreviation.trim(),
        base_unit_factor: updatedUnit.baseUnitFactor,
        is_base_unit: updatedUnit.isBaseUnit,
      })
      .eq("id", updatedUnit.id)
      .eq("organization_id", profile.organizationId)
      .select()
      .single();

    if (error) {
      console.error("Error updating unit:", error);
      logActivity("Update UoM Failed", `Failed to update unit: ${updatedUnit.name}.`, profile, { error_message: error.message, unit_id: updatedUnit.id, updated_fields: updatedUnit }, true);
      showError(`Failed to update unit: ${error.message}`);
    } else if (data) {
      setUnits(prev => prev.map(u => u.id === data.id ? mapSupabaseUnitToUnitOfMeasure(data) : u));
      showSuccess(`Unit "${updatedUnit.name}" updated.`);
      logActivity("Update UoM Success", `Updated unit: ${updatedUnit.name}.`, profile, { unit_id: updatedUnit.id, updated_fields: updatedUnit });
    }
  };

  const deleteUnit = async (unitId: string) => {
    if (!profile?.organizationId) {
      showError("Organization ID required.");
      return;
    }

    const { error } = await supabase
      .from("units_of_measure")
      .delete()
      .eq("id", unitId)
      .eq("organization_id", profile.organizationId);

    if (error) {
      console.error("Error deleting unit:", error);
      logActivity("Delete UoM Failed", `Failed to delete unit ID: ${unitId}.`, profile, { error_message: error.message, unit_id: unitId }, true);
      showError(`Failed to delete unit: ${error.message}`);
    } else {
      setUnits(prev => prev.filter(u => u.id !== unitId));
      showSuccess("Unit deleted.");
      logActivity("Delete UoM Success", `Deleted unit ID: ${unitId}.`, profile, { unit_id: unitId });
    }
  };

  const convertToBaseUnit = (quantity: number, unitId: string): number => {
    const unit = units.find(u => u.id === unitId);
    if (!unit) {
      console.warn(`Unit ID ${unitId} not found for conversion.`);
      return quantity;
    }
    return quantity * unit.baseUnitFactor;
  };

  const convertFromBaseUnit = (quantity: number, unitId: string): number => {
    const unit = units.find(u => u.id === unitId);
    if (!unit) {
      console.warn(`Unit ID ${unitId} not found for conversion.`);
      return quantity;
    }
    return quantity / unit.baseUnitFactor;
  };

  const refreshUnits = async () => {
    await fetchUnits();
  };

  return (
    <UnitOfMeasureContext.Provider value={{ units, isLoadingUnits, addUnit, updateUnit, deleteUnit, refreshUnits, convertToBaseUnit, convertFromBaseUnit }}>
      {children}
    </UnitOfMeasureContext.Provider>
  );
};

export const useUnitOfMeasure = () => {
  const context = useContext(UnitOfMeasureContext);
  if (context === undefined) {
    throw new Error("useUnitOfMeasure must be used within a UnitOfMeasureProvider");
  }
  return context;
};