import { useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats, Html5QrcodeFullConfig, Html5QrcodeCameraScanConfig } from "html5-qrcode";

export interface QrScannerRef {
  stopAndClear: () => Promise<void>;
  retryStart: () => Promise<void>;
}

interface QrScannerProps {
  onScan: (decodedText: string) => void;
  onError: (errorMessage: string) => void;
  onReady: () => void;
  onLoading: (loading: boolean) => void;
  isOpen: boolean;
}

const QR_SCANNER_DIV_ID = "qr-code-full-region";
const MAX_START_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1500; // 1.5 seconds

const QrScanner = forwardRef<QrScannerRef, QrScannerProps>(
  ({ onScan, onError, onReady, onLoading, isOpen }, ref) => {
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
    const isMounted = useRef(true);
    const isCameraStartedRef = useRef(false);
    const isStartingRef = useRef(false);
    const qrScannerDivRef = useRef<HTMLDivElement>(null);
    const currentAttemptsRef = useRef(0);

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
        console.log("[QrScanner] Attempting to stop scanner...");
        try {
          await html5QrCodeRef.current.stop();
          console.log("[QrScanner] Scanner stopped successfully.");
        } catch (e) {
          console.warn("[QrScanner] Error during scanner stop (might be already stopped or camera not found):", e);
        } finally {
          isCameraStartedRef.current = false;
        }
      } else {
        console.log("[QrScanner] No active scanner instance to stop.");
      }
    }, []);

    const clearScanner = useCallback(async () => { // Made async
      if (html5QrCodeRef.current) {
        console.log("[QrScanner] Attempting to clear scanner instance...");
        try {
          await html5QrCodeRef.current.clear(); // Await clear()
          console.log("[QrScanner] Scanner instance cleared.");
        } catch (e) {
          console.warn("[QrScanner] Error during scanner clear:", e);
        } finally {
          html5QrCodeRef.current = null;
        }
      } else {
        console.log("[QrScanner] No scanner instance to clear.");
      }
    }, []);

    const stopAndClear = useCallback(async () => {
      console.log("[QrScanner] stopAndClear called.");
      await stopScanner();
      // Add a slightly longer delay here to ensure camera resource is released
      await new Promise(resolve => setTimeout(resolve, 750)); // Increased from 500ms
      await clearScanner(); // Await clearScanner
      isCameraStartedRef.current = false;
      isStartingRef.current = false;
      currentAttemptsRef.current = 0;
      onLoading(false);
    }, [stopScanner, clearScanner, onLoading]);

    const startScanner = useCallback(async () => {
      if (!isMounted.current || !isOpen) {
        console.log("[QrScanner] Not starting scanner: component unmounted or dialog closed.");
        return;
      }
      if (isStartingRef.current) {
        console.log("[QrScanner] Scanner already in process of starting, skipping new start.");
        return;
      }
      if (isCameraStartedRef.current) {
        console.log("[QrScanner] Camera already started, skipping new start.");
        onReady();
        onLoading(false);
        return;
      }
      if (!qrScannerDivRef.current) {
        console.log("[QrScanner] qrScannerDivRef.current is null. Deferring startScanner.");
        return;
      }

      isStartingRef.current = true;
      onLoading(true);
      currentAttemptsRef.current = 0;

      // Ensure previous scanner is fully stopped and cleared before attempting a new start
      await stopAndClear(); // Call stopAndClear here to ensure a clean slate
      await new Promise(resolve => setTimeout(resolve, 500)); // Additional delay before starting camera enumeration

      let cameraSelection: string | undefined = undefined;
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
          console.log("[QrScanner] Available cameras:", cameras);
          let environmentCamera = cameras.find(camera => camera.label.toLowerCase().includes('back') || camera.label.toLowerCase().includes('rear'));
          
          if (!environmentCamera && cameras.length === 1) {
            environmentCamera = cameras[0];
          } else if (!environmentCamera && cameras.length > 1) {
            environmentCamera = cameras[cameras.length - 1];
          }

          if (environmentCamera) {
            cameraSelection = environmentCamera.id;
            console.log("[QrScanner] Selected camera device ID:", cameraSelection, "Label:", environmentCamera.label);
          } else {
            console.warn("[QrScanner] No explicit 'environment' camera found by label. Falling back to generic 'environment' string.");
            cameraSelection = "environment";
          }
        } else {
          console.warn("[QrScanner] No cameras found by Html5Qrcode.getCameras(). Falling back to generic 'environment' string.");
          cameraSelection = "environment";
        }
      } catch (err: any) {
        console.error("[QrScanner] Error enumerating cameras:", err);
        onError("Failed to list cameras. " + err.message);
        onLoading(false);
        isStartingRef.current = false;
        return;
      }

      if (!cameraSelection) {
        onError("No camera could be selected for scanning.");
        onLoading(false);
        isStartingRef.current = false;
        return;
      }

      // Initialize Html5Qrcode instance here, outside the attempt loop, if it's null
      // This check is now redundant because stopAndClear ensures html5QrCodeRef.current is null
      // if (!html5QrCodeRef.current) {
      html5QrCodeRef.current = new Html5Qrcode(QR_SCANNER_DIV_ID, html5QrcodeConstructorConfig);
      // }

      const attemptStart = async () => {
        if (!isMounted.current || !isOpen) {
          console.log("[QrScanner] Aborting retry: component unmounted or dialog closed.");
          isStartingRef.current = false;
          onLoading(false);
          return;
        }

        currentAttemptsRef.current++;
        console.log(`[QrScanner] Attempting camera start (attempt ${currentAttemptsRef.current}/${MAX_START_ATTEMPTS}) with selection:`, cameraSelection);

        // Re-check if html5QrCodeRef.current is null before starting, in case it was cleared
        // This check is now redundant because stopAndClear ensures html5QrCodeRef.current is null
        // if (!html5QrCodeRef.current) {
        //   html5QrCodeRef.current = new Html5Qrcode(QR_SCANNER_DIV_ID, html5QrcodeConstructorConfig);
        // }

        try {
          // Ensure html5QrCodeRef.current is not null before calling start
          if (!html5QrCodeRef.current) {
            throw new Error("Html5Qrcode instance is null before start attempt.");
          }
          await html5QrCodeRef.current.start(
            cameraSelection,
            html5QrcodeCameraScanConfig,
            async (decodedText) => {
              if (isMounted.current) {
                console.log("[QrScanner] Scan successful:", decodedText);
                await stopScanner();
                await new Promise(resolve => setTimeout(resolve, 100));
                onScan(decodedText);
              }
            },
            (errorMessage) => {
              if (isMounted.current && !errorMessage.includes("No QR code found")) {
                console.warn("[QrScanner] Scan error (not 'No QR code found'):", errorMessage);
              }
            }
          );
          if (isMounted.current) {
            console.log("[QrScanner] Scanner started and ready.");
            isCameraStartedRef.current = true;
            onReady();
            onLoading(false);
            isStartingRef.current = false; // Successfully started, reset starting flag
          }
        } catch (err: any) {
          if (isMounted.current) {
            console.error(`[QrScanner] Error starting scanner on attempt ${currentAttemptsRef.current}:`, err);
            isCameraStartedRef.current = false;
            let errorMessage = "Failed to start camera. ";
            if (err.name === "NotReadableError") {
              errorMessage += "The camera might be in use by another application, or there's a temporary hardware issue. Please try closing other camera apps. ";
            } else if (err.name === "NotAllowedError") {
              errorMessage += "Camera access was denied. Please check your browser's site permissions for this page and grant camera access. ";
            } else if (err.name === "OverconstrainedError") {
              errorMessage += "The camera could not be activated with the requested settings (e.g., back camera not found or available). Try restarting your device or closing other camera apps. ";
            } else if (err.name === "NotFoundError") {
              errorMessage += "No camera devices were found. ";
            } else {
              errorMessage += "An unknown error occurred. Please ensure your device has a working camera and try again. ";
            }
            
            if (currentAttemptsRef.current < MAX_START_ATTEMPTS && (err.name === "NotReadableError" || err.name === "NotAllowedError" || err.name === "NotFoundError" || err.name === "OverconstrainedError")) {
              console.log(`[QrScanner] Retrying camera start in ${RETRY_DELAY_MS}ms...`);
              setTimeout(attemptStart, RETRY_DELAY_MS);
            } else {
              onError(errorMessage);
              onLoading(false);
              isStartingRef.current = false; // All attempts failed, reset starting flag
            }
          }
        }
      };

      await attemptStart(); // Start the first attempt
    }, [isOpen, onScan, onReady, onError, onLoading, stopScanner, clearScanner, html5QrcodeConstructorConfig, html5QrcodeCameraScanConfig, qrScannerDivRef, stopAndClear]);

    const retryStart = useCallback(async () => {
      console.log("[QrScanner] retryStart called.");
      currentAttemptsRef.current = 0; // Reset attempts for a manual retry
      await startScanner();
    }, [startScanner]);

    useImperativeHandle(ref, () => ({
      stopAndClear: stopAndClear,
      retryStart: retryStart,
    }));

    useEffect(() => {
      isMounted.current = true;
      console.log("[QrScanner] Main effect running. isOpen:", isOpen);

      if (isOpen && qrScannerDivRef.current) {
        startScanner();
      } else if (!isOpen) {
        stopAndClear();
      }

      return () => {
        isMounted.current = false;
        console.log("[QrScanner] Component unmounting or effect cleanup. Stopping and clearing scanner.");
        stopAndClear();
      };
    }, [isOpen, startScanner, stopAndClear]); // Removed qrScannerDivRef.current from dependencies

    return (
      <div id={QR_SCANNER_DIV_ID} ref={qrScannerDivRef} className="w-full h-full" />
    );
  }
);

QrScanner.displayName = "QrScanner";

export default QrScanner;