import React, { useState, useEffect } from "react";
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
import { showSuccess, showError } from "@/utils/toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useOnboarding, CustomRole } from "@/context/OnboardingContext"; -- NEW: Import useOnboarding and CustomRole

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
  const { customRoles, isLoadingCustomRoles, addCustomRole, updateCustomRole, deleteCustomRole } = useOnboarding(); -- NEW: Use customRoles from context
  const [isAddEditRoleDialogOpen, setIsAddEditRoleDialogOpen] = useState(false);
  const [roleToEdit, setRoleToEdit] = useState<CustomRole | null>(null);

  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(new Set());

  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<CustomRole | null>(null);

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

  const handleSaveRole = async () => { -- NEW: Made async
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
      await updateCustomRole({ ...roleData, id: roleToEdit.id }); -- NEW: Use updateCustomRole
      showSuccess(`Role "${newRoleName.trim()}" updated.`);
    } else {
      await addCustomRole(roleData); -- NEW: Use addCustomRole
      showSuccess(`Role "${newRoleName.trim()}" created.`);
    }
    setIsAddEditRoleDialogOpen(false);
  };

  const handleEditRoleClick = (role: CustomRole) => {
    setRoleToEdit(role);
    setIsAddEditRoleDialogOpen(true);
  };

  const handleDeleteRoleClick = (role: CustomRole) => {
    setRoleToDelete(role);
    setIsConfirmDeleteDialogOpen(true);
  };

  const confirmDeleteRole = async () => { -- NEW: Made async
    if (roleToDelete) {
      await deleteCustomRole(roleToDelete.id); -- NEW: Use deleteCustomRole
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
            <Button onClick={() => setIsAddEditRoleDialogOpen(true)} className="w-full">
              <PlusCircle className="h-4 w-4 mr-2" /> Create New Role
            </Button>

            {isLoadingCustomRoles ? ( -- NEW: Add loading state
              <div className="flex items-center justify-center h-40">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Loading roles...</span>
              </div>
            ) : customRoles.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No custom roles defined yet.</p>
            ) : (
              <ScrollArea className="h-60 border border-border rounded-md p-3 bg-muted/20">
                <div className="space-y-3">
                  {customRoles.map(role => ( -- NEW: Use customRoles from context
                    <div key={role.id} className="flex items-center justify-between p-2 bg-card rounded-md shadow-sm">
                      <div>
                        <h4 className="font-semibold text-foreground">{role.name}</h4>
                        <p className="text-xs text-muted-foreground">{role.description}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEditRoleClick(role)}>
                          <Edit className="h-4 w-4 text-primary" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteRoleClick(role)}>
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

      <Dialog open={isAddEditRoleDialogOpen} onOpenChange={setIsAddEditRoleDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{roleToEdit ? "Edit Custom Role" : "Create New Custom Role"}</DialogTitle>
            <DialogDescription>
              {roleToEdit ? "Update the details and permissions for this role." : "Define a new role and assign its permissions."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="roleName">Role Name</Label>
              <Input
                id="roleName"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="e.g., Inventory Clerk"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="roleDescription">Description</Label>
              <Textarea
                id="roleDescription"
                value={newRoleDescription}
                onChange={(e) => setNewRoleDescription(e.target.value)}
                placeholder="Briefly describe this role's responsibilities."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Features / Permissions</Label>
              <ScrollArea className="h-60 border border-border rounded-md p-3 bg-muted/20">
                <div className="space-y-2">
                  {availableFeatures.map(feature => (
                    <div key={feature} className="flex items-center space-x-2">
                      <Checkbox
                        id={`feature-${feature}`}
                        checked={selectedFeatures.has(feature)}
                        onCheckedChange={(checked: boolean) => handleFeatureToggle(feature, checked)}
                      />
                      <Label htmlFor={`feature-${feature}`}>{feature}</Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddEditRoleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRole}>
              {roleToEdit ? "Save Changes" : "Create Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {roleToDelete && (
        <ConfirmDialog
          isOpen={isConfirmDeleteDialogOpen}
          onClose={() => setIsConfirmDeleteDialogOpen(false)}
          onConfirm={confirmDeleteRole}
          title="Confirm Role Deletion"
          description={`Are you sure you want to delete the custom role "${roleToDelete.name}"? This action cannot be undone.`}
          confirmText="Delete Role"
          cancelText="Cancel"
        />
      )}
    </>
  );
};

export default ManageCustomRolesDialog;