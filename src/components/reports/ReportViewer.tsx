"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Printer, Brain } from "lucide-react";
import { usePrint } from "@/context/PrintContext";
import { useOnboarding } from "@/context/OnboardingContext";
import { useProfile } from "@/context/ProfileContext";
import { supabase } from "@/lib/supabaseClient";
import { showError, showSuccess } from "@/utils/toast";

import InventoryValuationReport from "./InventoryValuationReport";
import LowStockReport from "./LowStockReport";
import InventoryMovementReport from "./InventoryMovementReport";
import SalesByCustomerReport from "./SalesByCustomerReport";
import SalesByProductReport from "./SalesByProductReport";
import PurchaseOrderStatusReport from "./PurchaseOrderStatusReport";
import ProfitabilityReport from "./ProfitabilityReport";
import DiscrepancyReport from "./DiscrepancyReport";
import DashboardSummaryReport from "./DashboardSummaryReport"; // For the overview report

interface ReportViewerProps {
  reportId: string;
  dateRange: DateRange | undefined; // NEW: Accept dateRange prop
}

// Map report IDs to their respective components
const reportComponents: { [key: string]: React.ElementType } = {
  "dashboard-summary": DashboardSummaryReport,
  "inventory-valuation": InventoryValuationReport,
  "low-stock-out-of-stock": LowStockReport,
  "inventory-movement": InventoryMovementReport,
  "sales-by-customer": SalesByCustomerReport,
  "sales-by-product": SalesByProductReport,
  "purchase-order-status": PurchaseOrderStatusReport,
  "profitability": ProfitabilityReport,
  "stock-discrepancy": DiscrepancyReport, // Corrected typo here
};

const ReportViewer: React.FC<ReportViewerProps> = ({ reportId, dateRange }) => { // NEW: Destructure dateRange
  const { initiatePrint } = usePrint();
  const { companyProfile, locations: structuredLocations } = useOnboarding(); // NEW: Get structured locations
  const { profile } = useProfile();

  const [reportData, setReportData] = useState<any>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [aiSummary, setAiSummary] = useState("");

  // Ref to hold the report content for printing
  const reportContentRef = useRef<HTMLDivElement>(null);

  const CurrentReportComponent = reportComponents[reportId];

  // Function to generate the text content of the report for AI summarization
  const generateReportTextContent = useCallback(() => {
    if (reportContentRef.current) {
      const rawInnerText = reportContentRef.current.innerText;
      console.log("Client-side: Raw innerText from reportContentRef:", `"${rawInnerText}"`, "length:", rawInnerText.length);

      const text = rawInnerText
        .replace(/(\r\n|\n|\r){2,}/g, '\n\n') // Reduce multiple newlines to max two
        .replace(/[ \t]+/g, ' ') // Replace multiple spaces/tabs with single space
        .trim();
      return text;
    }
    console.log("Client-side: reportContentRef.current is null.");
    return "";
  }, [reportContentRef]);

  const handleGenerateReport = useCallback(async (data: { pdfProps: any; printType: string }) => {
    setIsLoadingReport(true);
    setReportData(data); // The child component will pass its processed data here
    setIsLoadingReport(false);
    setAiSummary(""); // Clear previous AI summary
  }, []);

  const handlePrintReport = useCallback(() => {
    if (!reportData) {
      showError("No report data to print. Please generate the report first.");
      return;
    }
    if (!profile?.companyProfile) { // Corrected access
      showError("Company profile not set up. Please complete onboarding or set company details in settings.");
      return;
    }

    // Each report component will need to provide its specific PDF content props
    // This is a placeholder, actual implementation will be in individual report components
    const pdfProps = {
      companyName: profile.companyProfile.companyName, // Corrected access
      companyAddress: profile.companyProfile.companyAddress, // Corrected access
      companyContact: profile.companyProfile.companyCurrency, // Corrected access
      companyLogoUrl: profile.companyProfile.companyLogoUrl || undefined, // NEW: Pass companyLogoUrl
      reportDate: new Date().toLocaleDateString(),
      dateRange, // NEW: Pass dateRange to PDF props
      structuredLocations, // NEW: Pass structuredLocations to PDF props
      ...reportData.pdfProps, // Specific props from the generated report
    };

    initiatePrint({ type: reportData.printType, props: pdfProps });
    showSuccess("Report sent to printer!");
  }, [reportData, profile, initiatePrint, dateRange, structuredLocations]); // NEW: Add profile to dependencies

  const handleSummarizeReport = async () => {
    if (!reportData) {
      showError("No report data to summarize. Please generate the report first.");
      setIsSummarizing(false);
      return;
    }
    setIsSummarizing(true);
    setAiSummary(""); // Clear previous AI summary

    if (!reportContentRef.current) {
      showError("Report content not rendered. Please ensure the report is visible and fully loaded.");
      setIsSummarizing(false);
      return;
    }

    try {
      const rawText = generateReportTextContent();
      let textToSummarize = rawText.trim();

      if (!textToSummarize) {
        console.warn("Client-side: Report text content is empty after extraction. Cannot send for AI summary.");
        showError("No report content found to summarize. Please ensure the report is fully loaded and visible.");
        setIsSummarizing(false);
        return;
      }
      // NEW: Log the textToSummarize right before sending
      console.log("Client-side: Final textToSummarize before sending to Edge Function:", `"${textToSummarize.substring(0, 500)}..."`, "length:", textToSummarize.length);


      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showError("You must be logged in to use the AI Summary tool.");
        setIsSummarizing(false);
        return;
      }

      // NEW: Log the session and access_token before the fetch call
      console.log("Client-side: Session object before fetch:", session);
      console.log("Client-side: Access token before fetch:", session.access_token);

      // NEW: Direct fetch request to the Edge Function
      const edgeFunctionUrl = `https://nojumocxivfjsbqnnkqe.supabase.co/functions/v1/summarize-report`;
      console.log("Client-side: Making direct fetch request to:", edgeFunctionUrl);

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
        console.error("Client-side: Direct fetch to Edge Function failed. Status:", response.status, "Error data:", errorData);
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
      console.error("Error generating summary:", error); // Changed log message
      showError(`Error generating summary: ${error.message}`);
    } finally {
      setIsSummarizing(false);
    }
  };

  if (!reportId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">
          Select a report from the sidebar to get started.
        </div>
      </div>
    );
  }

  if (!CurrentReportComponent) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-destructive">
          Report type "{reportId}" not found.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-grow"> {/* Changed h-full to flex-grow */}
      {/* Removed Report Configuration Card as it's now in the parent Reports component */}

      <div className="flex-grow overflow-y-auto">
        <CurrentReportComponent
          dateRange={dateRange} // NEW: Pass dateRange prop to child component
          onGenerateReport={handleGenerateReport}
          isLoading={isLoadingReport}
          reportContentRef={reportContentRef} // Pass ref to child component
        />
      </div>

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
            <div className="bg-muted/20<dyad-problem-report summary="5 problems">
<problem file="src/components/reports/pdf/PurchaseOrderStatusPdfContent.tsx" line="83" column="13" code="1005">'&gt;' expected.</problem>
<problem file="src/components/warehouse-operations/PickingWaveManagementTool.tsx" line="139" column="35" code="2339">Property 'name' does not exist on type 'CompanyProfile'.</problem>
<problem file="src/components/warehouse-operations/PickingWaveManagementTool.tsx" line="140" column="38" code="2339">Property 'address' does not exist on type 'CompanyProfile'.</problem>
<problem file="src/components/warehouse-operations/PickingWaveManagementTool.tsx" line="141" column="38" code="2339">Property 'currency' does not exist on type 'CompanyProfile'.</problem>
<problem file="src/components/warehouse-operations/PickingWaveManagementTool.tsx" line="147" column="34" code="2339">Property 'name' does not exist on type 'CompanyProfile'.</problem>
</dyad-problem-report>You are absolutely right to point out these remaining errors. My apologies for the continued issues. I will fix these 5 TypeScript compile-time errors immediately and with utmost caution.

The errors are primarily due to incorrect property access on the `companyProfile` object within `PickingWaveManagementTool.tsx` and a missing closing tag in `PurchaseOrderStatusPdfContent.tsx`.

---

### Fix 1: `src/components/reports/pdf/PurchaseOrderStatusPdfContent.tsx` (Error 1)

This is a simple syntax error, a missing closing `</span>` tag.

<dyad-write path="src/components/reports/pdf/PurchaseOrderStatusPdfContent.tsx" description="Fixing missing closing span tag.">
import React from "react";
import { format, isValid } from "date-fns";
import { OrderItem } from "@/context/OrdersContext";
import { parseAndValidateDate } from "@/utils/dateUtils";
import { DateRange } from "react-day-picker";
import { useProfile } from "@/context/ProfileContext";

interface PurchaseOrderStatusPdfContentProps {
  companyLogoUrl?: string;
  reportDate: string;
  orders: OrderItem[];
  statusFilter: "all" | "new-order" | "processing" | "packed" | "shipped" | "on-hold-problem" | "archived";
  dateRange?: DateRange;
}

const PurchaseOrderStatusPdfContent: React.FC<PurchaseOrderStatusPdfContentProps> = ({
  companyLogoUrl,
  reportDate,
  orders,
  statusFilter,
  dateRange,
}) => {
  const { profile } = useProfile();

  if (!profile || !profile.companyProfile) {
    return <div className="text-center text-red-500">Error: Company profile not loaded.</div>;
  }

  const formattedDateRange = (dateRange?.from && isValid(dateRange.from))
    ? `${format(dateRange.from, "MMM dd, yyyy")} - ${dateRange.to && isValid(dateRange.to) ? format(dateRange.to, "MMM dd, yyyy") : format(dateRange.from, "MMM dd, yyyy")}`
    : "All Time";

  const reportTitle = statusFilter === "all"
    ? "PURCHASE ORDER STATUS REPORT"
    : `PURCHASE ORDERS (${statusFilter.replace(/-/g, ' ').toUpperCase()})`;

  const totalOrders = orders.length;
  const totalAmount = orders.reduce((sum, order) => sum + order.totalAmount, 0);

  return (
    <div className="bg-white text-gray-900 font-sans text-sm p-[20mm]">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          {profile.companyProfile.companyLogoUrl ? ( // Corrected access
            <img src={profile.companyProfile.companyLogoUrl} alt="Company Logo" className="max-h-20 object-contain mb-2" style={{ maxWidth: '1.5in' }} />
          ) : (
            <div className="max-h-20 mb-2" style={{ maxWidth: '1.5in' }}></div>
          )}
          <h1 className="text-5xl font-extrabold uppercase tracking-tight mb-2">
            {reportTitle}
          </h1>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold">REPORT DATE: {parseAndValidateDate(reportDate) ? format(parseAndValidateDate(reportDate)!, "MMM dd, yyyy HH:mm") : "N/A"}</p>
          <p className="text-sm font-semibold">DATA PERIOD: {formattedDateRange}</p>
        </div>
      </div>

      {/* Company Info */}
      <div className="mb-8">
        <p className="font-bold mb-2">REPORT FOR:</p>
        <div className="bg-gray-50 p-3 border border-gray-200 rounded">
          <p className="font-semibold">{profile.companyProfile.companyName || "Your Company"}</p> {/* Corrected access */}
          <p>{profile.companyProfile.companyCurrency || "N/A"}</p> {/* Corrected access */}
          <p>{profile.companyProfile.companyAddress?.split('\n')[0] || "N/A"}</p> {/* Corrected access */}
          <p>{profile.companyProfile.companyAddress?.split('\n')[1] || ""}</p> {/* Corrected access */}
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <p className="font-bold mb-2">OVERALL SUMMARY:</p>
          <div className="bg-gray-50 p-3 border border-gray-200 rounded space-y-2">
            <div className="flex justify-between">
              <span className="font-semibold">Total Purchase Orders:</span>
              <span>{totalOrders.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Total Value of Orders:</span>
              <span>${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Orders Table */}
      <div className="mb-8">
        <p className="font-bold mb-2">DETAILED PURCHASE ORDERS:</p>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100 border border-gray-300">
              <th className="py-2 px-4 text-left font-semibold border-r border-gray-300">Order ID</th>
              <th className="py-2 px-4 text-left font-semibold border-r border-gray-300">Supplier</th>
              <th className="py-2 px-4 text-left font-semibold border-r border-gray-300">Order Date</th>
              <th className="py-2 px-4 text-left font-semibold border-r border-gray-300">Due Date</th>
              <th className="py-2 px-4 text-left font-semibold border-r border-gray-300">Status</th>
              <th className="py-2 px-4 text-right font-semibold">Total Amount</th>
            </tr>
          </thead>
          <tbody>
            {orders.length > 0 ? (
              orders.map((order) => {
                const orderDate = parseAndValidateDate(order.date);
                const dueDate = parseAndValidateDate(order.dueDate);
                return (
                  <tr key={order.id} className="border-b border-gray-200">
                    <td className="py-2 px-4 border-r border-gray-200">{order.id}</td>
                    <td className="py-2 px-4 border-r border-gray-200">{order.customerSupplier}</td>
                    <td className="py-2 px-4 border-r border-gray-200">{orderDate ? format(orderDate, "MMM dd, yyyy") : "N/A"}</td>
                    <td className="py-2 px-4 border-r border-gray-200">{dueDate ? format(dueDate, "MMM dd, yyyy") : "N/A"}</td>
                    <td className="py-2 px-4 border-r border-gray-200">{order.status}</td>
                    <td className="py-2 px-4 text-right">${order.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                );
              })
            ) : (
              <tr className="border-b border-gray-200">
                <td colSpan={6} className="py-2 px-4 text-center text-gray-600">No purchase orders found for this report.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="text-xs text-gray-500 mt-12 text-right">
        <p>Generated by Fortress on {parseAndValidateDate(reportDate) ? format(parseAndValidateDate(reportDate)!, "MMM dd, yyyy HH:mm") : "N/A"}</p>
      </div>
    </div>
  );
};

export default PurchaseOrderStatusPdfContent;