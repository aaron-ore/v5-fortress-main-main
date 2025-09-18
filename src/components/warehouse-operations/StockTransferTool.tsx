import React, { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Truck, Package, ArrowRight, Barcode } from "lucide-react";
import { useInventory } from "@/context/InventoryContext";
import { useOnboarding } from "@/context/OnboardingContext"; // Now imports InventoryFolder
import { useStockMovement } from "@/context/StockMovementContext";
import { showError, showSuccess } from "@/utils/toast";
import { useProfile } from "@/context/ProfileContext"; // NEW: Import useProfile

interface StockTransferToolProps {
  onScanRequest: (callback: (scannedData: string) => void) => void;
  scannedDataFromGlobal?: string | null;
  onScannedDataProcessed: () => void;
}

const StockTransferTool: React.FC<StockTransferToolProps> = ({ onScanRequest, scannedDataFromGlobal, onScannedDataProcessed }) => {
  const { inventoryItems, updateInventoryItem, refreshInventory } = useInventory();
  const { inventoryFolders } = useOnboarding(); // Renamed from locations
  const { addStockMovement } = useStockMovement();
  const { profile } = useProfile(); // NEW: Import useProfile

  // NEW: Role-based permissions
  const canTransferStock = profile?.role === 'admin' || profile?.role === 'inventory_manager';

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [fromFolderId, setFromFolderId] = useState(""); // Changed from fromLocation to fromFolderId
  const [toFolderId, setToFolderId] = useState(""); // Changed from toLocation to toFolderId
  const [transferQuantity, setTransferQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [isScanning, setIsScanning] = useState(false);

  const selectedItem = useMemo(() => {
    return inventoryItems.find(item => item.id === selectedItemId);
  }, [inventoryItems, selectedItemId]);

  const filteredItems = useMemo(() => {
    if (!searchTerm) return inventoryItems;
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    return inventoryItems.filter(
      (item) =>
        item.name.toLowerCase().includes(lowerCaseSearchTerm) ||
        item.sku.toLowerCase().includes(lowerCaseSearchTerm)
    );
  }, [inventoryItems, searchTerm]);

  // Helper to get folder name from ID
  const getFolderName = (folderId: string) => {
    const folder = inventoryFolders.find(f => f.id === folderId);
    return folder?.name || "Unknown Folder";
  };

  // Reset form when item changes or component mounts
  useEffect(() => {
    if (selectedItem) {
      setFromFolderId(selectedItem.folderId); // Use item's current folderId
      setTransferQuantity("");
      setNotes("");
      setToFolderId(""); // Reset toFolderId when item changes
    } else {
      setFromFolderId("");
      setTransferQuantity("");
      setNotes("");
      setToFolderId("");
    }
  }, [selectedItem]);

  useEffect(() => {
    if (scannedDataFromGlobal && !isScanning) {
      handleScannedBarcode(scannedDataFromGlobal);
      onScannedDataProcessed();
    }
  }, [scannedDataFromGlobal, isScanning, onScannedDataProcessed]);

  const handleItemSelect = (itemId: string) => {
    if (!canTransferStock) { // NEW: Check permission before selecting item
      showError("You do not have permission to transfer stock.");
      return;
    }
    setSelectedItemId(itemId);
    setSearchTerm(inventoryItems.find(item => item.id === itemId)?.name || "");
  };

  const handleScannedBarcode = (scannedData: string) => {
    setIsScanning(false);
    if (!canTransferStock) { // NEW: Check permission before scanning
      showError("You do not have permission to transfer stock.");
      return;
    }
    const lowerCaseScannedData = scannedData.toLowerCase();
    const foundItem = inventoryItems.find(
      (item) =>
        item.sku.toLowerCase() === lowerCaseScannedData ||
        (item.barcodeUrl && item.barcodeUrl.toLowerCase().includes(lowerCaseScannedData))
    );

    if (foundItem) {
      handleItemSelect(foundItem.id);
      showSuccess(`Scanned item: ${foundItem.name}.`);
    } else {
      showError(`No item found with SKU/Barcode: "${scannedData}".`);
    }
  };

  const handleScanClick = () => {
    if (!canTransferStock) { // NEW: Check permission before scanning
      showError("You do not have permission to transfer stock.");
      return;
    }
    setIsScanning(true);
    onScanRequest(handleScannedBarcode);
  };

  const handleSubmitTransfer = async () => {
    if (!canTransferStock) { // NEW: Check permission before submitting transfer
      showError("You do not have permission to transfer stock.");
      return;
    }
    if (!selectedItem || !fromFolderId || !toFolderId || !transferQuantity) {
      showError("Please fill in all required fields.");
      return;
    }
    if (fromFolderId === toFolderId) {
      showError("Source and destination folders cannot be the same.");
      return;
    }

    const quantity = parseInt(transferQuantity);
    if (isNaN(quantity) || quantity <= 0) {
      showError("Please enter a valid positive quantity to transfer.");
      return;
    }
    if (selectedItem.quantity < quantity) {
      showError(`Not enough stock at ${getFolderName(fromFolderId)}. Available: ${selectedItem.quantity}`);
      return;
    }

    const oldQuantity = selectedItem.quantity;
    const newQuantity = selectedItem.quantity - quantity; // Deduct from source
    const updatedItem = {
      ...selectedItem,
      quantity: newQuantity, // Update quantity at the source (conceptually, the item is moving)
      folderId: toFolderId, // Update the item's primary folder to the destination
      lastUpdated: new Date().toISOString().split('T')[0],
    };

    try {
      await updateInventoryItem(updatedItem);

      // Log stock movement for the transfer
      await addStockMovement({
        itemId: selectedItem.id,
        itemName: selectedItem.name,
        type: "subtract", // Log as subtract from old folder
        amount: quantity,
        oldQuantity: oldQuantity,
        newQuantity: newQuantity,
        reason: `Transferred from ${getFolderName(fromFolderId)} to ${getFolderName(toFolderId)}`,
        folderId: fromFolderId, // Log the folder from which it was transferred
      });

      showSuccess(`Transferred ${quantity} units of ${selectedItem.name} from ${getFolderName(fromFolderId)} to ${getFolderName(toFolderId)}.`);
      refreshInventory(); // Ensure inventory context is refreshed
      // Reset form
      setSearchTerm("");
      setSelectedItemId("");
      setFromFolderId("");
      setToFolderId("");
      setTransferQuantity("");
      setNotes("");
    } catch (error: any) {
      showError(`Failed to transfer stock: ${error.message}`);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <h2 className="text-xl font-bold text-center">Stock Transfer</h2>

      {/* Item Selection */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" /> Select Item
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <Label htmlFor="itemSearch" className="font-semibold">Search Item</Label>
          <Input
            id="itemSearch"
            placeholder="Name or SKU"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={!canTransferStock} // NEW: Disable input if no permission
          />
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-lg py-3 flex items-center justify-center gap-2"
            onClick={handleScanClick}
            disabled={isScanning || !canTransferStock} // NEW: Disable button if no permission
          >
            <Barcode className="h-6 w-6" />
            {isScanning ? "Scanning..." : "Scan Item"}
          </Button>
          <ScrollArea className="h-32 border border-border rounded-md">
            <div className="p-2 space-y-1">
              {filteredItems.length > 0 ? (
                filteredItems.map(item => (
                  <Button
                    key={item.id}
                    variant={selectedItemId === item.id ? "secondary" : "ghost"}
                    className="w-full justify-start text-sm"
                    onClick={() => handleItemSelect(item.id)}
                    disabled={!canTransferStock} // NEW: Disable button if no permission
                  >
                    {item.name} (SKU: {item.sku}) - Qty: {item.quantity}
                  </Button>
                ))
              ) : (
                <p className="text-center text-muted-foreground text-sm py-4">No items found.</p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Transfer Details */}
      {selectedItem && (
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Truck className="h-5 w-5 text-accent" /> Transfer Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fromFolderId" className="font-semibold">From Folder</Label> {/* Updated label */}
              <Input id="fromFolderId" value={getFolderName(fromFolderId)} disabled /> {/* Display folder name */}
            </div>
            <div className="space-y-2">
              <Label htmlFor="toFolderId">To Folder</Label> {/* Updated label */}
              <Select value={toFolderId} onValueChange={setToFolderId} disabled={!canTransferStock}> {/* NEW: Disable if no permission */}
                <SelectTrigger id="toFolderId">
                  <SelectValue placeholder="Select destination folder" /> {/* Updated placeholder */}
                </SelectTrigger>
                <SelectContent>
                  {inventoryFolders.filter(folder => folder.id !== fromFolderId).map(folder => ( // Filter by folderId
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name} {/* Display folder name */}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="transferQuantity" className="font-semibold">Quantity to Transfer</Label>
              <Input
                id="transferQuantity"
                type="number"
                value={transferQuantity}
                onChange={(e) => setTransferQuantity(e.target.value)}
                placeholder="e.g., 50"
                min="1"
                max={selectedItem.quantity}
                disabled={!canTransferStock} // NEW: Disable input if no permission
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes" className="font-semibold">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this transfer..."
                rows={2}
                disabled={!canTransferStock} // NEW: Disable input if no permission
              />
            </div>
            <Button onClick={handleSubmitTransfer} className="w-full" disabled={!selectedItem || !toFolderId || !transferQuantity || fromFolderId === toFolderId || !canTransferStock}> {/* NEW: Disable if no permission */}
              <ArrowRight className="h-4 w-4 mr-2" /> Confirm Transfer
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StockTransferTool;