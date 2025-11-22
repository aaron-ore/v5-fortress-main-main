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
import { supabase } from "@/lib/supabaseClient";

interface UpgradePromptDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const UpgradePromptDialog: React.FC<UpgradePromptDialogProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { profile, markUpgradePromptSeen, fetchProfile } = useProfile();
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

    // Assuming DODO_PRODUCT_ID_STANDARD and DODO_PRODUCT_ID_PRO are set in environment variables
    const dodoProductId = planName === 'standard' ? import.meta.env.VITE_DODO_PRODUCT_ID_STANDARD : import.meta.env.VITE_DODO_PRODUCT_ID_PRO;
    const dodoVariantId = planName === 'standard' ? import.meta.env.VITE_DODO_PRODUCT_ID_STANDARD_VARIANT : import.meta.env.VITE_DODO_PRODUCT_ID_PRO_VARIANT; // Assuming variants for monthly

    if (!dodoProductId || !dodoVariantId) {
      showError("Dodo product information missing for this plan. Contact support.");
      return;
    }

    setIsProcessingSubscription(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        throw new Error("Authentication session expired. Please log in again.");
      }

      const { data, error } = await supabase.functions.invoke('create-dodo-checkout-session', {
        body: JSON.stringify({
          productId: dodoProductId,
          variantId: dodoVariantId,
          organizationId: profile.organizationId,
          userId: profile.id,
          customerEmail: profile.email,
          customerName: profile.fullName,
          redirectTo: window.location.origin + '/billing', // Redirect back to billing page
        }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl; // Redirect to Dodo checkout
      } else {
        throw new Error("No checkout URL received from Dodo.");
      }

    } catch (error: any) {
      console.error("Error initiating Dodo checkout for trial:", error);
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