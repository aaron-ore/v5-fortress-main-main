"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import ReturnsProcessingTool from "@/components/warehouse-operations/ReturnsProcessingTool";
import { Undo2 } from "lucide-react";
import { useProfile } from "@/context/ProfileContext";
import { Card, CardContent, CardTitle } from "@/components/ui/card"; // NEW: Import Card components

interface ReturnsProcessingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onScanRequest: (callback: (scannedData: string) => void) => void;
  scannedDataFromGlobal?: string | null;
  onScannedDataProcessed: () => void;
}

const ReturnsProcessingDialog: React.FC<ReturnsProcessingDialogProps> = ({
  isOpen,
  onClose,
  onScanRequest,
  scannedDataFromGlobal,
  onScannedDataProcessed,
}) => {
  const { profile } = useProfile(); // NEW: Get profile for role checks

  // NEW: Role-based permission
  const canProcessReturns = profile?.role === 'admin' || profile?.role === 'inventory_manager';

  if (!canProcessReturns) { // NEW: Check permission for viewing dialog
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[425px] flex flex-col h-[90vh] max-h-[700px] p-0">
          <Card className="p-6 text-center bg-card border-border">
            <CardTitle className="text-2xl font-bold mb-4">Access Denied</CardTitle>
            <CardContent>
              <p className="text-muted-foreground">You do not have permission to process returns.</p>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] flex flex-col h-[90vh] max-h-[700px] p-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="h-6 w-6 text-primary" /> Returns Processing
          </DialogTitle>
          <DialogDescription>
            Process returned items and update inventory.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-hidden p-4 pt-0">
          <ReturnsProcessingTool
            onScanRequest={onScanRequest}
            scannedDataFromGlobal={scannedDataFromGlobal}
            onScannedDataProcessed={onScannedDataProcessed}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReturnsProcessingDialog;