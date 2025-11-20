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

// Actual Dodo webhook signature verification
async function verifyDodoSignature(
  payload: string,
  signatureHeader: string | null,
  secret: string | undefined
): Promise<boolean> {
  if (!secret) {
    safeConsole.warn('Dodo Webhook: DODO_WEBHOOK_SECRET is not configured. Skipping signature verification. THIS IS INSECURE FOR PRODUCTION!');
    return true; // Insecure: allow if no secret is configured
  }
  if (!signatureHeader) {
    safeConsole.error('Dodo Webhook: Missing webhook-signature header for verification.');
    return false;
  }

  try {
    // Dodo's signature format is typically `v1,BASE64_ENCODED_HMAC`
    const parts = signatureHeader.split(',');
    if (parts.length !== 2 || parts[0] !== 'v1') {
      safeConsole.error('Dodo Webhook: Invalid webhook-signature format. Expected "v1,<signature>".');
      return false;
    }
    const incomingSignatureBase64 = parts[1];

    // ADDED LOGS FOR DEBUGGING
    safeConsole.log('Dodo Webhook: Debugging Signature Verification:');
    safeConsole.log(`  Secret length (used in func): ${secret.length}`);
    safeConsole.log(`  Secret starts with (masked): ${secret.substring(0, 5)}...`);
    safeConsole.log(`  Payload length (rawBodyText): ${payload.length}`);
    safeConsole.log(`  Incoming Signature (Base64): ${incomingSignatureBase64}`);


    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const hmacBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(payload)
    );

    // Convert ArrayBuffer to base64 string
    const calculatedSignature = btoa(String.fromCharCode(...new Uint8Array(hmacBuffer)));
    
    const isValid = calculatedSignature === incomingSignatureBase64;
    if (!isValid) {
      safeConsole.error('Dodo Webhook: Signature mismatch. Calculated:', calculatedSignature, 'Incoming:', incomingSignatureBase64);
    }
    return isValid;

  } catch (e: any) {
    safeConsole.error('Dodo Webhook: Error during signature verification:', e.message);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let rawBodyText = '';
  try {
    rawBodyText = await req.text();
    // NEW LOG: Log the raw body text (truncated for security)
    safeConsole.log('Dodo Webhook: Raw Body Text (first 200 chars):', rawBodyText.substring(0, 200));

    const event = JSON.parse(rawBodyText);

    safeConsole.log('Dodo Webhook: Received event:', JSON.stringify(event, null, 2));
    safeConsole.log('Dodo Webhook: Incoming Headers:', JSON.stringify(Object.fromEntries(req.headers.entries()), null, 2));

    // IMPORTANT: Webhook signature verification
    const signatureHeader = req.headers.get('webhook-signature');
    const dodoWebhookSecret = Deno.env.get('DODO_WEBHOOK_SECRET')?.trim(); // ADDED .trim()

    // Removed redundant logs here, moved them inside verifyDodoSignature for better context


    if (!(await verifyDodoSignature(rawBodyText, signatureHeader, dodoWebhookSecret))) {
      safeConsole.error('Unauthorized: Invalid webhook signature.');
      return new Response('Unauthorized: Invalid signature', { status: 401 });
    }
    safeConsole.log('Dodo Webhook: Signature verification successful.');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const eventType = event.event_name;
    const obj = event.data;

    safeConsole.log('Dodo Webhook: Event Type:', eventType);
    safeConsole.log('Dodo Webhook: Event Object:', JSON.stringify(obj, null, 2));

    // Extract userId and organizationId from custom_data or metadata
    // Dodo's passthrough data is usually in `metadata` or `custom_data` depending on setup.
    // Let's check `obj.metadata` first, then `obj.custom_data`
    const userId = obj.metadata?.user_id || obj.custom_data?.user_id || obj.user_id;
    const organizationId = obj.metadata?.organization_id || obj.custom_data?.organization_id || obj.organization_id;
    const customerId = obj.customer_id;

    if (!userId || !organizationId || !customerId) {
      safeConsole.error('Dodo Webhook: Missing essential metadata in event payload.', { userId, organizationId, customerId, eventType, metadata: obj.metadata, custom_data: obj.custom_data });
      return new Response('Missing essential metadata', { status: 400 });
    }

    let planName: string | null = null;
    let subscriptionId: string | null = null;

    // Handle events that indicate an active or updated subscription
    if (eventType === 'subscription.active' || eventType === 'subscription.plan_changed' || eventType === 'subscription.renewed') {
      const productId = obj.product_id;
      subscriptionId = obj.subscription_id;

      switch (String(productId)) {
        case Deno.env.get('DODO_PRODUCT_ID_STANDARD'):
          planName = 'standard';
          break;
        case Deno.env.get('DODO_PRODUCT_ID_PRO'): // NEW: Recognize Pro plan product ID
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

    } else if (eventType === 'subscription.cancelled' || eventType === 'subscription.expired' || eventType === 'subscription.failed' || eventType === 'subscription.on_hold') {
      subscriptionId = obj.subscription_id;

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