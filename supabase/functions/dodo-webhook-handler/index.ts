import { createClient } from 'npm:@supabase/supabase-js';
import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
import { DodoPayments } from 'npm:dodopayments'; // Corrected package name

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

    // Corrected field mappings based on Dodo's feedback and logs
    const eventType = event.type; // Correct: Use event.type
    const customerId = event.data.customer?.customer_id; // Correct: Access via event.data.customer
    const productId = event.data.product_id; // Correct: Access via event.data
    const subscriptionId = event.data.subscription_id; // Correct: Access via event.data

    safeConsole.log('Dodo Webhook: Extracted Event Type:', eventType);
    safeConsole.log('Dodo Webhook: Extracted Customer ID:', customerId);
    safeConsole.log('Dodo Webhook: Extracted Product ID:', productId);
    safeConsole.log('Dodo Webhook: Extracted Subscription ID:', subscriptionId);

    if (!customerId || !productId || !subscriptionId) {
      safeConsole.error('Dodo Webhook: Missing essential data in event payload.', { customerId, productId, subscriptionId, eventType, eventData: event.data });
      return new Response('Missing essential data', { status: 400 });
    }
    safeConsole.log('Dodo Webhook: All essential data extracted successfully.');

    // NEW: Look up organization_id using dodo_customer_id
    const { data: organizationData, error: orgFetchError } = await supabaseAdmin
      .from('organizations')
      .select('id, plan')
      .eq('dodo_customer_id', customerId)
      .single();

    if (orgFetchError || !organizationData) {
      safeConsole.error('Dodo Webhook: Organization not found for dodo_customer_id:', customerId, orgFetchError?.message);
      return new Response('Organization not found for customer ID', { status: 404 });
    }
    const organizationId = organizationData.id;
    safeConsole.log('Dodo Webhook: Found organization ID:', organizationId, 'for customer ID:', customerId);

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

      safeConsole.log(`Dodo Webhook: Updating organization ${organizationId} with plan: ${planName}, customerId: ${customerId}, subscriptionId: ${subscriptionId}`);

      const { data, error } = await supabaseAdmin
        .from('organizations')
        .update({
          plan: planName,
          dodo_customer_id: customerId, // Ensure customer_id is also updated/confirmed
          dodo_subscription_id: subscriptionId,
        })
        .eq('id', organizationId);

      if (error) {
        safeConsole.error('Dodo Webhook: Error updating organization in Supabase:', error);
        return new Response('Failed to update organization', { status: 500 });
      }

      safeConsole.log('Dodo Webhook: Organization updated successfully:', data);
      return new Response('Webhook processed successfully', { status: 200 });

    } else if (eventType === 'subscription.cancelled' || eventType === 'subscription.expired' || eventType === 'subscription.on_hold') {
      safeConsole.log(`Dodo Webhook: Handling cancellation/failure for organization ${organizationId}, customer ${customerId}. Setting plan to 'free'.`);

      const { data, error } = await supabaseAdmin
        .from('organizations')
        .update({
          plan: 'free',
          dodo_subscription_id: null,
        })
        .eq('id', organizationId);

      if (error) {
        safeConsole.error('Dodo Webhook: Error updating organization on cancellation/failure in Supabase:', error);
        return new Response('Failed to update organization on cancellation/failure', { status: 500 });
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