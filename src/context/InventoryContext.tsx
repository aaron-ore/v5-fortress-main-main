"use client";

import React,
{
  createContext,
  useState,
  useContext,
  ReactNode,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { supabase } from "@/lib/supabaseClient";
import { showError, showSuccess } from "@/utils/toast";
import { useProfile } from "./ProfileContext";
import { useOrders } from "./OrdersContext";
import { useVendors } from "./VendorContext";
import { processAutoReorder } from "@/utils/autoReorderLogic";
import { useNotifications } from "./NotificationContext";
import { parseAndValidateDate } from "@/utils/dateUtils";

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  sku: string;
  category: string;
  // NEW: Split quantity into pickingBinQuantity and overstockQuantity
  pickingBinQuantity: number;
  overstockQuantity: number;
  // Derived total quantity
  quantity: number;
  reorderLevel: number; // This will now be the overall reorder level
  pickingReorderLevel: number; // NEW: Reorder level specifically for picking bins
  committedStock: number;
  incomingStock: number;
  unitCost: number;
  retailPrice: number;
  location: string; // Overall primary storage location (fullLocationString)
  pickingBinLocation: string; // NEW: Specific location for picking bin (fullLocationString)
  status: string;
  lastUpdated: string;
  imageUrl?: string;
  vendorId?: string;
  barcodeUrl?: string;
  organizationId: string | null;
  autoReorderEnabled: boolean;
  autoReorderQuantity: number;
}

interface InventoryContextType {
  inventoryItems: InventoryItem[];
  isLoadingInventory: boolean;
  addInventoryItem: (item: Omit<InventoryItem, "id" | "status" | "lastUpdated" | "organizationId" | "quantity">) => Promise<void>;
  updateInventoryItem: (updatedItem: Omit<InventoryItem, "quantity"> & { id: string }) => Promise<void>;
  deleteInventoryItem: (itemId: string) => Promise<void>;
  refreshInventory: () => Promise<void>;
}

const InventoryContext = createContext<InventoryContextType | undefined>(
  undefined,
);

export const InventoryProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [isLoadingInventory, setIsLoadingInventory] = useState(true);
  const { profile, isLoadingProfile } = useProfile();
  const { addOrder } = useOrders();
  const { vendors } = useVendors();
  const { addNotification } = useNotifications();

  // NEW: Ref to track if the initial load is complete
  const isInitialLoadComplete = useRef(false);

  const mapSupabaseItemToInventoryItem = (item: any): InventoryItem => {
    const pickingBinQuantity = parseInt(item.picking_bin_quantity || '0');
    const overstockQuantity = parseInt(item.overstock_quantity || '0');
    const reorderLevel = parseInt(item.reorder_level || '0');
    const pickingReorderLevel = parseInt(item.picking_reorder_level || '0');
    const committedStock = parseInt(item.committed_stock || '0');
    const incomingStock = parseInt(item.incoming_stock || '0');
    const unitCost = parseFloat(item.unit_cost || '0');
    const retailPrice = parseFloat(item.retail_price || '0');
    const autoReorderQuantity = parseInt(item.auto_reorder_quantity || '0');

    const validatedLastUpdated = parseAndValidateDate(item.last_updated);
    const lastUpdatedString = validatedLastUpdated ? validatedLastUpdated.toISOString() : new Date().toISOString();

    return {
      id: item.id,
      name: item.name || "",
      description: item.description || "",
      sku: item.sku || "",
      category: item.category || "",
      pickingBinQuantity: isNaN(pickingBinQuantity) ? 0 : pickingBinQuantity,
      overstockQuantity: isNaN(overstockQuantity) ? 0 : overstockQuantity,
      quantity: (isNaN(pickingBinQuantity) ? 0 : pickingBinQuantity) + (isNaN(overstockQuantity) ? 0 : overstockQuantity),
      reorderLevel: isNaN(reorderLevel) ? 0 : reorderLevel,
      pickingReorderLevel: isNaN(pickingReorderLevel) ? 0 : pickingReorderLevel,
      committedStock: isNaN(committedStock) ? 0 : committedStock,
      incomingStock: isNaN(incomingStock) ? 0 : incomingStock,
      unitCost: isNaN(unitCost) ? 0 : unitCost,
      retailPrice: isNaN(retailPrice) ? 0 : retailPrice,
      location: item.location || "",
      pickingBinLocation: item.picking_bin_location || item.location || "",
      status: item.status || "In Stock",
      lastUpdated: lastUpdatedString,
      imageUrl: item.image_url || undefined,
      vendorId: item.vendor_id || undefined,
      barcodeUrl: item.barcode_url || undefined,
      organizationId: item.organization_id,
      autoReorderEnabled: item.auto_reorder_enabled || false,
      autoReorderQuantity: isNaN(autoReorderQuantity) ? 0 : autoReorderQuantity,
    };
  };

  const fetchInventoryItems = useCallback(async (): Promise<InventoryItem[]> => {
    // Only set loading to true if it's the initial load
    if (!isInitialLoadComplete.current) {
      setIsLoadingInventory(true);
    }
    const { data: { session } } = await supabase.auth.getSession();

    if (!session || !profile?.organizationId) {
      setInventoryItems([]);
      setIsLoadingInventory(false);
      isInitialLoadComplete.current = true; // Mark initial load complete even if no data
      return [];
    }

    const { data, error } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("organization_id", profile.organizationId);

    if (error) {
      console.error("Error fetching inventory items:", error);
      setInventoryItems([]);
      showError("Failed to load inventory items.");
      setIsLoadingInventory(false);
      isInitialLoadComplete.current = true; // Mark initial load complete on error
      return [];
    } else {
      const fetchedItems: InventoryItem[] = data.map(mapSupabaseItemToInventoryItem);
      setInventoryItems(fetchedItems);
      setIsLoadingInventory(false);
      isInitialLoadComplete.current = true; // Mark initial load complete on success
      return fetchedItems;
    }
  }, [profile?.organizationId]);

  // Effect for initial data fetch
  useEffect(() => {
    if (!isLoadingProfile && profile?.organizationId) {
      fetchInventoryItems();
    } else if (!isLoadingProfile && !profile?.organizationId) {
      setInventoryItems([]);
      setIsLoadingInventory(false);
      isInitialLoadComplete.current = true; // Ensure initial load is marked complete
    }
  }, [fetchInventoryItems, isLoadingProfile, profile?.organizationId]);

  // Realtime subscription for inventory items
  useEffect(() => {
    if (!profile?.organizationId) return;

    console.log(`[InventoryContext] Subscribing to real-time changes for organization: ${profile.organizationId}`);

    const channel = supabase
      .channel(`inventory_items_org_${profile.organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory_items',
          filter: `organization_id=eq.${profile.organizationId}`,
        },
        (payload) => {
          console.log('[InventoryContext] Realtime change received:', payload);
          setInventoryItems(prevItems => {
            const newItem = mapSupabaseItemToInventoryItem(payload.new || payload.old);
            switch (payload.eventType) {
              case 'INSERT':
                if (!prevItems.some(item => item.id === newItem.id)) {
                  return [...prevItems, newItem];
                }
                return prevItems;
              case 'UPDATE':
                return prevItems.map(item => item.id === newItem.id ? newItem : item);
              case 'DELETE':
                return prevItems.filter(item => item.id !== newItem.id);
              default:
                return prevItems;
            }
          });
        }
      )
      .subscribe();

    return () => {
      console.log(`[InventoryContext] Unsubscribing from real-time changes for organization: ${profile.organizationId}`);
      supabase.removeChannel(channel);
    };
  }, [profile?.organizationId]);

  // Effect to trigger auto-reorder logic when inventory or vendors change
  useEffect(() => {
    // Only run auto-reorder logic if initial load is complete, and there's an organization
    if (isInitialLoadComplete.current && profile?.organizationId && inventoryItems.length > 0) {
      console.log("[InventoryContext] Triggering auto-reorder check due to inventory/vendor/profile change.");
      processAutoReorder(inventoryItems, addOrder, vendors, profile.organizationId, addNotification);
    }
  }, [inventoryItems, vendors, profile?.organizationId, addOrder, addNotification]); // Removed isLoadingInventory from dependencies

  const addInventoryItem = async (item: Omit<InventoryItem, "id" | "status" | "lastUpdated" | "organizationId" | "quantity">) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !profile?.organizationId) {
      throw new Error("You must be logged in and have an organization ID to add inventory items.");
    }

    const totalQuantity = item.pickingBinQuantity + item.overstockQuantity;
    const status = totalQuantity > item.reorderLevel ? "In Stock" : (totalQuantity > 0 ? "Low Stock" : "Out of Stock");
    const lastUpdated = new Date().toISOString();

    const { data, error } = await supabase
      .from("inventory_items")
      .insert({
        name: item.name,
        description: item.description,
        sku: item.sku,
        category: item.category,
        picking_bin_quantity: item.pickingBinQuantity,
        overstock_quantity: item.overstockQuantity,
        reorder_level: item.reorderLevel,
        picking_reorder_level: item.pickingReorderLevel,
        committed_stock: 0,
        incoming_stock: 0,
        unit_cost: item.unitCost,
        retail_price: item.retailPrice,
        location: item.location,
        picking_bin_location: item.pickingBinLocation,
        status: status,
        last_updated: lastUpdated,
        image_url: item.imageUrl,
        vendor_id: item.vendorId,
        barcode_url: item.barcodeUrl,
        user_id: session.user.id,
        organization_id: profile.organizationId,
        auto_reorder_enabled: item.autoReorderEnabled,
        auto_reorder_quantity: item.autoReorderQuantity,
      })
      .select();

    if (error) {
      console.error("Error adding inventory item:", error);
      throw new Error(error.message || 'Failed to add item: Unknown error.'); // Ensure string message
    } else if (data && data.length > 0) {
      showSuccess(`Added new inventory item: ${data[0].name} (SKU: ${data[0].sku}).`);
    } else {
      const errorMessage = "Failed to add item: No data returned after insert.";
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const updateInventoryItem = async (updatedItem: Omit<InventoryItem, "quantity"> & { id: string }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !profile?.organizationId) {
      throw new Error("You must be logged in and have an organization ID to update inventory items.");
    }

    const totalQuantity = updatedItem.pickingBinQuantity + updatedItem.overstockQuantity;
    const newStatus = totalQuantity > updatedItem.reorderLevel ? "In Stock" : (totalQuantity > 0 ? "Low Stock" : "Out of Stock");
    const lastUpdated = new Date().toISOString();

    const { data, error } = await supabase
      .from("inventory_items")
      .update({
        name: updatedItem.name,
        description: updatedItem.description,
        sku: updatedItem.sku,
        category: updatedItem.category,
        picking_bin_quantity: updatedItem.pickingBinQuantity,
        overstock_quantity: updatedItem.overstockQuantity,
        reorder_level: updatedItem.reorderLevel,
        picking_reorder_level: updatedItem.pickingReorderLevel,
        committed_stock: updatedItem.committedStock,
        incoming_stock: updatedItem.incomingStock,
        unit_cost: updatedItem.unitCost,
        retail_price: updatedItem.retailPrice,
        location: updatedItem.location,
        picking_bin_location: updatedItem.pickingBinLocation,
        status: newStatus,
        last_updated: lastUpdated,
        image_url: updatedItem.imageUrl,
        vendor_id: updatedItem.vendorId,
        barcode_url: updatedItem.barcodeUrl,
        auto_reorder_enabled: updatedItem.autoReorderEnabled,
        auto_reorder_quantity: updatedItem.autoReorderQuantity,
      })
      .eq("id", updatedItem.id)
      .eq("organization_id", profile.organizationId)
      .select();

    if (error) {
      console.error("Error updating inventory item:", error);
      throw new Error(error.message || 'Failed to update item: Unknown error.'); // Ensure string message
    } else if (data && data.length > 0) {
      showSuccess(`Updated inventory item: ${data[0].name} (SKU: ${data[0].sku}).`);
    } else {
      const errorMessage = "Update might not have been saved. Check database permissions.";
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const deleteInventoryItem = async (itemId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !profile?.organizationId) {
      showError("You must be logged in and have an organization ID to delete inventory items.");
      return;
    }

    const itemToDelete = inventoryItems.find(item => item.id === itemId);

    const { error } = await supabase
      .from("inventory_items")
      .delete()
      .eq("id", itemId)
      .eq("organization_id", profile.organizationId);

    if (error) {
      console.error("Error deleting inventory item:", error);
      throw new Error(error.message || 'Failed to delete item: Unknown error.'); // Ensure string message
    } else {
      showSuccess("Item deleted successfully!");
    }
  };

  const refreshInventory = async () => {
    await fetchInventoryItems();
  };

  return (
    <InventoryContext.Provider
      value={{ inventoryItems, isLoadingInventory, addInventoryItem, updateInventoryItem, deleteInventoryItem, refreshInventory }}
    >
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (context === undefined) {
    throw new Error("useInventory must be used within an InventoryProvider");
  }
  return context;
};