"use client";

import React, { useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowUp, ArrowDown, History, Package, Loader2 } from "lucide-react";
import { useStockMovement } from "@/context/StockMovementContext";
import { useInventory } from "@/context/InventoryContext";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProfile } from "@/context/ProfileContext"; // NEW: Import useProfile

const ItemHistoryPage: React.FC = () => {
  const { id } = useParams<{ id: string }>(); // Item ID from URL
  const navigate = useNavigate();
  const { stockMovements, fetchStockMovements } = useStockMovement();
  const { inventoryItems, isLoadingInventory } = useInventory();
  const { allProfiles, fetchAllProfiles } = useProfile(); // NEW: Get allProfiles and fetchAllProfiles

  const currentItem = useMemo(() => inventoryItems.find((item) => item.id === id), [inventoryItems, id]);

  useEffect(() => {
    if (id) {
      fetchStockMovements(id);
      fetchAllProfiles(); // NEW: Fetch all profiles to resolve user names
    }
  }, [id, fetchStockMovements, fetchAllProfiles]);

  const itemSpecificMovements = useMemo(() => {
    return stockMovements
      .filter((movement) => movement.itemId === id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [stockMovements, id]);

  const getUserName = (userId: string) => {
    const user = allProfiles.find(p => p.id === userId);
    return user?.fullName || user?.email || "Unknown User";
  };

  if (isLoadingInventory) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading item history...</span>
      </div>
    );
  }

  if (!currentItem) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-4">
        <h1 className="text-4xl font-bold text-destructive">404</h1>
        <p className="text-xl text-muted-foreground">Inventory Item Not Found</p>
        <Button onClick={() => navigate("/inventory")}>Back to Inventory</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 flex flex-col flex-grow"> {/* Added flex flex-col flex-grow */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <History className="h-8 w-8 text-primary" /> Stock Movement History for {currentItem.name}
        </h1>
        <Button variant="outline" onClick={() => navigate(`/inventory/${currentItem.id}`)}>
          Back to Item Details
        </Button>
      </div>

      <p className="text-muted-foreground">
        A complete log of all stock changes for "{currentItem.name}" (SKU: {currentItem.sku}).
      </p>

      <Card className="bg-card border-border rounded-lg shadow-sm flex flex-col flex-grow"> {/* Added flex flex-col flex-grow */}
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <Package className="h-5 w-5 text-accent" /> Movement Log ({itemSpecificMovements.length} entries)
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-grow flex flex-col"> {/* Added flex-grow flex-col */}
          {itemSpecificMovements.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No stock movement history found for this item.</p>
          ) : (
            <ScrollArea className="flex-grow border rounded-md"> {/* Changed h-[500px] to flex-grow */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead className="text-right w-[80px]">Amount</TableHead>
                    <TableHead className="text-right w-[80px]">Old Qty</TableHead>
                    <TableHead className="text-right w-[80px]">New Qty</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="w-[150px]">User</TableHead> {/* NEW: User column */}
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemSpecificMovements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell className="font-medium flex items-center gap-2">
                        {movement.type === "add" ? (
                          <ArrowUp className="h-4 w-4 text-green-500" />
                        ) : (
                          <ArrowDown className="h-4 w-4 text-red-500" />
                        )}
                        {movement.type === "add" ? "Add" : "Subtract"}
                      </TableCell>
                      <TableCell className="text-right">{movement.amount}</TableCell>
                      <TableCell className="text-right">{movement.oldQuantity}</TableCell>
                      <TableCell className="text-right">{movement.newQuantity}</TableCell>
                      <TableCell>{movement.reason}</TableCell>
                      <TableCell>{getUserName(movement.userId)}</TableCell> {/* NEW: Display user name */}
                      <TableCell>{format(new Date(movement.timestamp), "MMM dd, yyyy HH:mm")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ItemHistoryPage;