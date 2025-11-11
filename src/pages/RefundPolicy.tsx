import React from "react";
import { Card, CardContent } from "@/components/ui/card";

const RefundPolicy: React.FC = () => {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Refund Policy</h1>
      <p className="text-muted-foreground">Effective Date: November 11, 2025 | Last Updated: November 11, 2025</p>

      <Card className="bg-card border-border rounded-lg shadow-sm">
        <CardContent className="p-6 prose dark:prose-invert max-w-none">
          <p>At Fortress Inventory, we strive to provide a high-quality service that meets your inventory management needs. All payments for our Service are processed by our Merchant of Record, Paddle.com Market Limited ("Paddle"). Paddle handles all billing, refunds, and chargebacks. Please read our refund policy carefully.</p>

          <h2>1. Subscription Fees</h2>
          <p>For recurring subscriptions (e.g., monthly or annual plans), we offer a **30-day money-back guarantee** from the date of your initial purchase. If you are not satisfied with the Service within the first 30 days, you may request a full refund. After this 30-day period, subscription fees are **non-refundable**.</p>
          <p>This means:</p>
          <ul>
            <li>Refunds for the initial 30-day period will be processed by Paddle upon request.</li>
            <li>No refunds or credits will be provided for partial months or years of service after the initial 30-day guarantee period.</li>
            <li>If you cancel your subscription, it will remain active until the end of your current billing period, and you will not be charged for subsequent billing periods.</li>
          </ul>

          <h2>2. One-Time Purchases</h2>
          <p>For any one-time purchases (e.g., lifetime deals, add-ons, or specific features purchased outside of a recurring subscription), these fees are generally **non-refundable** once the service or access has been provided.</p>
          <p>However, in exceptional circumstances, such as a proven technical fault preventing access to the purchased feature, a refund may be considered at the sole discretion of Fortress Inventory. All such requests must be made within 14 days of purchase.</p>

          <h2>3. Free Trials</h2>
          <p>If you register for a free trial, you can use the Service free of charge for the specified trial period. You will not be charged during the trial period. To avoid charges, you must cancel your trial or not convert to a paid subscription before the trial period ends.</p>

          <h2>4. How to Request a Refund</h2>
          <p>To request a refund within the eligible period, please contact our support team at support@fortressinventory.com. All refunds will be processed by Paddle, our Merchant of Record, and will be issued to the original payment method used for the purchase.</p>

          <h2>5. Contact Us</h2>
          <p>If you have any questions about our Refund Policy, please contact us:</p>
          <p>Fortress Inventory<br />Email: support@fortressinventory.com<br />Address: 333 W 39th St STE 303, New York, NY 10018</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default RefundPolicy;