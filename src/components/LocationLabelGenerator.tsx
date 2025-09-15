import React, { useState, useEffect, useMemo, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, Download, Save } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { usePrint, PrintContentData } from "@/context/PrintContext";
import { useOnboarding, InventoryFolder } from "@/context/OnboardingContext"; // Updated import to InventoryFolder
import { generateQrCodeSvg } from "@/utils/qrCodeGenerator";
import { format } from "date-fns";
import LocationLabelPdfContent from "@/components/LocationLabelPdfContent";
import html2canvas from 'html2canvas';
// Removed buildLocationString, getUniqueLocationParts, LocationParts as they are not directly used for folders

// Predefined colors for labels, matching some of the designs
const labelColors = [
  { name: "Green", hex: "#4CAF50" },
  { name: "Blue", hex: "#2196F3" },
  { name: "Purple", hex: "#9C27B0" },
  { name: "Yellow", hex: "#FFEB3B" },
  { name: "Red", hex: "#F44336" },
  { name: "Orange", hex: "#FF9800" },
];

interface LocationLabelGeneratorProps {
  initialLocation?: InventoryFolder | null; // Updated from Location to InventoryFolder
  onSave: (folder: Omit<InventoryFolder, 'id' | 'createdAt' | 'userId' | 'organizationId'>, isNew: boolean) => void; // Updated to InventoryFolder
  onClose: () => void;
  onGenerateAndPrint?: (data: PrintContentData[]) => void;
}

const LocationLabelGenerator: React.FC<LocationLabelGeneratorProps> = ({
  initialLocation,
  onSave,
  onClose,
  onGenerateAndPrint,
}) => {
  const { initiatePrint } = usePrint();
  const { inventoryFolders: existingFoldersInContext } = useOnboarding(); // Updated to inventoryFolders

  const [folderName, setFolderName] = useState(initialLocation?.name || ""); // Changed from displayName to folderName
  const [selectedColor, setSelectedColor] = useState(initialLocation?.color || labelColors[0].hex);
  const [quantity, setQuantity] = useState("1");
  const [qrCodeSvg, setQrCodeSvg] = useState<string | null>(null);

  const labelPreviewRef = useRef<HTMLDivElement>(null);

  // Removed uniqueAreas, uniqueRows, etc.

  useEffect(() => {
    setFolderName(initialLocation?.name || ""); // Changed from displayName to folderName
    setSelectedColor(initialLocation?.color || labelColors[0].hex);
    setQuantity("1");
  }, [initialLocation]);

  const folderIdentifier = useMemo(() => { // Changed from fullLocationString to folderIdentifier
    return folderName; // For folders, the name is the identifier
  }, [folderName]);

  useEffect(() => {
    const generatePreviewQr = async () => {
      if (folderIdentifier) {
        try {
          const svg = await generateQrCodeSvg(folderIdentifier, 150);
          setQrCodeSvg(svg);
        } catch (error) {
          console.error("Error generating QR for preview:", error);
          setQrCodeSvg(null);
        }
      } else {
        setQrCodeSvg(null);
      }
    };
    generatePreviewQr();
  }, [folderIdentifier]);

  const handleSaveFolderDetails = async () => { // Renamed from handleSaveLocationDetails
    if (!folderName || !selectedColor) { // Validate folderName
      showError("Please fill in the folder name and select a color.");
      return;
    }

    const isNew = !initialLocation;

    const duplicateExists = existingFoldersInContext.some(folder => // Check against existingFoldersInContext
      folder.name.toLowerCase() === folderName.trim().toLowerCase() &&
      folder.id !== initialLocation?.id
    );

    if (duplicateExists) {
      showError(`A folder with the name "${folderName}" already exists. Please choose a unique name.`);
      return;
    }

    const folderData: Omit<InventoryFolder, 'id' | 'createdAt' | 'userId' | 'organizationId'> = { // Create InventoryFolder object
      name: folderName.trim(),
      color: selectedColor,
      // parentId, description, imageUrl, tags can be added via a more detailed dialog
    };

    onSave(folderData, isNew);
    onClose();
  };

  const handleGenerateAndPrint = async () => {
    if (!folderName || !selectedColor || !quantity) { // Validate folderName
      showError("Please fill in the folder name and select a color.");
      return;
    }

    const numQuantity = parseInt(quantity);
    if (isNaN(numQuantity) || numQuantity <= 0 || numQuantity > 100) {
      showError("Please enter a valid quantity between 1 and 100.");
      return;
    }

    try {
      const qrSvg = await generateQrCodeSvg(folderIdentifier, 150);

      const labelsToPrint: PrintContentData[] = Array.from({ length: numQuantity }).map(() => ({
        type: "location-label", // Reusing location-label type for now
        props: {
          folderName: folderName, // Pass folderName
          color: selectedColor,
          qrCodeSvg: qrSvg,
          printDate: format(new Date(), "MMM dd, yyyy HH:mm"),
          folderIdentifier: folderIdentifier, // Pass folderIdentifier
        },
      }));

      if (onGenerateAndPrint) {
        onGenerateAndPrint(labelsToPrint);
      } else {
        for (const label of labelsToPrint) {
          initiatePrint(label);
        }
        showSuccess(`Generated and sent ${numQuantity} folder labels to printer!`);
      }
    } catch (error: any) {
      showError(`Failed to generate labels: ${error.message}`);
    }
  };

  const handleDownloadPng = async () => {
    if (!labelPreviewRef.current) {
      showError("No label preview available to download.");
      return;
    }

    try {
      const canvas = await html2canvas(labelPreviewRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `folder-label-${folderIdentifier}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showSuccess("Label downloaded as PNG!");
    } catch (error: any) {
      console.error("Error downloading label as PNG:", error);
      showError(`Failed to download label as PNG: ${error.message}`);
    }
  };

  const isSaveDisabled = !folderName || !selectedColor; // Validate folderName

  return (
    <div className="space-y-4 flex-grow flex flex-col p-4">
      <div className="space-y-2">
        <Label htmlFor="folderName">Folder Name <span className="text-red-500">*</span></Label> {/* Updated label */}
        <Input id="folderName" value={folderName} onChange={(e) => setFolderName(e.target.value)} placeholder="e.g., Main Warehouse" aria-label="Folder Name" /> {/* Updated to folderName */}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Removed Area, Row, Bay, Level, Pos inputs */}
        <div className="space-y-2">
          <Label htmlFor="color">Label Color</Label>
          <Select value={selectedColor} onValueChange={setSelectedColor}>
            <SelectTrigger id="color" aria-label="Select label color">
              <SelectValue placeholder="Select a color" />
            </SelectTrigger>
            <SelectContent>
              {labelColors.map((c) => (
                <SelectItem key={c.hex} value={c.hex}>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: c.hex }}></div>
                    {c.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="quantity">Number of Labels to Print (1-100)</Label>
        <Input
          id="quantity"
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="1"
          min="1"
          max="100"
          aria-label="Number of labels to print"
        />
      </div>

      <div className="flex-grow flex flex-col items-center justify-center min-h-[150px] border border-dashed border-muted-foreground/50 rounded-md p-2">
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">Label Preview</h3>
        {qrCodeSvg ? (
          <div className="w-[101.6mm] h-[50.8mm] flex items-center justify-center overflow-hidden p-1 bg-white">
            <LocationLabelPdfContent // Reusing LocationLabelPdfContent
              ref={labelPreviewRef}
              folderName={folderName} // Pass folderName
              color={selectedColor}
              qrCodeSvg={qrCodeSvg}
              printDate={format(new Date(), "MMM dd, yyyy HH:mm")}
              folderIdentifier={folderIdentifier} // Pass folderIdentifier
            />
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Enter details to see a preview.</p>
        )}
      </div>
      <div className="flex gap-2 w-full mt-auto">
        <Button onClick={handleSaveFolderDetails} className="flex-grow" disabled={isSaveDisabled}>
          <Save className="h-4 w-4 mr-2" /> {initialLocation ? "Save Changes" : "Save Folder"} {/* Updated button text */}
        </Button>
        <Button onClick={handleGenerateAndPrint} className="flex-grow" variant="secondary" disabled={isSaveDisabled}>
          <Printer className="h-4 w-4 mr-2" /> Generate & Print Labels
        </Button>
        <Button onClick={handleDownloadPng} className="flex-grow" variant="outline" disabled={isSaveDisabled}>
          <Download className="h-4 w-4 mr-2" /> Download PNG
        </Button>
      </div>
    </div>
  );
};

export default LocationLabelGenerator;