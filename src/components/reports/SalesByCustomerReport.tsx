import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CustomerSalesData {
  customerName: string;
  totalSales: number;
  totalItems: number;
  lastOrderDate: string;
}

// Props now directly reflect the processed data from useReportData
interface SalesByCustomerReportProps {
  customerSales: CustomerSalesData[];
}

const SalesByCustomerReport: React.FC<SalesByCustomerReportProps> = ({
  customerSales,
}) => {
  const totalOverallSales = customerSales.reduce((sum: number, data: CustomerSalesData) => sum + data.totalSales, 0);
  const totalOverallItems = customerSales.reduce((sum: number, data: CustomerSalesData) => sum + data.totalItems, 0);

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Sales by Customer Report
          </CardTitle>
          <p className="text-muted-foreground">
            Overview of sales performance grouped by customer.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">Total Sales Revenue</h3>
              <p className="text-3xl font-bold text-green-500">${totalOverallSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">Total Items Sold</h3>
              <p className="text-3xl font-bold">{totalOverallItems.toLocaleString()}</p>
            </div>
          </div>

          <h3 className="font-semibold text-xl mt-6">Detailed Sales by Customer ({customerSales.length})</h3>
          {customerSales.length > 0 ? (
            <ScrollArea className="h-[400px] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer Name</TableHead>
                    <TableHead className="text-right">Total Sales</TableHead>
                    <TableHead className="text-right">Total Items</TableHead>
                    <TableHead>Last Order Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerSales.map((data: CustomerSalesData, index: number) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{data.customerName}</TableCell>
                      <TableCell className="text-right">${data.totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">{data.totalItems.toLocaleString()}</TableCell>
                      <TableCell>{data.lastOrderDate}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <p className="text-center text-muted-foreground py-8">No sales data found for the selected criteria.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SalesByCustomerReport;