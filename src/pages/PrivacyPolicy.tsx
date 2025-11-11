import React from "react";
import { Card, CardContent } from "@/components/ui/card";

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="text-muted-foreground">Effective Date: November 11, 2025 | Last Updated: November 11, 2025</p>

      <Card className="bg-card border-border rounded-lg shadow-sm">
        <CardContent className="p-6 prose dark:prose-invert max-w-none">
          <p>This Privacy Policy describes how Fortress Inventory ("Company," "we," "us," or "our") collects, uses, and discloses your information when you use our Service.</p>

          <h2>1. Information We Collect</h2>
          <h3>1.1 Personal Information You Provide:</h3>
          <ul>
            <li><strong>Account Data:</strong> When you register for an account, we collect your name, email address, password, and company information.</li>
            <li><strong>Profile Data:</strong> You may provide additional information for your user profile, such as phone number, address, and avatar URL.</li>
            <li><strong>Payment Information:</strong> If you subscribe to a paid plan, our Merchant of Record, Paddle.com Market Limited ("Paddle"), collects your payment details. We do not directly store your credit card information.</li>
            <li><strong>Customer Data:</strong> Any inventory records, product details, stock levels, transaction history, customer lists, and pricing information you upload or create within the Service.</li>
            <li><strong>Communications:</strong> Records of your communications with us, including support requests and feedback.</li>
          </ul>

          <h3>1.2 Information Collected Automatically:</h3>
          <ul>
            <li><strong>Usage Data:</strong> Information about how you access and use the Service, such as features used, time spent, and pages visited.</li>
            <li><strong>Device Information:</strong> Information about the device you use to access the Service, including IP address, browser type, operating system, and unique device identifiers.</li>
            <li><strong>Cookies and Tracking Technologies:</strong> We use cookies and similar technologies to track activity on our Service and hold certain information.</li>
          </ul>

          <h2>2. How We Use Your Information</h2>
          <p>We use the information we collect for various purposes, including:</p>
          <ul>
            <li>To provide, operate, and maintain our Service.</li>
            <li>To process your transactions and manage your subscriptions.</li>
            <li>To send you technical notices, updates, security alerts, and support messages.</li>
            <li>To respond to your comments, questions, and customer service requests.</li>
            <li>To monitor and analyze trends, usage, and activities in connection with our Service.</li>
            <li>To improve our Service, products, and user experience.</li>
            <li>To detect, investigate, and prevent fraudulent transactions and other illegal activities.</li>
            <li>To comply with our legal obligations.</li>
          </ul>

          <h2>3. How We Share Your Information</h2>
          <p>We may share your information with third parties in the following circumstances:</p>
          <ul>
            <li><strong>Service Providers:</strong> With third-party vendors, consultants, and other service providers who perform services on our behalf (e.g., hosting, payment processing by Paddle, analytics, email delivery).</li>
            <li><strong>Business Transfers:</strong> In connection with any merger, sale of company assets, financing, or acquisition of all or a portion of our business by another company.</li>
            <li><strong>Legal Compliance:</strong> To comply with legal obligations, respond to lawful requests from public authorities, or protect our rights, privacy, safety, or property.</li>
            <li><strong>With Your Consent:</strong> We may share your information with your consent or at your direction.</li>
          </ul>
          <p>We do not sell your personal information to third parties.</p>

          <h2>4. Data Security</h2>
          <p>We implement reasonable administrative, physical, and technical safeguards designed to protect the security, confidentiality, and integrity of your data. However, no security system is impenetrable, and we cannot guarantee the absolute security of your information.</p>

          <h2>5. Your Data Rights</h2>
          <p>Depending on your location and applicable laws, you may have the following rights regarding your personal data:</p>
          <ul>
            <li><strong>Access:</strong> Request access to your personal data.</li>
            <li><strong>Correction:</strong> Request correction of inaccurate or incomplete data.</li>
            <li><strong>Deletion:</strong> Request deletion of your personal data.</li>
            <li><strong>Objection:</strong> Object to the processing of your personal data.</li>
            <li><strong>Portability:</strong> Request a copy of your personal data in a structured, machine-readable format.</li>
          </ul>
          <p>To exercise these rights, please contact us using the contact information below.</p>

          <h2>6. Third-Party Links</h2>
          <p>Our Service may contain links to third-party websites or services that are not operated by us. We have no control over and assume no responsibility for the content, privacy policies, or practices of any third-party sites or services.</p>

          <h2>7. Changes to This Privacy Policy</h2>
          <p>We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Effective Date" at the top. You are advised to review this Privacy Policy periodically for any changes.</p>

          <h2>8. Contact Us</h2>
          <p>If you have any questions about this Privacy Policy, please contact us:</p>
          <p>Fortress Inventory<br />Email: support@fortressinventory.com<br />Address: 333 W 39th St STE 303, New York, NY 10018</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PrivacyPolicy;