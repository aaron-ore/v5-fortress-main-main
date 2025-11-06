import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

const TermsOfService: React.FC = () => {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Fortress Inventory Terms of Service Agreement</h1>
      <p className="text-muted-foreground">Effective Date: October 1, 2025 | Last Updated: October 1, 2025</p>

      <Card className="bg-card border-border rounded-lg shadow-sm">
        <CardContent className="p-6 prose dark:prose-invert max-w-none">
          <p>These Terms of Service ("Terms") constitute a legally binding agreement between Fortress Inventory ("Company," "we," or "our") and the individual or entity ("Customer," "you," or "your") that accesses or uses the Fortress Inventory cloud-based inventory management application and related services (collectively, the "Service").</p>

          <p><strong>BY CLICKING THE "I AGREE" BUTTON, COMPLETING THE ACCOUNT REGISTRATION PROCESS, AND/OR ACCESSING OR USING THE SERVICE, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO BE BOUND BY THESE TERMS. IF YOU ARE ENTERING INTO THESE TERMS ON BEHALF OF A COMPANY OR OTHER LEGAL ENTITY, YOU REPRESENT THAT YOU HAVE THE AUTHORITY TO BIND SUCH ENTITY TO THESE TERMS. IF YOU DO NOT HAVE SUCH AUTHORITY, OR IF YOU DO NOT AGREE WITH THESE TERMS, YOU MUST NOT ACCEPT THIS AGREEMENT AND MAY NOT USE THE SERVICE.</strong></p>

          <h2>1. Definitions</h2>
          <p><strong>1.1 Service:</strong> The Fortress Inventory software-as-a-service platform, including the mobile application, web interface, underlying technology, and any documentation or support provided by us.</p>
          <p><strong>1.2 Customer Data:</strong> All data, information, files, inventory records, product details, stock levels, transaction history, customer lists, and pricing information uploaded, submitted, or otherwise transmitted by you or your Authorized Users to the Service.</p>
          <p><strong>1.3 Authorized User:</strong> An individual employee, contractor, or agent of the Customer authorized by the Customer to access and use the Service pursuant to the Customer's subscription plan.</p>
          <p><strong>1.4 Subscription:</strong> The specific plan (e.g., Basic, Pro, Enterprise) purchased by the Customer, specifying features, number of Authorized Users, and the duration of access.</p>

          <h2>2. Subscription and Access Grant</h2>
          <p><strong>2.1 License:</strong> Subject to your compliance with these Terms, we grant you a non-exclusive, non-transferable, non-sublicensable, revocable license to access and use the Service during the Subscription Term solely for your internal business operations.</p>
          <p><strong>2.2 Authorized Users:</strong> Access to the Service is limited to the number of Authorized Users permitted under your current Subscription. You are responsible for ensuring all Authorized Users comply with these Terms.</p>
          <p><strong>2.3 Trial Period:</strong> If you register for a free trial, we will make the Service available on a trial basis, free of charge, until the earlier of (a) the end of the trial period or (b) termination by either party. Data entered during a trial may be permanently lost unless you purchase a paid Subscription.</p>

          <h2>3. Fees and Payment Terms</h2>
          <p><strong>3.1 Billing:</strong> Fees for the Service are detailed in the Subscription plan selected by the Customer and are billed in advance for the billing cycle (e.g., monthly or annually).</p>
          <p><strong>3.2 Auto-Renewal:</strong> Your Subscription will automatically renew at the end of each billing cycle unless you cancel or we notify you otherwise. You authorize us (or our third-party payment processor) to charge your designated payment method for the renewal term.</p>
          <p><strong>3.3 Price Changes:</strong> We reserve the right to change the fees for the Service at any time, provided that any price increase will take effect no earlier than thirty (30) days after notice is sent to you, and will not affect the fees for the remainder of your current Subscription Term.</p>
          <p><strong>3.4 Taxes:</strong> All fees are exclusive of applicable taxes, duties, and levies, which are your responsibility.</p>
          <p><strong>3.5 Refunds:</strong> ALL FEES ARE NON-REFUNDABLE AND NON-CANCELLABLE. No refunds or credits will be provided for partial months of service, downgrade refunds, or unused periods of service.</p>

          <h2>4. Customer Data Ownership and Use</h2>
          <p><strong>4.1 Ownership:</strong> As between the parties, you exclusively own all rights, title, and interest in and to all Customer Data.</p>
          <p><strong>4.2 Data License:</strong> You grant us a worldwide, limited-term, royalty-free license to host, copy, transmit, and display the Customer Data solely as necessary for us to provide the Service to you in accordance with these Terms.</p>
          <p><strong>4.3 Data Responsibilities:</strong> You are solely responsible for the accuracy, quality, integrity, legality, reliability, appropriateness, and intellectual property ownership or right to use all Customer Data. We shall not be responsible for any loss, corruption, or inaccuracy of Customer Data.</p>
          <p><strong>4.4 Security:</strong> We will maintain administrative, physical, and technical safeguards for the protection of the security, confidentiality, and integrity of Customer Data, as described in our Privacy Policy.</p>

          <h2>5. Restrictions and Acceptable Use Policy</h2>
          <p><strong>5.1 Prohibited Actions:</strong> You agree not to, and shall not permit any Authorized User or third party to:</p>
          <p>a. License, sublicense, sell, resell, rent, lease, transfer, assign, distribute, or otherwise commercially exploit or make the Service available to any third party, other than your Authorized Users.</p>
          <p>b. Use the Service to store or transmit infringing, libelous, or otherwise unlawful or tortious material, or to store or transmit material in violation of third-party privacy rights.</p>
          <p>c. Use the Service to store or transmit any malware, viruses, or other harmful computer code.</p>
          <p>d. Interfere with or disrupt the integrity or performance of the Service or the data contained therein.</p>
          <p>e. Attempt to gain unauthorized access to the Service or its related systems or networks.</p>
          <p>f. Reverse engineer, disassemble, decompile, or otherwise attempt to discover the source code or underlying structure, ideas, or algorithms of the Service.</p>
          <p>g. Access the Service for the purpose of building a competitive product or service or copying any features, functions, or graphics of the Service.</p>

          <h2>6. Intellectual Property Rights</h2>
          <p><strong>6.1 Company IP:</strong> We retain all right, title, and interest, including all Intellectual Property Rights, in and to the Service, including all software, technology, features, logos, trademarks, and documentation provided by us. These Terms grant you a limited license to use the Service, not a transfer of ownership.</p>
          <p><strong>6.2 Feedback:</strong> If you provide us with any suggestions, ideas, enhancement requests, feedback, or recommendations ("Feedback"), you grant us a perpetual, irrevocable, worldwide, royalty-free license to use, incorporate, and otherwise exploit any such Feedback for any purpose.</p>

          <h2>7. Term and Termination</h2>
          <p><strong>7.1 Term:</strong> These Terms commence on the date you first accept them or use the Service and continue for the duration of your Subscription Term.</p>
          <p><strong>7.2 Termination for Cause:</strong> Either party may terminate these Terms for cause: (i) upon 30 days written notice of a material breach to the other party if such breach remains uncured at the expiration of such period, or (ii) if the other party becomes the subject of a petition in bankruptcy or any other proceeding relating to insolvency, receivership, liquidation, or assignment for the benefit of creditors.</p>
          <p><strong>7.3 Termination by Company:</strong> We may terminate your access to the Service immediately and without prior notice if you breach Section 5 (Restrictions and Acceptable Use Policy) or fail to pay any fees when due.</p>
          <p><strong>7.4 Effect of Termination:</strong> Upon termination:</p>
          <p>a. Your right to use the Service immediately ceases.</p>
          <p>b. You must pay any unpaid fees covering the remainder of the Subscription Term.</p>
          <p>c. We will make your Customer Data available for download for a period of 30 days. After this period, we shall have no obligation to maintain or forward any Customer Data and may securely delete it.</p>

          <h2>8. Warranties and Disclaimer</h2>
          <p><strong>8.1 Limited Warranty:</strong> We warrant that during an active Subscription Term, the Service will perform materially in accordance with the user documentation. Your sole and exclusive remedy for breach of this warranty shall be, at our option, to correct the non-conforming Service or terminate the affected Subscription and issue a prorated refund for the remainder of the Subscription Term.</p>
          <p><strong>8.2 Disclaimer:</strong> EXCEPT FOR THE LIMITED WARRANTY IN SECTION 8.1, THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE." WE MAKE NO OTHER WARRANTIES, EXPRESS OR IMPLIED, INCLUDING, WITHOUT LIMITATION, ANY IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR COMPLETELY SECURE.</p>

          <h2>9. Limitation of Liability</h2>
          <p><strong>9.1 Exclusion of Damages:</strong> TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT WILL WE BE LIABLE FOR ANY INDIRECT, PUNITIVE, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR EXEMPLARY DAMAGES (INCLUDING, WITHOUT LIMITATION, LOSS OF DATA, PROFITS, REVENUE, GOODWILL, OR ANY OTHER INTANGIBLE LOSS) ARISING OUT OF OR IN CONNECTION WITH THE SERVICE OR THESE TERMS, WHETHER BASED ON CONTRACT, TORT, NEGLIGENCE, STRICT LIABILITY, OR OTHERWISE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.</p>
          <p><strong>9.2 Liability Cap:</strong> IN NO EVENT SHALL OUR TOTAL CUMULATIVE LIABILITY ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICE EXCEED THE TOTAL AMOUNT OF FEES PAID BY YOU TO US FOR THE SERVICE DURING THE TWELVE (12) MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE LIABILITY.</p>

          <h2>10. Indemnification</h2>
          <p>You agree to indemnify, defend, and hold harmless the Company, its affiliates, officers, directors, and employees from and against any and all claims, damages, liabilities, losses, costs, and expenses (including reasonable attorneys' fees) arising out of or related to: (i) your or your Authorized Users' use of the Service, (ii) your breach of any term of this Agreement, or (iii) any third-party claim that your Customer Data or your use of the Service infringes or misappropriates any third party's intellectual property rights or violates applicable law.</p>

          <h2>11. General Provisions</h2>
          <p><strong>11.1 Governing Law and Venue:</strong> These Terms and any dispute or claim arising out of or in connection with them shall be governed by and construed in accordance with the laws of New York, without regard to its conflict of law principles. Any legal action or proceeding arising under these Terms shall be brought exclusively in the courts located in New York, NY.</p>
          <p><strong>11.2 Entire Agreement:</strong> These Terms, together with the Privacy Policy, constitute the entire agreement between you and us concerning the use of the Service and supersedes all prior agreements, proposals, or representations.</p>
          <p><strong>11.3 Modification:</strong> We may modify these Terms at any time by posting the revised Terms on our website or within the Service and updating the "Last Updated" date. Your continued use of the Service after the effective date of the changes constitutes your acceptance of the new Terms.</p>

          <h2>12. Contact Information</h2>
          <p>For any questions regarding these Terms of Service, please contact us at:</p>
          <p>Fortress Inventory<br />Email: support@fortressinventory.com<br />Address: 333 W 39th St STE 303, New York, NY 10018</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default TermsOfService;