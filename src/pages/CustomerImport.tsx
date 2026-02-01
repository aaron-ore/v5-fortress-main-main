import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Upload, Loader2 } from "lucide-react";
import * as XLSX from 'xlsx';
import { useInventory } from "@/context/InventoryContext";
import { useOnboarding } from "@/context/OnboardingContext";
import { showError, showSuccess } from "@/utils/toast";
import { generateInventoryCsvTemplate } from "@/utils/csvGenerator";
import DuplicateItemsWarningDialog from "@/components/DuplicateItemsWarningDialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import { supabase } from "@/lib/supabaseClient";
import { uploadFileToSupabase } from "@/integrations/supabase/storage";
import { useProfile } from "@/context/ProfileContext";
import { useNavigate } from "react-router-dom";

interface CsvDuplicateItem {
  sku: string;
  csvQuantity: number;
  itemName: string;
}

const CustomerImport: React.FC = () => {
  const { inventoryItems, refreshInventory } = useInventory();
  const { inventoryFolders, addInventoryFolder } = useOnboarding();
  const { profile, isLoadingProfile } = useProfile();
  const navigate = useNavigate();

  // Only allow admins and managers to use this tool
  const canManageInventory = profile?.role === 'admin' || profile?.role === 'inventory_manager';

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [jsonDataToProcess, setJsonDataToProcess] = useState<any[] | null>(null);

  // States for New Folders Confirmation
  const [newFoldersToConfirm, setNewFoldersToConfirm] = useState<string[]>([]);
  const [isConfirmNewFoldersDialogOpen, setIsConfirmNewFoldersDialogOpen] = useState(false);

  // States for Duplicate SKUs Warning
  const [duplicateSkusInCsv, setDuplicateSkusInCsv] = useState<CsvDuplicateItem[]>([]);
  const [isDuplicateItemsWarningDialogOpen, setIsDuplicateItemsWarningDialogOpen] = useState(false);
  const [duplicateAction, setDuplicateAction] = useState<"skip" | "add_to_stock" | "update">("skip");

  // Memoize existing SKUs and folder names
  const existingInventorySkus = useMemo(() => {
    return new Set(inventoryItems.map(item => item.sku.toLowerCase()));
  }, [inventoryItems]);

  const existingFolderNames = useMemo(() => {
    return new Set(inventoryFolders.map(folder => folder.name.toLowerCase()));
  }, [inventoryFolders]);

  useEffect(() => {
    if (!canManageInventory && !isLoadingProfile) {
      showError("Access Denied: Only Inventory Managers and Admins can access this page.");
      navigate('/');
    }
  }, [canManageInventory, isLoadingProfile, navigate]);

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

  const checkForNewFoldersAndProceed = async (data: any[], actionForDuplicates: "skip" | "add_to_stock" | "update") => {
    const uniqueFolderNamesInCsv = Array.from(new Set(data.map(row => String(row.folderName || '').trim())));

    const newFolders = uniqueFolderNamesInCsv.filter(folderName => folderName && !existingFolderNames.has(folderName.toLowerCase()));

    if (newFolders.length > 0) {
      setNewFoldersToConfirm(newFolders);
      setDuplicateAction(actionForDuplicates);
      setIsConfirmNewFoldersDialogOpen(true);
      setIsUploading(false);
    } else {
      await invokeEdgeFunction(actionForDuplicates);
      setSelectedFile(null);
    }
  };

  const invokeEdgeFunction = async (actionForDuplicates: "skip" | "add_to_stock" | "update") => {
    if (!profile?.organizationId || !profile?.id) {
      showError("User/org not loaded. Cannot import.");
      setIsUploading(false);
      return;
    }
    if (!selectedFile) {
      showError("No file selected for upload.");
      setIsUploading(false);
      return;
    }

    setIsUploading(true);
    let uploadedFilePath: string | null = null;

    try {
      uploadedFilePath = await uploadFileToSupabase(selectedFile, 'csv-uploads', 'customer-imports/');
      showSuccess("CSV uploaded. Processing...");

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        throw new Error("Session expired. Log in again.");
      }

      const edgeFunctionUrl = `https://nojumocxivfjsbqnnkqe.supabase.co/functions/v1/process-customer-inventory-upload`;
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
          errorDetail = errorData.error || JSON.stringify(errorData);
          console.error("Edge Function detailed error response:", errorData);
        } catch (jsonError) {
          errorDetail = `Edge Function failed with status: ${response.status}. Response was not valid JSON. Raw response: ${await response.text()}`;
        }
        throw new Error(errorDetail);
      }

      const result = await response.json();
      if (result.success) {
        showSuccess(result.message);
      } else {
        showError(result.message || "Import errors. Check console.");
        console.error("Customer Import Errors:", result.errors);
      }
      refreshInventory();
    } catch (error: any) {
      console.error("Error during customer import process:", error);
      const errorMessage = typeof error === 'string' ? error : (error.message || "An unknown error occurred during bulk import.");
      showError(`Customer import failed: ${errorMessage}`);
    } finally {
      setIsUploading(false);
      setSelectedFile(null);
    }
  };

  const handleUpload = async () => {
    if (!canManageInventory) {
      showError("No permission to import data.");
      return;
    }
    if (!selectedFile) {
      showError("Select a CSV file to upload.");
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
          showError("CSV file is empty.");
          setIsUploading(false);
          return;
        }

        setJsonDataToProcess(jsonData);

        const duplicates: CsvDuplicateItem[] = [];
        const seenSkusInCsv = new Set<string>();
        jsonData.forEach(row => {
          const sku = String(row.sku || '').trim();
          if (sku && existingInventorySkus.has(sku.toLowerCase())) {
            if (!seenSkusInCsv.has(sku.toLowerCase())) {
              duplicates.push({
                sku: sku,
                csvQuantity: parseInt(String(row.pickingBinQuantity || '0')) + parseInt(String(row.overstockQuantity || '0')),
                itemName: String(row.name || '').trim(),
              });
              seenSkusInCsv.add(sku.toLowerCase());
            }
          }
        });

        if (duplicates.length > 0) {
          setDuplicateSkusInCsv(duplicates);
          setIsDuplicateItemsWarningDialogOpen(true);
        } else {
          await checkForNewFoldersAndProceed(jsonData, "skip");
        }

      } catch (parseError: any) {
        showError(`Error parsing CSV file: ${parseError.message}`);
        console.error("CSV Parse Error:", parseError);
      } finally {
        // Keep isUploading true until the whole process (including edge function) is done
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
      link.setAttribute("download", "customer_inventory_import_template.csv");
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showSuccess("CSV template downloaded!");
    } else {
      showError("Browser doesn't support downloads.");
    }
  };

  const handleSkipAllDuplicates = async () => {
    setIsDuplicateItemsWarningDialogOpen(false);
    if (jsonDataToProcess) {
      await checkForNewFoldersAndProceed(jsonDataToProcess, "skip");
    } else {
      setIsUploading(false);
      setSelectedFile(null);
    }
  };

  const handleAddToExistingStock = async () => {
    setIsDuplicateItemsWarningDialogOpen(false);
    if (jsonDataToProcess) {
      await checkForNewFoldersAndProceed(jsonDataToProcess, "add_to_stock");
    } else {
      setIsUploading(false);
      setSelectedFile(null);
    }
  };

  const handleUpdateExisting = async () => {
    setIsDuplicateItemsWarningDialogOpen(false);
    if (jsonDataToProcess) {
      await checkForNewFoldersAndProceed(jsonDataToProcess, "update");
    } else {
      setIsUploading(false);
      setSelectedFile(null);
    }
  };

  const handleCancelDuplicateWarning = () => {
    setIsDuplicateItemsWarningDialogOpen(false);
    setIsUploading(false);
    setJsonDataToProcess(null);
    setDuplicateSkusInCsv([]);
    setSelectedFile(null);
    showError("CSV upload cancelled.");
  };

  const handleConfirmAddFolders = async () => {
    setIsConfirmNewFoldersDialogOpen(false);
    setIsUploading(true);

    for (const folderName of newFoldersToConfirm) {
      const newFolder = {
        name: folderName,
        color: "#CCCCCC",
      };
      await addInventoryFolder(newFolder);
    }
    showSuccess(`Added ${newFoldersToConfirm.length} new folders.`);

    if (jsonDataToProcess) {
      await invokeEdgeFunction(duplicateAction);
    }
    setNewFoldersToConfirm([]);
    setSelectedFile(null);
  };

  const handleCancelAddFolders = () => {
    setIsConfirmNewFoldersDialogOpen(false);
    setIsUploading(false);
    setJsonDataToProcess(null);
    setNewFoldersToConfirm([]);
    setSelectedFile(null);
    showError("CSV upload cancelled.");
  };

  if (isLoadingProfile || !canManageInventory) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Customer Inventory Import</h1>
      <p className="text-muted-foreground">
        Upload a CSV file provided by your customer to quickly populate their inventory data into your system.
      </p>

      <Card className="bg-card border-border rounded-lg shadow-sm p-6">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <Upload className="h-6 w-6 text-primary" /> Upload Customer CSV
          </CardTitle>
          <CardDescription>
            Ensure the CSV file matches the required template structure.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 py-4">
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
              disabled={isUploading}
            />
          </div>
          {selectedFile && (
            <p className="col-span-4 text-center text-sm text-muted-foreground">
              Selected: {selectedFile.name}
            </p>
          )}
          <div className="col-span-4 text-center">
            <Button variant="outline" onClick={handleDownloadTemplate} className="w-full" disabled={isUploading}>
              <Download className="h-4 w-4 mr-2" /> Download CSV Template
            </Button>
          </div>
        </CardContent>
        <div className="flex justify-end">
          <Button onClick={handleUpload} disabled={!selectedFile || isUploading}>
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
              </>
            ) : (
              "Start Import"
            )}
          </Button>
        </div>
      </Card>

      <DuplicateItemsWarningDialog
        isOpen={isDuplicateItemsWarningDialogOpen}
        onClose={handleCancelDuplicateWarning}
        duplicates={duplicateSkusInCsv}
        onSkipAll={handleSkipAllDuplicates}
        onAddToExistingStock={handleAddToExistingStock}
        onUpdateExisting={handleUpdateExisting}
      />

      <ConfirmDialog
        isOpen={isConfirmNewFoldersDialogOpen}
        onClose={handleCancelAddFolders}
        onConfirm={handleConfirmAddFolders}
        title="New Folders Detected"
        description={
          <div>
            <p>The following new inventory folders were found in the CSV:</p>
            <ul className="list-disc list-inside mt-2 ml-4 text-left">
              {newFoldersToConfirm.map((folderName, _index) => (
                <li key={_index} className="font-semibold">{folderName}</li>
              ))}
            </ul>
            <p>Would you like to add these to your available folders? Items with these folders will only be imported if confirmed.</p>
          </div>
        }
        confirmText="Add Folders & Continue"
        cancelText="Cancel Import"
      />
    </div>
  );
};

export default CustomerImport;