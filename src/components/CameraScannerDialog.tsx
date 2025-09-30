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
const MAX_START_ATTEMPTS = 3; // Max attempts for initial camera start (excluding device enumeration retries)
const RETRY_DELAY_MS = 1500; // 1.5 seconds delay between retries
const CAMERA_STARTUP_TIMEOUT_MS = 10000; // 10 seconds for camera to start
const MIN_LOADING_DISPLAY_TIME = 500; // Minimum 500ms for the loading overlay

const CameraScannerDialog: React.FC<CameraScannerDialogProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  title = "Scan Barcode / QR Code",
  description = "Point your camera at a barcode or QR code to scan.",
}) => {
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isCameraStartedRef = useRef(false); // Tracks if camera stream is actively running
  const isStartingRef = useRef(false); // Prevents multiple concurrent start attempts
  const currentAttemptIndexRef = useRef(0); // Tracks current retry attempt index
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
    // videoConstraints will be determined dynamically in startScanner
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
        isCameraStartedRef.current = false; // Mark as stopped
        setIsScannerLoading(false); // Ensure loading is off
        isStartingRef.current = false; // Ensure starting flag is reset
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
        isCameraStartedRef.current = false;
        isStartingRef.current = false;
        currentAttemptIndexRef.current = 0;
        setIsScannerLoading(false);
      }
    } else {
      console.log("[CameraScannerDialog] No scanner instance to clear.");
    }
  }, []);

  const startScanner = useCallback(async () => {
    if (isStartingRef.current) {
      console.log("[CameraScannerDialog] Start already in progress, skipping.");
      return;
    }
    if (isCameraStartedRef.current) {
      console.log("[CameraScannerDialog] Camera already started, no need to restart.");
      setScannerError(null);
      setIsScannerLoading(false);
      return;
    }
    if (!isOpen || manualInputMode) {
      console.log("[CameraScannerDialog] Not starting scanner: dialog closed or manual input mode.");
      return;
    }

    isStartingRef.current = true;
    setIsScannerLoading(true);
    setScannerError(null);
    loadingStartTimeRef.current = Date.now();
    currentAttemptIndexRef.current = 0; // Reset attempts for a new start cycle

    // Ensure a fresh Html5Qrcode instance for each start attempt
    if (html5QrCodeRef.current) {
      await clearScanner();
    }
    html5QrCodeRef.current = new Html5Qrcode(QR_SCANNER_DIV_ID, html5QrcodeConstructorConfig);

    const tryStartCamera = async () => {
      if (!isOpen || manualInputMode) { // Check again before each retry
        console.log("[CameraScannerDialog] Aborting retry: dialog closed or manual input mode activated.");
        isStartingRef.current = false;
        setIsScannerLoading(false);
        return;
      }
      if (isCameraStartedRef.current) { // Check if it somehow started in between retries
        console.log("[CameraScannerDialog] Camera already started during retry, aborting further attempts.");
        isStartingRef.current = false;
        setIsScannerLoading(false);
        return;
      }

      currentAttemptIndexRef.current++;
      console.log(`[CameraScannerDialog] Attempting camera start (attempt ${currentAttemptIndexRef.current}/${MAX_START_ATTEMPTS})`);

      let cameraSelection: string | MediaTrackConstraints;

      // Strategy 1: Try specific facing modes
      if (currentAttemptIndexRef.current === 1) {
        cameraSelection = { facingMode: { exact: "environment" } };
        console.log("[CameraScannerDialog] Attempt 1: Trying exact 'environment' facingMode.");
      } else if (currentAttemptIndexRef.current === 2) {
        cameraSelection = { facingMode: "environment" };
        console.log("[CameraScannerDialog] Attempt 2: Trying lenient 'environment' facingMode.");
      } else if (currentAttemptIndexRef.current === 3) {
        cameraSelection = { facingMode: "user" }; // Fallback to front camera
        console.log("[CameraScannerDialog] Attempt 3: Trying 'user' (front) facingMode.");
      } else {
        // Strategy 2: Enumerate devices and try by ID
        console.log("[CameraScannerDialog] Attempt 4+: Enumerating camera devices for explicit selection.");
        try {
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            console.log("[CameraScannerDialog] Found camera devices:", devices);
            // Try to find an environment camera, otherwise use the first one
            const environmentCamera = devices.find(device => device.label.toLowerCase().includes("back") || device.label.toLowerCase().includes("environment"));
            cameraSelection = environmentCamera ? environmentCamera.id : devices[0].id;
            console.log("[CameraScannerDialog] Using specific camera ID:", cameraSelection);
          } else {
            console.warn("[CameraScannerDialog] No camera devices found during enumeration.");
            throw new Error("No camera devices found.");
          }
        } catch (enumError) {
          console.error("[CameraScannerDialog] Error enumerating cameras:", enumError);
          setScannerError("Failed to access camera devices. Check permissions.");
          setIsScannerLoading(false);
          isStartingRef.current = false;
          return;
        }
      }

      const startupPromise = new Promise<void>(async (resolve, reject) => {
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
              resolve(); // Resolve the startup promise on successful scan
            },
            (errorMessage) => {
              if (!errorMessage.includes("No QR code found")) {
                console.warn("[CameraScannerDialog] Scan error (not 'No QR code found'):", errorMessage);
              }
            }
          );
          console.log("[CameraScannerDialog] Scanner started and ready.");
          isCameraStartedRef.current = true;
          resolve(); // Resolve the startup promise on successful camera start
        } catch (err) {
          reject(err); // Reject on any error during camera start
        }
      });

      const timeoutPromise = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("Camera startup timed out.")), CAMERA_STARTUP_TIMEOUT_MS)
      );

      try {
        await Promise.race([startupPromise, timeoutPromise]);

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
        console.error(`[CameraScannerDialog] Error starting scanner on attempt ${currentAttemptIndexRef.current}:`, err);
        isCameraStartedRef.current = false; // Ensure this is false on error
        let errorMessage = "Failed to start camera. ";
        if (err.message === "Camera startup timed out.") {
          errorMessage = "Camera startup timed out. ";
        } else if (err.name === "NotReadableError") {
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
        
        if (currentAttemptIndexRef.current < MAX_START_ATTEMPTS && (err.name === "NotReadableError" || err.name === "NotAllowedError" || err.name === "NotFoundError" || err.name === "OverconstrainedError" || err.message === "Camera startup timed out.")) {
          console.log(`[CameraScannerDialog] Retrying camera start in ${RETRY_DELAY_MS}ms...`);
          setTimeout(tryStartCamera, RETRY_DELAY_MS);
        } else {
          setScannerError(errorMessage);
          setIsScannerLoading(false);
          isStartingRef.current = false;
        }
      }
    };

    tryStartCamera();
  }, [isOpen, manualInputMode, stopScanner, onScanSuccess, html5QrcodeConstructorConfig, html5QrcodeCameraScanConfig, clearScanner]);

  const handleRetryScan = useCallback(async () => {
    console.log("[CameraScannerDialog] Manual retry initiated.");
    await stopScanner(); // Ensure it's stopped before retrying
    await new Promise(resolve => setTimeout(resolve, 500)); // Give some time to release
    startScanner();
  }, [stopScanner, startScanner]);

  const handleManualInputSubmit = () => {
    if (manualInputValue.trim()) {
      onScanSuccess(manualInputValue.trim());
      showSuccess("Manual input submitted!");
      onClose();
    } else {
      showError("Enter barcode/QR value.");
    }
  };

  // Main effect to manage scanner lifecycle based on dialog state and manual input mode
  useEffect(() => {
    console.log(`[CameraScannerDialog] useEffect: isOpen=${isOpen}, manualInputMode=${manualInputMode}, isCameraStartedRef.current=${isCameraStartedRef.current}`);
    if (isOpen) {
      // Reset manual input mode when dialog opens to ensure camera attempts to start
      setManualInputMode(false); 
      if (!manualInputMode) {
        startScanner();
      }
    } else {
      // If dialog is closing, stop scanner if it's running
      if (isCameraStartedRef.current) {
        stopScanner();
      }
    }

    // Cleanup function for when the dialog component unmounts
    return () => {
      console.log("[CameraScannerDialog] Component unmounting. Performing full cleanup.");
      clearScanner(); // Only clear when component unmounts
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