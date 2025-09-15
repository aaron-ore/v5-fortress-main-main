import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PlusCircle, Trash2, Folder, QrCode, Edit } from "lucide-react"; // Changed MapPin to Folder
import { showSuccess } from "@/utils/toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useOnboarding, InventoryFolder } from "@/context/OnboardingContext"; // Updated import to InventoryFolder
import { usePrint, PrintContentData } from "@/context/PrintContext";
import LocationLabelGenerator from "@/components/LocationLabelGenerator"; // This component will remain for physical labels
import FolderInventoryViewDialog from "@/components/LocationInventoryViewDialog"; // Renamed import
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const Folders = () => { // Renamed component and removed React.FC
  const { inventoryFolders, addInventoryFolder, updateInventoryFolder, removeInventoryFolder } = useOnboarding(); // Updated context functions
  const { initiatePrint } = usePrint();

  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<InventoryFolder | null>(null); // Updated type

  const [isLocationLabelGeneratorOpen, setIsLocationLabelGeneratorOpen] = useState(false);
  const [folderToEdit, setFolderToEdit] = useState<InventoryFolder | null>(null); // Updated type

  const [isFolderInventoryViewDialogOpen, setIsFolderInventoryViewDialogOpen] = useState(false); // Renamed state
  const [folderToViewInventory, setFolderToViewInventory] = useState<string | null>(null); // Renamed state

  const handleAddFolderClick = () => { // Renamed
    setFolderToEdit(null);
    setIsLocationLabelGeneratorOpen(true); // Reusing the label generator for folder details
  };

  const handleEditFolderClick = (folder: InventoryFolder) => { // Renamed
    setFolderToEdit(folder);
    setIsLocationLabelGeneratorOpen(true); // Reusing the label generator for folder details
  };

  const handleDeleteFolderClick = (folder: InventoryFolder) => { // Renamed
    setFolderToDelete(folder);
    setIsConfirmDeleteDialogOpen(true);
  };

  const confirmRemoveFolder = async () => { // Renamed
    if (folderToDelete) {
      await removeInventoryFolder(folderToDelete.id); // Updated context function
      if (folderToViewInventory === folderToDelete.id) { // Updated to folderId
        setFolderToViewInventory(null);
        setIsFolderInventoryViewDialogOpen(false);
      }
    }
    setIsConfirmDeleteDialogOpen(false);
    setFolderToDelete(null);
  };

  const handleViewInventoryClick = (folderId: string) => { // Renamed
    setFolderToViewInventory(folderId);
    setIsFolderInventoryViewDialogOpen(true);
  };

  const handleSaveFolder = async (newFolderData: Omit<InventoryFolder, 'id' | 'createdAt' | 'userId' | 'organizationId'>, isNew: boolean) => { // Renamed
    if (isNew) {
      await addInventoryFolder(newFolderData); // Updated context function
    } else if (folderToEdit) {
      await updateInventoryFolder({ ...folderToEdit, ...newFolderData }); // Updated context function
    }
    setIsLocationLabelGeneratorOpen(false);
  };

  const handleGenerateAndPrintFromGenerator = (labelsToPrint: PrintContentData[]) => {
    for (const label of labelsToPrint) {
      initiatePrint(label);
    }
    showSuccess(`Generated and sent ${labelsToPrint.length} folder labels to printer!`);
  };

  return (
    <div className="flex flex-col flex-grow space-y-6 p-6">
      <h1 className="text-3xl font-bold">Folder Management</h1> {/* Updated title */}
      <p className="text-muted-foreground">Manage your inventory organization folders and generate QR code labels for them.</p> {/* Updated description */}

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 flex-grow">
        {/* Manage Folders Card */}
        <Card className="bg-card border-border shadow-sm flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Folder className="h-5 w-5 text-primary" /> Existing Folders {/* Updated icon and title */}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4 flex-grow flex flex-col">
            <Button onClick={handleAddFolderClick} aria-label="Add new folder"> {/* Updated button text */}
              <PlusCircle className="h-4 w-4 mr-2" /> Add New Folder
            </Button>

            {inventoryFolders.length > 0 ? (
              <div className="space-y-2 flex-grow flex flex-col">
                <Label>Current Folders</Label> {/* Updated label */}
                <ScrollArea className="flex-grow border border-border rounded-md p-3 bg-muted/20">
                  <ul className="space-y-1">
                    {inventoryFolders.map((folder) => (
                      <li key={folder.id} className="flex items-center justify-between py-1 text-foreground">
                        <Button
                          variant="ghost"
                          className="p-0 h-auto text-left font-normal text-foreground hover:underline"
                          onClick={() => handleViewInventoryClick(folder.id)}
                        >
                          {folder.name} {/* Display folder name */}
                        </Button>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditFolderClick(folder)}
                            aria-label={`Edit label for ${folder.name}`}
                          >
                            <Edit className="h-4 w-4 text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteFolderClick(folder)}
                            aria-label={`Remove folder ${folder.name}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No folders defined yet. Add your first folder!</p>
            )}
          </CardContent>
        </Card>

        {/* Generate Labels Card (now just a placeholder for the dialog) */}
        <Card className="bg-card border-border shadow-sm flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <QrCode className="h-5 w-5 text-accent" /> Folder Label Preview {/* Updated title */}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex-grow flex flex-col items-center justify-center text-muted-foreground">
            <p>Use the "Add New Folder" or "Edit" buttons to manage folder details and generate labels.</p> {/* Updated text */}
            <QrCode className="h-24 w-24 mt-4 text-muted-foreground/50" />
          </CardContent>
        </Card>
      </div>

      {folderToDelete && (
        <ConfirmDialog
          isOpen={isConfirmDeleteDialogOpen}
          onClose={() => setIsConfirmDeleteDialogOpen(false)}
          onConfirm={confirmRemoveFolder}
          title="Confirm Folder Deletion"
          description={`Are you sure you want to delete the folder "${folderToDelete.name}"? This cannot be undone and will unassign all items within it.`}
          confirmText="Delete"
          cancelText="Cancel"
        />
      )}

      {/* Location Label Generator Dialog (repurposed for folder labels) */}
      <Dialog open={isLocationLabelGeneratorOpen} onOpenChange={setIsLocationLabelGeneratorOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{folderToEdit ? "Edit Folder & Generate Labels" : "Add New Folder & Generate Labels"}</DialogTitle> {/* Updated title */}
            <DialogDescription>
              {folderToEdit ? "Update details for this folder and generate new labels." : "Define a new folder and generate scannable QR code labels."} {/* Updated description */}
            </DialogDescription>
          </DialogHeader>
          <LocationLabelGenerator
            initialLocation={folderToEdit}
            onSave={handleSaveFolder}
            onGenerateAndPrint={handleGenerateAndPrintFromGenerator}
            onClose={() => setIsLocationLabelGeneratorOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Folder Inventory View Dialog */}
      {folderToViewInventory && (
        <FolderInventoryViewDialog
          isOpen={isFolderInventoryViewDialogOpen}
          onClose={() => setIsFolderInventoryViewDialogOpen(false)}
          folderId={folderToViewInventory}
        />
      )}
    </div>
  );
};

export default Folders;