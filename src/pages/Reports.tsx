import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, AlertTriangle, FileText, Printer, Loader2, FilterX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/DateRangePicker";
import { DateRange } from "react-day-picker";
import { isValid } from "date-fns";
import { usePrint, PrintContentData } from "@/context/PrintContext";
import { useProfile } from "@/context/ProfileContext";
import { useOnboarding } from "@/context/OnboardingContext";
import { showError, showSuccess } from "@/utils/toast";
import { useReportData } from "@/hooks/use-report-data";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

import ReportSidebar from "@/components/reports/ReportSidebar";

import { reportCategories, reportContentComponents, pdfContentComponents } from "@/lib/reportConfig";


const Reports: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { initiatePrint } = usePrint();
  const { profile } = useProfile();
  const { inventoryFolders: structuredLocations } = useOnboarding();

  const [activeReportId, setActiveReportId] = useState<string>("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // NEW: Report-specific filter states
  const [inventoryValuationGroupBy, setInventoryValuationGroupBy] = useState<"category" | "folder">("category");
  const [lowStockStatusFilter, setLowStockStatusFilter] = useState<"all" | "low-stock" | "out-of-stock">("all");
  const [purchaseOrderStatusFilter, setPurchaseOrderStatusFilter] = useState<"all" | "new-order" | "processing" | "packed" | "shipped" | "on-hold-problem" | "archived">("all");
  const [discrepancyStatusFilter, setDiscrecrepancyStatusFilter] = useState<"all" | "pending" | "resolved">("all");


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
    // Removed AI summary state resets
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

  // Removed AI summary related functions and state

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
                <Select value={discrepancyStatusFilter} onValueChange={(value: "all" | "pending" | "resolved") => setDiscrecrepancyStatusFilter(value)}>
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
                  value={reportData.advancedDemandForecast.selectedForecastItemId || "all-items"}
                  onValueChange={reportData.advancedDemandForecast.onSelectItem}
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
            {/* Removed AI Summary Button */}
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
                    {...reportData}
                    groupBy={inventoryValuationGroupBy}
                    statusFilter={activeReportId === "low-stock-out-of-stock" ? lowStockStatusFilter : (activeReportId === "purchase-order-status" ? purchaseOrderStatusFilter : discrepancyStatusFilter)}
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

      {/* Removed AI Summary Sidebar */}
    </div>
  );
};

export default Reports;