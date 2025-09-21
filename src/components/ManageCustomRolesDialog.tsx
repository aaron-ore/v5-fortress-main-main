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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PlusCircle, Edit, Trash2, Settings, Loader2 } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast"; // Import showSuccess
import { CustomRole, useOnboarding } from "@/context/OnboardingContext"; // NEW: Import CustomRole and useOnboarding
import { useProfile } from "@/context/ProfileContext";
import ConfirmDialog from "@/components/ConfirmDialog";

// Mock data for features and roles (not persisted)
const availableFeatures = [
  "View Dashboard",
  "Manage Inventory",
  "Create/Edit Orders",
  "View Reports",
  "Manage Vendors",
  "Manage Users",
  "Access Warehouse Operations",
  "Generate Labels",
  "Adjust Stock",
  "Import/Export Data",
  "Manage Categories",
  "Manage Locations",
  "Access Billing",
  "Change Account Settings",
];

interface ManageCustomRolesDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const ManageCustomRolesDialog: React.FC<ManageCustomRolesDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const { customRoles, isLoadingCustomRoles, addCustomRole, updateCustomRole, deleteCustomRole } = useOnboarding();
  const { profile } = useProfile();

  const [isAddEditRoleDialogOpen, setIsAddEditRoleDialogOpen] = useState(false);
  const [roleToEdit, setRoleToEdit] = useState<CustomRole | null>(null);

  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(new Set());

  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<CustomRole | null>(null);

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (!isAddEditRoleDialogOpen) {
      setNewRoleName("");
      setNewRoleDescription("");
      setSelectedFeatures(new Set());
      setRoleToEdit(null);
    } else if (roleToEdit) {
      setNewRoleName(roleToEdit.name);
      setNewRoleDescription(roleToEdit.description || "");
      setSelectedFeatures(new Set(roleToEdit.features));
    }
  }, [isAddEditRoleDialogOpen, roleToEdit]);

  const handleFeatureToggle = (feature: string, checked: boolean) => {
    setSelectedFeatures(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(feature);
      } else {
        newSet.delete(feature);
      }
      return newSet;
    });
  };

  const handleSaveRole = async () => {
    if (!isAdmin) {
      showError("You do not have permission to create or edit automation rules.");
      return;
    }
    if (!newRoleName.trim()) {
      showError("Role name cannot be empty.");
      return;
    }

    const roleData: Omit<CustomRole, "id" | "createdAt" | "userId" | "organizationId"> = {
      name: newRoleName.trim(),
      description: newRoleDescription.trim(),
      features: Array.from(selectedFeatures),
    };

    if (roleToEdit) {
      await updateCustomRole({ ...roleData, id: roleToEdit.id });
      showSuccess(`Role "${newRoleName.trim()}" updated.`);
    } else {
      await addCustomRole(roleData);
      showSuccess(`Role "${newRoleName.trim()}" created.`);
    }
    setIsAddEditRoleDialogOpen(false);
  };

  const handleEditRoleClick = (role: CustomRole) => {
    if (!isAdmin) {
      showError("You do not have permission to edit automation rules.");
      return;
    }
    setRoleToEdit(role);
    setIsAddEditRoleDialogOpen(true);
  };

  const handleDeleteRoleClick = (role: CustomRole) => {
    if (!isAdmin) {
      showError("You do not have permission to delete automation rules.");
      return;
    }
    setRoleToDelete(role);
    setIsConfirmDeleteDialogOpen(true);
  };

  const confirmDeleteRole = async () => {
    if (roleToDelete) {
      await deleteCustomRole(roleToDelete.id);
      showSuccess(`Role "${roleToDelete.name}" deleted.`);
    }
    setIsConfirmDeleteDialogOpen(false);
    setRoleToDelete(null);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-6 w-6 text-primary" /> Manage Custom Roles
            </DialogTitle>
            <DialogDescription>
              Create, edit, or delete custom roles and define their permissions.
              <p className="text-red-500 font-semibold mt-2">
                Note: Custom roles are now persisted to the database. User assignment is a future feature.
              </p>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Button onClick={() => setIsAddEditRoleDialogOpen(true)} className="w-full" disabled={!isAdmin}>
              <PlusCircle className="h-4 w-4 mr-2" /> Create New Role
            </Button>

            {isLoadingCustomRoles ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Loading roles...</span>
              </div>
            ) : customRoles.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No custom roles defined yet.</p>
            ) : (
              <ScrollArea className="h-60 border border-border rounded-md p-3 bg-muted/20">
                <div className="space-y-3">
                  {customRoles.map(role => (
                    <div key={role.id} className="flex items-center justify-between p-2 bg-card rounded-md shadow-sm">
                      <div>
                        <h4 className="font-semibold text-foreground">{role.name}</h4>
                        <p className="text-xs text-muted-foreground">{role.description}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEditRoleClick(role)} disabled={!isAdmin}>
                          <Edit className="h-4 w-4 text-primary" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteRoleClick(role)} disabled={!isAdmin}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {roleToDelete && (
        <ConfirmDialog
          isOpen={isConfirmDeleteDialogOpen}
          onClose={() => setIsConfirmDeleteDialogOpen(false)}
          onConfirm={confirmDeleteRole}
          title="Confirm Rule Dletion"
          description={`Are you sure you want to delete the custom role "${roleToDelete.name}"? This action cannot be undone.`}
          confirmText="Delete Role"
          cancelText="Cancel"
        />
      )}
    </>
  );
};

export default ManageCustomRolesDialog;