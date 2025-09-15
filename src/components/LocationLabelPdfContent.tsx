import React from "react";
import { Diamond } from "lucide-react";

interface LocationLabelPdfContentProps {
  folderName: string; // Changed from area, row, bay, level, pos
  color: string;
  qrCodeSvg: string;
  printDate: string;
  folderIdentifier: string; // Changed from locationString
  className?: string;
}

const LocationLabelPdfContent = React.forwardRef<HTMLDivElement, LocationLabelPdfContentProps>(({
  folderName, // Changed from area, row, bay, level, pos
  color,
  qrCodeSvg,
  className,
}, ref) => {
  return (
    <div ref={ref} className={`bg-white text-gray-900 font-sans w-[101.6mm] h-[50.8mm] border border-black relative overflow-hidden ${className || ''}`}>
      {/* QR Code at the top left */}
      <div className="absolute top-[2mm] left-[2mm] w-[45mm] h-[45mm] flex items-center justify-center z-0 p-1 bg-white">
        <div dangerouslySetInnerHTML={{ __html: qrCodeSvg }} className="w-full h-full object-contain" />
      </div>

      {/* Diamond Icon at the top right */}
      <div className="absolute top-[2mm] right-[2mm] z-10">
        <Diamond className="h-6 w-6 text-gray-700" />
      </div>

      {/* Folder Name - positioned on the right side of the label */}
      <div className="absolute top-[2mm] right-[2mm] w-[50mm] h-[45mm] flex flex-col justify-center items-center z-10">
        <div className="flex flex-col items-center leading-none">
          <span className="text-[0.6rem] font-bold uppercase text-gray-700">FOLDER</span>
          <span className="text-3xl font-extrabold text-black text-center px-2 rounded-sm" style={{ backgroundColor: color }}>{folderName}</span> {/* Display folderName */}
        </div>
      </div>
    </div>
  );
});

LocationLabelPdfContent.displayName = "LocationLabelPdfContent";

export default LocationLabelPdfContent;