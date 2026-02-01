import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Trash2, Utensils, Loader2 } from "lucide-react";
import { useRecipe, Recipe, RecipeIngredient } from "@/context/RecipeContext";
import { useUnitOfMeasure } from "@/context/UnitOfMeasureContext";
import { useInventory } from "@/context/InventoryContext";
import { showError } from "@/utils/toast";
import { useProfile } from "@/context/ProfileContext";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AddEditRecipeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  recipeToEdit?: Recipe | null;
}

// Define a temporary ingredient structure for local state management
interface TempIngredient extends Omit<RecipeIngredient, 'id' | 'recipeId'> {
  tempId: number; // Use a temporary ID for local state
}

const AddEditRecipeDialog: React.FC<AddEditRecipeDialogProps> = ({
  isOpen,
  onClose,
  recipeToEdit,
}) => {
  const { addRecipe, updateRecipe } = useRecipe();
  const { units, isLoadingUnits } = useUnitOfMeasure();
  const { inventoryItems, isLoadingInventory } = useInventory();
  const { profile } = useProfile();

  const canManageRecipes = profile?.role === 'admin' || profile?.role === 'inventory_manager';

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [yieldQuantity, setYieldQuantity] = useState("1");
  const [yieldUnitId, setYieldUnitId] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [ingredients, setIngredients] = useState<TempIngredient[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const baseUnits = useMemo(() => units.filter(u => u.isBaseUnit), [units]);
  const allUnits = units; // Use all units for ingredient selection

  useEffect(() => {
    if (isOpen) {
      if (recipeToEdit) {
        setName(recipeToEdit.name);
        setDescription(recipeToEdit.description || "");
        setYieldQuantity(String(recipeToEdit.yieldQuantity));
        setYieldUnitId(recipeToEdit.yieldUnitId);
        setSellingPrice(String(recipeToEdit.sellingPrice));
        setIngredients(recipeToEdit.ingredients.map(ing => ({ ...ing, tempId: Math.random() })));
      } else {
        setName("");
        setDescription("");
        setYieldQuantity("1");
        setYieldUnitId(baseUnits.length > 0 ? baseUnits[0].id : "");
        setSellingPrice("");
        setIngredients([]);
      }
    }
  }, [recipeToEdit, isOpen, baseUnits]);

  const handleAddIngredient = () => {
    if (!canManageRecipes) {
      showError("No permission to add ingredients.");
      return;
    }
    setIngredients(prev => [
      ...prev,
      {
        tempId: Date.now(),
        inventoryItemId: "",
        quantityNeeded: 0,
        unitId: "",
        notes: undefined,
      } as TempIngredient,
    ]);
  };

  const handleRemoveIngredient = (tempId: number) => {
    if (!canManageRecipes) {
      showError("No permission to remove ingredients.");
      return;
    }
    setIngredients(prev => prev.filter(ing => ing.tempId !== tempId));
  };

  const handleIngredientChange = (tempId: number, field: keyof TempIngredient, value: string | number) => {
    if (!canManageRecipes) {
      showError("No permission to edit ingredients.");
      return;
    }
    setIngredients(prev =>
      prev.map(ing => {
        if (ing.tempId === tempId) {
          if (field === 'quantityNeeded') {
            return { ...ing, quantityNeeded: parseFloat(String(value) || '0') };
          }
          return { ...ing, [field]: value };
        }
        return ing;
      })
    );
  };

  const handleSubmit = async () => {
    if (!canManageRecipes) {
      showError("No permission to save recipes.");
      return;
    }
    if (!name.trim() || !yieldQuantity || !yieldUnitId || !sellingPrice) {
      showError("Fill all required recipe fields.");
      return;
    }
    if (ingredients.length === 0 || ingredients.some(ing => !ing.inventoryItemId || ing.quantityNeeded <= 0 || !ing.unitId)) {
      showError("All ingredients must have a selected item, positive quantity, and unit.");
      return;
    }

    setIsSaving(true);

    const recipeData: Omit<Recipe, "id" | "createdAt" | "userId" | "organizationId" | "ingredients"> = {
      name: name.trim(),
      description: description.trim() || undefined,
      yieldQuantity: parseFloat(yieldQuantity),
      yieldUnitId: yieldUnitId,
      sellingPrice: parseFloat(sellingPrice),
    };

    const ingredientsData: Omit<RecipeIngredient, "id" | "recipeId">[] = ingredients.map(ing => ({
      inventoryItemId: ing.inventoryItemId,
      quantityNeeded: ing.quantityNeeded,
      unitId: ing.unitId,
      notes: ing.notes,
    }));

    try {
      if (recipeToEdit) {
        await updateRecipe({ ...recipeData, id: recipeToEdit.id }, ingredientsData);
      } else {
        await addRecipe(recipeData, ingredientsData);
      }
      onClose();
    } catch (error) {
      // Error handled in context
    } finally {
      setIsSaving(false);
    }
  };

  const isFormInvalid = !canManageRecipes || isSaving || !name.trim() || !yieldQuantity || !yieldUnitId || !sellingPrice || ingredients.length === 0 || ingredients.some(ing => !ing.inventoryItemId || ing.quantityNeeded <= 0 || !ing.unitId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Utensils className="h-6 w-6 text-primary" /> {recipeToEdit ? "Edit Recipe" : "Create New Recipe"}
          </DialogTitle>
          <DialogDescription>
            Define the ingredients and yield for a final product or dish.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-grow p-4 -mx-4">
          <div className="grid gap-6 px-4">
            {/* Basic Recipe Details */}
            <div className="space-y-4 border p-4 rounded-md">
              <h3 className="text-lg font-semibold">Recipe Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Recipe Name <span className="text-red-500">*</span></Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Signature Burger" disabled={!canManageRecipes} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sellingPrice">Selling Price <span className="text-red-500">*</span></Label>
                  <Input id="sellingPrice" type="number" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} placeholder="e.g., 12.99" step="0.01" min="0" disabled={!canManageRecipes} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="yieldQuantity">Yield Quantity <span className="text-red-500">*</span></Label>
                  <Input id="yieldQuantity" type="number" value={yieldQuantity} onChange={(e) => setYieldQuantity(e.target.value)} placeholder="e.g., 1" min="0.01" step="0.01" disabled={!canManageRecipes} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="yieldUnit">Yield Unit <span className="text-red-500">*</span></Label>
                  <Select value={yieldUnitId} onValueChange={setYieldUnitId} disabled={!canManageRecipes || isLoadingUnits || baseUnits.length === 0}>
                    <SelectTrigger id="yieldUnit">
                      <SelectValue placeholder="Select yield unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {baseUnits.map(unit => (
                        <SelectItem key={unit.id} value={unit.id}>{unit.name} ({unit.abbreviation})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of the dish..." rows={2} disabled={!canManageRecipes} />
              </div>
            </div>

            {/* Ingredients (Bill of Materials) */}
            <div className="space-y-4 border p-4 rounded-md">
              <h3 className="text-lg font-semibold">Ingredients (Bill of Materials)</h3>
              <Button type="button" onClick={handleAddIngredient} variant="secondary" disabled={!canManageRecipes}>
                <PlusCircle className="h-4 w-4 mr-2" /> Add Ingredient
              </Button>

              <div className="space-y-3">
                {ingredients.map(ing => (
                  <div key={ing.tempId} className="grid grid-cols-12 gap-2 items-end border-b pb-3 border-border/50">
                    <div className="col-span-4 space-y-1">
                      <Label className="text-xs">Inventory Item <span className="text-red-500">*</span></Label>
                      <Select
                        value={ing.inventoryItemId}
                        onValueChange={(value) => handleIngredientChange(ing.tempId, 'inventoryItemId', value)}
                        disabled={!canManageRecipes || isLoadingInventory}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select item" />
                        </SelectTrigger>
                        <SelectContent>
                          {inventoryItems.map(item => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name} (SKU: {item.sku})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Qty <span className="text-red-500">*</span></Label>
                      <Input
                        type="number"
                        value={ing.quantityNeeded || ""}
                        onChange={(e) => handleIngredientChange(ing.tempId, 'quantityNeeded', e.target.value)}
                        min="0.01"
                        step="0.01"
                        disabled={!canManageRecipes}
                      />
                    </div>
                    <div className="col-span-3 space-y-1">
                      <Label className="text-xs">Unit <span className="text-red-500">*</span></Label>
                      <Select
                        value={ing.unitId}
                        onValueChange={(value) => handleIngredientChange(ing.tempId, 'unitId', value)}
                        disabled={!canManageRecipes || isLoadingUnits}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                        <SelectContent>
                          {allUnits.map(unit => (
                            <SelectItem key={unit.id} value={unit.id}>
                              {unit.abbreviation} ({unit.name})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Notes</Label>
                      <Input
                        type="text"
                        value={ing.notes || ""}
                        onChange={(e) => handleIngredientChange(ing.tempId, 'notes', e.target.value)}
                        placeholder="Optional notes"
                        disabled={!canManageRecipes}
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveIngredient(ing.tempId)} disabled={!canManageRecipes}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter className="flex-shrink-0 pt-4">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isFormInvalid}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              recipeToEdit ? "Save Changes" : "Create Recipe"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddEditRecipeDialog;