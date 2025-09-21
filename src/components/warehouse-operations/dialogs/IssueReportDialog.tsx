"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import IssueReportTool from "@/components/warehouse-operations/IssueReportTool";
import { AlertTriangle } from "lucide-react";
import { useProfile } from "@/context/ProfileContext";
import { Card, CardContent, CardTitle } from "@/components/ui/card"; // NEW: Import Card components

interface IssueReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onScanRequest: (callback: (scannedData: string) => void) => void;
  scannedDataFromGlobal?: string | null;
  onScannedDataProcessed: () => void;
}

const IssueReportDialog: React.FC<IssueReportDialogProps> = ({
  isOpen,
  onClose,
  onScanRequest,
  scannedDataFromGlobal,
  onScannedDataProcessed,
}) => {
  const { profile } = useProfile(); // NEW: Get profile for role checks

  // NEW: Role-based permission
  const canReportIssues = profile?.role === 'admin' || profile?.role === 'inventory_manager' || profile?.role === 'viewer';

  if (!canReportIssues) { // NEW: Check permission for viewing dialog
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[425px] flex flex-col h-[90vh] max-h-[700px] p-0">
          <Card className="p-6 text-center bg-card border-border">
            <CardTitle className="text-2xl font-bold mb-4">Access Denied</CardTitle>
            <CardContent>
              <p className="text-muted-foreground">You do not have permission to report issues.</p>
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
            <AlertTriangle className="h-6 w-6 text-primary" /> Report an Issue
          </DialogTitle>
          <DialogDescription>
            Report damaged items, discrepancies, or other warehouse issues.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-hidden p-4 pt-0">
          <IssueReportTool
            onScanRequest={onScanRequest}
            scannedDataFromGlobal={scannedDataFromGlobal}
            onScannedDataProcessed={onScannedDataProcessed}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default IssueReportDialog;