import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, AlertTriangle, FileText, Printer, Loader2, FilterX, Brain } from "lucide-react";
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
  const [aiSummary, setAiSummary] = useState<string | null>(null); // State for AI summary
  const [isSummarizing, setIsSummarizing] = useState(false); // State for AI summary loading

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

  // Reset AI summary when report or date range changes
  useEffect(() => {
    setAiSummary(null);
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

  const { data: reportData, pdfProps, isLoading: isLoadingReportData, error: reportError, refresh: refreshReportData } = useReportData(activeReportId, dateRange);

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

  const hasAiSummaryAccess = profile?.companyProfile?.plan === 'premium' || profile?.companyProfile?.plan === 'enterprise';

  const handleSummarizeReport = async () => {
    if (!reportData) {
      showError("No report data available to summarize.");
      return;
    }
    if (!hasAiSummaryAccess) {
      showError("AI Summary is a Premium/Enterprise feature. Please upgrade your plan.");
      return;
    }

    setIsSummarizing(true);
    setAiSummary(null); // Clear previous summary

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        throw new Error("User session not found. Please log in again.");
      }

      const payload = {
        reportId: activeReportId,
        reportData: reportData,
      };

      // --- START: Direct fetch call to Edge Function ---
      const edgeFunctionUrl = `https://nojumocxivfjsbqnnkqe.supabase.co/functions/v1/generate-ai-summary`; // Hardcode project ref
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
      // --- END: Direct fetch call ---

      if (data.error) {
        throw new Error(data.error);
      }

      setAiSummary(data.summary);
      showSuccess("AI summary generated successfully!");
    } catch (error: any) {
      console.error("Error generating AI summary:", error);
      showError(`Failed to generate AI summary: ${error.message}`);
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
        </Card>

        <Card className="flex-grow rounded-lg border flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-xl font-semibold">
              {currentReportTitle}
            </CardTitle>
            <Button
              onClick={handleSummarizeReport}
              disabled={!reportData || isSummarizing || !hasAiSummaryAccess}
              variant="secondary"
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
                {CurrentReportComponent && <CurrentReportComponent {...reportData} />}
              </div>
            )}
          </CardContent>
        </Card>

        {aiSummary && (
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-semibold flex items-center gap-2">
                <Brain className="h-6 w-6 text-primary" /> AI Report Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap">{aiSummary}</p>
            </CardContent>
          </Card>
        )}

        <div className="mt-4 flex flex-wrap gap-2 justify-end">
          <Button onClick={handlePrintReport} disabled={!reportData}>
            <Printer className="h-4 w-4 mr-2" /> Print/PDF
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Reports;