import { toast } from "sonner";

let consecutiveErrorCount = 0;
const ERROR_THRESHOLD = 10; // Number of consecutive errors before showing a summary
let summaryErrorToastId: string | number | null = null; // ID of the persistent summary error toast
const activeToastIds: Set<string | number> = new Set(); // Track all active toast IDs

const truncateMessage = (message: string, wordLimit: number = 10): string => {
  const words = message.split(' ');
  if (words.length > wordLimit) {
    return words.slice(0, wordLimit).join(' ') + '...';
  }
  return message;
};

const showToast = (type: 'success' | 'error' | 'info' | 'warning', message: string, options?: any) => {
  // Dismiss all currently active toasts before showing a new one
  activeToastIds.forEach(id => toast.dismiss(id));
  activeToastIds.clear();

  const truncatedMessage = truncateMessage(message);

  const id = toast[type](truncatedMessage, {
    ...options,
    onDismiss: (dismissedId: string | number) => {
      activeToastIds.delete(dismissedId);
      if (dismissedId === summaryErrorToastId) {
        summaryErrorToastId = null;
        consecutiveErrorCount = 0; // Reset error count when summary is dismissed
      }
      options?.onDismiss?.(dismissedId);
    },
    onAutoClose: (closedId: string | number) => {
      activeToastIds.delete(closedId);
      if (closedId === summaryErrorToastId) {
        summaryErrorToastId = null;
        consecutiveErrorCount = 0; // Reset error count when summary auto-closes
      }
      options?.onAutoClose?.(closedId);
    }
  });
  activeToastIds.add(id);
  return id;
};

export const showSuccess = (message: string) => {
  // If a summary error toast is active, dismiss it when a success occurs
  if (summaryErrorToastId !== null) {
    toast.dismiss(summaryErrorToastId);
    summaryErrorToastId = null;
    consecutiveErrorCount = 0; // Reset error count on success
  }
  consecutiveErrorCount = 0; // Reset error count on success
  showToast('success', message);
};

export const showError = (message: string) => {
  // If a summary error toast is already active, don't show new individual errors
  if (summaryErrorToastId !== null) {
    console.warn("Additional error occurred while summary toast is active. Message:", message);
    return; // Suppress individual error toasts
  }

  consecutiveErrorCount++;

  if (consecutiveErrorCount >= ERROR_THRESHOLD) {
    // Dismiss all currently active toasts before showing the summary
    activeToastIds.forEach(id => toast.dismiss(id));
    activeToastIds.clear();

    const summaryMessage = "Multiple errors. Contact support if issue persists.";
    summaryErrorToastId = showToast('error', summaryMessage, {
      duration: Infinity, // Make summary error toast persistent until dismissed manually
      closeButton: true,
    });
    consecutiveErrorCount = 0; // Reset count after showing summary
  } else {
    // Show individual error toast
    showToast('error', message);
  }
};

export const showInfo = (message: string) => {
  if (summaryErrorToastId !== null) {
    toast.dismiss(summaryErrorToastId);
    summaryErrorToastId = null;
    consecutiveErrorCount = 0;
  }
  consecutiveErrorCount = 0;
  showToast('info', message);
};

export const showWarning = (message: string) => {
  if (summaryErrorToastId !== null) {
    toast.dismiss(summaryErrorToastId);
    summaryErrorToastId = null;
    consecutiveErrorCount = 0;
  }
  consecutiveErrorCount = 0;
  showToast('warning', message);
};

export const dismissToast = (toastId: string | number) => {
  toast.dismiss(toastId);
};