import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard, DollarSign, FileText, CheckCircle, XCircle, Sparkles } from "lucide-react";
import { showSuccess } from "@/utils/toast";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { planOrder } from "@/utils/planUtils"; // Import planOrder for consistency

interface PlanFeature {
  text: string;
  included: boolean;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  features: PlanFeature[];
  isPopular?: boolean;
}

const plans: SubscriptionPlan[] = [
  {
    id: "free",
    name: "Free",
    description: "Get started with essential inventory tracking for small personal projects or very basic needs.",
    monthlyPrice: 0,
    features: [
      { text: "1 User, 25 Items, 1 Folder", included: true },
      { text: "Basic Inventory & Order Tracking", included: true },
      { text: "QR Code Generation, Basic Reports", included: true },
      { text: "Mobile-Optimized Interface", included: true },
      { text: "Advanced Inventory Features", included: false },
      { text: "CSV Import/Export", included: false },
      { text: "QuickBooks Integration", included: false },
      { text: "AI-Powered Report Summaries", included: false },
    ],
  },
  {
    id: "standard",
    name: "Standard",
    description: "Ideal for small businesses needing more robust inventory control and basic operations.",
    monthlyPrice: 59,
    features: [
      { text: "5 Users, 500 Items, 5 Folders", included: true },
      { text: "All Free features", included: true },
      { text: "Advanced Inventory (Picking/Overstock, Tags, Images)", included: true },
      { text: "Full Order Management, CSV Import/Export", included: true },
      { text: "Basic Warehouse Operations (Lookup, Receive, Ship, Transfer)", included: true },
      { text: "All Inventory, Sales & Purchase Reports", included: true },
      { text: "User Role Management (Viewer, Inventory Manager)", included: true },
      { text: "Bulk Update", included: false },
      { text: "Auto-Reorder & Automation", included: false },
      { text: "QuickBooks Integration", included: false },
      { text: "AI-Powered Report Summaries", included: false },
    ],
  },
  {
    id: "premium",
    name: "Premium",
    description: "Unlock comprehensive inventory, order, and warehouse management with powerful integrations.",
    monthlyPrice: 169,
    features: [
      { text: "Unlimited Users, 5K Items, Unlimited Folders", included: true },
      { text: "All Standard features", included: true },
      { text: "Bulk Update, Auto-Reorder & Automation", included: true },
      { text: "Global Search, Full Warehouse Operations", included: true },
      { text: "QuickBooks & Shopify Integration", included: true },
      { text: "AI-Powered Report Summaries, Profitability Reports", included: true },
      { text: "Customizable User Roles, Priority Support", included: true },
      { text: "Dedicated CSM", included: false },
      { text: "API Access & Webhooks", included: false },
    ],
    isPopular: true,
  },
  {
    id: "ultimate",
    name: "Ultimate",
    description: "Designed for growing businesses needing higher limits and advanced support.",
    monthlyPrice: 350,
    features: [
      { text: "Unlimited Users, Unlimited Items, Unlimited Folders", included: true },
      { text: "All Premium features", included: true },
      { text: "Dedicated Account Manager", included: true },
      { text: "Enhanced Security Features", included: true },
      { text: "Dedicated CSM", included: false },
      { text: "Custom Integrations", included: false },
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "Tailored solutions for large-scale operations with custom needs and dedicated support.",
    monthlyPrice: 0, // Custom pricing, "Contact Sales"
    features: [
      { text: "All Ultimate features", included: true },
      { text: "Dedicated Customer Success Manager (CSM)", included: true },
      { text: "API Access & Webhooks", included: true },
      { text: "Single Sign-On (SSO)", included: true },
      { text: "Advanced Automation & Custom Rules", included: true },
      { text: "On-site Training & Guided Setup", included: true },
      { text: "Custom Integrations", included: true },
      { text: "24/7 Premium Support", included: true },
    ],
  },
];

const BillingSubscriptions: React.FC = () => {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annually">("monthly");
  const [currentPlanId, setCurrentPlanId] = useState<string>("premium"); // Default to 'premium'

  const currentPlan = plans.find(p => p.id === currentPlanId) || plans[0];

  const getPriceDisplay = (monthlyPrice: number, planId: string) => {
    if (planId === "enterprise") return "Contact Sales";
    if (monthlyPrice === 0) return "Free";
    if (billingCycle === "monthly") return `$${monthlyPrice}/month`;
    const annualPrice = monthlyPrice * 12 * 0.83; // Approximately 17% discount for annual
    return `$${annualPrice.toFixed(0)}/year`;
  };

  const handleChoosePlan = (planId: string) => {
    setCurrentPlanId(planId);
    showSuccess(`You have selected the ${plans.find(p => p.id === planId)?.name} plan! (This is a demo selection)`);
  };

  // Mock data for invoices and payment methods (cleared)
  const invoices: any[] = [];
  const paymentMethods: any[] = [];

  const handleManageSubscription = () => {
    showSuccess("Redirecting to subscription management portal (demo action).");
  };

  const handleUpdatePaymentMethod = () => {
    showSuccess("Opening payment method update form (demo action).");
  };

  const handleDownloadInvoice = (invoiceId: string) => {
    showSuccess(`Downloading invoice ${invoiceId} (demo action).`);
  };

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

      {/* Plan Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Free, Standard, Premium cards */}
        {plans.slice(0, 3).map((plan) => (
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
                {getPriceDisplay(plan.monthlyPrice, plan.id).split('/')[0]}
                <span className="text-lg font-medium text-muted-foreground">/{getPriceDisplay(plan.monthlyPrice, plan.id).split('/')[1]}</span>
              </div>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col justify-between p-6 pt-0">
              <ul className="space-y-2 text-sm text-muted-foreground mb-6">
                {plan.features.map((feature, index) => (
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
                onClick={() => handleChoosePlan(plan.id)}
                disabled={currentPlanId === plan.id}
              >
                {currentPlanId === plan.id ? "Current Plan" : "Choose Plan"}
              </Button>
            </CardContent>
          </Card>
        ))}

        {/* New column for Ultimate and Enterprise */}
        <div className="flex flex-col gap-6">
          {/* Ultimate Card */}
          {plans.slice(3, 4).map((plan) => (
            <Card
              key={plan.id}
              className={cn(
                "bg-card border-border rounded-lg shadow-sm flex flex-col flex-1", // flex-1 to share space
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
                  {getPriceDisplay(plan.monthlyPrice, plan.id).split('/')[0]}
                  <span className="text-lg font-medium text-muted-foreground">/{getPriceDisplay(plan.monthlyPrice, plan.id).split('/')[1]}</span>
                </div>
              </CardHeader>
              <CardContent className="flex-grow flex flex-col justify-between p-6 pt-0">
                <ul className="space-y-2 text-sm text-muted-foreground mb-6">
                  {plan.features.map((feature, index) => (
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
                  onClick={() => handleChoosePlan(plan.id)}
                  disabled={currentPlanId === plan.id}
                >
                  {currentPlanId === plan.id ? "Current Plan" : "Choose Plan"}
                </Button>
              </CardContent>
            </Card>
          ))}

          {/* Enterprise Card */}
          {plans.slice(4, 5).map((plan) => (
            <Card
              key={plan.id}
              className={cn(
                "bg-card border-border rounded-lg shadow-sm flex flex-col flex-1", // flex-1 to share space
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
                  {getPriceDisplay(plan.monthlyPrice, plan.id)}
                </div>
              </CardHeader>
              <CardContent className="flex-grow flex flex-col justify-between p-6 pt-0">
                <ul className="space-y-2 text-sm text-muted-foreground mb-6">
                  {plan.features.map((feature, index) => (
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
                  onClick={() => handleChoosePlan(plan.id)}
                  disabled={currentPlanId === plan.id || plan.id === "enterprise"}
                >
                  {currentPlanId === plan.id ? "Current Plan" : (plan.id === "enterprise" ? "Contact Sales" : "Choose Plan")}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Current Plan Details */}
      <Card className="bg-card border-border rounded-lg shadow-sm p-6">
        <CardHeader className="pb-4 flex flex-row items-center gap-4">
          <DollarSign className="h-6 w-6 text-primary" />
          <CardTitle className="text-xl font-semibold">Your Current Plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <p className="text-lg font-semibold text-foreground">
              {currentPlan.name} -{" "}
              {currentPlan.id === "enterprise" ? "Custom Pricing" : getPriceDisplay(currentPlan.monthlyPrice, currentPlan.id)}
            </p>
            <p className="text-sm text-muted-foreground">Status: <span className="font-medium text-green-500">Active (Demo)</span></p>
            {currentPlan.id !== "free" && currentPlan.id !== "enterprise" && (
              <p className="text-sm text-muted-foreground">Next Billing Date: 2024-10-01 (Demo)</p>
            )}
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">Features:</h3>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              {currentPlan.features.filter(f => f.included).map((feature, index) => (
                <li key={index} className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" /> {feature.text}
                </li>
              ))}
            </ul>
          </div>
          {currentPlan.id !== "enterprise" && (
            <Button onClick={handleManageSubscription}>Manage Subscription</Button>
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
                {paymentMethods.map((method) => (
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
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.id}</TableCell>
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
        </CardContent>
      </Card>
    </div>
  );
};

export default BillingSubscriptions;