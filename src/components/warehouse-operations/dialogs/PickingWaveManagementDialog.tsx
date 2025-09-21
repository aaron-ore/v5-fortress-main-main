"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import PickingWaveManagementTool from "@/components/warehouse-operations/PickingWaveManagementTool";
import { ListOrdered } from "lucide-react";
import { useProfile, UserProfile } from "@/context/ProfileContext"; // NEW: Import useProfile
import { Card, CardContent, CardTitle } from "@/components/ui/card"; // NEW: Import Card components

interface PickingWaveManagementDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const PickingWaveManagementDialog: React.FC<PickingWaveManagementDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const { profile } = useProfile(); // NEW: Get profile for role checks

  // NEW: Role-based permission
  const canManagePickingWaves = profile?.role === 'admin' || profile?.role === 'inventory_manager';

  if (!canManagePickingWaves) { // NEW: Check permission for viewing dialog
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px] flex flex-col h-[90vh] max-h-[800px] p-0">
          <Card className="p-6 text-center bg-card border-border">
            <CardTitle className="text-2xl font-bold mb-4">Access Denied</CardTitle>
            <CardContent>
              <p className="text-muted-foreground">You do not have permission to manage picking waves.</p>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] flex flex-col h-[90vh] max-h-[800px] p-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <ListOrdered className="h-6 w-6 text-primary" /> Picking Wave Management
          </DialogTitle>
          <DialogDescription>
            Batch sales orders into efficient picking waves.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-hidden p-4 pt-0">
          <PickingWaveManagementTool />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PickingWaveManagementDialog;