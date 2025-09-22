import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, AlertTriangle, FileText, Printer, Loader2, FilterX } from "lucide-react"; // Re-added BarChart, AlertTriangle, FileText, Printer
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/DateRangePicker";
import { DateRange } from "react-day-picker";
import { isValid } from "date-fns";
import { usePrint, PrintContentData } from "@/context/PrintContext";
import { useProfile } from "@/context/ProfileContext";
import { useOnboarding } from "@/context/OnboardingContext";
import { supabase } from "@/lib/supabaseClient";
import { showError, showSuccess } from "@/utils/toast";
import { useReportData } from "@/hooks/use-report-data";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";


// Import the ReportSidebar component
import ReportSidebar from "@/components/reports/ReportSidebar";

// Import report categories and component mappings from the new config file
import { reportCategories, reportContentComponents, pdfContentComponents } from "@/lib/reportConfig";


const Reports: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { initiatePrint } = usePrint();
  const { profile } = useProfile();
  const { inventoryFolders: structuredLocations } = useOnboarding();

  const [activeReportId, setActiveReportId] = useState<string>("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  // Removed aiSummary state
  // Removed isSummarizing state

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

  const handleClearDateFilter = () => {
    setDateRange(undefined);
  };

  const currentReportTitle = useMemo(() => {
    const report = allReports.find(r => r.id === activeReportId);
    return report ? report.title : "Select a Report";
  }, [activeReportId, allReports]);

  const CurrentReportComponent = reportContentComponents[activeReportId];
  const CurrentPdfComponent = pdfContentComponents[activeReportId];

  const { data: reportData, pdfProps, isLoading: isLoadingReportData, error: reportError, refresh: refreshReportData } = useReportData(activeReportId, dateRange);

  // Removed generateReportTextContent

  const handlePrintReport = useCallback(() => {
    if (!reportData || !pdfProps || !CurrentPdfComponent) {
      showError("No report data to print. Please generate the report first.");
      return;
    }
    if (!profile?.companyProfile) {
      showError("Company profile not set up. Please complete onboarding or set company details in settings.");
      return;
    }

    const finalPdfProps = {
      ...pdfProps,
      structuredLocations: structuredLocations,
    };

    initiatePrint({ type: activeReportId as PrintContentData['type'], props: finalPdfProps });
    showSuccess("Report sent to printer!");
  }, [reportData, pdfProps, CurrentPdfComponent, profile, initiatePrint, activeReportId, structuredLocations]);

  // Removed hasAiSummaryAccess
  // Removed handleSummarizeReport

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
            // The ReportSidebar component will handle its own active state based on URL hash
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
        </Card>

        <Card className="flex-grow rounded-lg border flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-xl font-semibold">
              {currentReportTitle}
            </CardTitle>
            {/* Removed DropdownMenu for report selection */}
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
                {CurrentReportComponent && <CurrentReportComponent {...reportData} />}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-4 flex flex-wrap gap-2 justify-end">
          {/* Removed AI Summary Button */}
          <Button onClick={handlePrintReport} disabled={!reportData}>
            <Printer className="h-4 w-4 mr-2" /> Print/PDF
          </Button>
        </div>

        {/* Removed AI Summary Card */}
      </div>
    </div>
  );
};

export default Reports;