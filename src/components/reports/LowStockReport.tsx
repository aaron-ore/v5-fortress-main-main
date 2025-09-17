import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { InventoryFolder } from "@/context/OnboardingContext"; // Updated import to InventoryFolder

// Props now directly reflect the processed data from useReportData
interface LowStockReportProps {
  items: any[]; // Use 'any' for now, or define specific item types if needed
  statusFilter: "all" | "low-stock" | "out-of-stock";
  structuredLocations: InventoryFolder[]; // Updated to InventoryFolder
}

const LowStockReport: React.FC<LowStockReportProps> = ({
  items,
  statusFilter: currentStatusFilter,
  structuredLocations,
}) => {
  const getFolderDisplayName = (folderId: string) => {
    const foundLoc = structuredLocations.find(loc => loc.id === folderId); // Find by ID
    return foundLoc?.name || "Unassigned"; // Use folder name
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-destructive" /> Low Stock / Out of Stock Report
          </CardTitle>
          <p className="text-muted-foreground">
            Items currently below reorder level or out of stock.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <h3 className="font-semibold text-xl mt-6">
            {currentStatusFilter === "low-stock" ? "Low Stock Items" :
             currentStatusFilter === "out-of-stock" ? "Out of Stock Items" :
             "Low & Out of Stock Items"} ({(items ?? []).length})
          </h3>
          {(items ?? []).length > 0 ? (
            <ScrollArea className="h-[400px] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Reorder Level</TableHead>
                    <TableHead>Folder</TableHead> {/* Changed to Folder */}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(items ?? []).map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.sku}</TableCell>
                      <TableCell className="text-right text-destructive">{item.quantity}</TableCell>
                      <TableCell className="text-right">{item.reorderLevel}</TableCell>
                      <TableCell>{getFolderDisplayName(item.folderId)}</TableCell> {/* Updated to folderId */}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <p className="text-center text-muted-foreground py-8">No items found for the selected criteria.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LowStockReport;