import { createClient } from 'npm:@supabase/supabase-js';
import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
// Inlined corsHeaders definition to resolve module import error
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const safeConsole = {
  log: (...args: any[]) => {
    try {
      if (typeof console !== 'undefined' && console.log) console.log(...args);
    } catch (e) { /* ignore */ }
  },
  error: (...args: any[]) => {
    try {
      if (typeof console !== 'undefined' && console.error) console.error(...args);
    } catch (e) { /* ignore */ }
  },
  warn: (...args: any[]) => {
    try {
      if (typeof console !== 'undefined' && console.warn) console.warn(...args);
    } catch (e) { /* ignore */ }
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let rawBodyBuffer: ArrayBuffer;
  let rawBodyText = '';
  try {
    rawBodyBuffer = await req.arrayBuffer(); // Read as ArrayBuffer
    rawBodyText = new TextDecoder().decode(rawBodyBuffer); // Decode to string

    safeConsole.log('Dodo Webhook: Raw Body Text (first 200 chars):', rawBodyText.substring(0, 200));
    safeConsole.log('Dodo Webhook: Raw Body Text length:', rawBodyText.length);

    const signatureHeader = req.headers.get('webhook-signature');
    const webhookTimestamp = req.headers.get('webhook-timestamp');
    const webhookId = req.headers.get('webhook-id'); // Extract webhook-id
    
    const dodoApiKey = Deno.env.get('DODO_API_KEY')?.trim();
    const dodoWebhookSecret = Deno.env.get('DODO_PAYMENTS_WEBHOOK_KEY')?.trim();

    safeConsole.log('Dodo Webhook: Extracted webhook-signature header:', signatureHeader);
    safeConsole.log('Dodo Webhook: Extracted webhook-timestamp header:', webhookTimestamp);
    safeConsole.log('Dodo Webhook: Extracted webhook-id header:', webhookId);
    safeConsole.log('Dodo Webhook: DODO_API_KEY (from env):', dodoApiKey ? 'present' : 'MISSING');
    safeConsole.log('Dodo Webhook: DODO_PAYMENTS_WEBHOOK_KEY (from env):', dodoWebhookSecret ? 'present' : 'MISSING');


    if (!dodoApiKey) {
      safeConsole.error('Dodo Webhook: DODO_API_KEY environment variable is not set. Cannot initialize DodoPayments SDK.');
      return new Response('Server configuration error: Dodo API Key is missing.', { status: 500 });
    }
    if (!dodoWebhookSecret) {
      safeConsole.error('Dodo Webhook: DODO_PAYMENTS_WEBHOOK_KEY environment variable is not set. Cannot initialize DodoPayments SDK.');
      return new Response('Server configuration error: Dodo Webhook Key is missing.', { status: 500 });
    }
    if (!signatureHeader) {
      safeConsole.error('Dodo Webhook: Missing webhook-signature header for verification.');
      return new Response('Unauthorized: Missing webhook signature header.', { status: 401 });
    }
    if (!webhookTimestamp) {
      safeConsole.error('Dodo Webhook: Missing webhook-timestamp header for verification.');
      return new Response('Unauthorized: Missing webhook timestamp header.', { status: 401 });
    }
    if (!webhookId) {
      safeConsole.error('Dodo Webhook: Missing webhook-id header for verification.');
      return new Response('Unauthorized: Missing webhook ID header.', { status: 401 });
    }

    const dodoPaymentsClient = new DodoPayments({
      bearerToken: dodoApiKey,
      webhookKey: dodoWebhookSecret,
    });

    const webhookHeaders = {
      'webhook-signature': signatureHeader,
      'webhook-timestamp': webhookTimestamp,
      'webhook-id': webhookId,
    };

    let event;
    try {
      event = dodoPaymentsClient.webhooks.unwrap(rawBodyText, { headers: webhookHeaders });
      safeConsole.log('Dodo Webhook: SDK unwrapped webhook successfully:', JSON.stringify(event, null, 2));
    } catch (sdkError: any) {
      safeConsole.error('Dodo Webhook: SDK webhook unwrap failed:', sdkError.message);
      return new Response(`Unauthorized: Webhook verification failed. ${sdkError.message}`, { status: 401 });
    }
    safeConsole.log('Dodo Webhook: Signature verification successful using SDK.');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const eventType = event.type;
    const dodoCustomerId = event.data.customer?.customer_id;
    const productId = event.data.product_id;
    const subscriptionId = event.data.subscription_id;
    const customerEmail = event.data.customer?.email;
    const customerName = event.data.customer?.name;
    const organizationIdFromPassthrough = event.meta?.passthrough?.organization_id;
    const userIdFromPassthrough = event.meta?.passthrough?.user_id;

    safeConsole.log('Dodo Webhook: Extracted Event Type:', eventType);
    safeConsole.log('Dodo Webhook: Extracted Dodo Customer ID:', dodoCustomerId);
    safeConsole.log('Dodo Webhook: Extracted Product ID:', productId);
    safeConsole.log('Dodo Webhook: Extracted Subscription ID:', subscriptionId);
    safeConsole.log('Dodo Webhook: Extracted Customer Email:', customerEmail);
    safeConsole.log('Dodo Webhook: Extracted Customer Name:', customerName);
    safeConsole.log('Dodo Webhook: Extracted Organization ID from passthrough:', organizationIdFromPassthrough);
    safeConsole.log('Dodo Webhook: Extracted User ID from passthrough:', userIdFromPassthrough);


    if (!dodoCustomerId || !productId || !subscriptionId || !customerEmail || !customerName || !organizationIdFromPassthrough || !userIdFromPassthrough) {
      safeConsole.error('Dodo Webhook: Missing essential data in event payload or passthrough.', { dodoCustomerId, productId, subscriptionId, customerEmail, customerName, organizationIdFromPassthrough, userIdFromPassthrough, eventType, eventData: event.data, passthrough: event.meta?.passthrough });
      return new Response('Missing essential data in webhook payload or passthrough', { status: 400 });
    }
    safeConsole.log('Dodo Webhook: All essential data extracted successfully.');

    // Step 1: Upsert customer in public.customers table
    safeConsole.log('Dodo Webhook: Attempting to upsert customer into public.customers...');
    const { data: upsertedCustomer, error: upsertError } = await supabaseAdmin
      .from('customers')
      .upsert({
        email: customerEmail,
        name: customerName,
        dodo_customer_id: dodoCustomerId,
        dodo_subscription_id: subscriptionId,
        organization_id: organizationIdFromPassthrough, // Link to the organization from passthrough
        user_id: userIdFromPassthrough, // Link to the user from passthrough
      }, {
        onConflict: 'dodo_customer_id', // Use dodo_customer_id for conflict resolution
        ignoreDuplicates: false
      })
      .select('id, organization_id') // Select organization_id to use for updating plan
      .single();

    if (upsertError) {
      safeConsole.error('Dodo Webhook: Failed to upsert customer:', upsertError);
      return new Response(`Failed to upsert customer: ${upsertError.message}`, { status: 500 });
    }
    safeConsole.log('Dodo Webhook: Customer upserted successfully. Fortress Customer ID:', upsertedCustomer.id, 'Organization ID:', upsertedCustomer.organization_id);

    const organizationIdToUpdate = upsertedCustomer.organization_id; // Use the organization_id from the upserted customer

    let planName: string | null = null;

    if (eventType === 'subscription.active' || eventType === 'subscription.plan_changed' || eventType === 'subscription.renewed') {
      switch (String(productId)) {
        case Deno.env.get('DODO_PRODUCT_ID_STANDARD'):
          planName = 'standard';
          break;
        case Deno.env.get('DODO_PRODUCT_ID_PRO'):
          planName = 'pro';
          break;
        default:
          safeConsole.warn('Dodo Webhook: Unknown product ID received:', productId);
          planName = 'unknown';
      }

      safeConsole.log(`Dodo Webhook: Updating organization ${organizationIdToUpdate} with plan: ${planName}`);

      const { data, error } = await supabaseAdmin
        .from('organizations')
        .update({
          plan: planName,
        })
        .eq('id', organizationIdToUpdate);

      if (error) {
        safeConsole.error('Dodo Webhook: Error updating organization plan in Supabase:', error);
        return new Response('Failed to update organization plan', { status: 500 });
      }

      safeConsole.log('Dodo Webhook: Organization plan updated successfully:', data);
      return new Response('Webhook processed successfully', { status: 200 });

    } else if (eventType === 'subscription.cancelled' || eventType === 'subscription.expired' || eventType === 'subscription.on_hold') {
      safeConsole.log(`Dodo Webhook: Handling cancellation/failure for organization ${organizationIdToUpdate}, customer ${dodoCustomerId}. Setting plan to 'free'.`);

      const { data, error } = await supabaseAdmin
        .from('organizations')
        .update({
          plan: 'free',
        })
        .eq('id', organizationIdToUpdate);

      if (error) {
        safeConsole.error('Dodo Webhook: Error updating organization plan on cancellation/failure in Supabase:', error);
        return new Response('Failed to update organization plan on cancellation/failure', { status: 500 });
      }

      safeConsole.log('Dodo Webhook: Organization plan downgraded to free successfully:', data);
      return new Response('Cancellation/failure webhook processed successfully', { status: 200 });

    } else {
      safeConsole.log('Dodo Webhook: Unhandled event type:', eventType);
      return new Response('Unhandled event type', { status: 200 });
    }

  } catch (error: any) {
    safeConsole.error('Dodo Webhook: Top-level error:', error.message, 'Raw body:', rawBodyText);
    return new Response(`Internal Server Error: ${error.message}`, { status: 500 });
  }
});