"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Crown, ArrowRight, X, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useProfile } from "@/context/ProfileContext";
import { showError, showSuccess } from "@/utils/toast";

interface UpgradePromptDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const UpgradePromptDialog: React.FC<UpgradePromptDialogProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { profile, markUpgradePromptSeen } = useProfile();
  const [isProcessingSubscription, setIsProcessingSubscription] = useState(false);

  const handleUpgradeNow = () => {
    markUpgradePromptSeen();
    onClose();
    navigate("/billing");
  };

  const handleStartFreeTrial = async (planName: 'standard' | 'pro') => {
    if (!profile?.organizationId || !profile?.id || !profile?.email || !profile?.fullName) {
      showError("User or organization data missing. Cannot start trial.");
      return;
    }

    // Use Lemon Squeezy product IDs (assuming they are now configured in .env)
    const lemonSqueezyProductId = planName === 'standard' ? import.meta.env.VITE_LEMON_SQUEEZY_PRODUCT_ID_STANDARD : import.meta.env.VITE_LEMON_SQUEEZY_PRODUCT_ID_PRO;
    const lemonSqueezyVariantId = planName === 'standard' ? import.meta.env.VITE_LEMON_SQUEEZY_PRODUCT_ID_STANDARD_VARIANT : import.meta.env.VITE_LEMON_SQUEEZY_PRODUCT_ID_PRO_VARIANT;

    if (!lemonSqueezyProductId || !lemonSqueezyVariantId) {
      showError("Lemon Squeezy product information missing for this plan. Contact support.");
      return;
    }

    setIsProcessingSubscription(true);
    try {
      const lemonSqueezyStoreUrl = import.meta.env.VITE_LEMON_SQUEEZY_STORE_URL;
      if (!lemonSqueezyStoreUrl) {
        throw new Error("Lemon Squeezy Store URL is not configured. Please contact support.");
      }

      const redirectUrl = encodeURIComponent(`${window.location.origin}/billing?lemon_squeezy_checkout_status={checkout_status}&organization_id=${profile.organizationId}&user_id=${profile.id}`);
      const passthroughData = encodeURIComponent(JSON.stringify({
        organization_id: profile.organizationId,
        user_id: profile.id,
        plan_id: planName, // Pass the plan ID for webhook processing
      }));

      const checkoutUrl = `https://${lemonSqueezyStoreUrl}/checkout/buy/${lemonSqueezyProductId}?variant=${lemonSqueezyVariantId}&passthrough=${passthroughData}&redirect_url=${redirectUrl}`;
      
      window.location.href = checkoutUrl; // Redirect to Lemon Squeezy checkout page

    } catch (error: any) {
      console.error("Error initiating Lemon Squeezy checkout for trial:", error);
      showError(`Failed to start free trial: ${error.message}`);
    } finally {
      setIsProcessingSubscription(false);
    }
  };

  const handleContinueWithFreePlan = () => {
    markUpgradePromptSeen();
    onClose();
    showSuccess("Continuing with Free plan. Upgrade anytime!");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader className="text-center">
          <Sparkles className="h-12 w-12 text-primary mx-auto mb-4" />
          <DialogTitle className="text-2xl font-bold">Unlock More Power with Fortress!</DialogTitle>
          <DialogDescription>
            You're currently on the Free plan. Upgrade or start a free trial to access advanced features and streamline your operations even further.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Button onClick={handleUpgradeNow} className="w-full">
            <Crown className="h-4 w-4 mr-2" /> Upgrade Now
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleStartFreeTrial('standard')}
            disabled={isProcessingSubscription}
            className="w-full"
          >
            {isProcessingSubscription ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting Trial...
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4 mr-2" /> Start 14-Day Free Trial (Standard)
              </>
            )}
          </Button>
          <Button variant="ghost" onClick={handleContinueWithFreePlan} className="w-full text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4 mr-2" /> Continue with Free Plan
          </Button>
        </div>
        <DialogFooter className="text-xs text-muted-foreground text-center">
          Your trial will automatically convert to a paid subscription after 14 days unless cancelled.
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UpgradePromptDialog;