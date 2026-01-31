import { createClient } from 'npm:@supabase/supabase-js';
import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
import { Webhook } from 'npm:lemonsqueezy'; // Corrected import

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  let rawBodyText = '';
  const contentType = req.headers.get('content-type');

  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    // 1. Read raw body for signature verification
    rawBodyText = await req.text();
    
    const lemonSqueezyWebhookSecret = Deno.env.get('LEMON_SQUEEZY_WEBHOOK_SECRET');
    if (!lemonSqueezyWebhookSecret) {
      console.error('[LemonSqueezy Webhook] Server configuration error: LEMON_SQUEEZY_WEBHOOK_SECRET is missing.');
      return new Response(JSON.stringify({ error: 'Server configuration error: Webhook secret missing.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const signature = req.headers.get('X-Signature');
    if (!signature) {
      console.error('[LemonSqueezy Webhook] Webhook signature missing.');
      return new Response(JSON.stringify({ error: 'Webhook signature missing.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // 2. Verify webhook signature
    try {
      const webhook = new Webhook(lemonSqueezyWebhookSecret);
      webhook.verify(rawBodyText, signature);
      console.log('[LemonSqueezy Webhook] Signature verified successfully.');
    } catch (e) {
      console.error('[LemonSqueezy Webhook] Signature verification failed:', e);
      return new Response(JSON.stringify({ error: 'Webhook signature verification failed.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // 3. Parse body after verification
    const event = JSON.parse(rawBodyText);
    console.log('[LemonSqueezy Webhook] Received event:', event.meta.event_name, JSON.stringify(event, null, 2));

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const attributes = event.data.attributes;
    const meta = event.meta;
    const eventName = meta.event_name;

    const organizationId = meta.custom_data?.organization_id;
    const userId = meta.custom_data?.user_id;
    const planId = meta.custom_data?.plan_id;

    if (!organizationId || !userId || !planId) {
      console.error('[LemonSqueezy Webhook] Missing custom data in metadata:', meta.custom_data);
      return new Response(JSON.stringify({ error: 'Missing organization_id, user_id, or plan_id in webhook metadata.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    switch (eventName) {
      case 'subscription_created':
      case 'subscription_updated':
        const subscription = attributes;
        const newPlan = planId;
        const trialEndsAt = subscription.trial_ends_at;
        const customerId = subscription.customer_id;

        const { error: updateOrgError } = await supabaseAdmin
          .from('organizations')
          .update({
            plan: newPlan,
            lemon_squeezy_subscription_id: subscription.id,
            lemon_squeezy_customer_id: customerId,
            trial_ends_at: trialEndsAt,
          })
          .eq('id', organizationId);

        if (updateOrgError) {
          console.error('[LemonSqueezy Webhook] Error updating organization plan/subscription ID:', updateOrgError);
          throw new Error('Failed to update organization plan/subscription ID.');
        }
        console.log(`[LemonSqueezy Webhook] Organization ${organizationId} updated to plan ${newPlan} with subscription ID ${subscription.id}.`);
        break;

      case 'subscription_cancelled':
      case 'subscription_expired':
        // Revert to free plan
        const { error: cancelOrgError } = await supabaseAdmin
          .from('organizations')
          .update({
            plan: 'free',
            lemon_squeezy_subscription_id: null,
            trial_ends_at: null,
          })
          .eq('id', organizationId);

        if (cancelOrgError) {
          console.error('[LemonSqueezy Webhook] Error updating organization plan after cancellation:', cancelOrgError);
          throw new Error('Failed to update organization plan after cancellation.');
        }
        console.log(`[LemonSqueezy Webhook] Organization ${organizationId} subscription cancelled/expired. Reverted to free plan.`);
        break;

      case 'order_created':
        // Handle one-time purchases or other order types (e.g., perpetual licenses)
        console.log('[LemonSqueezy Webhook] Order created event received:', attributes.order_number);
        // Logic to update perpetual license features based on the purchased product
        break;

      default:
        console.log('[LemonSqueezy Webhook] Unhandled event type:', eventName);
    }

    return new Response(JSON.stringify({ message: 'Webhook processed successfully.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('[LemonSqueezy Webhook] Caught top-level error:', error);
    return new Response(JSON.stringify({ error: error.message, rawBody: rawBodyText, contentType: contentType }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
</dyad-file>

### 2. Update Client-Side Code (Billing, Upgrade Prompt, App Content, Vite Config)

I will update the remaining files to use the new Lemon Squeezy logic and environment variables.

<dyad-write path="src/pages/BillingSubscriptions.tsx" description="Updating the BillingSubscriptions page to use Lemon Squeezy checkout links and profile fields.">
import React, { useState, useEffect } from "react";
    import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
    import { Button } from "@/components/ui/button";
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
    import { CreditCard, DollarSign, FileText, CheckCircle, XCircle, Sparkles, Loader2 } from "lucide-react";
    import { showSuccess, showError, showInfo } from "@/utils/toast";
    import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
    import { cn } from "@/lib/utils";
    import { Badge } from "@/components/ui/badge";
    import { useProfile } from "@/context/ProfileContext";
    import { supabase } from "@/lib/supabaseClient";
    import { ALL_APP_FEATURES, getAllFeatureIds } from "@/lib/features";

    interface PlanFeature {
      text: string;
      included: boolean;
    }

    interface PlanDisplay {
      id: string;
      name: string;
      description: string;
      monthlyPrice?: number;
      annualPrice?: number;
      oneTimePrice?: number;
      isPopular?: boolean;
      features: PlanFeature[];
      lemonSqueezyProductId?: string; // RENAMED
      lemonSqueezyVariantId?: string; // RENAMED
    }

    const BillingSubscriptions: React.FC = () => {
      const { profile, isLoadingProfile, fetchProfile } = useProfile();
      const [billingCycle, setBillingCycle] = useState<"monthly" | "annually">("monthly");
      const [availablePlans, setAvailablePlans] = useState<PlanDisplay[]>([]);
      const [isLoadingPlans, setIsLoadingPlans] = useState(true);
      const [isProcessingSubscription, setIsProcessingSubscription] = useState(false);
      const [isManagingSubscription, setIsManagingSubscription] = useState(false);

      const currentPlanId = profile?.companyProfile?.plan || "free";

      useEffect(() => {
        const fetchPlans = async () => {
          setIsLoadingPlans(true);
          const mockPlans: PlanDisplay[] = [
            {
              id: "free",
              name: "Free",
              description: "Basic inventory management for small businesses.",
              isPopular: false,
              features: ALL_APP_FEATURES.map(appFeature => ({
                text: appFeature.name,
                included: ['core_inventory_management', 'dashboard_overview', 'basic_order_management', 'user_profile_management', 'basic_reports', 'mobile_responsive_ui', 'in_app_notifications', 'email_notifications', 'terms_of_service', 'privacy_policy', 'refund_policy'].includes(appFeature.id),
              })),
            },
            {
              id: "standard",
              name: "Standard",
              description: "Essential features for growing businesses.",
              monthlyPrice: 59,
              annualPrice: 59 * 12 * 0.83, // Approx 17% discount
              isPopular: true,
              features: ALL_APP_FEATURES.map(appFeature => ({
                text: appFeature.name,
                included: ['core_inventory_management', 'dashboard_overview', 'basic_order_management', 'user_profile_management', 'basic_reports', 'mobile_responsive_ui', 'in_app_notifications', 'email_notifications', 'customer_management', 'vendor_management', 'folder_management', 'qr_code_generation', 'csv_import_export', 'order_kanban_board', 'pdf_export_orders', 'warehouse_operations_dashboard', 'warehouse_tool_item_lookup', 'warehouse_tool_receive_inventory', 'warehouse_tool_putaway', 'warehouse_tool_fulfill_order', 'warehouse_tool_ship_order', 'warehouse_tool_stock_transfer', 'warehouse_tool_cycle_count', 'warehouse_tool_issue_report', 'terms_of_service', 'privacy_policy', 'refund_policy'].includes(appFeature.id),
              })),
              lemonSqueezyProductId: import.meta.env.VITE_LEMON_SQUEEZY_PRODUCT_ID_STANDARD || 'prod_standard_mock', // RENAMED
              lemonSqueezyVariantId: import.meta.env.VITE_LEMON_SQUEEZY_PRODUCT_ID_STANDARD_VARIANT || 'standard_monthly_mock', // RENAMED
            },
            {
              id: "pro",
              name: "Pro",
              description: "Advanced features for optimized operations.",
              monthlyPrice: 125,
              annualPrice: 125 * 12 * 0.83, // Approx 17% discount
              isPopular: false,
              features: ALL_APP_FEATURES.map(appFeature => ({
                text: appFeature.name,
                included: getAllFeatureIds().includes(appFeature.id), // Pro includes all current features
              })),
              lemonSqueezyProductId: import.meta.env.VITE_LEMON_SQUEEZY_PRODUCT_ID_PRO || 'prod_pro_mock', // RENAMED
              lemonSqueezyVariantId: import.meta.env.VITE_LEMON_SQUEEZY_PRODUCT_ID_PRO_VARIANT || 'pro_monthly_mock', // RENAMED
            },
            {
              id: "enterprise",
              name: "Enterprise",
              description: "Custom solutions for large-scale businesses.",
              isPopular: false,
              features: ALL_APP_FEATURES.map(appFeature => ({ text: appFeature.name, included: true })),
            },
          ];

          setAvailablePlans(mockPlans.sort((a, b) => {
            if (a.name.toLowerCase() === 'free') return -1;
            if (b.name.toLowerCase() === 'free') return 1;
            return (a.monthlyPrice || Infinity) - (b.monthlyPrice || Infinity);
          }));
          setIsLoadingPlans(false);
        };

        fetchPlans();
      }, []);

      const getPriceDisplay = (plan: PlanDisplay) => {
        if (plan.name.toLowerCase() === "enterprise") return "Contact Sales";
        if (plan.name.toLowerCase() === "free") return "Free";
        if (plan.oneTimePrice !== undefined) return `$${plan.oneTimePrice.toFixed(0)} one-time`;

        if (billingCycle === "monthly") {
          return plan.monthlyPrice !== undefined ? `$${plan.monthlyPrice.toFixed(0)}/month` : "N/A";
        } else {
          const price = plan.annualPrice !== undefined && plan.annualPrice > 0 ? plan.annualPrice : (plan.monthlyPrice !== undefined ? plan.monthlyPrice * 12 * 0.83 : undefined);
          return price !== undefined ? `$${price.toFixed(0)}/year` : "N/A";
        }
      };

      const handleChoosePlan = async (plan: PlanDisplay) => {
        if (!profile?.organizationId || !profile?.id || !profile?.email || !profile?.fullName) {
          showError("User or organization data missing. Please log in again.");
          return;
        }

        if (plan.name.toLowerCase() === "enterprise") {
          showSuccess("Please contact sales for Enterprise plan details.");
          return;
        }

        if (plan.name.toLowerCase() === "free") {
          showSuccess("You are already on the Free plan.");
          return;
        }

        const lemonSqueezyProductId = plan.lemonSqueezyProductId; // RENAMED
        const lemonSqueezyVariantId = plan.lemonSqueezyVariantId; // RENAMED

        if (!lemonSqueezyProductId || !lemonSqueezyVariantId) {
          showError("Lemon Squeezy product information missing for this plan. Contact support.");
          return;
        }

        setIsProcessingSubscription(true);
        try {
          const lemonSqueezyStoreUrl = import.meta.env.VITE_LEMON_SQUEEZY_STORE_URL; // RENAMED
          if (!lemonSqueezyStoreUrl) {
            throw new Error("Lemon Squeezy Store URL is not configured. Please contact support.");
          }

          const redirectUrl = encodeURIComponent(`${window.location.origin}/billing?lemon_squeezy_checkout_status={checkout_status}&organization_id=${profile.organizationId}&user_id=${profile.id}`);
          const passthroughData = encodeURIComponent(JSON.stringify({
            organization_id: profile.organizationId,
            user_id: profile.id,
            plan_id: plan.id,
          }));

          const checkoutUrl = `https://${lemonSqueezyStoreUrl}/checkout/buy/${lemonSqueezyProductId}?variant=${lemonSqueezyVariantId}&passthrough=${passthroughData}&redirect_url=${redirectUrl}`;
          
          window.location.href = checkoutUrl; // Redirect to Lemon Squeezy checkout page

        } catch (error: any) {
          console.error("Error initiating Lemon Squeezy checkout:", error);
          showError(`Failed to initiate checkout: ${error.message}`);
        } finally {
          setIsProcessingSubscription(false);
        }
      };

      const handleManageSubscription = async () => {
        if (!profile?.organizationId || !profile?.lemonSqueezySubscriptionId) { // RENAMED
          showError("You don't have an active Lemon Squeezy subscription to manage.");
          return;
        }

        setIsManagingSubscription(true);
        try {
          // In a real Lemon Squeezy integration, you would call an API to generate a link to the customer portal
          // For now, we'll simulate this and show a message.
          showInfo("Redirecting to Lemon Squeezy subscription management portal (simulated)...");
          await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API call delay
          showSuccess("Redirected to simulated Lemon Squeezy subscription management.");
        } catch (error: any) {
          console.error("Error managing Lemon Squeezy subscription (simulated):", error);
          showError(`Failed to manage subscription: ${error.message}`);
        } finally {
          setIsManagingSubscription(false);
          await fetchProfile(); // Re-fetch profile to update plan status
        }
      };

      // Mock data for invoices and payment methods (cleared)
      const invoices: any[] = [];
      const paymentMethods: any[] = [];

      const handleUpdatePaymentMethod = () => {
        showError("Payment methods are managed directly in the subscription portal. Click 'Manage Subscription' to access it.");
      };

      const handleDownloadInvoice = (_invoiceId: string) => {
        showError("Invoice history is managed directly in the subscription portal. Click 'Manage Subscription' to access it.");
      };

      const recurringPlans = availablePlans.filter((plan: PlanDisplay) => plan.monthlyPrice !== undefined || plan.annualPrice !== undefined);
      const lifetimePlans = availablePlans.filter((plan: PlanDisplay) => plan.oneTimePrice !== undefined);

      if (isLoadingProfile || isLoadingPlans) {
        return (
          <div className="min-h-[60vh] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading billing information...</span>
          </div>
        );
      }

      return (
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">Billing & Subscriptions</h1>
          <p className="text-muted-foreground">Manage your subscription plan, view invoices, and update payment methods.</p>

          {/* Billing Cycle Toggle */}
          <div className="flex justify-center mb-8">
            <ToggleGroup
              type="single"
              value={billingCycle}
              onValueChange={(value: "monthly" | "annually") => value && setBillingCycle(value)}
              aria-label="Billing cycle toggle"
              className="bg-muted rounded-md p-1"
            >
              <ToggleGroupItem value="monthly" aria-label="Monthly billing" className="px-4 py-2 text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm">
                Monthly
              </ToggleGroupItem>
              <ToggleGroupItem value="annually" aria-label="Annual billing" className="px-4 py-2 text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm relative">
                Annually (Save 17%)
                <span className="absolute -top-2 -right-2 bg-green-500 text-white text-[0.6rem] px-1.5 py-0.5 rounded-full rotate-6">SAVE</span>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Recurring Plan Cards */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {recurringPlans.map((plan: PlanDisplay) => (
              <Card
                key={plan.id}
                className={cn(
                  "bg-card border-border rounded-lg shadow-sm flex flex-col",
                  plan.isPopular && "border-2 border-primary shadow-lg"
                )}
              >
                <CardHeader className="pb-4 text-center">
                  {plan.isPopular && (
                    <div className="flex justify-center mb-2">
                      <Badge variant="secondary" className="bg-primary/20 text-primary text-xs px-3 py-1 rounded-full flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> Most Popular
                      </Badge>
                    </div>
                  )}
                  <CardTitle className="text-2xl font-bold text-foreground">{plan.name}</CardTitle>
                  <p className="text-muted-foreground text-sm">{plan.description}</p>
                  <div className="mt-4 text-4xl font-extrabold text-foreground">
                    {getPriceDisplay(plan).split('/')[0]}
                    <span className="text-lg font-medium text-muted-foreground">/{getPriceDisplay(plan).split('/')[1]}</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col justify-between p-6 pt-0">
                  <ul className="space-y-2 text-sm text-muted-foreground mb-6">
                    {plan.features.map((feature: PlanFeature, index: number) => (
                      <li key={index} className="flex items-center gap-2">
                        {feature.included ? (
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                        {feature.text}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full mt-auto"
                    onClick={() => handleChoosePlan(plan)}
                    disabled={currentPlanId === plan.name.toLowerCase() || isProcessingSubscription}
                  >
                    {isProcessingSubscription ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
                      </>
                    ) : currentPlanId === plan.name.toLowerCase() ? (
                      "Current Plan"
                    ) : (
                      "Choose Plan"
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* NEW: Perpetual License Card */}
          {lifetimePlans.length > 0 && (
            <div className="mt-10 space-y-6">
              <h2 className="text-2xl font-bold text-foreground text-center">One-Time Licenses</h2>
              <p className="text-muted-foreground text-center">Get access to a specific feature set with a single payment!</p>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {lifetimePlans.map((plan: PlanDisplay) => (
                  <Card
                    key={plan.id}
                    className={cn(
                      "bg-card border-border rounded-lg shadow-sm flex flex-col",
                      plan.isPopular && "border-2 border-primary shadow-lg"
                    )}
                  >
                    <CardHeader className="pb-4 text-center">
                      {plan.isPopular && (
                        <div className="flex justify-center mb-2">
                          <Badge variant="secondary" className="bg-primary/20 text-primary text-xs px-3 py-1 rounded-full flex items-center gap-1">
                            <Sparkles className="h-3 w-3" /> Most Popular
                          </Badge>
                        </div>
                      )}
                      <CardTitle className="text-2xl font-bold text-foreground">{plan.name.includes('Perpetual License') ? 'Perpetual License' : plan.name}</CardTitle>
                      <p className="text-muted-foreground text-sm">{plan.description}</p>
                      <div className="mt-4 text-4xl font-extrabold text-foreground">
                        {getPriceDisplay(plan)}
                      </div>
                    </CardHeader>
                    <CardContent className="flex-grow flex flex-col justify-between p-6 pt-0">
                      <ul className="space-y-2 text-sm text-muted-foreground mb-6">
                        {plan.features.map((feature: PlanFeature, index: number) => (
                          <li key={index} className="flex items-center gap-2">
                            {feature.included ? (
                              <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                            ) : (
                              <XCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            )}
                            {feature.text}
                          </li>
                        ))}
                      </ul>
                      <Button
                        className="w-full mt-auto"
                        onClick={() => handleChoosePlan(plan)}
                        disabled={currentPlanId === plan.name.toLowerCase() || isProcessingSubscription}
                      >
                        {isProcessingSubscription ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
                          </>
                        ) : currentPlanId === plan.name.toLowerCase() ? (
                          "Current License"
                        ) : (
                          "Get Perpetual License"
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <p className="text-xs text-muted-foreground text-center mt-4">
                Perpetual Licenses grant access to the features available at the time of purchase, plus ongoing bug fixes and security updates. New features are not included.
              </p>
            </div>
          )}

          {/* Current Plan Details */}
          <Card className="bg-card border-border rounded-lg shadow-sm p-6">
            <CardHeader className="pb-4 flex flex-row items-center gap-4">
              <DollarSign className="h-6 w-6 text-primary" />
              <CardTitle className="text-xl font-semibold">Your Current Plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <p className="text-lg font-semibold text-foreground">
                  {profile?.companyProfile?.plan ? profile.companyProfile.plan.charAt(0).toUpperCase() + profile.companyProfile.plan.slice(1) : "Free"}
                  {profile?.companyProfile?.perpetualLicenseVersion && (
                    <span className="ml-2 text-sm text-muted-foreground">(Licensed Version: {profile.companyProfile.perpetualLicenseVersion})</span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">Status: <span className="font-medium text-green-500">Active</span></p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">Features:</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {availablePlans.find((p: PlanDisplay) => p.name.toLowerCase() === currentPlanId)?.features.filter((f: PlanFeature) => f.included).map((feature: PlanFeature, index: number) => (
                    <li key={index} className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" /> {feature.text}
                    </li>
                  ))}
                </ul>
              </div>
              {currentPlanId !== "free" && !currentPlanId.includes('perpetual') && (
                <Button onClick={handleManageSubscription} disabled={isManagingSubscription}>
                  {isManagingSubscription ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Redirecting...
                    </>
                  ) : (
                    "Manage Subscription"
                  )}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Payment Methods */}
          <Card className="bg-card border-border rounded-lg shadow-sm p-6">
            <CardHeader className="pb-4 flex flex-row items-center gap-4">
              <CreditCard className="h-6 w-6 text-primary" />
              <CardTitle className="text-xl font-semibold">Payment Methods</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {paymentMethods.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Last 4 Digits</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentMethods.map((method: any) => (
                      <TableRow key={method.id}>
                        <TableCell className="font-medium">{method.type}</TableCell>
                        <TableCell>•••• {method.last4}</TableCell>
                        <TableCell>{method.expiry}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => showSuccess(`Removing ${method.type} ending in ${method.last4}.`)}>Remove</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-4">No payment methods added yet.</p>
              )}
              <Button onClick={handleUpdatePaymentMethod}>Add/Update Payment Method</Button>
            </CardContent>
          </Card>

          {/* Invoice History */}
          <Card className="bg-card border-border rounded-lg shadow-sm p-6">
            <CardHeader className="pb-4 flex flex-row items-center gap-4">
              <FileText className="h-6 w-6 text-primary" />
              <CardTitle className="text-xl font-semibold">Invoice History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {invoices.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice ID</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice: any) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">{invoice.type}</TableCell>
                        <TableCell>{invoice.date}</TableCell>
                        <TableCell>${invoice.amount.toFixed(2)}</TableCell>
                        <TableCell>{invoice.status}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => handleDownloadInvoice(invoice.id)}>Download</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-4">No invoices available.</p>
              )}
              <Button onClick={() => showError("Invoice history is managed directly in the subscription portal. Click 'Manage Subscription' to access it.")}>View All Invoices</Button>
            </CardContent>
          </Card>
        </div>
      );
    };

    export default BillingSubscriptions;