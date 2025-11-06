import React, { lazy, Suspense } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";

// Lazy load policy pages
const TermsOfService = lazy(() => import("@/pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("@/pages/PrivacyPolicy"));
const RefundPolicy = lazy(() => import("@/pages/RefundPolicy"));

interface PolicyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  policyType: 'terms' | 'privacy' | 'refund';
}

const PolicyDialog: React.FC<PolicyDialogProps> = ({ isOpen, onClose, policyType }) => {
  const getPolicyComponent = () => {
    switch (policyType) {
      case 'terms':
        return <TermsOfService />;
      case 'privacy':
        return <PrivacyPolicy />;
      case 'refund':
        return <RefundPolicy />;
      default:
        return <p>Policy content not found.</p>;
    }
  };

  const getPolicyTitle = () => {
    switch (policyType) {
      case 'terms':
        return "Terms of Service";
      case 'privacy':
        return "Privacy Policy";
      case 'refund':
        return "Refund Policy";
      default:
        return "Policy";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{getPolicyTitle()}</DialogTitle>
          <DialogDescription>
            Please review our {getPolicyTitle().toLowerCase()} agreement.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-grow p-4">
          <Suspense fallback={
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Loading policy...</span>
            </div>
          }>
            {getPolicyComponent()}
          </Suspense>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default PolicyDialog;