import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, AlertTriangle, FileText, Printer, Loader2, Brain, FilterX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/DateRangePicker";
import { DateRange } from "react-day-picker";
import { isValid } from "date-fns";
import { usePrint, PrintContentData } from "@/context/PrintContext";
import { useProfile } from "@/context/ProfileContext";
import { useOnboarding } from "@/context/OnboardingContext";
import { showError, showSuccess } from "@/utils/toast";
import { useReportData } from "@/hooks/use-report-data";
import { supabase } from "@/lib/supabaseClient";
import { hasRequiredPlan } from "@/utils/planUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // NEW: Import Select components
import { Label } from "@/components/ui/label"; // NEW: Import Label component

import ReportSidebar from "@/components/reports/ReportSidebar";
import AiSummarySidebar from "@/components/reports/AiSummarySidebar";

import { reportCategories, reportContentComponents, pdfContentComponents } from "@/lib/reportConfig";


const Reports: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { initiatePrint } = usePrint();
  const { profile } = useProfile();
  const { inventoryFolders: structuredLocations } = useOnboarding();

  const [activeReportId, setActiveReportId] = useState<string>("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isAiSummarySidebarOpen, setIsAiSummarySidebarOpen] = useState(false);

  // NEW: Report-specific filter states
  const [inventoryValuationGroupBy, setInventoryValuationGroupBy] = useState<"category" | "folder">("category");
  const [lowStockStatusFilter, setLowStockStatusFilter] = useState<"all" | "low-stock" | "out-of-stock">("all");
  const [purchaseOrderStatusFilter, setPurchaseOrderStatusFilter] = useState<"all" | "new-order" | "processing" | "packed" | "shipped" | "on-hold-problem" | "archived">("all");
  const [discrepancyStatusFilter, setDiscrepancyStatusFilter] = useState<"all" | "pending" | "resolved">("all");


  const reportContentRef = useRef<HTMLDivElement>(null);

  const allReports = useMemo(() => {
    return reportCategories.flatMap(category => category.reports);
  }, []);

  useEffect(() => {
    const hash = location.hash.replace("#", "");
    if (hash) {
      setActiveReportId(hash);
    } else {
      setActiveReportId("dashboard-summary");
      navigate("/reports#dashboard-summary", { replace: true });
    }
  }, [location.hash, navigate]);

  // Reset AI summary and close sidebar when report or date range changes
  useEffect(() => {
    setAiSummary(null);
    setIsAiSummarySidebarOpen(false);
  }, [activeReportId, dateRange]);

  const handleClearDateFilter = () => {
    setDateRange(undefined);
  };

  const currentReportTitle = useMemo(() => {
    const report = allReports.find(r => r.id === activeReportId);
    return report ? report.title : "Select a Report";
  }, [activeReportId, allReports]);

  const CurrentReportComponent = reportContentComponents[activeReportId];
  const CurrentPdfComponent = pdfContentComponents[activeReportId];

  // Pass filter states to useReportData
  const { data: reportData, pdfProps, isLoading: isLoadingReportData, error: reportError, refresh: refreshReportData } = useReportData(
    activeReportId,
    dateRange,
    inventoryValuationGroupBy,
    lowStockStatusFilter,
    purchaseOrderStatusFilter,
    discrepancyStatusFilter,
  );

  const handlePrintReport = useCallback(() => {
    if (!reportData || !pdfProps || !CurrentPdfComponent) {
      showError("No report data to print.");
      return;
    }
    if (!profile?.companyProfile) {
      showError("Company profile not set up. Complete onboarding/settings.");
      return;
    }

    const finalPdfProps = {
      ...pdfProps,
      structuredLocations: structuredLocations,
      // NEW: Pass forecast-specific props if it's the forecast report
      ...(activeReportId === "advanced-demand-forecast" && {
        forecastData: reportData.advancedDemandForecast.forecastData,
        selectedItemName: reportData.advancedDemandForecast.selectedItemName,
      }),
      // NEW: Pass report-specific filters to PDF content
      ...(activeReportId === "inventory-valuation" && { groupBy: inventoryValuationGroupBy }),
      ...(activeReportId === "low-stock-out-of-stock" && { statusFilter: lowStockStatusFilter }),
      ...(activeReportId === "purchase-order-status" && { statusFilter: purchaseOrderStatusFilter }),
      ...(activeReportId === "stock-discrepancy" && { statusFilter: discrepancyStatusFilter }),
    };

    initiatePrint({ type: activeReportId as PrintContentData['type'], props: finalPdfProps });
    showSuccess("Report sent to printer!");
  }, [reportData, pdfProps, CurrentPdfComponent, profile, initiatePrint, activeReportId, structuredLocations, inventoryValuationGroupBy, lowStockStatusFilter, purchaseOrderStatusFilter, discrepancyStatusFilter]);

  const canAccessAiSummary = hasRequiredPlan(profile?.companyProfile?.plan, 'premium');

  const handleSummarizeReport = async () => {
    if (!reportData) {
      showError("No report data to summarize.");
      return;
    }
    if (!canAccessAiSummary) {
      showError("AI Summary requires Premium/Enterprise.");
      return;
    }

    setIsSummarizing(true);
    setAiSummary(null);
    setIsAiSummarySidebarOpen(true); // NEW: Open the sidebar when summarizing starts

    try {
      let summaryReportData: any = {};

      // Construct a concise summaryReportData based on activeReportId
      switch (activeReportId) {
        case "dashboard-summary":
          summaryReportData = {
            metrics: reportData.metrics,
            lists: {
              lowStockItemsCount: reportData.lists.lowStockItems.length,
              outOfStockItemsCount: reportData.lists.outOfStockItems.length,
              recentSalesOrdersCount: reportData.lists.recentSalesOrders.length,
              recentPurchaseOrdersCount: reportData.lists.recentPurchaseOrders.length,
            },
          };
          break;
        case "inventory-valuation":
          summaryReportData = {
            totalOverallValue: reportData.inventoryValuation.totalOverallValue,
            totalOverallQuantity: reportData.inventoryValuation.totalOverallQuantity,
            groupedData: reportData.inventoryValuation.groupedData.slice(0, 5), // Top 5
            groupBy: reportData.inventoryValuationGroupBy,
          };
          break;
        case "low-stock-out-of-stock":
          summaryReportData = {
            itemsCount: reportData.lowStock.items.length,
            topItems: reportData.lowStock.items.slice(0, 5).map((item: any) => ({ name: item.name, sku: item.sku, quantity: item.quantity })),
            statusFilter: reportData.lowStockStatusFilter,
          };
          break;
        case "inventory-movement":
          const totalAdditions = reportData.inventoryMovement.movements.filter((m: any) => m.type === 'add').reduce((sum: number, m: any) => sum + m.amount, 0);
          const totalSubtractions = reportData.inventoryMovement.movements.filter((m: any) => m.type === 'subtract').reduce((sum: number, m: any) => sum + m.amount, 0);
          summaryReportData = {
            movementsCount: reportData.inventoryMovement.movements.length,
            totalAdditions,
            totalSubtractions,
          };
          break;
        case "sales-by-customer":
          summaryReportData = {
            customerSalesCount: reportData.salesByCustomer.customerSales.length,
            totalSalesRevenue: reportData.profitability.totalSalesRevenue, // Reusing from profitability
            topCustomers: reportData.salesByCustomer.customerSales.slice(0, 5).map((c: any) => ({ name: c.customerName, totalSales: c.totalSales })),
          };
          break;
        case "sales-by-product":
          summaryReportData = {
            productSalesCount: reportData.salesByProduct.productSales.length,
            totalSalesRevenue: reportData.profitability.totalSalesRevenue, // Reusing from profitability
            topProducts: reportData.salesByProduct.productSales.slice(0, 5).map((p: any) => ({ name: p.productName, unitsSold: p.unitsSold, totalRevenue: p.totalRevenue })),
          };
          break;
        case "purchase-order-status":
          const statusCounts: { [key: string]: number } = {};
          reportData.purchaseOrderStatus.orders.forEach((order: any) => {
            statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
          });
          summaryReportData = {
            ordersCount: reportData.purchaseOrderStatus.orders.length,
            totalValue: reportData.purchaseOrderStatus.orders.reduce((sum: number, order: any) => sum + order.totalAmount, 0),
            statusCounts,
            statusFilter: reportData.purchaseOrderStatusFilter,
          };
          break;
        case "profitability":
          summaryReportData = {
            totalSalesRevenue: reportData.profitability.totalSalesRevenue,
            totalCostOfGoodsSold: reportData.profitability.totalCostOfGoodsSold,
            metricsData: reportData.profitability.metricsData,
          };
          break;
        case "stock-discrepancy":
          const totalDifference = reportData.stockDiscrepancy.discrepancies.reduce((sum: number, d: any) => sum + d.difference, 0);
          summaryReportData = {
            discrepanciesCount: reportData.stockDiscrepancy.discrepancies.length,
            totalDifference,
            statusFilter: reportData.discrepancyStatusFilter,
            topDiscrepancyItems: reportData.stockDiscrepancy.discrepancies.slice(0, 5).map((d: any) => ({ itemName: d.itemName, difference: d.difference })),
          };
          break;
        case "advanced-demand-forecast":
          summaryReportData = {
            selectedItemName: reportData.advancedDemandForecast.selectedItemName,
            forecastSummary: reportData.advancedDemandForecast.forecastData.map((dp: any) => ({
              month: dp.name,
              historical: dp["Historical Demand"],
              forecasted: dp["Forecasted Demand"],
            })),
          };
          break;
        default:
          summaryReportData = {
            message: "No specific summary logic for this report type. Providing generic data.",
            reportId: activeReportId,
            // Fallback to a very minimal set of data to avoid large payloads
            metrics: reportData.metrics,
            // Add other minimal data if absolutely necessary for a generic summary
          };
          break;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        throw new Error("Session expired. Log in again.");
      }

      const payload = {
        reportId: activeReportId,
        reportData: summaryReportData, // Use the concise summaryReportData
      };

      const edgeFunctionUrl = `https://nojumocxivfjsbqnnkqe.supabase.co/functions/v1/generate-ai-summary`;
      console.log("[Reports.tsx] Invoking AI summary Edge Function via direct fetch:", edgeFunctionUrl);
      console.log("[Reports.tsx] Payload being sent:", JSON.stringify(payload, null, 2));

      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorDetail = `Edge Function failed with status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorDetail = errorData.error || errorDetail;
        } catch (jsonError) {
          console.error("Failed to parse error response JSON from Edge Function:", jsonError);
          errorDetail = `Edge Function failed with status: ${response.status}. Response was not valid JSON.`;
        }
        throw new Error(errorDetail);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setAiSummary(data.summary);
      showSuccess("AI summary generated!");
    } catch (error: any) {
      console.error("Error generating AI summary:", error);
      showError(`Failed to generate AI summary: ${error.message}`);
      setAiSummary(null);
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row flex-grow space-y-6 lg:space-y-0 lg:space-x-6">
      {/* Sidebar for Report Navigation */}
      <Card className="lg:w-1/4 bg-card border-border shadow-sm flex-shrink-0">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <BarChart className="h-6 w-6 text-primary" /> Reports
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ReportSidebar
            reportCategories={reportCategories}
          />
        </CardContent>
      </Card>

      {/* Main Report Content Area */}
      <div className="flex flex-col flex-grow space-y-6">
        <h1 className="text-3xl font-bold">Reports & Analytics</h1>
        <p className="text-muted-foreground">
          Generate detailed reports to gain actionable insights into your inventory, sales, and operations.
        </p>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xl font-semibold">Report Configuration</CardTitle>
            <div className="flex items-center gap-2">
              <DateRangePicker dateRange={dateRange} onSelect={setDateRange} className="w-[240px]" />
              {dateRange?.from && isValid(dateRange.from) && (
                <Button variant="outline" onClick={handleClearDateFilter} size="icon">
                  <FilterX className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            {activeReportId === "inventory-valuation" && (
              <div className="space-y-2">
                <Label htmlFor="groupBy">Group By</Label>
                <Select value={inventoryValuationGroupBy} onValueChange={(value: "category" | "folder") => setInventoryValuationGroupBy(value)}>
                  <SelectTrigger id="groupBy" className="w-[180px]">
                    <SelectValue placeholder="Group by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="category">Category</SelectItem>
                    <SelectItem value="folder">Folder</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {activeReportId === "low-stock-out-of-stock" && (
              <div className="space-y-2">
                <Label htmlFor="lowStockStatusFilter">Status Filter</Label>
                <Select value={lowStockStatusFilter} onValueChange={(value: "all" | "low-stock" | "out-of-stock") => setLowStockStatusFilter(value)}>
                  <SelectTrigger id="lowStockStatusFilter" className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Low/Out of Stock</SelectItem>
                    <SelectItem value="low-stock">Low Stock Only</SelectItem>
                    <SelectItem value="out-of-stock">Out of Stock Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {activeReportId === "purchase-order-status" && (
              <div className="space-y-2">
                <Label htmlFor="purchaseOrderStatusFilter">Status Filter</Label>
                <Select value={purchaseOrderStatusFilter} onValueChange={(value: "all" | "new-order" | "processing" | "packed" | "shipped" | "on-hold-problem" | "archived") => setPurchaseOrderStatusFilter(value)}>
                  <SelectTrigger id="purchaseOrderStatusFilter" className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="new-order">New Order</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="packed">Packed</SelectItem>
                    <SelectItem value="shipped">Shipped</SelectItem>
                    <SelectItem value="on-hold-problem">On Hold / Problem</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {activeReportId === "stock-discrepancy" && (
              <div className="space-y-2">
                <Label htmlFor="discrepancyStatusFilter">Status Filter</Label>
                <Select value={discrepancyStatusFilter} onValueChange={(value: "all" | "pending" | "resolved") => setDiscrepancyStatusFilter(value)}>
                  <SelectTrigger id="discrepancyStatusFilter" className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Discrepancies</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {activeReportId === "advanced-demand-forecast" && reportData?.advancedDemandForecast && (
              <div className="space-y-2">
                <Label htmlFor="forecastItemSelect">Select Item</Label>
                <Select
                  value={reportData.advancedDemandForecast.selectedForecastItemId || "all-items"} // Use internal state from hook
                  onValueChange={reportData.advancedDemandForecast.onSelectItem} // Use setter from hook
                >
                  <SelectTrigger id="forecastItemSelect" className="w-[240px]">
                    <SelectValue placeholder="Select an item or 'All Items'" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-items">All Items (Overall Demand)</SelectItem>
                    {/* Inventory items will be populated by the component itself */}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex-grow rounded-lg border flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-xl font-semibold">
              {currentReportTitle}
            </CardTitle>
            <Button
              onClick={handleSummarizeReport}
              disabled={!reportData || isSummarizing || !canAccessAiSummary}
              style={{ backgroundColor: '#9BFBCD', color: 'hsl(var(--primary))' }}
              className="hover:bg-[#7ee0c2] text-primary"
              size="sm"
            >
              {isSummarizing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Summarizing...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4 mr-2" /> AI Summary
                </>
              )}
            </Button>
          </CardHeader>
          <CardContent className="flex-grow p-4 pt-0">
            {isLoadingReportData ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Generating report...</span>
              </div>
            ) : reportError ? (
              <div className="flex flex-col items-center justify-center h-full text-destructive">
                <AlertTriangle className="h-16 w-16 mb-4" />
                <p className="text-lg">Error: {reportError}</p>
                <Button onClick={refreshReportData} className="mt-4">Retry Report</Button>
              </div>
            ) : !reportData ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <FileText className="h-16 w-16 mb-4" />
                <p className="text-lg">Select a report from the sidebar and filters, then click "Generate Report".</p>
                <Button onClick={refreshReportData} className="mt-4">Generate Report</Button>
              </div>
            ) : (
              <div ref={reportContentRef} className="space-y-6">
                {CurrentReportComponent && (
                  <CurrentReportComponent
                    {...reportData} // Pass all reportData
                    // Pass filter states directly to the component if needed for display logic
                    groupBy={inventoryValuationGroupBy}
                    statusFilter={activeReportId === "low-stock-out-of-stock" ? lowStockStatusFilter : (activeReportId === "purchase-order-status" ? purchaseOrderStatusFilter : discrepancyStatusFilter)}
                    // onSelectItem is now part of reportData.advancedDemandForecast
                  />
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-4 flex flex-wrap gap-2 justify-end">
          <Button onClick={handlePrintReport} disabled={!reportData}>
            <Printer className="h-4 w-4 mr-2" /> Print/PDF
          </Button>
        </div>
      </div>

      {/* NEW: AI Summary Sidebar */}
      <AiSummarySidebar
        isOpen={isAiSummarySidebarOpen}
        onClose={() => setIsAiSummarySidebarOpen(false)}
        summaryText={aiSummary}
        isSummarizing={isSummarizing}
        onGenerateSummary={handleSummarizeReport}
        reportTitle={currentReportTitle}
        activeReportId={activeReportId}
      />
    </div>
  );
};

export default Reports;