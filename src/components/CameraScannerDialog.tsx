import React, { useState, useRef, useEffect, useCallback } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showSuccess, showError } from "@/utils/toast";
import { Html5Qrcode, Html5QrcodeSupportedFormats, Html5QrcodeFullConfig, Html5QrcodeCameraScanConfig } from "html5-qrcode";

// Simplified QrScanner component (now purely presentational)
const QrScannerDisplay: React.FC<{ divId: string }> = ({ divId }) => {
  return <div id={divId} className="w-full h-full" />;
};

interface CameraScannerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
  title?: string;
  description?: string;
}

const QR_SCANNER_DIV_ID = "qr-code-full-region";
const MAX_START_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1500; // 1.5 seconds
const MIN_LOADING_DISPLAY_TIME = 500; // Minimum 500ms for the loading overlay

const CameraScannerDialog: React.FC<CameraScannerDialogProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  title = "Scan Barcode / QR Code",
  description = "Point your camera at a barcode or QR code to scan.",
}) => {
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isCameraStartedRef = useRef(false);
  const isStartingRef = useRef(false);
  const currentAttemptsRef = useRef(0);
  const loadingStartTimeRef = useRef<number | null>(null);

  const [isScannerLoading, setIsScannerLoading] = useState(true);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [manualInputMode, setManualInputMode] = useState(false);
  const [manualInputValue, setManualInputValue] = useState("");

  const html5QrcodeConstructorConfig: Html5QrcodeFullConfig = {
    formatsToSupport: [
      Html5QrcodeSupportedFormats.QR_CODE,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
    ],
    verbose: false,
  };

  const html5QrcodeCameraScanConfig: Html5QrcodeCameraScanConfig = {
    fps: 10,
    aspectRatio: 1.0,
    disableFlip: false,
  };

  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current && isCameraStartedRef.current) {
      console.log("[CameraScannerDialog] Attempting to stop scanner...");
      try {
        await html5QrCodeRef.current.stop();
        console.log("[CameraScannerDialog] Scanner stopped successfully.");
      } catch (e) {
        console.warn("[CameraScannerDialog] Error during scanner stop (might be already stopped or camera not found):", e);
      } finally {
        isCameraStartedRef.current = false;
      }
    } else {
      console.log("[CameraScannerDialog] No active scanner instance to stop.");
    }
  }, []);

  const clearScanner = useCallback(async () => {
    if (html5QrCodeRef.current) {
      console.log("[CameraScannerDialog] Attempting to clear scanner instance...");
      try {
        await html5QrCodeRef.current.clear();
        console.log("[CameraScannerDialog] Scanner instance cleared.");
      } catch (e) {
        console.warn("[CameraScannerDialog] Error during scanner clear:", e);
      } finally {
        html5QrCodeRef.current = null;
      }
    } else {
      console.log("[CameraScannerDialog] No scanner instance to clear.");
    }
  }, []);

  const startScanner = useCallback(async () => {
    if (isStartingRef.current || !isOpen || manualInputMode) {
      console.log("[CameraScannerDialog] Not starting scanner: already starting, dialog closed, or manual input mode.");
      return;
    }
    if (isCameraStartedRef.current) {
      console.log("[CameraScannerDialog] Camera already started, skipping new start.");
      setScannerError(null);
      setIsScannerLoading(false);
      return;
    }

    isStartingRef.current = true;
    setIsScannerLoading(true);
    setScannerError(null);
    loadingStartTimeRef.current = Date.now();
    currentAttemptsRef.current = 0;

    // Ensure previous scanner is stopped before attempting a new start
    await stopScanner();
    await new Promise(resolve => setTimeout(resolve, 500)); // Small delay to ensure camera resource is released

    if (!html5QrCodeRef.current) {
      html5QrCodeRef.current = new Html5Qrcode(QR_SCANNER_DIV_ID, html5QrcodeConstructorConfig);
    }

    let cameraSelection: string | undefined = undefined;
    try {
      const cameras = await Html5Qrcode.getCameras();
      if (cameras && cameras.length > 0) {
        console.log("[CameraScannerDialog] Available cameras:", cameras);
        let environmentCamera = cameras.find(camera => camera.label.toLowerCase().includes('back') || camera.label.toLowerCase().includes('rear'));
        
        if (!environmentCamera && cameras.length === 1) {
          environmentCamera = cameras[0];
        } else if (!environmentCamera && cameras.length > 1) {
          environmentCamera = cameras[cameras.length - 1];
        }

        if (environmentCamera) {
          cameraSelection = environmentCamera.id;
          console.log("[CameraScannerDialog] Selected camera device ID:", cameraSelection, "Label:", environmentCamera.label);
        } else {
          console.warn("[CameraScannerDialog] No explicit 'environment' camera found by label. Falling back to generic 'environment' string.");
          cameraSelection = "environment";
        }
      } else {
        console.warn("[CameraScannerDialog] No cameras found by Html5Qrcode.getCameras(). Falling back to generic 'environment' string.");
        cameraSelection = "environment";
      }
    } catch (err: any) {
      console.error("[CameraScannerDialog] Error enumerating cameras:", err);
      setScannerError("Failed to list cameras. " + err.message);
      setIsScannerLoading(false);
      isStartingRef.current = false;
      return;
    }

    if (!cameraSelection) {
      setScannerError("No camera could be selected for scanning.");
      setIsScannerLoading(false);
      isStartingRef.current = false;
      return;
    }

    const attemptStart = async () => {
      if (!isOpen || manualInputMode) {
        console.log("[CameraScannerDialog] Aborting retry: dialog closed or manual input mode activated.");
        isStartingRef.current = false;
        setIsScannerLoading(false);
        return;
      }

      currentAttemptsRef.current++;
      console.log(`[CameraScannerDialog] Attempting camera start (attempt ${currentAttemptsRef.current}/${MAX_START_ATTEMPTS}) with selection:`, cameraSelection);

      try {
        if (!html5QrCodeRef.current) {
          throw new Error("Html5Qrcode instance is null before start attempt.");
        }
        await html5QrCodeRef.current.start(
          cameraSelection,
          html5QrcodeCameraScanConfig,
          async (decodedText) => {
            console.log("[CameraScannerDialog] Scan successful:", decodedText);
            await stopScanner(); // Stop camera after successful scan
            onScanSuccess(decodedText);
            // onClose(); // Dialog will close via onScanSuccess callback
          },
          (errorMessage) => {
            if (!errorMessage.includes("No QR code found")) {
              console.warn("[CameraScannerDialog] Scan error (not 'No QR code found'):", errorMessage);
            }
          }
        );
        console.log("[CameraScannerDialog] Scanner started and ready.");
        isCameraStartedRef.current = true;
        
        const elapsedTime = Date.now() - (loadingStartTimeRef.current || 0);
        if (elapsedTime < MIN_LOADING_DISPLAY_TIME) {
            const remainingTime = MIN_LOADING_DISPLAY_TIME - elapsedTime;
            console.log(`[CameraScannerDialog] Delaying onReady/onLoading(false) by ${remainingTime}ms to meet minimum loading display time.`);
            await new Promise(resolve => setTimeout(resolve, remainingTime));
        }

        setScannerError(null);
        setIsScannerLoading(false);
        isStartingRef.current = false;
      } catch (err: any) {
        console.error(`[CameraScannerDialog] Error starting scanner on attempt ${currentAttemptsRef.current}:`, err);
        isCameraStartedRef.current = false;
        let errorMessage = "Failed to start camera. ";
        if (err.name === "NotReadableError") {
          errorMessage += "Camera in use or hardware issue. Close other camera apps. ";
        } else if (err.name === "NotAllowedError") {
          errorMessage += "Camera access denied. Grant permission in browser settings. ";
        } else if (err.name === "OverconstrainedError") {
          errorMessage += "Camera settings issue. Try restarting device/apps. ";
        } else if (err.name === "NotFoundError") {
          errorMessage += "No camera devices found. ";
        } else {
          errorMessage += "Unknown error. Ensure working camera. ";
        }
        
        if (currentAttemptsRef.current < MAX_START_ATTEMPTS && (err.name === "NotReadableError" || err.name === "NotAllowedError" || err.name === "NotFoundError" || err.name === "OverconstrainedError")) {
          console.log(`[CameraScannerDialog] Retrying camera start in ${RETRY_DELAY_MS}ms...`);
          setTimeout(attemptStart, RETRY_DELAY_MS);
        } else {
          setScannerError(errorMessage);
          setIsScannerLoading(false);
          isStartingRef.current = false;
        }
      }
    };

    attemptStart();
  }, [isOpen, manualInputMode, stopScanner, onScanSuccess, html5QrcodeConstructorConfig, html5QrcodeCameraScanConfig]);

  const handleRetryScan = useCallback(() => {
    currentAttemptsRef.current = 0; // Reset attempts for a manual retry
    startScanner();
  }, [startScanner]);

  const handleManualInputSubmit = () => {
    if (manualInputValue.trim()) {
      onScanSuccess(manualInputValue.trim());
      showSuccess("Manual input submitted!");
      onClose();
    } else {
      showError("Enter barcode/QR value.");
    }
  };

  // Effect to manage scanner state when dialog opens/closes or mode changes
  useEffect(() => {
    if (isOpen && !manualInputMode) {
      startScanner();
    } else if (!isOpen || manualInputMode) {
      stopScanner();
    }
    // Cleanup function for when the dialog component unmounts
    return () => {
      console.log("[CameraScannerDialog] Component unmounting. Performing full cleanup.");
      clearScanner();
      isCameraStartedRef.current = false;
      isStartingRef.current = false;
      currentAttemptsRef.current = 0;
      setIsScannerLoading(false);
    };
  }, [isOpen, manualInputMode, startScanner, stopScanner, clearScanner]);

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
                <QrScannerDisplay divId={QR_SCANNER_DIV_ID} />
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