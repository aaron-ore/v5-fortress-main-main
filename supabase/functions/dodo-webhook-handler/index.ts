import { createClient } from 'npm:@supabase/supabase-js';
import { serve } from "https://deno.land/std@0.200.0/http/server.ts";

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

// Placeholder for Dodo webhook signature verification (if Dodo provides one)
async function verifyDodoSignature(
  payload: string,
  signature: string | null,
  secret: string | undefined
): Promise<boolean> {
  // In a real Dodo integration, you would implement Dodo's specific signature verification logic here.
  // For now, we'll just check if a signature is present if a secret is configured.
  if (secret && !signature) {
    safeConsole.error('Missing signature for webhook verification when secret is configured.');
    return false;
  }
  if (secret && signature) {
    // Simulate verification for now
    safeConsole.warn('Dodo Webhook: Signature verification is simulated. Implement actual verification for production!');
    return true; // Placeholder: Assume valid if signature and secret are present
  }
  return true; // If no secret configured, assume no verification needed (DANGEROUS for production)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let rawBodyText = '';
  try {
    rawBodyText = await req.text();
    const event = JSON.parse(rawBodyText);

    safeConsole.log('Dodo Webhook: Received event:', JSON.stringify(event, null, 2));

    // IMPORTANT: Webhook signature verification (implement Dodo's actual logic here)
    const signature = req.headers.get('X-Dodo-Signature'); // Placeholder header name
    const dodoWebhookSecret = Deno.env.get('DODO_WEBHOOK_SECRET');

    if (!(await verifyDodoSignature(rawBodyText, signature, dodoWebhookSecret))) {
      safeConsole.error('Unauthorized: Invalid webhook signature.');
      return new Response('Unauthorized: Invalid signature', { status: 401 });
    }
    safeConsole.log('Dodo Webhook: Signature verification (simulated) successful.');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const eventType = event.event_name; // Placeholder for Dodo event name
    const obj = event.data; // The main object of the event

    safeConsole.log('Dodo Webhook: Event Type:', eventType);
    safeConsole.log('Dodo Webhook: Event Object:', JSON.stringify(obj, null, 2));

    // Extract metadata from Dodo event payload
    const userId = obj.custom_data?.user_id || obj.user_id; // Placeholder for custom data or direct user_id
    const organizationId = obj.custom_data?.organization_id || obj.organization_id; // Placeholder for custom data or direct organization_id
    const customerId = obj.customer_id; // Placeholder for Dodo customer ID

    if (!userId || !organizationId || !customerId) {
      safeConsole.error('Dodo Webhook: Missing essential metadata in event payload.', { userId, organizationId, customerId, eventType });
      return new Response('Missing essential metadata', { status: 400 });
    }

    let planName: string | null = null;
    let subscriptionId: string | null = null;

    if (eventType === 'subscription.created' || eventType === 'subscription.updated') { // Placeholder event types
      const productId = obj.product_id; // Placeholder for Dodo product ID
      subscriptionId = obj.subscription_id; // Placeholder for Dodo subscription ID

      // Map Dodo Product ID to your internal plan name
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

      safeConsole.log(`Dodo Webhook: Updating organization ${organizationId} for user ${userId} with plan: ${planName}, customerId: ${customerId}, subscriptionId: ${subscriptionId}`);

      const { data, error } = await supabaseAdmin
        .from('organizations')
        .update({
          plan: planName,
          dodo_customer_id: customerId,
          dodo_subscription_id: subscriptionId,
        })
        .eq('id', organizationId);

      if (error) {
        safeConsole.error('Dodo Webhook: Error updating organization in Supabase:', error);
        return new Response('Failed to update organization', { status: 500 });
      }

      safeConsole.log('Dodo Webhook: Organization updated successfully:', data);
      return new Response('Webhook processed successfully', { status: 200 });

    } else if (eventType === 'subscription.cancelled' || eventType === 'subscription.expired') { // Placeholder event types
      subscriptionId = obj.subscription_id; // Placeholder for Dodo subscription ID

      safeConsole.log(`Dodo Webhook: Handling cancellation for organization ${organizationId}, customer ${customerId}. Setting plan to 'free'.`);

      const { data, error } = await supabaseAdmin
        .from('organizations')
        .update({
          plan: 'free',
          dodo_subscription_id: null, // Clear subscription ID
        })
        .eq('id', organizationId);

      if (error) {
        safeConsole.error('Dodo Webhook: Error updating organization on cancellation in Supabase:', error);
        return new Response('Failed to update organization on cancellation', { status: 500 });
      }

      safeConsole.log('Dodo Webhook: Organization plan downgraded to free successfully:', data);
      return new Response('Cancellation webhook processed successfully', { status: 200 });

    } else {
      safeConsole.log('Dodo Webhook: Unhandled event type:', eventType);
      return new Response('Unhandled event type', { status: 200 });
    }

  } catch (error: any) {
    safeConsole.error('Dodo Webhook: Top-level error:', error.message, 'Raw body:', rawBodyText);
    return new Response(`Internal Server Error: ${error.message}`, { status: 500 });
  }
});