import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, AlertTriangle, FileText, Printer, Brain, Loader2, FilterX } from "lucide-react"; // Re-added BarChart, AlertTriangle, FileText, Printer
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
import { hasPlanAccess } from "@/utils/planUtils";

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
  const [aiSummary, setAiSummary] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);

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

    const finalPdfProps = {
      ...pdfProps,
      structuredLocations: structuredLocations,
    };

    initiatePrint({ type: activeReportId as PrintContentData['type'], props: finalPdfProps });
    showSuccess("Report sent to printer!");
  }, [reportData, pdfProps, CurrentPdfComponent, profile, initiatePrint, activeReportId, structuredLocations]);

  const hasAiSummaryAccess = useMemo(() => {
    // AI Summary is available from 'premium' plan onwards
    return hasPlanAccess(profile?.companyProfile?.plan, "premium");
  }, [profile?.companyProfile?.plan]);

  const handleSummarizeReport = async () => {
    if (!hasAiSummaryAccess) {
      showError("AI Summary is a Premium feature. Please upgrade your plan to use this functionality.");
      return;
    }
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={handleSummarizeReport} disabled={isSummarizing || !reportData || !hasAiSummaryAccess}>
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
            </TooltipTrigger>
            {!hasAiSummaryAccess && (
              <TooltipContent>
                <p>AI Summary is a Premium feature. Upgrade your plan to unlock!</p>
              </TooltipContent>
            )}
          </Tooltip>
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
    </div>
  );
};

export default Reports;