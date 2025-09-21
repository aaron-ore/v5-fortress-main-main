"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import ReplenishmentManagementTool from "@/components/warehouse-operations/ReplenishmentManagementTool";
import { Repeat } from "lucide-react";
import { useProfile } from "@/context/ProfileContext";
import { Card, CardContent, CardTitle } from "@/components/ui/card";

interface ReplenishmentManagementDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const ReplenishmentManagementDialog: React.FC<ReplenishmentManagementDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const { profile } = useProfile();

  const canManageReplenishment = profile?.role === 'admin' || profile?.role === 'inventory_manager';

  if (!canManageReplenishment) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px] flex flex-col h-[90vh] max-h-[800px] p-0">
          <Card className="p-6 text-center bg-card border-border">
            <CardTitle className="text-2xl font-bold mb-4">Access Denied</CardTitle>
            <CardContent>
              <p className="text-muted-foreground">You do not have permission to manage replenishment.</p>
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
            <Repeat className="h-6 w-6 text-primary" /> Replenishment Management
          </DialogTitle>
          <DialogDescription>
            Manage tasks for moving stock from overstock to picking bins.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-hidden p-4 pt-0">
          <ReplenishmentManagementTool />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReplenishmentManagementDialog;