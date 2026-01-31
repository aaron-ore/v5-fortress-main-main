import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlusCircle, Utensils, Edit, Trash2, Scale, Loader2, AlertTriangle } from "lucide-react";
import { useRecipe, Recipe } from "@/context/RecipeContext";
import { useUnitOfMeasure, UnitOfMeasure } from "@/context/UnitOfMeasureContext";
import { useProfile } from "@/context/ProfileContext";
import { showError, showSuccess } from "@/utils/toast";
import AddEditRecipeDialog from "@/components/recipes/AddEditRecipeDialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

const Recipes: React.FC = () => {
  const { recipes, isLoadingRecipes, deleteRecipe } = useRecipe();
  const { units, isLoadingUnits, addUnit, updateUnit, deleteUnit } = useUnitOfMeasure();
  const { profile, isLoadingProfile } = useProfile();

  const canViewRecipes = profile?.role === 'admin' || profile?.role === 'inventory_manager' || profile?.role === 'viewer';
  const canManageRecipes = profile?.role === 'admin' || profile?.role === 'inventory_manager';

  const [searchTerm, setSearchTerm] = useState("");
  const [isAddEditRecipeDialogOpen, setIsAddEditRecipeDialogOpen] = useState(false);
  const [recipeToEdit, setRecipeToEdit] = useState<Recipe | null>(null);
  const [isConfirmDeleteRecipeDialogOpen, setIsConfirmDeleteRecipeDialogOpen] = useState(false);
  const [recipeToDelete, setRecipeToDelete] = useState<Recipe | null>(null);

  const [isUnitManagementOpen, setIsUnitManagementOpen] = useState(false);
  const [newUnitName, setNewUnitName] = useState("");
  const [newUnitAbbreviation, setNewUnitAbbreviation] = useState("");
  const [newUnitFactor, setNewUnitFactor] = useState("1");
  const [newUnitIsBase, setNewUnitIsBase] = useState(false);
  const [unitToEdit, setUnitToEdit] = useState<UnitOfMeasure | null>(null);
  const [editingUnitName, setEditingUnitName] = useState("");
  const [editingUnitAbbreviation, setEditingUnitAbbreviation] = useState("");
  const [editingUnitFactor, setEditingUnitFactor] = useState("");
  const [editingUnitIsBase, setEditingUnitIsBase] = useState(false);
  const [isConfirmDeleteUnitDialogOpen, setIsConfirmDeleteUnitDialogOpen] = useState(false);
  const [unitToDelete, setUnitToDelete] = useState<UnitOfMeasure | null>(null);

  const filteredRecipes = useMemo(() => {
    if (!searchTerm) return recipes;
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    return recipes.filter(recipe =>
      recipe.name.toLowerCase().includes(lowerCaseSearchTerm) ||
      recipe.description?.toLowerCase().includes(lowerCaseSearchTerm) ||
      recipe.ingredients.some(ing => ing.itemName?.toLowerCase().includes(lowerCaseSearchTerm))
    );
  }, [recipes, searchTerm]);

  const handleAddRecipeClick = () => {
    if (!canManageRecipes) {
      showError("No permission to add recipes.");
      return;
    }
    if (units.length === 0) {
      showError("Please set up at least one Unit of Measure first.");
      return;
    }
    setRecipeToEdit(null);
    setIsAddEditRecipeDialogOpen(true);
  };

  const handleEditRecipeClick = (recipe: Recipe) => {
    if (!canManageRecipes) {
      showError("No permission to edit recipes.");
      return;
    }
    setRecipeToEdit(recipe);
    setIsAddEditRecipeDialogOpen(true);
  };

  const handleDeleteRecipeClick = (recipe: Recipe) => {
    if (!canManageRecipes) {
      showError("No permission to delete recipes.");
      return;
    }
    setRecipeToDelete(recipe);
    setIsConfirmDeleteRecipeDialogOpen(true);
  };

  const confirmDeleteRecipe = async () => {
    if (recipeToDelete) {
      await deleteRecipe(recipeToDelete.id);
    }
    setIsConfirmDeleteRecipeDialogOpen(false);
    setRecipeToDelete(null);
  };

  const handleAddUnit = async () => {
    if (!canManageRecipes) {
      showError("No permission to add units.");
      return;
    }
    const factor = parseFloat(newUnitFactor);
    if (!newUnitName.trim() || !newUnitAbbreviation.trim() || isNaN(factor) || factor <= 0) {
      showError("Fill all unit fields with valid data.");
      return;
    }
    await addUnit({
      name: newUnitName.trim(),
      abbreviation: newUnitAbbreviation.trim(),
      baseUnitFactor: factor,
      isBaseUnit: newUnitIsBase,
    });
    setNewUnitName("");
    setNewUnitAbbreviation("");
    setNewUnitFactor("1");
    setNewUnitIsBase(false);
  };

  const handleEditUnitClick = (unit: UnitOfMeasure) => {
    if (!canManageRecipes) {
      showError("No permission to edit units.");
      return;
    }
    setUnitToEdit(unit);
    setEditingUnitName(unit.name);
    setEditingUnitAbbreviation(unit.abbreviation);
    setEditingUnitFactor(String(unit.baseUnitFactor));
    setEditingUnitIsBase(unit.isBaseUnit);
  };

  const handleSaveEditedUnit = async () => {
    if (!unitToEdit || !canManageRecipes) return;
    const factor = parseFloat(editingUnitFactor);
    if (!editingUnitName.trim() || !editingUnitAbbreviation.trim() || isNaN(factor) || factor <= 0) {
      showError("Fill all unit fields with valid data.");
      return;
    }

    await updateUnit({
      ...unitToEdit,
      name: editingUnitName.trim(),
      abbreviation: editingUnitAbbreviation.trim(),
      baseUnitFactor: factor,
      isBaseUnit: editingUnitIsBase,
    });
    setUnitToEdit(null);
  };

  const handleDeleteUnitClick = (unit: UnitOfMeasure) => {
    if (!canManageRecipes) {
      showError("No permission to delete units.");
      return;
    }
    setUnitToDelete(unit);
    setIsConfirmDeleteUnitDialogOpen(true);
  };

  const confirmDeleteUnit = async () => {
    if (unitToDelete) {
      await deleteUnit(unitToDelete.id);
    }
    setIsConfirmDeleteUnitDialogOpen(false);
    setUnitToDelete(null);
  };

  if (isLoadingProfile || isLoadingRecipes || isLoadingUnits) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading restaurant data...</span>
      </div>
    );
  }

  if (!canViewRecipes) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="p-6 text-center bg-card border-border">
          <CardTitle className="text-2xl font-bold mb-4">Access Denied</CardTitle>
          <CardContent>
            <p className="text-muted-foreground">You do not have permission to view recipes.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Restaurant Inventory Management</h1>
      <p className="text-muted-foreground">Manage recipes (Bill of Materials) and custom units of measure for accurate COGS tracking.</p>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Unit of Measure Management Card */}
        <Card className="bg-card border-border shadow-sm lg:col-span-1">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <Scale className="h-6 w-6 text-accent" /> Units of Measure
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={() => setIsUnitManagementOpen(prev => !prev)} variant="outline" className="w-full" disabled={!canManageRecipes}>
              {isUnitManagementOpen ? "Hide Unit Form" : "Add New Unit"}
            </Button>

            {isUnitManagementOpen && (
              <div className="space-y-3 border p-3 rounded-md bg-muted/20">
                <h4 className="font-semibold">New Unit Definition</h4>
                <Input placeholder="Name (e.g., Gram)" value={newUnitName} onChange={(e) => setNewUnitName(e.target.value)} disabled={!canManageRecipes} />
                <Input placeholder="Abbreviation (e.g., g)" value={newUnitAbbreviation} onChange={(e) => setNewUnitAbbreviation(e.target.value)} disabled={!canManageRecipes} />
                <Input placeholder="Factor (e.g., 0.001 if base is kg)" type="number" step="0.0001" value={newUnitFactor} onChange={(e) => setNewUnitFactor(e.target.value)} disabled={!canManageRecipes} />
                <div className="flex items-center space-x-2">
                  <Switch id="isBaseUnit" checked={newUnitIsBase} onCheckedChange={setNewUnitIsBase} disabled={!canManageRecipes} />
                  <Label htmlFor="isBaseUnit" className="text-sm">Is Base Unit (Factor = 1)</Label>
                </div>
                <Button onClick={handleAddUnit} className="w-full" disabled={!canManageRecipes}>Add Unit</Button>
              </div>
            )}

            <ScrollArea className="h-60 border border-border rounded-md p-3">
              <h4 className="font-semibold mb-2">Existing Units ({units.length})</h4>
              <ul className="space-y-1">
                {units.map(unit => (
                  <li key={unit.id} className="flex items-center justify-between py-1 text-sm">
                    {unitToEdit?.id === unit.id ? (
                      <div className="flex flex-col w-full space-y-1">
                        <Input value={editingUnitName} onChange={(e) => setEditingUnitName(e.target.value)} onBlur={handleSaveEditedUnit} autoFocus disabled={!canManageRecipes} />
                        <Input value={editingUnitAbbreviation} onChange={(e) => setEditingUnitAbbreviation(e.target.value)} onBlur={handleSaveEditedUnit} disabled={!canManageRecipes} />
                        <Input type="number" step="0.0001" value={editingUnitFactor} onChange={(e) => setEditingUnitFactor(e.target.value)} onBlur={handleSaveEditedUnit} disabled={!canManageRecipes} />
                        <div className="flex items-center space-x-2">
                          <Switch id={`isBase-${unit.id}`} checked={editingUnitIsBase} onCheckedChange={setEditingUnitIsBase} disabled={!canManageRecipes} />
                          <Label htmlFor={`isBase-${unit.id}`} className="text-xs">Base Unit</Label>
                        </div>
                        <Button size="sm" onClick={handleSaveEditedUnit} disabled={!canManageRecipes}>Save</Button>
                      </div>
                    ) : (
                      <>
                        <span>{unit.name} ({unit.abbreviation}) - Factor: {unit.baseUnitFactor}</span>
                        <div className="flex items-center space-x-1">
                          {unit.isBaseUnit && <Badge variant="secondary">Base</Badge>}
                          {canManageRecipes && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => handleEditUnitClick(unit)}>
                                <Edit className="h-4 w-4 text-primary" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteUnitClick(unit)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Recipe Management Card */}
        <Card className="bg-card border-border shadow-sm lg:col-span-2 flex flex-col">
          <CardHeader className="pb-4 flex flex-row items-center justify-between">
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <Utensils className="h-6 w-6 text-primary" /> Recipes
            </CardTitle>
            <Button onClick={handleAddRecipeClick} disabled={!canManageRecipes}>
              <PlusCircle className="h-4 w-4 mr-2" /> Create Recipe
            </Button>
          </CardHeader>
          <CardContent className="flex-grow flex flex-col">
            <Input
              placeholder="Search recipes by name or ingredient..."
              className="mb-4"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <ScrollArea className="flex-grow border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipe Name</TableHead>
                    <TableHead>Yield</TableHead>
                    <TableHead>Selling Price</TableHead>
                    <TableHead className="text-center w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecipes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No recipes found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRecipes.map((recipe) => (
                      <TableRow key={recipe.id}>
                        <TableCell className="font-medium">{recipe.name}</TableCell>
                        <TableCell>{recipe.yieldQuantity} {recipe.yieldUnitAbbreviation}</TableCell>
                        <TableCell>${recipe.sellingPrice.toFixed(2)}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center space-x-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEditRecipeClick(recipe)} disabled={!canManageRecipes}>
                              <Edit className="h-4 w-4 text-primary" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteRecipeClick(recipe)} disabled={!canManageRecipes}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <AddEditRecipeDialog
        isOpen={isAddEditRecipeDialogOpen}
        onClose={() => setIsAddEditRecipeDialogOpen(false)}
        recipeToEdit={recipeToEdit}
      />

      {recipeToDelete && (
        <ConfirmDialog
          isOpen={isConfirmDeleteRecipeDialogOpen}
          onClose={() => setIsConfirmDeleteRecipeDialogOpen(false)}
          onConfirm={confirmDeleteRecipe}
          title="Confirm Recipe Deletion"
          description={`Are you sure you want to delete the recipe "${recipeToDelete.name}"? This action cannot be undone.`}
          confirmText="Delete Recipe"
          cancelText="Cancel"
        />
      )}

      {unitToDelete && (
        <ConfirmDialog
          isOpen={isConfirmDeleteUnitDialogOpen}
          onClose={() => setIsConfirmDeleteUnitDialogOpen(false)}
          onConfirm={confirmDeleteUnit}
          title="Confirm Unit Deletion"
          description={
            <div>
              <p>Are you sure you want to delete the unit of measure "{unitToDelete.name}"?</p>
              <p className="text-destructive font-semibold mt-2">
                This unit may be referenced by existing recipes or inventory items. Deleting it may cause data inconsistencies.
              </p>
            </div>
          }
          confirmText="Delete Unit"
          cancelText="Cancel"
        />
      )}
    </div>
  );
};

export default Recipes;