"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { List, LayoutGrid, Folder, Loader2, AlertTriangle } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { useInventory, InventoryItem } from "@/context/InventoryContext";
import { useOnboarding } from "@/context/OnboardingContext";
import { createInventoryColumns } from "@/pages/Inventory"; // Reusing columns from Inventory page
import InventoryCardGrid from "@/components/inventory/InventoryCardGrid";
import InventoryItemQuickViewDialog from "@/components/InventoryItemQuickViewDialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useSidebar } from "@/context/SidebarContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { showError } from "@/utils/toast";

const FolderContentPage: React.FC = () => {
  const { folderId } = useParams<{ folderId: string }>();
  const navigate = useNavigate();
  const { inventoryItems, deleteInventoryItem, isLoadingInventory, refreshInventory } = useInventory();
  const { inventoryFolders, isLoadingProfile } = useOnboarding(); // isLoadingProfile is used to check if folders are loaded
  const { isCollapsed } = useSidebar();

  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "card">("table");

  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);

  const [isQuickViewDialogOpen, setIsQuickViewDialogOpen] = useState(false);
  const [selectedItemForQuickView, setSelectedItemForQuickView] = useState<InventoryItem | null>(null);

  const currentFolder = useMemo(() => {
    if (isLoadingProfile) return null;
    return inventoryFolders.find(folder => folder.id === folderId);
  }, [folderId, inventoryFolders, isLoadingProfile]);

  const itemsInFolder = useMemo(() => {
    return inventoryItems.filter(item => item.folderId === folderId);
  }, [inventoryItems, folderId]);

  const filteredItems = useMemo(() => {
    if (!searchTerm) {
      return itemsInFolder;
    }
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    return itemsInFolder.filter(item =>
      item.name.toLowerCase().includes(lowerCaseSearchTerm) ||
      item.sku.toLowerCase().includes(lowerCaseSearchTerm) ||
      item.description.toLowerCase().includes(lowerCaseSearchTerm)
    );
  }, [itemsInFolder, searchTerm]);

  const handleQuickView = useCallback((item: InventoryItem) => {
    setSelectedItemForQuickView(item);
    setIsQuickViewDialogOpen(true);
  }, []);

  const handleDeleteItemClick = useCallback((itemId: string, itemName: string) => {
    setItemToDelete({ id: itemId, name: itemName });
    setIsConfirmDeleteDialogOpen(true);
  }, []);

  const confirmDeleteItem = async () => {
    if (itemToDelete) {
      await deleteInventoryItem(itemToDelete.id);
      refreshInventory(); // Refresh to update the list after deletion
    }
    setIsConfirmDeleteDialogOpen(false);
    setItemToDelete(null);
  };

  const handleCreateOrder = useCallback((item: InventoryItem) => {
    // Placeholder for creating an order from this item
    showError(`Create order for ${item.name} (feature not implemented yet)`);
  }, []);

  const columnsForDataTable = useMemo(() => createInventoryColumns(handleQuickView, inventoryFolders), [handleQuickView, inventoryFolders]);

  if (isLoadingInventory || isLoadingProfile) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading folder contents...</span>
      </div>
    );
  }

  if (!currentFolder) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-destructive">
        <AlertTriangle className="h-16 w-16 mb-4" />
        <p className="text-lg">Folder not found.</p>
        <Button onClick={() => navigate("/folders")} className="mt-4">Back to Folders</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-6 flex-grow">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Folder className="h-8 w-8 text-primary" /> {currentFolder.name}
        </h1>
        <Button variant="outline" onClick={() => navigate("/folders")}>
          Back to All Folders
        </Button>
      </div>

      <p className="text-muted-foreground">
        Viewing inventory items within the "{currentFolder.name}" folder.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder={`Search items in ${currentFolder.name}...`}
          className="flex-grow max-w-xs"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div className="flex items-center ml-auto space-x-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={viewMode === "table" ? "secondary" : "outline"}
                size="icon"
                onClick={() => setViewMode("table")}
              >
                <List className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Table View</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={viewMode === "card" ? "secondary" : "outline"}
                size="icon"
                onClick={() => setViewMode("card")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Card View</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <Card className="flex-grow rounded-md border flex flex-col">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-semibold">Items in Folder ({filteredItems.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow overflow-y-auto">
          {filteredItems.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No inventory items found in this folder.</p>
          ) : (
            <>
              {viewMode === "table" && (
                <DataTable columns={columnsForDataTable} data={filteredItems} />
              )}
              {viewMode === "card" && (
                <InventoryCardGrid
                  items={filteredItems}
                  onAdjustStock={handleQuickView}
                  onCreateOrder={handleCreateOrder}
                  onViewDetails={handleQuickView}
                  onDeleteItem={handleDeleteItemClick}
                  isSidebarCollapsed={isCollapsed}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      {itemToDelete && (
        <ConfirmDialog
          isOpen={isConfirmDeleteDialogOpen}
          onClose={() => setIsConfirmDeleteDialogOpen(false)}
          onConfirm={confirmDeleteItem}
          title="Confirm Item Deletion"
          description={`Are you sure you want to delete "${itemToDelete.name}" (SKU: ${itemToDelete.id})? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
        />
      )}
      <InventoryItemQuickViewDialog
        isOpen={isQuickViewDialogOpen}
        onClose={() => setIsQuickViewDialogOpen(false)}
        item={selectedItemForQuickView}
      />
    </div>
  );
};

export default FolderContentPage;