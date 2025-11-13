import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard, DollarSign, FileText, CheckCircle, XCircle, Sparkles, Loader2 } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useProfile } from "@/context/ProfileContext"; // Corrected import
import { supabase } from "@/lib/supabaseClient";
import { format } from "date-fns";
import { ALL_APP_FEATURES, getAllFeatureIds } from "@/lib/features"; // NEW: Import ALL_APP_FEATURES and getAllFeatureIds

interface PlanFeature {
  text: string;
  included: boolean;
}

interface StripeProduct {
  id: string;
  active: boolean;
  name: string;
  description: string;
  image: string | null;
  metadata: any;
}

interface StripePrice {
  id: string;
  product_id: string;
  active: boolean;
  unit_amount: number; // In cents
  currency: string;
  type: 'one_time' | 'recurring';
  interval: 'day' | 'week' | 'month' | 'year' | null;
  interval_count: number | null;
  trial_period_days: number | null;
  metadata: any;
}

interface SubscriptionPlanDisplay extends StripeProduct {
  prices: StripePrice[];
  monthlyPrice?: number; // Calculated monthly price for display
  annualPrice?: number; // Calculated annual price for display
  oneTimePrice?: number; // NEW: Calculated one-time price for display
  isPopular?: boolean;
  features: PlanFeature[]; // Added features array
}

// Define the current application version
const CURRENT_APP_VERSION = "1.3.0"; // IMPORTANT: Update this with each major release

const BillingSubscriptions: React.FC = () => {
  const { profile, isLoadingProfile, fetchProfile } = useProfile();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annually">("monthly");
  const [availablePlans, setAvailablePlans] = useState<SubscriptionPlanDisplay[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [isProcessingSubscription, setIsProcessingSubscription] = useState(false);
  const [isManagingSubscription, setIsManagingSubscription] = useState(false);

  const currentPlanId = profile?.companyProfile?.plan || "free";
  const currentStripeCustomerId = profile?.stripeCustomerId;

  useEffect(() => {
    const fetchStripeProductsAndPrices = async () => {
      setIsLoadingPlans(true);
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('active', true);

      if (productsError) {
        console.error('Error fetching Stripe products:', productsError);
        showError('Failed to load subscription plans.');
        setIsLoadingPlans(false);
        return;
      }

      const { data: prices, error: pricesError } = await supabase
        .from('prices')
        .select('*')
        .eq('active', true);

      if (pricesError) {
        console.error('Error fetching Stripe prices:', pricesError);
        showError('Failed to load subscription prices.');
        setIsLoadingPlans(false);
        return;
      }

      const plansWithPrices: SubscriptionPlanDisplay[] = products.map(product => {
        const productPrices = prices.filter(price => price.product_id === product.id);
        
        // Find the monthly recurring price for display
        const monthlyPrice = productPrices.find(p => p.type === 'recurring' && p.interval === 'month')?.unit_amount || undefined;
        const annualPrice = productPrices.find(p => p.type === 'recurring' && p.interval === 'year')?.unit_amount || undefined;
        const oneTimePrice = productPrices.find(p => p.type === 'one_time')?.unit_amount || undefined; // NEW: Find one-time price

        // Mock features for display, as they are not coming from Stripe directly in this setup
        // This needs to align with ALL_APP_FEATURES and the useFeature hook logic
        const features: PlanFeature[] = ALL_APP_FEATURES.map(appFeature => {
          let included = false;
          const planNameLower = product.name.toLowerCase();

          // Logic to determine if a feature is included in this plan for display purposes
          if (planNameLower === 'free') {
            included = ['core_inventory_management', 'dashboard_overview', 'basic_order_management', 'user_profile_management', 'basic_reports', 'mobile_responsive_ui', 'in_app_notifications', 'email_notifications', 'terms_of_service', 'privacy_policy', 'refund_policy'].includes(appFeature.id);
            if (appFeature.id === 'core_inventory_management') included = true; // Example: Basic IM is always free
          } else if (planNameLower === 'standard') {
            included = ['core_inventory_management', 'dashboard_overview', 'basic_order_management', 'user_profile_management', 'basic_reports', 'mobile_responsive_ui', 'in_app_notifications', 'email_notifications', 'customer_management', 'vendor_management', 'folder_management', 'qr_code_generation', 'csv_import_export', 'order_kanban_board', 'pdf_export_orders', 'warehouse_operations_dashboard', 'warehouse_tool_item_lookup', 'warehouse_tool_receive_inventory', 'warehouse_tool_putaway', 'warehouse_tool_fulfill_order', 'warehouse_tool_ship_order', 'warehouse_tool_stock_transfer', 'warehouse_tool_cycle_count', 'warehouse_tool_issue_report', 'terms_of_service', 'privacy_policy', 'refund_policy'].includes(appFeature.id);
          } else if (planNameLower === 'premium' || planNameLower.includes('perpetual license')) { // NEW: Perpetual License includes all current features
            included = getAllFeatureIds().includes(appFeature.id); // All features up to CURRENT_APP_VERSION
          } else if (planNameLower === 'enterprise') {
            included = true; // Enterprise includes everything
          }

          return { text: appFeature.name, included };
        });


        return {
          ...product,
          prices: productPrices,
          monthlyPrice: monthlyPrice ? monthlyPrice / 100 : undefined, // Convert cents to dollars
          annualPrice: annualPrice ? annualPrice / 100 : undefined, // Convert cents to dollars
          oneTimePrice: oneTimePrice ? oneTimePrice / 100 : undefined, // NEW: Convert cents to dollars
          isPopular: product.metadata?.is_popular === 'true',
          features: features, // Assign mock features
        };
      }).sort((a, b) => {
        // Sort: Free first, then Perpetual, then by monthly price
        if (a.name.toLowerCase() === 'free') return -1;
        if (b.name.toLowerCase() === 'free') return 1;
        if (a.name.toLowerCase().includes('perpetual license')) return -1;
        if (b.name.toLowerCase().includes('perpetual license')) return 1;
        return (a.monthlyPrice || Infinity) - (b.monthlyPrice || Infinity);
      });

      // TEMPORARY CLIENT-SIDE OVERRIDE: Update lifetime deal prices as requested.
      // In a real application, these prices should be updated directly in Stripe and Supabase.
      const updatedPlans = plansWithPrices.map(plan => {
        if (plan.name.toLowerCase().includes('perpetual license')) { // Changed from 'lifetime premium'
          return { ...plan, oneTimePrice: 999 }; // Set the one-time price for Perpetual License
        }
        // Corrected: Target 'lifetime lite' and rename it to 'Lifetime Standard' with price $499
        if (plan.name.toLowerCase().includes('lifetime lite')) {
          return { ...plan, name: 'Lifetime Standard', oneTimePrice: 499 };
        }
        return plan;
      });

      setAvailablePlans(updatedPlans);
      setIsLoadingPlans(false);
    };

    fetchStripeProductsAndPrices();
  }, []);

  const getPriceDisplay = (plan: SubscriptionPlanDisplay) => {
    if (plan.name.toLowerCase() === "enterprise") return "Contact Sales";
    if (plan.name.toLowerCase() === "free") return "Free";
    if (plan.oneTimePrice !== undefined) return `$${plan.oneTimePrice.toFixed(0)} one-time`; // NEW: Display one-time price

    if (billingCycle === "monthly") {
      return plan.monthlyPrice !== undefined ? `$${plan.monthlyPrice.toFixed(0)}/month` : "N/A";
    } else {
      const price = plan.annualPrice !== undefined && plan.annualPrice > 0 ? plan.annualPrice : (plan.monthlyPrice !== undefined ? plan.monthlyPrice * 12 * 0.83 : undefined); // Approx 17% discount
      return price !== undefined ? `$${price.toFixed(0)}/year` : "N/A";
    }
  };

  const handleChoosePlan = async (plan: SubscriptionPlanDisplay) => {
    if (!profile?.organizationId) {
      showError("Organization not found. Please ensure your company profile is set up.");
      return;
    }

    if (plan.name.toLowerCase() === "enterprise") {
      showSuccess("Please contact sales for Enterprise plan details.");
      return;
    }

    setIsProcessingSubscription(true);
    try {
      let selectedPrice: StripePrice | undefined;
      let mode: 'subscription' | 'payment';
      let perpetualFeatures: string[] | undefined;
      let perpetualLicenseVersion: string | undefined;

      if (plan.oneTimePrice !== undefined) { // Handle one-time payment (including Perpetual License)
        selectedPrice = plan.prices.find(p => p.type === 'one_time');
        mode = 'payment';
        if (plan.name.toLowerCase().includes('perpetual license')) {
          perpetualFeatures = getAllFeatureIds(); // Capture all current features
          perpetualLicenseVersion = CURRENT_APP_VERSION;
        }
      } else { // Handle recurring subscription
        selectedPrice = plan.prices.find(p => 
          p.type === 'recurring' && 
          (billingCycle === 'monthly' ? p.interval === 'month' : p.interval === 'year')
        );
        mode = 'subscription';
      }

      if (!selectedPrice) {
        throw new Error(`No suitable price found for ${plan.name} with selected billing cycle.`);
      }

      const { data: sessionData, error: _sessionError } = await supabase.auth.getSession();
      if (_sessionError || !sessionData.session) {
        throw new Error("User session not found. Please log in again.");
      }

      const payload = {
        priceId: selectedPrice.id,
        organizationId: profile.organizationId,
        mode: mode, // Pass the mode to the Edge Function
        trial_period_days: selectedPrice.trial_period_days || undefined,
        perpetualFeatures: perpetualFeatures, // NEW: Pass perpetual features
        perpetualLicenseVersion: perpetualLicenseVersion, // NEW: Pass perpetual license version
      };

      console.log("[BillingSubscriptions] Sending payload to create-checkout-session:", JSON.stringify(payload, null, 2));

      const edgeFunctionUrl = `https://nojumocxivfjsbqnnkqe.supabase.co/functions/v1/create-checkout-session`;
      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorDetail = `Edge Function failed with status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorDetail = errorData.error || JSON.stringify(errorData);
        } catch (jsonError) {
          console.error("Failed to parse error response JSON from Edge Function:", jsonError);
          errorDetail = `Edge Function failed with status: ${response.status}. Response was not valid JSON. Raw response: ${await response.text()}`;
        }
        throw new Error(errorDetail);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("Stripe Checkout URL not returned.");
      }
    } catch (error: any) {
      console.error("Error initiating Stripe Checkout:", error);
      showError(`Failed to subscribe: ${error.message}`);
    } finally {
      setIsProcessingSubscription(false);
      await fetchProfile(); // Refresh profile after potential subscription change
    }
  };

  const handleManageSubscription = async () => {
    if (!profile?.organizationId || !currentStripeCustomerId) {
      showError("You don't have an active Stripe subscription to manage.");
      return;
    }

    setIsManagingSubscription(true);
    try {
      const { data: sessionData, error: _sessionError } = await supabase.auth.getSession();
      if (_sessionError || !sessionData.session) {
        throw new Error("User session not found. Please log in again.");
      }

      const { data, error } = await supabase.functions.invoke('create-portal-session', {
        body: JSON.stringify({
          organizationId: profile.organizationId,
        }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("Stripe Customer Portal URL not returned.");
      }
    } catch (error: any) {
      console.error("Error creating customer portal session:", error);
      showError(`Failed to manage subscription: ${error.message}`);
    } finally {
      setIsManagingSubscription(false);
      await fetchProfile(); // Refresh profile after potential subscription change
    }
  };

  // Mock data for invoices and payment methods (cleared)
  const invoices: any[] = [];
  const paymentMethods: any[] = [];

  const handleUpdatePaymentMethod = () => {
    showError("Payment methods are managed directly in the Stripe Customer Portal. Click 'Manage Subscription' to access it."); // NEW: Updated toast
  };

  const handleDownloadInvoice = (_invoiceId: string) => { // Marked as unused
    showError("Invoice history is managed directly in the Stripe Customer Portal. Click 'Manage Subscription' to access it."); // NEW: Updated toast
  };

  // Filter out the regular 'Standard' plan if 'Lifetime Standard' exists
  const hasLifetimeStandard = availablePlans.some(plan => plan.name.toLowerCase() === 'lifetime standard' && plan.oneTimePrice !== undefined);

  const recurringPlans = availablePlans.filter(plan => {
    const isRecurring = plan.monthlyPrice !== undefined || plan.annualPrice !== undefined;
    if (!isRecurring) return false;

    // If a lifetime standard exists, exclude the regular 'Standard' recurring plan
    if (hasLifetimeStandard && plan.name.toLowerCase() === 'standard') {
      return false;
    }
    return true;
  });

  const lifetimePlans = availablePlans.filter(plan => plan.oneTimePrice !== undefined);

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
        {recurringPlans.map((plan: SubscriptionPlanDisplay) => (
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
            {lifetimePlans.map((plan: SubscriptionPlanDisplay) => (
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
              {profile?.companyProfile?.trialEndsAt && (
                <span className="ml-2 text-sm text-yellow-500">(Trial ends: {format(new Date(profile.companyProfile.trialEndsAt), "MMM dd, yyyy")})</span>
              )}
              {profile?.companyProfile?.perpetualLicenseVersion && ( // NEW: Display perpetual license version
                <span className="ml-2 text-sm text-muted-foreground">(Licensed Version: {profile.companyProfile.perpetualLicenseVersion})</span>
              )}
            </p>
            <p className="text-sm text-muted-foreground">Status: <span className="font-medium text-green-500">Active</span></p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">Features:</h3>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              {availablePlans.find(p => p.name.toLowerCase() === currentPlanId)?.features.filter((f: PlanFeature) => f.included).map((feature: PlanFeature, index: number) => (
                <li key={index} className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" /> {feature.text}
                </li>
              ))}
            </ul>
          </div>
          {currentPlanId !== "free" && !currentPlanId.includes('perpetual') && ( // Only show manage subscription for recurring plans
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
          <Button onClick={() => showError("Invoice history is managed directly in the Stripe Customer Portal. Click 'Manage Subscription' to access it.")}>View All Invoices</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default BillingSubscriptions;