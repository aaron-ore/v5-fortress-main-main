"use client";

import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { showError, showSuccess } from "@/utils/toast";
import { useProfile } from "./ProfileContext";
import { logActivity } from "@/utils/logActivity";
import { UnitOfMeasure } from "./UnitOfMeasureContext";
import { InventoryItem } from "./InventoryContext";

export interface RecipeIngredient {
  id: string;
  recipeId: string;
  inventoryItemId: string;
  quantityNeeded: number;
  unitId: string;
  notes?: string;
  // Transient data for UI display
  itemName?: string;
  unitAbbreviation?: string;
}

export interface Recipe {
  id: string;
  organizationId: string;
  userId: string;
  name: string;
  description?: string;
  yieldQuantity: number;
  yieldUnitId: string;
  sellingPrice: number;
  createdAt: string;
  ingredients: RecipeIngredient[];
  // Transient data for UI display
  yieldUnitAbbreviation?: string;
}

interface RecipeContextType {
  recipes: Recipe[];
  isLoadingRecipes: boolean;
  addRecipe: (recipe: Omit<Recipe, "id" | "createdAt" | "userId" | "organizationId" | "ingredients">, ingredients: Omit<RecipeIngredient, "id" | "recipeId">[]) => Promise<void>;
  updateRecipe: (recipe: Omit<Recipe, "createdAt" | "userId" | "organizationId" | "ingredients">, ingredients: Omit<RecipeIngredient, "id" | "recipeId">[]) => Promise<void>;
  deleteRecipe: (recipeId: string) => Promise<void>;
  refreshRecipes: () => Promise<void>;
}

const RecipeContext = createContext<RecipeContextType | undefined>(undefined);

export const RecipeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoadingRecipes, setIsLoadingRecipes] = useState(true);
  const { profile, isLoadingProfile } = useProfile();

  const mapSupabaseRecipeToRecipe = (data: any, ingredients: any[], units: UnitOfMeasure[], inventoryItems: Partial<InventoryItem>[]): Recipe => {
    const yieldUnit = units.find(u => u.id === data.yield_unit_id);

    const mappedIngredients: RecipeIngredient[] = ingredients.map(ing => {
      const item = inventoryItems.find(i => i.id === ing.inventory_item_id);
      const unit = units.find(u => u.id === ing.unit_id);
      return {
        id: ing.id,
        recipeId: ing.recipe_id,
        inventoryItemId: ing.inventory_item_id,
        quantityNeeded: parseFloat(ing.quantity_needed),
        unitId: ing.unit_id,
        notes: ing.notes || undefined,
        itemName: item?.name,
        unitAbbreviation: unit?.abbreviation,
      };
    });

    return {
      id: data.id,
      organizationId: data.organization_id,
      userId: data.user_id,
      name: data.name,
      description: data.description || undefined,
      yieldQuantity: parseFloat(data.yield_quantity),
      yieldUnitId: data.yield_unit_id,
      sellingPrice: parseFloat(data.selling_price),
      createdAt: data.created_at,
      ingredients: mappedIngredients,
      yieldUnitAbbreviation: yieldUnit?.abbreviation,
    };
  };

  const fetchRecipes = useCallback(async () => {
    setIsLoadingRecipes(true);
    if (!profile?.organizationId) {
      setRecipes([]);
      setIsLoadingRecipes(false);
      return;
    }

    // Fetch all recipes, ingredients, units, and inventory items in parallel
    const [
      { data: recipeData, error: recipeError },
      { data: ingredientData, error: ingredientError },
      { data: unitData, error: unitError },
      { data: inventoryData, error: inventoryError },
    ] = await Promise.all([
      supabase.from("recipes").select("*").eq("organization_id", profile.organizationId),
      supabase.from("recipe_ingredients").select('*'),
      supabase.from("units_of_measure").select('id, abbreviation, base_unit_factor, is_base_unit, name, created_at, organization_id').eq("organization_id", profile.organizationId),
      supabase.from("inventory_items").select("id, name").eq("organization_id", profile.organizationId),
    ]);

    if (recipeError || ingredientError || unitError || inventoryError) {
      console.error("Error fetching recipe data:", recipeError || ingredientError || unitError || inventoryError);
      showError("Failed to load recipes.");
      setRecipes([]);
      setIsLoadingRecipes(false);
      return;
    }

    const unitsMap = unitData.map(u => ({
        id: u.id,
        organizationId: u.organization_id,
        name: u.name,
        abbreviation: u.abbreviation,
        baseUnitFactor: parseFloat(u.base_unit_factor),
        isBaseUnit: u.is_base_unit,
        createdAt: u.created_at,
    })) as UnitOfMeasure[];

    const inventoryItemsMap = inventoryData.map(i => ({
        id: i.id,
        name: i.name,
    })) as Partial<InventoryItem>[];

    const mappedRecipes: Recipe[] = recipeData.map(recipe => {
      const ingredients = ingredientData.filter(ing => ing.recipe_id === recipe.id);
      return mapSupabaseRecipeToRecipe(recipe, ingredients, unitsMap, inventoryItemsMap as Partial<InventoryItem>[]);
    });

    setRecipes(mappedRecipes);
    setIsLoadingRecipes(false);
  }, [profile]);

  useEffect(() => {
    if (!isLoadingProfile && profile?.organizationId) {
      fetchRecipes();
    }
  }, [fetchRecipes, isLoadingProfile, profile?.organizationId]);

  const addRecipe = async (recipe: Omit<Recipe, "id" | "createdAt" | "userId" | "organizationId" | "ingredients">, ingredients: Omit<RecipeIngredient, "id" | "recipeId">[]) => {
    if (!profile?.organizationId || !profile?.id) {
      showError("Login/org ID required.");
      return;
    }

    const { data: recipeData, error: recipeError } = await supabase
      .from("recipes")
      .insert({
        organization_id: profile.organizationId,
        user_id: profile.id,
        name: recipe.name.trim(),
        description: recipe.description,
        yield_quantity: recipe.yieldQuantity,
        yield_unit_id: recipe.yieldUnitId,
        selling_price: recipe.sellingPrice,
      })
      .select()
      .single();

    if (recipeError) {
      console.error("Error adding recipe:", recipeError);
      showError(`Failed to add recipe: ${recipeError.message}`);
      return;
    }

    const newRecipeId = recipeData.id;
    const ingredientInserts = ingredients.map(ing => ({
      recipe_id: newRecipeId,
      inventory_item_id: ing.inventoryItemId,
      quantity_needed: ing.quantityNeeded,
      unit_id: ing.unitId,
      notes: ing.notes,
    }));

    const { error: ingredientError } = await supabase
      .from("recipe_ingredients")
      .insert(ingredientInserts);

    if (ingredientError) {
      console.error("Error adding recipe ingredients:", ingredientError);
      showError(`Recipe added, but failed to add ingredients: ${ingredientError.message}`);
      // Clean up the recipe if ingredient insertion fails critically
      await supabase.from("recipes").delete().eq("id", newRecipeId);
      return;
    }

    showSuccess(`Recipe "${recipe.name}" added!`);
    await fetchRecipes();
  };

  const updateRecipe = async (recipe: Omit<Recipe, "createdAt" | "userId" | "organizationId" | "ingredients">, ingredients: Omit<RecipeIngredient, "id" | "recipeId">[]) => {
    if (!profile?.organizationId) {
      showError("Organization ID required.");
      return;
    }

    // 1. Update Recipe Header
    const { error: recipeError } = await supabase
      .from("recipes")
      .update({
        name: recipe.name.trim(),
        description: recipe.description,
        yield_quantity: recipe.yieldQuantity,
        yield_unit_id: recipe.yieldUnitId,
        selling_price: recipe.sellingPrice,
      })
      .eq("id", recipe.id)
      .eq("organization_id", profile.organizationId);

    if (recipeError) {
      console.error("Error updating recipe:", recipeError);
      showError(`Failed to update recipe: ${recipeError.message}`);
      return;
    }

    // 2. Delete existing ingredients and insert new ones (simplest transaction model)
    const { error: deleteError } = await supabase
      .from("recipe_ingredients")
      .delete()
      .eq("recipe_id", recipe.id);

    if (deleteError) {
      console.error("Error deleting old ingredients:", deleteError);
      showError(`Recipe updated, but failed to clear old ingredients: ${deleteError.message}`);
      return;
    }

    const ingredientInserts = ingredients.map(ing => ({
      recipe_id: recipe.id,
      inventory_item_id: ing.inventoryItemId,
      quantity_needed: ing.quantityNeeded,
      unit_id: ing.unitId,
      notes: ing.notes,
    }));

    const { error: ingredientError } = await supabase
      .from("recipe_ingredients")
      .insert(ingredientInserts);

    if (ingredientError) {
      console.error("Error inserting new ingredients:", ingredientError);
      showError(`Recipe updated, but failed to insert new ingredients: ${ingredientError.message}`);
      return;
    }

    showSuccess(`Recipe "${recipe.name}" updated!`);
    await fetchRecipes();
  };

  const deleteRecipe = async (recipeId: string) => {
    if (!profile?.organizationId) {
      showError("Organization ID required.");
      return;
    }

    const recipeToDelete = recipes.find(r => r.id === recipeId);

    const { error } = await supabase
      .from("recipes")
      .delete()
      .eq("id", recipeId)
      .eq("organization_id", profile.organizationId);

    if (error) {
      console.error("Error deleting recipe:", error);
      showError(`Failed to delete recipe: ${error.message}`);
    } else {
      showSuccess(`Recipe "${recipeToDelete?.name}" deleted.`);
      await fetchRecipes();
    }
  };

  const refreshRecipes = async () => {
    await fetchRecipes();
  };

  return (
    <RecipeContext.Provider value={{ recipes, isLoadingRecipes, addRecipe, updateRecipe, deleteRecipe, refreshRecipes }}>
      {children}
    </RecipeContext.Provider>
  );
};

export const useRecipe = () => {
  const context = useContext(RecipeContext);
  if (context === undefined) {
    throw new Error("useRecipe must be used within a RecipeProvider");
  }
  return context;
};