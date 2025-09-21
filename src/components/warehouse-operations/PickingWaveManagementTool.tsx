import React, { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Truck, Printer, Package, CheckCircle, ListOrdered } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { useOrders, OrderItem } from "@/context/OrdersContext";
import { useInventory } from "@/context/InventoryContext";
import { useOnboarding } from "@/context/OnboardingContext";
import { usePrint } from "@/context/PrintContext";
import { format } from "date-fns";
import { generateSequentialNumber } from "@/utils/numberGenerator";
import { useProfile, UserProfile } from "@/context/ProfileContext"; // NEW: Import useProfile

interface PickListItem {
  itemName: string;
  itemSku: string;
  pickingBinFolderId: string; // Changed from pickingBinLocation to pickingBinFolderId
  quantityToPick: number;
}

const PickingWaveManagementTool: React.FC = () => {
  const { orders, updateOrder } = useOrders();
  const { inventoryItems } = useInventory();
  const { companyProfile, inventoryFolders } = useOnboarding(); // Added inventoryFolders
  const { initiatePrint } = usePrint();
  const { profile } = useProfile(); // NEW: Import useProfile

  // NEW: Role-based permissions
  const canManagePickingWaves = profile?.role === 'admin' || profile?.role === 'inventory_manager';

  const [selectedDeliveryRoute, setSelectedDeliveryRoute] = useState("all");
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [generatedPickList, setGeneratedPickList] = useState<PickListItem[]>([]);
  const [currentWaveId, setCurrentWaveId] = useState<string | null>(null);

  const availableDeliveryRoutes = useMemo(() => {
    const routes = new Set<string>();
    orders.forEach(order => {
      if (order.type === "Sales" && order.status === "New Order" && order.deliveryRoute) {
        routes.add(order.deliveryRoute);
      }
    });
    return ["all", ...Array.from(routes).sort()];
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesRoute = selectedDeliveryRoute === "all" || order.deliveryRoute === selectedDeliveryRoute;
      const isSalesOrder = order.type === "Sales";
      const isNewOrder = order.status === "New Order";
      return matchesRoute && isSalesOrder && isNewOrder;
    });
  }, [orders, selectedDeliveryRoute]);

  useEffect(() => {
    // Clear selected orders when route filter changes
    setSelectedOrderIds(new Set<string>());
    setGeneratedPickList([]);
    setCurrentWaveId(null);
  }, [selectedDeliveryRoute]);

  // Helper to get folder name from ID
  const getFolderName = (folderId: string) => {
    const folder = inventoryFolders.find(f => f.id === folderId);
    return folder?.name || "Unknown Folder";
  };

  const handleCreatePickingWave = () => {
    if (!canManagePickingWaves) { // NEW: Check permission before creating wave
      showError("You do not have permission to create picking waves.");
      return;
    }
    if (selectedOrderIds.size === 0) {
      showError("Please select at least one order to create a picking wave.");
      return;
    }

    const ordersToBatch = Array.from(selectedOrderIds).map(id => orders.find(o => o.id === id)).filter(Boolean) as OrderItem[];

    const pickListItemsMap = new Map<string, PickListItem>(); // Key: itemSku

    ordersToBatch.forEach(order => {
      order.items.forEach(orderItem => {
        const inventoryItem = inventoryItems.find(inv => inv.id === orderItem.inventoryItemId);
        if (inventoryItem) {
          const key = inventoryItem.sku;
          if (pickListItemsMap.has(key)) {
            const existing = pickListItemsMap.get(key)!;
            existing.quantityToPick += orderItem.quantity;
            pickListItemsMap.set(key, existing);
          } else {
            pickListItemsMap.set(key, {
              itemName: inventoryItem.name,
              itemSku: inventoryItem.sku,
              pickingBinFolderId: inventoryItem.pickingBinFolderId, // Updated to pickingBinFolderId
              quantityToPick: orderItem.quantity,
            });
          }
        } else {
          console.warn(`Inventory item not found for order item: ${orderItem.itemName}`);
        }
      });
    });

    // Sort pick list items by picking bin folder for efficient path
    const sortedPickList = Array.from(pickListItemsMap.values()).sort((a, b) =>
      getFolderName(a.pickingBinFolderId).localeCompare(getFolderName(b.pickingBinFolderId)) // Sort by folder name
    );

    setGeneratedPickList(sortedPickList);
    const newWaveId = generateSequentialNumber("WAVE");
    setCurrentWaveId(newWaveId);

    // Update status of batched orders to "Processing"
    ordersToBatch.forEach(order => {
      updateOrder({ ...order, status: "Processing" });
    });

    showSuccess(`Picking Wave ${newWaveId} created for ${selectedOrderIds.size} orders.`);
  };

  const handlePrintPickList = () => {
    if (!canManagePickingWaves) { // NEW: Check permission before printing
      showError("You do not have permission to print picking lists.");
      return;
    }
    if (!currentWaveId || generatedPickList.length === 0) {
      showError("No picking wave generated to print.");
      return;
    }
    if (!companyProfile) {
      showError("Company profile not set up. Please complete onboarding or set company details in settings.");
      return;
    }

    const ordersInWaveDetails = Array.from(selectedOrderIds).map(id => {
      const order = orders.find(o => o.id === id);
      return order ? { id: order.id, customerSupplier: order.customerSupplier, deliveryRoute: order.deliveryRoute } : null;
    }).filter(Boolean) as { id: string; customerSupplier: string; deliveryRoute?: string }[];

    const pdfProps = {
      companyName: companyProfile.companyName,
      companyAddress: companyProfile.companyAddress,
      companyContact: companyProfile.companyCurrency,
      companyLogoUrl: companyProfile.companyLogoUrl || undefined,
      waveId: currentWaveId,
      pickDate: format(new Date(), "MMM dd, yyyy"),
      ordersInWave: ordersInWaveDetails,
      pickListItems: generatedPickList,
      pickerName: profile?.fullName || "N/A", // Use current user's full name
      inventoryFolders: inventoryFolders, // Pass inventoryFolders
    };

    initiatePrint({ type: "picking-wave", props: pdfProps });
    showSuccess("Picking wave pick list sent to printer!");
  };

  const handleOrderSelection = (orderId: string, checked: boolean) => {
    if (!canManagePickingWaves) { // NEW: Check permission before selecting order
      showError("You do not have permission to select orders for picking waves.");
      return;
    }
    setSelectedOrderIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(orderId);
      } else {
        newSet.delete(orderId);
      }
      return newSet;
    });
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <h2 className="text-xl font-bold text-center">Picking Wave Management</h2>

      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" /> Select Orders for Wave
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="deliveryRouteFilter" className="font-semibold">Filter by Delivery Route</Label>
            <Select value={selectedDeliveryRoute} onValueChange={setSelectedDeliveryRoute} disabled={!canManagePickingWaves}> {/* NEW: Disable if no permission */}
              <SelectTrigger id="deliveryRouteFilter">
                <SelectValue placeholder="All Routes" />
              </SelectTrigger>
              <SelectContent>
                {availableDeliveryRoutes.map(route => (
                  <SelectItem key={route} value={route}>
                    {route === "all" ? "All Routes" : route}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="font-semibold">Available Sales Orders</Label>
            <ScrollArea className="h-40 border border-border rounded-md p-3 bg-muted/20">
              {filteredOrders.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-4">No new sales orders for this route.</p>
              ) : (
                <div className="space-y-2">
                  {filteredOrders.map(order => (
                    <div key={order.id} className="flex items-center justify-between py-1">
                      <Label htmlFor={`order-${order.id}`} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          id={`order-${order.id}`}
                          checked={selectedOrderIds.has(order.id)}
                          onCheckedChange={(checked: boolean) => handleOrderSelection(order.id, checked)}
                          disabled={!canManagePickingWaves} // NEW: Disable checkbox if no permission
                        />
                        <span>{order.id} - {order.customerSupplier} (Route: {order.deliveryRoute || 'N/A'})</span>
                      </Label>
                      <span className="text-sm text-muted-foreground">${order.totalAmount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
          <Button onClick={handleCreatePickingWave} className="w-full" disabled={selectedOrderIds.size === 0 || !canManagePickingWaves}> {/* NEW: Disable if no permission */}
            <ListOrdered className="h-4 w-4 mr-2" /> Create Picking Wave ({selectedOrderIds.size} Orders)
          </Button>
        </CardContent>
      </Card>

      {generatedPickList.length > 0 && (
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Package className="h-5 w-5 text-accent" /> Picking Wave {currentWaveId}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <p className="text-muted-foreground text-sm">
              Consolidated pick list, sequenced by folder for efficiency.
            </p>
            <ScrollArea className="h-60 border border-border rounded-md p-3 bg-muted/20">
              <div className="space-y-2">
                {generatedPickList.map((item, index) => (
                  <div key={index} className="flex justify-between items-center py-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-primary">{getFolderName(item.pickingBinFolderId)}</span>
                      <span>{item.itemName} (SKU: {item.itemSku})</span>
                    </div>
                    <span className="font-bold">{item.quantityToPick} units</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <Button onClick={handlePrintPickList} className="w-full" disabled={!canManagePickingWaves}> {/* NEW: Disable if no permission */}
              <Printer className="h-4 w-4 mr-2" /> Print Pick List
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => { setSelectedOrderIds(new Set<string>()); setGeneratedPickList([]); setCurrentWaveId(null); showSuccess("Picking wave cleared."); }} disabled={!canManagePickingWaves}> {/* NEW: Disable if no permission */}
              <CheckCircle className="h-4 w-4 mr-2" /> Complete Wave (Clear)
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PickingWaveManagementTool;