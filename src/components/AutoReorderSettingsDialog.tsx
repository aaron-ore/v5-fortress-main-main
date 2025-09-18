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
import { Switch } from "@/components/ui/switch";
import { showSuccess, showError } from "@/utils/toast";
import { Repeat, Loader2 } from "lucide-react"; -- NEW: Import Loader2
import { useProfile } from "@/context/ProfileContext"; -- NEW: Import useProfile

interface AutoReorderSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const AutoReorderSettingsDialog: React.FC<AutoReorderSettingsDialogProps> = ({ isOpen, onClose }) => {
  const { profile, isLoadingProfile, updateCompanyProfile } = useProfile(); -- NEW: Use useProfile
  const [defaultReorderLevel, setDefaultReorderLevel] = useState("0"); -- Changed default to "0"
  const [enableAutoReorderNotifications, setEnableAutoReorderNotifications] = useState(false);
  const [enableAutoReorder, setEnableAutoReorder] = useState(false);
  const [isSaving, setIsSaving] = useState(false); -- NEW: Add saving state

  useEffect(() => {
    if (isOpen && !isLoadingProfile && profile?.companyProfile) {
      setDefaultReorderLevel(String(profile.companyProfile.defaultReorderLevel || 0));
      setEnableAutoReorderNotifications(profile.companyProfile.enableAutoReorderNotifications || false);
      setEnableAutoReorder(profile.companyProfile.enableAutoReorder || false);
    } else if (isOpen && !isLoadingProfile && !profile?.companyProfile) {
      // If no company profile, reset to defaults
      setDefaultReorderLevel("0");
      setEnableAutoReorderNotifications(false);
      setEnableAutoReorder(false);
    }
  }, [isOpen, isLoadingProfile, profile?.companyProfile]);

  const handleSaveSettings = async () => { -- NEW: Made async
    const parsedLevel = parseInt(defaultReorderLevel);
    if (isNaN(parsedLevel) || parsedLevel < 0) {
      showError("Default Reorder Level must be a non-negative number.");
      return;
    }

    if (!profile?.organizationId) {
      showError("Organization not found. Cannot save auto-reorder settings.");
      return;
    }

    setIsSaving(true); -- NEW: Set saving state
    try {
      await updateCompanyProfile({
        defaultReorderLevel: parsedLevel,
        enableAutoReorderNotifications: enableAutoReorderNotifications,
        enableAutoReorder: enableAutoReorder,
      });
      showSuccess("Auto-reorder settings saved successfully!");
      onClose();
    } catch (error: any) {
      console.error("Error saving auto-reorder settings:", error);
      showError(`Failed to save settings: ${error.message}`);
    } finally {
      setIsSaving(false); -- NEW: Reset saving state
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat className="h-6 w-6 text-primary" /> Auto-Reorder Settings
          </DialogTitle>
          <DialogDescription>
            Configure global rules for automatic reordering and notifications.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="defaultReorderLevel">Default Reorder Level</Label>
            <Input
              id="defaultReorderLevel"
              type="number"
              value={defaultReorderLevel}
              onChange={(e) => setDefaultReorderLevel(e.target.value)}
              placeholder="e.g., 10"
              min="0"
              disabled={isLoadingProfile} -- NEW: Disable while loading profile
            />
            <p className="text-xs text-muted-foreground">
              This value will be suggested for new items' reorder levels.
            </p>
          </div>
          <div className="flex items-center justify-between space-x-2 pt-2">
            <Label htmlFor="enableAutoReorder">
              Enable Global Auto-Reorder System
            </Label>
            <Switch
              id="enableAutoReorder"
              checked={enableAutoReorder}
              onCheckedChange={setEnableAutoReorder}
              disabled={isLoadingProfile} -- NEW: Disable while loading profile
            />
          </div>
          <p className="text-xs text-muted-foreground">
            When enabled, items with individual auto-reorder settings will trigger purchase orders.
          </p>
          <div className="flex items-center justify-between space-x-2 pt-2">
            <Label htmlFor="enableAutoReorderNotifications">
              Enable Auto-Reorder Notifications
            </Label>
            <Switch
              id="enableAutoReorderNotifications"
              checked={enableAutoReorderNotifications}
              onCheckedChange={setEnableAutoReorderNotifications}
              disabled={isLoadingProfile} -- NEW: Disable while loading profile
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Receive alerts when items hit their reorder level.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}> -- NEW: Disable if saving
            Cancel
          </Button>
          <Button onClick={handleSaveSettings} disabled={isSaving || isLoadingProfile}> -- NEW: Disable if saving or loading profile
            {isSaving ? ( -- NEW: Add saving spinner
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              "Save Settings"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AutoReorderSettingsDialog;