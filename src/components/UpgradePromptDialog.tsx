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
import { Sparkles, Crown, ArrowRight, X, Loader2 } from "lucide-react"; // Corrected import for Loader2
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
  const [isProcessingTrial, setIsProcessingTrial] = useState(false);

  const handleUpgradeNow = () => {
    markUpgradePromptSeen();
    onClose();
    navigate("/billing");
  };

  const handleStartFreeTrial = async (plan: 'standard' | 'premium') => {
    if (!profile?.organizationId) {
      showError("Org not found. Cannot start trial.");
      return;
    }
    if (!profile?.id) {
      showError("User not found. Log in again.");
      return;
    }

    setIsProcessingTrial(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        throw new Error("Session expired. Log in again.");
      }

      // Find the price ID for the selected plan (e.g., 'standard' monthly)
      const { data: prices, error: pricesError } = await supabase
        .from('prices')
        .select('id, product_id')
        .eq('type', 'recurring')
        .eq('interval', 'month');

      if (pricesError) throw pricesError;

      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name')
        .in('name', [plan]);

      if (productsError) throw productsError;

      const selectedProduct = products.find(p => p.name.toLowerCase() === plan);
      if (!selectedProduct) throw new Error(`Product for plan '${plan}' not found.`);

      const selectedPrice = prices.find(p => p.product_id === selectedProduct.id);
      if (!selectedPrice) throw new Error(`Monthly price for plan '${plan}' not found.`);

      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: JSON.stringify({
          priceId: selectedPrice.id,
          organizationId: profile.organizationId,
          trial_period_days: 14, // 14-day free trial
        }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      if (data.url) {
        window.location.href = data.url; // Redirect to Stripe Checkout
      } else {
        throw new Error("Stripe Checkout URL not returned.");
      }
    } catch (error: any) {
      console.error("Error starting free trial:", error);
      showError(`Failed to start free trial: ${error.message}`);
    } finally {
      setIsProcessingTrial(false);
      await fetchProfile(); // Refresh profile to reflect trial status
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
            onClick={() => handleStartFreeTrial('standard')} // Default to Standard plan for trial
            disabled={isProcessingTrial}
            className="w-full"
          >
            {isProcessingTrial ? (
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