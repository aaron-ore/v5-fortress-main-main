import React from "react";
import { format, isValid } from "date-fns";
import { parseAndValidateDate } from "@/utils/dateUtils";
import { DateRange } from "react-day-picker";
import { useProfile } from "@/context/ProfileContext";

interface ProfitabilityMetricsData {
  name: string;
  value: number;
  color: string;
}

interface ProfitabilityPdfContentProps {
  reportDate: string;
  metricsData: ProfitabilityMetricsData[];
  totalSalesRevenue: number;
  totalCostOfGoodsSold: number;
  dateRange?: DateRange;
  groupBy: "category" | "product"; // Added groupBy prop
}

const ProfitabilityPdfContent: React.FC<ProfitabilityPdfContentProps> = ({
  reportDate,
  metricsData,
  totalSalesRevenue,
  totalCostOfGoodsSold,
  dateRange,
  groupBy, // Destructure groupBy
}) => {
  const { profile } = useProfile();

  if (!profile || !profile.companyProfile) {
    return <div className="text-center text-red-500">Error: Company profile not loaded.</div>;
  }

  const formattedDateRange = (dateRange?.from && isValid(dateRange.from))
    ? `${format(dateRange.from, "MMM dd, yyyy")} - ${dateRange.to && isValid(dateRange.to) ? format(dateRange.to, "MMM dd, yyyy") : format(dateRange.from, "MMM dd, yyyy")}`
    : "All Time";

  const grossProfit = totalSalesRevenue - totalCostOfGoodsSold;

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
            PROFITABILITY REPORT
          </h1>
          <p className="text-lg font-semibold text-gray-700">Grouped by: {groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}</p>
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
          <p className="font-semibold">{profile.companyProfile.companyName || "Your Company"}</p>
          <p>{profile.companyProfile.companyCurrency || "N/A"}</p>
          <p>{profile.companyProfile.companyAddress?.split('\n')[0] || "N/A"}</p>
          <p>{profile.companyProfile.companyAddress?.split('\n')[1] || ""}</p>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <p className="font-bold mb-2">FINANCIAL SUMMARY:</p>
          <div className="bg-gray-50 p-3 border border-gray-200 rounded space-y-2">
            <div className="flex justify-between">
              <span className="font-semibold">Total Sales Revenue:</span>
              <span>${totalSalesRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Total Cost of Goods Sold:</span>
              <span>${totalCostOfGoodsSold.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Gross Profit:</span>
              <span>${grossProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            {metricsData.map((metric, index) => (
              <div key={index} className="flex justify-between">
                <span className="font-semibold">{metric.name}:</span>
                <span>{metric.value.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed Metrics Table (if applicable, or just list key metrics) */}
      <div className="mb-8">
        <p className="font-bold mb-2">PROFITABILITY METRICS:</p>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100 border border-gray-300">
              <th className="py-2 px-4 text-left font-semibold border-r border-gray-300">Metric</th>
              <th className="py-2 px-4 text-right font-semibold">Value (%)</th>
            </tr>
          </thead>
          <tbody>
            {metricsData.length > 0 ? (
              metricsData.map((metric, index) => (
                <tr key={index} className="border-b border-gray-200">
                  <td className="py-2 px-4 border-r border-gray-200">{metric.name}</td>
                  <td className="py-2 px-4 text-right">{metric.value.toFixed(1)}%</td>
                </tr>
              ))
            ) : (
              <tr className="border-b border-gray-200">
                <td colSpan={2} className="py-2 px-4 text-center text-gray-600">No profitability metrics available for this report.</td>
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

export default ProfitabilityPdfContent;