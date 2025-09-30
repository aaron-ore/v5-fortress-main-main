import React, { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { XCircle, QrCode, Keyboard } from "lucide-react";
import QrScanner, { QrScannerRef } from "@/components/QrScanner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showSuccess, showError } from "@/utils/toast";

interface CameraScannerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
  title?: string;
  description?: string;
}

const CameraScannerDialog: React.FC<CameraScannerDialogProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  title = "Scan Barcode / QR Code",
  description = "Point your camera at a barcode or QR code to scan.",
}) => {
  const qrScannerRef = useRef<QrScannerRef>(null);
  const [isScannerLoading, setIsScannerLoading] = useState(true);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [manualInputMode, setManualInputMode] = useState(false);
  const [manualInputValue, setManualInputValue] = useState("");

  useEffect(() => {
    if (isOpen) {
      setIsScannerLoading(true);
      setScannerError(null);
      setManualInputMode(false);
      setManualInputValue("");
    } else {
      qrScannerRef.current?.stopAndClear();
    }
  }, [isOpen]);

  const handleScannerScan = (decodedText: string) => {
    onScanSuccess(decodedText);
    onClose();
  };

  const handleScannerError = (errorMessage: string) => {
    setScannerError(errorMessage);
    setIsScannerLoading(false);
  };

  const handleScannerReady = () => {
    setScannerError(null);
    setIsScannerLoading(false);
  };

  const handleScannerLoadingChange = (loading: boolean) => {
    setIsScannerLoading(loading);
  };

  const handleRetryScan = () => {
    setScannerError(null);
    setIsScannerLoading(true);
    qrScannerRef.current?.retryStart();
  };

  const handleManualInputSubmit = () => {
    if (manualInputValue.trim()) {
      onScanSuccess(manualInputValue.trim());
      showSuccess("Manual input submitted!");
      onClose();
    } else {
      showError("Enter barcode/QR value.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] flex flex-col h-[80vh] max-h-[600px] p-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-6 w-6 text-primary" /> {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex-grow flex flex-col items-center justify-center bg-black rounded-md overflow-hidden relative p-0">
          {manualInputMode ? (
            <div className="flex flex-col items-center justify-center p-6 w-full h-full bg-background text-foreground">
              <Keyboard className="h-12 w-12 text-muted-foreground mb-4" />
              <Label htmlFor="manual-barcode-input" className="text-lg font-semibold mb-2">Enter Barcode / QR Value</Label>
              <Input
                id="manual-barcode-input"
                placeholder="Type code here..."
                value={manualInputValue}
                onChange={(e) => setManualInputValue(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleManualInputSubmit();
                  }
                }}
                className="w-full max-w-xs mb-4"
              />
              <Button onClick={handleManualInputSubmit} className="w-full max-w-xs">Submit</Button>
            </div>
          ) : (
            <div className="relative w-full pb-[100%]">
              {isScannerLoading && !scannerError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white text-lg z-10">
                  Loading camera...
                </div>
              )}
              {scannerError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/70 text-white text-center p-4 z-10">
                  <XCircle className="h-8 w-8 mb-2" />
                  <p className="font-semibold">Camera Error:</p>
                  <p className="text-sm">{scannerError}</p>
                  <p className="text-xs mt-2">Please ensure a back camera is available and permissions are granted.</p>
                  <Button onClick={handleRetryScan} className="mt-4" variant="secondary">Retry Camera</Button>
                </div>
              )}
              <div className="absolute inset-0">
                <QrScanner
                  key={manualInputMode ? "manual-mode" : "camera-mode"}
                  ref={qrScannerRef}
                  onScan={handleScannerScan}
                  onError={handleScannerError}
                  onReady={handleScannerReady}
                  onLoading={handleScannerLoadingChange}
                  isOpen={isOpen && !manualInputMode}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row sm:justify-between p-4 pt-2 gap-2">
          <Button variant="secondary" onClick={() => setManualInputMode(prev => !prev)} className="w-full sm:w-auto">
            {manualInputMode ? (
              <>
                <QrCode className="h-4 w-4 mr-2" /> Use Camera
              </>
            ) : (
              <>
                <Keyboard className="h-4 w-4 mr-2" /> Manual Input
              </>
            )}
          </Button>
          <Button variant="ghost" onClick={onClose} className="w-full sm:w-auto">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CameraScannerDialog;