import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Upload } from "lucide-react";
import * as XLSX from 'xlsx';
import { useInventory } from "@/context/InventoryContext";
import { useCategories } from "@/context/CategoryContext";
import { useOnboarding, Location } from "@/context/OnboardingContext";
import { showError, showSuccess } from "@/utils/toast";
import { generateInventoryCsvTemplate } from "@/utils/csvGenerator";
import DuplicateItemsWarningDialog from "@/components/DuplicateItemsWarningDialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import { parseLocationString } from "@/utils/locationParser";
import { supabase } from "@/lib/supabaseClient";
import { uploadFileToSupabase } from "@/integrations/supabase/storage";
import { useProfile } from "@/context/ProfileContext";

interface CsvDuplicateItem {
  sku: string;
  csvQuantity: number;
  itemName: string;
}

interface ImportCsvDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const ImportCsvDialog: React.FC<ImportCsvDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const { inventoryItems, refreshInventory } = useInventory();
  const { categories, addCategory } = useCategories();
  const { locations, addLocation } = useOnboarding();
  const { profile } = useProfile();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [jsonDataToProcess, setJsonDataToProcess] = useState<any[] | null>(null);

  // States for New Locations Confirmation
  const [newLocationsToConfirm, setNewLocationsToConfirm] = useState<string[]>([]);
  const [isConfirmNewLocationsDialogOpen, setIsConfirmNewLocationsDialogOpen] = useState(false);

  // States for Duplicate SKUs Warning
  const [duplicateSkusInCsv, setDuplicateSkusInCsv] = useState<CsvDuplicateItem[]>([]);
  const [isDuplicateItemsWarningDialogOpen, setIsDuplicateItemsWarningDialogOpen] = useState(false);
  const [duplicateAction, setDuplicateAction] = useState<"skip" | "add_to_stock" | "update">("skip");

  // Memoize existing SKUs for efficient lookup
  const existingInventorySkus = useMemo(() => {
    return new Set(inventoryItems.map(item => item.sku.toLowerCase()));
  }, [inventoryItems]);

  useEffect(() => {
    if (isOpen) {
      setSelectedFile(null);
      setJsonDataToProcess(null);
      setNewLocationsToConfirm([]);
      setIsConfirmNewLocationsDialogOpen(false);
      setDuplicateSkusInCsv([]);
      setIsDuplicateItemsWarningDialogOpen(false);
      setDuplicateAction("skip");
    }
  }, [isOpen]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      if (file.name.endsWith(".csv")) {
        setSelectedFile(file);
      } else {
        showError("Please select a CSV file.");
        setSelectedFile(null);
      }
    } else {
      setSelectedFile(null);
    }
  };

  const checkForNewLocationsAndProceed = async (data: any[], actionForDuplicates: "skip" | "add_to_stock" | "update") => {
    const uniqueLocationsInCsv = Array.from(new Set(data.map(row => String(row.location || '').trim())));
    const uniquePickingBinLocationsInCsv = Array.from(new Set(data.map(row => String(row.pickingBinLocation || '').trim())));
    const allUniqueLocationsInCsv = Array.from(new Set([...uniqueLocationsInCsv, ...uniquePickingBinLocationsInCsv]));

    const existingLocationsLower = new Set(locations.map(loc => loc.fullLocationString.toLowerCase()));
    const newLocations = allUniqueLocationsInCsv.filter(loc => loc && !existingLocationsLower.has(loc.toLowerCase()));

    if (newLocations.length > 0) {
      setNewLocationsToConfirm(newLocations);
      setDuplicateAction(actionForDuplicates);
      setIsConfirmNewLocationsDialogOpen(true);
      setIsUploading(false);
    } else {
      await invokeEdgeFunction(data, actionForDuplicates);
      setSelectedFile(null);
    }
  };

  const invokeEdgeFunction = async (dataToProcess: any[], actionForDuplicates: "skip" | "add_to_stock" | "update") => {
    if (!profile?.organizationId || !profile?.id) {
      showError("User or organization not loaded. Cannot perform import.");
      setIsUploading(false);
      return;
    }

    setIsUploading(true);
    let uploadedFilePath: string | null = null;

    try {
      if (!selectedFile) {
        throw new Error("No file selected for upload.");
      }
      uploadedFilePath = await uploadFileToSupabase(selectedFile, 'csv-uploads', 'inventory-imports/');
      showSuccess("CSV file uploaded to storage. Processing...");

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        throw new Error("User session not found. Please log in again.");
      }

      const edgeFunctionUrl = `https://nojumocxivfjsbqnnkqe.supabase.co/functions/v1/process-csv-inventory-upload`;
      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          filePath: uploadedFilePath,
          organizationId: profile.organizationId,
          userId: profile.id,
          actionForDuplicates: actionForDuplicates,
        }),
      });

      if (!response.ok) {
        let errorDetail = `Edge Function failed with status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorDetail = errorData.error || errorDetail;
        } catch (jsonError) {
          console.error("Failed to parse error response JSON:", jsonError);
          errorDetail = `Edge Function failed with status: ${response.status}. Response was not valid JSON.`;
        }
        throw new Error(errorDetail);
      }

      const result = await response.json();
      if (result.success) {
        showSuccess(result.message);
      } else {
        showError(result.message || "Bulk import completed with errors. Check console for details.");
        console.error("Bulk Import Errors:", result.errors);
      }
      refreshInventory();
      onClose();

    } catch (error: any) {
      console.error("Error during bulk import process:", error);
      const errorMessage = typeof error === 'string' ? error : (error.message || "An unknown error occurred during bulk import.");
      showError(`Bulk import failed: ${errorMessage}`);
    } finally {
      setIsUploading(false);
      setSelectedFile(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      showError("Please select a CSV file to upload.");
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const binaryString = e.target?.result;
        if (typeof binaryString !== 'string') {
          showError("Failed to read file content.");
          setIsUploading(false);
          return;
        }

        const workbook = XLSX.read(binaryString, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          showError("The CSV file is empty or contains no data rows.");
          setIsUploading(false);
          return;
        }

        setJsonDataToProcess(jsonData);

        const duplicates: CsvDuplicateItem[] = [];
        const seenSkus = new Set<string>();
        jsonData.forEach(row => {
          const sku = String(row.sku || '').trim();
          if (sku && existingInventorySkus.has(sku.toLowerCase())) {
            if (!seenSkus.has(sku.toLowerCase())) {
              duplicates.push({
                sku: sku,
                csvQuantity: parseInt(String(row.pickingBinQuantity || '0')) + parseInt(String(row.overstockQuantity || '0')),
                itemName: String(row.name || '').trim(),
              });
              seenSkus.add(sku.toLowerCase());
            }
          }
        });

        if (duplicates.length > 0) {
          setDuplicateSkusInCsv(duplicates);
          setIsDuplicateItemsWarningDialogOpen(true);
        } else {
          await checkForNewLocationsAndProceed(jsonData, "skip");
        }

      } catch (parseError: any) {
        showError(`Error parsing CSV file: ${parseError.message}`);
        console.error("CSV Parse Error:", parseError);
      } finally {
      }
    };

    reader.onerror = () => {
      showError("Failed to read file.");
      setIsUploading(false);
      setSelectedFile(null);
    };

    reader.readAsBinaryString(selectedFile);
  };

  const handleDownloadTemplate = () => {
    const csv = generateInventoryCsvTemplate();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "inventory_import_template.csv");
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showSuccess("CSV template downloaded!");
    } else {
      showError("Your browser does not support downloading files directly.");
    }
  };

  const handleSkipAllDuplicates = async () => {
    setIsDuplicateItemsWarningDialogOpen(false);
    if (jsonDataToProcess) {
      await checkForNewLocationsAndProceed(jsonDataToProcess, "skip");
    } else {
      setIsUploading(false);
      setSelectedFile(null);
      onClose();
    }
  };

  const handleAddToExistingStock = async () => {
    setIsDuplicateItemsWarningDialogOpen(false);
    if (jsonDataToProcess) {
      await checkForNewLocationsAndProceed(jsonDataToProcess, "add_to_stock");
    } else {
      setIsUploading(false);
      setSelectedFile(null);
      onClose();
    }
  };

  const handleUpdateExisting = async () => {
    setIsDuplicateItemsWarningDialogOpen(false);
    if (jsonDataToProcess) {
      await checkForNewLocationsAndProceed(jsonDataToProcess, "update");
    } else {
      setIsUploading(false);
      setSelectedFile(null);
      onClose();
    }
  };

  const handleCancelDuplicateWarning = () => {
    setIsDuplicateItemsWarningDialogOpen(false);
    setIsUploading(false);
    setJsonDataToProcess(null);
    setDuplicateSkusInCsv([]);
    setSelectedFile(null);
    showError("CSV upload cancelled.");
    onClose();
  };

  const handleConfirmAddLocations = async () => {
    setIsConfirmNewLocationsDialogOpen(false);
    setIsUploading(true);

    for (const locString of newLocationsToConfirm) {
      const parsed = parseLocationString(locString);
      const newLocation: Omit<Location, "id" | "createdAt" | "userId" | "organizationId"> = {
        fullLocationString: locString,
        displayName: locString,
        area: parsed.area || "N/A",
        row: parsed.row || "N/A",
        bay: parsed.bay || "N/A",
        level: parsed.level || "N/A",
        pos: parsed.pos || "N/A",
        color: "#CCCCCC",
      };
      await addLocation(newLocation);
    }
    showSuccess(`Added new locations: ${newLocationsToConfirm.join(", ")}`);

    if (jsonDataToProcess) {
      await invokeEdgeFunction(jsonDataToProcess, duplicateAction);
    }
    setNewLocationsToConfirm([]);
    setSelectedFile(null);
  };

  const handleCancelAddLocations = () => {
    setIsConfirmNewLocationsDialogOpen(false);
    setIsUploading(false);
    setJsonDataToProcess(null);
    setNewLocationsToConfirm([]);
    setSelectedFile(null);
    showError("CSV upload cancelled.");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Import CSV File</DialogTitle>
          <DialogDescription>
            Upload a CSV file to update your inventory. New categories will be automatically added if they don't exist.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="csvFile" className="text-right">
              CSV File
            </Label>
            <Input
              id="csvFile"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="col-span-3"
            />
          </div>
          {selectedFile && (
            <p className="col-span-4 text-center text-sm text-muted-foreground">
              Selected: {selectedFile.name}
            </p>
          )}
          <div className="col-span-4 text-center">
            <Button variant="outline" onClick={handleDownloadTemplate} className="w-full">
              <Download className="h-4 w-4 mr-2" /> Download CSV Template
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!selectedFile || isUploading}>
            {isUploading ? "Uploading..." : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>

      <DuplicateItemsWarningDialog
        isOpen={isDuplicateItemsWarningDialogOpen}
        onClose={handleCancelDuplicateWarning}
        duplicates={duplicateSkusInCsv}
        onSkipAll={handleSkipAllDuplicates}
        onAddToExistingStock={handleAddToExistingStock}
        onUpdateExisting={handleUpdateExisting}
      />

      <ConfirmDialog
        isOpen={isConfirmNewLocationsDialogOpen}
        onClose={handleCancelAddLocations}
        onConfirm={handleConfirmAddLocations}
        title="New Locations Detected"
        description={
          <div>
            <p>The following new inventory locations were found in your CSV:</p>
            <ul className="list-disc list-inside mt-2 ml-4 text-left">
              {newLocationsToConfirm.map((loc, _index) => (
                <li key={_index} className="font-semibold">{loc}</li>
              ))}
            </ul>
            <p>Would you like to add these to your available locations? Items with these locations will only be imported if confirmed.</p>
          </div>
        }
        confirmText="Add Locations & Continue"
        cancelText="Cancel Import"
      />
    </Dialog>
  );
};

export default ImportCsvDialog;