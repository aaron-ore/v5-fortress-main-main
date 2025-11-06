import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

const RefundPolicy: React.FC = () => {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Refund Policy</h1>
      <p className="text-muted-foreground">Effective Date: October 1, 2025 | Last Updated: October 1, 2025</p>

      <Card className="bg-card border-border rounded-lg shadow-sm">
        <CardContent className="p-6 prose dark:prose-invert max-w-none">
          <p>At Fortress Inventory, we strive to provide a high-quality service that meets your inventory management needs. Please read our refund policy carefully.</p>

          <h2>1. Subscription Fees</h2>
          <p>As stated in our Terms of Service, all fees for our subscription-based Service are **NON-REFUNDABLE AND NON-CANCELLABLE**.</p>
          <p>This means:</p>
          <ul>
            <li>No refunds or credits will be provided for partial months of service.</li>
            <li>No refunds or credits will be provided for downgrades of your subscription plan.</li>
            <li>No refunds or credits will be provided for unused periods of service if you cancel your subscription before the end of your billing cycle.</li>
          </ul>
          <p>Your subscription will remain active until the end of your current billing period, even if you cancel. You will not be charged for subsequent billing periods.</p>

          <h2>2. One-Time Purchases</h2>
          <p>For any one-time purchases (e.g., lifetime deals, add-ons, or specific features purchased outside of a recurring subscription), these fees are also **NON-REFUNDABLE** once the service or access has been provided.</p>

          <h2>3. Free Trials</h2>
          <p>If you register for a free trial, you can use the Service free of charge for the specified trial period. You will not be charged during the trial period. To avoid charges, you must cancel your trial or not convert to a paid subscription before the trial period ends.</p>

          <h2>4. Exceptional Circumstances</h2>
          <p>In rare cases of billing errors or unauthorized charges, please contact our support team immediately. Any refunds for such exceptional circumstances will be issued solely at the discretion of Fortress Inventory.</p>

          <h2>5. Contact Us</h2>
          <p>If you have any questions about our Refund Policy, please contact us:</p>
          <p>Fortress Inventory<br />Email: support@fortressinventory.com<br />Address: 333 W 39th St STE 303, New York, NY 10018</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default RefundPolicy;