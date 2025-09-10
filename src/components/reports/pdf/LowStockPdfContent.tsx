import React from "react";
import { format, isValid } from "date-fns";
import { InventoryItem } from "@/context/InventoryContext";
import { parseAndValidateDate } from "@/utils/dateUtils";
import { DateRange } from "react-day-picker";
import { Location } from "@/context/OnboardingContext";
import { useProfile } from "@/context/ProfileContext";

interface LowStockPdfContentProps {
  reportDate: string;
  items: InventoryItem[];
  statusFilter: "all" | "low-stock" | "out-of-stock";
  dateRange?: DateRange;
  structuredLocations: Location[];
}

const LowStockPdfContent: React.FC<LowStockPdfContentProps> = ({
  reportDate,
  items,
  statusFilter,
  dateRange,
  structuredLocations,
}) => {
  const { profile } = useProfile();

  if (!profile || !profile.companyProfile) {
    return <div className="text-center text-red-500">Error: Company profile not loaded.</div>;
  }

  const formattedDateRange = (dateRange?.from && isValid(dateRange.from))
    ? `${format(dateRange.from, "MMM dd, yyyy")} - ${dateRange.to && isValid(dateRange.to) ? format(dateRange.to, "MMM dd, yyyy") : format(dateRange.from, "MMM dd, yyyy")}`
    : "All Time";

  const reportTitle = statusFilter === "low-stock"
    ? "LOW STOCK ITEMS"
    : statusFilter === "out-of-stock"
      ? "OUT OF STOCK ITEMS"
      : "LOW & OUT OF STOCK ITEMS";

  const getLocationDisplayName = (fullLocationString: string) => {
    const foundLoc = structuredLocations.find(loc => loc.fullLocationString === fullLocationString);
    return foundLoc?.displayName || fullLocationString;
  };

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

      {/* Summary */}
      <div className="mb-8">
        <p className="font-bold mb-2">SUMMARY:</p>
        <div className="bg-gray-50 p-3 border border-gray-200 rounded">
          <p className="font-semibold">Total {reportTitle} Items: {items.length}</p>
          <p className="text-xs text-gray-600 mt-1">
            This report lists inventory items that are currently at or below their reorder level, or completely out of stock.
          </p>
        </div>
      </div>

      {/* Detailed Items Table */}
      <div className="mb-8">
        <p className="font-bold mb-2">DETAILED ITEMS:</p>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100 border border-gray-300">
              <th className="py-2 px-4 text-left font-semibold border-r border-gray-300">Item Name</th>
              <th className="py-2 px-4 text-left font-semibold border-r border-gray-300">SKU</th>
              <th className="py-2 px-4 text-right font-semibold border-r border-gray-300">Quantity</th>
              <th className="py-2 px-4 text-right font-semibold">Reorder Level</th>
              <th className="py-2 px-4 text-left font-semibold">Location</th>
            </tr>
          </thead>
          <tbody>
            {items.length > 0 ? (
              items.map((item) => (
                <tr key={item.id} className="border-b border-gray-200">
                  <td className="py-2 px-4 border-r border-gray-200">{item.name}</td>
                  <td className="py-2 px-4 border-r border-gray-200">{item.sku}</td>
                  <td className="py-2 px-4 text-right border-r border-gray-200 text-red-600">{item.quantity}</td>
                  <td className="py-2 px-4 text-right">{item.reorderLevel}</td>
                  <td className="py-2 px-4">{getLocationDisplayName(item.location)}</td>
                </tr>
              ))
            ) : (
              <tr className="border-b border-gray-200">
                <td colSpan={5} className="py-2 px-4 text-center text-gray-600">No items found for this report.</td>
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

export default LowStockPdfContent;