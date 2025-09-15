import React from "react";
import { format, isValid } from "date-fns";
import { parseAndValidateDate } from "@/utils/dateUtils";
import { useProfile } from "@/context/ProfileContext";
import { useOnboarding } from "@/context/OnboardingContext"; // Import useOnboarding for folder names

interface PickListItem {
  itemName: string;
  itemSku: string;
  pickingBinFolderId: string; // Changed from pickingBinLocation to pickingBinFolderId
  quantityToPick: number;
}

interface PickingWavePdfContentProps {
  waveId: string;
  pickDate: string;
  ordersInWave: { id: string; customerSupplier: string; deliveryRoute?: string }[];
  pickListItems: PickListItem[];
  pickerName?: string;
}

const PickingWavePdfContent: React.FC<PickingWavePdfContentProps> = ({
  waveId,
  pickDate,
  ordersInWave,
  pickListItems,
  pickerName,
}) => {
  const { profile } = useProfile();
  const { inventoryFolders } = useOnboarding(); // Get inventoryFolders
  const pickDateObj = parseAndValidateDate(pickDate);

  if (!profile || !profile.companyProfile) {
    return <div className="text-center text-red-500">Error: Company profile not loaded.</div>;
  }

  // Helper to get folder name from ID
  const getFolderName = (folderId: string) => {
    const folder = inventoryFolders.find(f => f.id === folderId);
    return folder?.name || "Unknown Folder";
  };

  return (
    <div className="bg-white text-gray-900 font-sans text-sm p-[20mm]">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          {profile.companyProfile.companyLogoUrl ? (
            <img src={profile.companyProfile.companyLogoUrl} alt="Company Logo" className="max-h-20 object-contain mb-2" style={{ maxWidth: '1.5in' }} />
          ) : (
            <div className="max-h-20 mb-2" style={{ maxWidth: '1.5in' }}></div>
          )}
          <h1 className="text-5xl font-extrabold uppercase tracking-tight mb-2">
            PICKING WAVE
          </h1>
          <p className="text-lg font-semibold text-gray-700">Wave ID: {waveId}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold">PICK DATE: {pickDateObj && isValid(pickDateObj) ? format(pickDateObj, "MMM dd, yyyy") : "N/A"}</p>
          {pickerName && <p className="text-sm font-semibold">PICKER: {pickerName}</p>}
        </div>
      </div>

      {/* Company Info */}
      <div className="mb-8">
        <p className="font-bold mb-2">ISSUED BY:</p>
        <div className="bg-gray-50 p-3 border border-gray-200 rounded">
          <p className="font-semibold">{profile.companyProfile.companyName || "Your Company"}</p>
          <p>{profile.companyProfile.companyCurrency || "N/A"}</p>
          <p>{profile.companyProfile.companyAddress?.split('\n')[0] || "N/A"}</p>
          <p>{profile.companyProfile.companyAddress?.split('\n')[1] || ""}</p>
        </div>
      </div>

      {/* Orders in Wave */}
      <div className="mb-8">
        <p className="font-bold mb-2">ORDERS IN THIS WAVE:</p>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100 border border-gray-300">
              <th className="py-2 px-4 text-left font-semibold border-r border-gray-300">Order ID</th>
              <th className="py-2 px-4 text-left font-semibold border-r border-gray-300">Customer</th>
              <th className="py-2 px-4 text-left font-semibold">Delivery Route</th>
            </tr>
          </thead>
          <tbody>
            {ordersInWave.map((order, _index) => (
              <tr key={order.id} className="border-b border-gray-200">
                <td className="py-2 px-4 border-r border-gray-200">{order.id}</td>
                <td className="py-2 px-4 border-r border-gray-200">{order.customerSupplier}</td>
                <td className="py-2 px-4">{order.deliveryRoute || 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pick List Items */}
      <div className="mb-8">
        <p className="font-bold mb-2">PICK LIST (SEQUENCED FOR EFFICIENCY):</p>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100 border border-gray-300">
              <th className="py-2 px-4 text-left font-semibold border-r border-gray-300">Item Name</th>
              <th className="py-2 px-4 text-left font-semibold border-r border-gray-300">SKU</th>
              <th className="py-2 px-4 text-left font-semibold border-r border-gray-300">Folder</th> {/* Updated to Folder */}
              <th className="py-2 px-4 text-right font-semibold">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {pickListItems.map((item, _index) => (
              <tr key={_index} className="border-b border-gray-200">
                <td className="py-2 px-4 border-r border-gray-200">{item.itemName}</td>
                <td className="py-2 px-4 border-r border-gray-200">{item.itemSku}</td>
                <td className="py-2 px-4 border-r border-gray-200">{getFolderName(item.pickingBinFolderId)}</td> {/* Updated to folder name */}
                <td className="py-2 px-4 text-right">{item.quantityToPick}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="text-xs text-gray-500 mt-12 text-right">
        <p>Generated by Fortress on {pickDateObj && isValid(pickDateObj) ? format(pickDateObj, "MMM dd, yyyy HH:mm") : "N/A"}</p>
      </div>
    </div>
  );
};

export default PickingWavePdfContent;