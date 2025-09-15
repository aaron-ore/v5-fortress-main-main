import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { UserProfile } from "@/context/ProfileContext";
import { InventoryFolder } from "@/context/OnboardingContext"; // Updated import to InventoryFolder
import { AlertTriangle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { parseAndValidateDate } from "@/utils/dateUtils";

interface DiscrepancyLog {
  id: string;
  timestamp: string;
  userId: string;
  organizationId: string;
  itemId: string;
  itemName: string;
  locationString: string; // This is the fullLocationString
  locationType: string;
  originalQuantity: number;
  countedQuantity: number;
  difference: number;
  reason: string;
  status: string;
}

// Props now directly reflect the processed data from useReportData
interface DiscrepancyReportProps {
  discrepancies: DiscrepancyLog[];
  statusFilter: "all" | "pending" | "resolved";
  allProfiles: UserProfile[];
  structuredLocations: InventoryFolder[]; // Updated to InventoryFolder
}

const DiscrepancyReport: React.FC<DiscrepancyReportProps> = ({
  discrepancies: itemsToDisplay,
  statusFilter: currentStatusFilter,
  allProfiles,
  structuredLocations,
}) => {
  const getUserName = (userId: string) => {
    const user = allProfiles.find(p => p.id === userId);
    return user?.fullName || user?.email || "Unknown User";
  };

  const getLocationDisplayName = (fullLocationString: string) => {
    const foundLoc = structuredLocations.find(folder => folder.id === fullLocationString); // Find by ID
    return foundLoc?.name || fullLocationString; // Use folder name
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-destructive" /> Stock Discrepancy Report
          </CardTitle>
          <p className="text-muted-foreground">
            Detailed list of reported stock discrepancies.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <h3 className="font-semibold text-xl mt-6">
            {currentStatusFilter === "pending" ? "Pending Discrepancies" :
             currentStatusFilter === "resolved" ? "Resolved Discrepancies" :
             "All Discrepancies"} ({itemsToDisplay.length})
          </h3>
          {itemsToDisplay.length > 0 ? (
            <ScrollArea className="h-[400px] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Folder</TableHead> {/* Changed to Folder */}
                    <TableHead className="text-right">Original Qty</TableHead>
                    <TableHead className="text-right">Counted Qty</TableHead>
                    <TableHead className="text-right">Difference</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reported By</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemsToDisplay.map((discrepancy: DiscrepancyLog) => {
                    const discrepancyTimestamp = parseAndValidateDate(discrepancy.timestamp);
                    return (
                      <TableRow key={discrepancy.id}>
                        <TableCell className="font-medium">{discrepancy.itemName}</TableCell>
                        <TableCell>{getLocationDisplayName(discrepancy.locationString)} ({discrepancy.locationType.replace('_', ' ')})</TableCell>
                        <TableCell className="text-right">{discrepancy.originalQuantity}</TableCell>
                        <TableCell className="text-right">{discrepancy.countedQuantity}</TableCell>
                        <TableCell className="text-right text-destructive">{discrepancy.difference}</TableCell>
                        <TableCell>{discrepancy.reason}</TableCell>
                        <TableCell>{discrepancy.status}</TableCell>
                        <TableCell>{getUserName(discrepancy.userId)}</TableCell>
                        <TableCell>{discrepancyTimestamp ? format(discrepancyTimestamp, "MMM dd, yyyy HH:mm") : "N/A"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <p className="text-center text-muted-foreground py-8">No discrepancies found for the selected criteria.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DiscrepancyReport;