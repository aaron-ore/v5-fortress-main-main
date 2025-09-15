import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { StockMovement } from "@/context/StockMovementContext";
import { UserProfile } from "@/context/ProfileContext";
import { Location } from "@/context/OnboardingContext";
import { Scale } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { parseAndValidateDate } from "@/utils/dateUtils";

// Props now directly reflect the processed data from useReportData
interface InventoryMovementReportProps {
  movements: StockMovement[];
  allProfiles: UserProfile[];
  structuredLocations: Location[];
}

const InventoryMovementReport: React.FC<InventoryMovementReportProps> = ({
  movements: movementsToDisplay,
  allProfiles,
  // Removed structuredLocations as it's not used in this component
}) => {
  const getUserName = (userId: string) => {
    const user = allProfiles.find(p => p.id === userId);
    return user?.fullName || user?.email || "Unknown User";
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <Scale className="h-6 w-6 text-primary" /> Inventory Movement Report
          </CardTitle>
          <p className="text-muted-foreground">
            Detailed log of all stock changes within the selected period.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <h3 className="font-semibold text-xl mt-6">
            All Stock Movements ({movementsToDisplay.length})
          </h3>
          {movementsToDisplay.length > 0 ? (
            <ScrollArea className="h-[400px] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Old Qty</TableHead>
                    <TableHead className="text-right">New Qty</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movementsToDisplay.map((movement: StockMovement) => {
                    const movementTimestamp = parseAndValidateDate(movement.timestamp);
                    return (
                      <TableRow key={movement.id}>
                        <TableCell className="font-medium">{movement.itemName}</TableCell>
                        <TableCell>{movement.type}</TableCell>
                        <TableCell className="text-right">{movement.amount}</TableCell>
                        <TableCell className="text-right">{movement.oldQuantity}</TableCell>
                        <TableCell className="text-right">{movement.newQuantity}</TableCell>
                        <TableCell>{movement.reason}</TableCell>
                        <TableCell>{getUserName(movement.userId)}</TableCell>
                        <TableCell>{movementTimestamp ? format(movementTimestamp, "MMM dd, yyyy HH:mm") : "N/A"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <p className="text-center text-muted-foreground py-8">No inventory movements found for the selected criteria.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InventoryMovementReport;