import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, LayoutDashboard, Package, Receipt, Truck, Scale, FileText, DollarSign, Users, AlertTriangle, ChevronDown, FilterX, Printer, Brain, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { DateRangePicker } from "@/components/DateRangePicker";
import { DateRange } from "react-day-picker";
import { isValid } from "date-fns";
import { usePrint, PrintContentData } from "@/context/PrintContext"; // NEW: Import PrintContentData
import { useProfile } from "@/context/ProfileContext";
import { useOnboarding } from "@/context/OnboardingContext";
import { supabase } from "@/lib/supabaseClient";
import { showError, showSuccess } from "@/utils/toast";
import { useReportData } from "@/hooks/use-report-data"; // NEW: Import the new hook

// Import all report content components
import DashboardSummaryReportContent from "@/components/reports/DashboardSummaryReport";
import InventoryValuationReportContent from "@/components/reports/InventoryValuationReport";
import LowStockReportContent from "@/components/reports/LowStockReport";
import InventoryMovementReportContent from "@/components/reports/InventoryMovementReport";
import SalesByCustomerReportContent from "@/components/reports/SalesByCustomerReport";
import SalesByProductReportContent from "@/components/reports/SalesByProductReport";
import PurchaseOrderStatusReportContent from "@/components/reports/PurchaseOrderStatusReport";
import ProfitabilityReportContent from "@/components/reports/ProfitabilityReport";
import DiscrepancyReportContent from "@/components/reports/DiscrepancyReport";

// PDF content components (still needed for PrintWrapper)
import DashboardSummaryPdfContent from "@/components/reports/pdf/DashboardSummaryPdfContent";
import InventoryValuationPdfContent from "@/components/reports/pdf/InventoryValuationPdfContent";
import LowStockPdfContent from "@/components/reports/pdf/LowStockPdfContent";
import InventoryMovementPdfContent from "@/components/reports/pdf/InventoryMovementPdfContent";
import SalesByCustomerPdfContent from "@/components/reports/pdf/SalesByCustomerPdfContent";
import SalesByProductPdfContent from "@/components/reports/pdf/SalesByProductPdfContent";
import PurchaseOrderStatusPdfContent from "@/components/reports/pdf/PurchaseOrderStatusPdfContent";
import ProfitabilityPdfContent from "@/components/reports/pdf/ProfitabilityPdfContent";
import DiscrepancyPdfContent from "@/components/reports/pdf/DiscrepancyPdfContent";
import AdvancedDemandForecastPdfContent from "@/components/reports/pdf/AdvancedDemandForecastPdfContent"; // Example for other PDF types
import PutawayLabelPdfContent from "@/components/reports/pdf/PutawayLabelPdfContent"; // Example for other PDF types

interface ReportCategory {
  title: string;
  icon: React.ElementType;
  reports: ReportItem[];
}

interface ReportItem {
  id: string; // Unique ID for the report, used in URL hash
  title: string;
  description: string;
  icon: React.ElementType;
}

const reportCategories: ReportCategory[] = [
  {
    title: "Overview",
    icon: LayoutDashboard,
    reports: [
      { id: "dashboard-summary", title: "Dashboard Summary", description: "High-level overview of key metrics.", icon: LayoutDashboard },
    ],
  },
  {
    title: "Inventory Reports",
    icon: Package,
    reports: [
      { id: "inventory-valuation", title: "Inventory Valuation", description: "Value of all stock by category/location.", icon: DollarSign },
      { id: "low-stock-out-of-stock", title: "Low/Out of Stock", description: "Items needing replenishment.", icon: AlertTriangle },
      { id: "inventory-movement", title: "Inventory Movement", description: "Detailed log of stock changes.", icon: Scale },
      { id: "stock-discrepancy", title: "Stock Discrepancy", description: "Reported differences in stock counts.", icon: AlertTriangle },
    ],
  },
  {
    title: "Sales Reports",
    icon: Receipt,
    reports: [
      { id: "sales-by-customer", title: "Sales by Customer", description: "Revenue generated per customer.", icon: Users },
      { id: "sales-by-product", title: "Sales by Product", description: "Top-selling items by quantity/revenue.", icon: BarChart },
    ],
  },
  {
    title: "Purchase Reports",
    icon: Truck,
    reports: [
      { id: "purchase-order-status", title: "Purchase Order Status", description: "Overview of all purchase orders.", icon: FileText },
    ],
  },
  {
    title: "Financial Reports",
    icon: DollarSign,
    reports: [
      { id: "profitability", title: "Profitability (Gross Margin)", description: "Gross profit by product or category.", icon: DollarSign },
    ],
  },
];

// Map report IDs to their respective content components
const reportContentComponents: { [key: string]: React.ElementType } = {
  "dashboard-summary": DashboardSummaryReportContent,
  "inventory-valuation": InventoryValuationReportContent,
  "low-stock-out-of-stock": LowStockReportContent,
  "inventory-movement": InventoryMovementReportContent,
  "sales-by-customer": SalesByCustomerReportContent,
  "sales-by-product": SalesByProductReportContent,
  "purchase-order-status": PurchaseOrderStatusReportContent,
  "profitability": ProfitabilityReportContent,
  "stock-discrepancy": DiscrepancyReportContent,
};

// Map report IDs to their respective PDF content components
const pdfContentComponents: { [key: string]: React.ElementType } = {
  "dashboard-summary": DashboardSummaryPdfContent,
  "inventory-valuation": InventoryValuationPdfContent,
  "low-stock-out-of-stock": LowStockPdfContent,
  "inventory-movement": InventoryMovementPdfContent,
  "sales-by-customer": SalesByCustomerPdfContent,
  "sales-by-product": SalesByProductPdfContent,
  "purchase-order-status": PurchaseOrderStatusPdfContent,
  "profitability": ProfitabilityPdfContent,
  "stock-discrepancy": DiscrepancyPdfContent,
  // Add other PDF content components here if they are distinct from reportContentComponents
  "advanced-demand-forecast": AdvancedDemandForecastPdfContent,
  "putaway-label": PutawayLabelPdfContent,
};


const Reports: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { initiatePrint } = usePrint();
  const { profile } = useProfile();
  const { locations: structuredLocations } = useOnboarding(); // For passing to PDF content

  const [activeReportId, setActiveReportId] = useState<string>("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [aiSummary, setAiSummary] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);

  // Ref to hold the report content for text extraction (for AI summary)
  const reportContentRef = useRef<HTMLDivElement>(null);

  // Flatten all reports for the dropdown menu
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

  const handleReportSelect = (reportId: string) => {
    setActiveReportId(reportId);
    navigate(`/reports#${reportId}`);
    setAiSummary(""); // Clear AI summary when changing report
  };

  const handleClearDateFilter = () => {
    setDateRange(undefined);
  };

  const currentReportTitle = useMemo(() => {
    const report = allReports.find(r => r.id === activeReportId);
    return report ? report.title : "Select a Report";
  }, [activeReportId, allReports]);

  const CurrentReportComponent = reportContentComponents[activeReportId];
  const CurrentPdfComponent = pdfContentComponents[activeReportId];

  // Function to generate the text content of the report for AI summarization
  const generateReportTextContent = useCallback(() => {
    if (reportContentRef.current) {
      const rawInnerText = reportContentRef.current.innerText;
      const text = rawInnerText
        .replace(/(\r\n|\n|\r){2,}/g, '\n\n')
        .replace(/[ \t]+/g, ' ')
        .trim();
      return text;
    }
    return "";
  }, [reportContentRef]);

  const handlePrintReport = useCallback(() => {
    if (!reportData || !pdfProps || !CurrentPdfComponent) {
      showError("No report data to print. Please generate the report first.");
      return;
    }
    if (!profile?.companyProfile) {
      showError("Company profile not set up. Please complete onboarding or set company details in settings.");
      return;
    }

    // Ensure structuredLocations is passed to PDF components that need it
    const finalPdfProps = {
      ...pdfProps,
      structuredLocations: structuredLocations,
    };

    initiatePrint({ type: activeReportId as PrintContentData['type'], props: finalPdfProps });
    showSuccess("Report sent to printer!");
  }, [reportData, pdfProps, CurrentPdfComponent, profile, initiatePrint, activeReportId, structuredLocations]);

  const handleSummarizeReport = async () => {
    if (!reportData) {
      showError("No report data to summarize. Please generate the report first.");
      setIsSummarizing(false);
      return;
    }
    setIsSummarizing(true);
    setAiSummary("");

    if (!reportContentRef.current) {
      showError("Report content not rendered. Please ensure the report is visible and fully loaded.");
      setIsSummarizing(false);
      return;
    }

    try {
      const textToSummarize = generateReportTextContent();

      if (!textToSummarize) {
        showError("No report content found to summarize. Please ensure the report is fully loaded and visible.");
        setIsSummarizing(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showError("You must be logged in to use the AI Summary tool.");
        setIsSummarizing(false);
        return;
      }

      const edgeFunctionUrl = `https://nojumocxivfjsbqnnkqe.supabase.co/functions/v1/summarize-report`;
      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ textToSummarize }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data && data.summary) {
        setAiSummary(data.summary);
        showSuccess("Report summarized successfully!");
      } else {
        showError("Failed to get a summary from the AI. Please try again.");
      }
    } catch (error: any) {
      console.error("Error generating summary:", error);
      showError(`Error generating summary: ${error.message}`);
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <div className="flex flex-col flex-grow">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold">Reports & Analytics</h1>
      </div>
      <p className="text-muted-foreground mb-6">
        Generate detailed reports to gain actionable insights into your inventory, sales, and operations.
      </p>

      <Card className="mb-4 bg-card border-border shadow-sm">
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
      </Card>

      <Card className="flex-grow rounded-lg border flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-xl font-semibold">
            {currentReportTitle}
          </CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <BarChart className="h-4 w-4" /> {currentReportTitle} <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {reportCategories.map(category => (
                <React.Fragment key={category.title}>
                  <DropdownMenuLabel className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-primary-foreground bg-primary rounded-md mx-2 my-1 cursor-default">
                    <category.icon className="h-4 w-4" /> {category.title}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="mx-2" />
                  {category.reports.map(report => (
                    <DropdownMenuItem
                      key={report.id}
                      onClick={() => handleReportSelect(report.id)}
                      className={cn("mx-2", activeReportId === report.id && "bg-muted text-primary")}
                    >
                      {report.title}
                    </DropdownMenuItem>
                  ))}
                  {reportCategories.indexOf(category) < reportCategories.length - 1 && <DropdownMenuSeparator className="mx-2" />}
                </React.Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
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
              <p className="text-lg">Select a report and filters, then click "Refresh Report".</p>
              <Button onClick={refreshReportData} className="mt-4">Generate Report</Button>
            </div>
          ) : (
            <div ref={reportContentRef} className="space-y-6">
              {CurrentReportComponent && <CurrentReportComponent {...reportData} />}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 flex flex-wrap gap-2 justify-end">
        <Button onClick={handleSummarizeReport} disabled={isSummarizing || !reportData}>
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
        <Button onClick={handlePrintReport} disabled={!reportData}>
          <Printer className="h-4 w-4 mr-2" /> Print/PDF
        </Button>
      </div>

      {aiSummary && (
        <Card className="mt-4 bg-card border-border rounded-lg shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <Brain className="h-6 w-6 text-accent" /> AI Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/20 p-4 rounded-md border border-border">
              <p className="text-foreground whitespace-pre-wrap">{aiSummary}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Reports;