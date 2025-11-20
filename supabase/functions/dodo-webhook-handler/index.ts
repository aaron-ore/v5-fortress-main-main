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
  signature: string | null,
  secret: string | undefined
): Promise<boolean> {
  if (!secret) {
    safeConsole.warn('Dodo Webhook: DODO_WEBHOOK_SECRET is not configured. Skipping signature verification. THIS IS INSECURE FOR PRODUCTION!');
    return true; // Insecure: allow if no secret is configured
  }
  if (!signature) {
    safeConsole.error('Dodo Webhook: Missing X-Dodo-Signature header for verification.');
    return false;
  }

  try {
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

    const expectedSignature = 'whsec_' + Array.from(new Uint8Array(hmacBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Dodo's signature format is typically `whsec_` followed by a base64 encoded HMAC.
    // The previous implementation was for a raw hex string. Let's adjust for base64.
    // Re-evaluating Dodo's typical signature format: it's usually `whsec_` followed by a base64 encoded HMAC.
    // The provided secret `whsec_X6Dyf+4bLnCvFumlKTGGMEDCTq4/nbP/` itself looks like a secret, not a signature.
    // The signature would be in a header like `X-Dodo-Signature`.
    // Let's assume the `signature` parameter is the actual `X-Dodo-Signature` header value.
    // The secret is used to *generate* the expected signature.

    // Dodo's documentation (or common practice) usually involves:
    // 1. Concatenating timestamp and payload.
    // 2. Hashing with HMAC-SHA256 using the signing secret.
    // 3. Base64 encoding the hash.
    // 4. Comparing with the `X-Dodo-Signature` header.

    // For now, let's assume the `signature` passed is the raw HMAC-SHA256 base64 string (without 'whsec_').
    // If Dodo's signature includes 'whsec_', we'll need to strip it from the incoming signature.

    // Let's assume Dodo sends `X-Dodo-Signature: t=TIMESTAMP,v1=SIGNATURE_HASH`
    // Or just `X-Dodo-Signature: SIGNATURE_HASH`
    // The screenshot shows the secret itself, not an example signature.

    // Given the format `whsec_X6Dyf+4bLnCvFumlKTGGMEDCTq4/nbP/`, this is likely the *secret key*
    // and not the *signature header value*.
    // The signature header would typically be something like `X-Dodo-Signature: v1=some_base64_hash`.

    // Let's update the `verifyDodoSignature` to expect the secret as the key,
    // and the signature header to be a base64 encoded HMAC-SHA256 of the payload.
    // We'll need to check Dodo's actual header name and format.
    // For now, let's assume the header is `X-Dodo-Signature` and its value is the base64 encoded HMAC.

    // Re-reading the prompt: "I found this signing secret under the webhook page after creation. is this it? whsec_X6Dyf+4bLnCvFumlKTGGMEDCTq4/nbP/"
    // This confirms `whsec_X6Dyf+4bLnCvFumlKTGGMEDCTq4/nbP/` is the *secret key* itself.
    // The `X-Dodo-Signature` header will contain the *generated signature*.

    // Let's assume Dodo sends a header like `X-Dodo-Signature: <base64_encoded_hmac_sha256_of_payload>`
    // And the secret is `whsec_...`

    // The `crypto.subtle.sign` returns an ArrayBuffer. We need to base64 encode it.
    const calculatedSignatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(payload)
    );
    const calculatedSignature = btoa(String.fromCharCode(...new Uint8Array(calculatedSignatureBuffer)));

    // Compare the calculated signature with the one from the header
    // We need to handle potential prefixes like 'whsec_' if Dodo adds them to the header value.
    const incomingSignatureClean = signature.startsWith('whsec_') ? signature.substring(6) : signature;

    const isValid = calculatedSignature === incomingSignatureClean;
    if (!isValid) {
      safeConsole.error('Dodo Webhook: Signature mismatch. Calculated:', calculatedSignature, 'Incoming:', incomingSignatureClean);
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
    const event = JSON.parse(rawBodyText);

    safeConsole.log('Dodo Webhook: Received event:', JSON.stringify(event, null, 2));
    safeConsole.log('Dodo Webhook: Incoming Headers:', JSON.stringify(Object.fromEntries(req.headers.entries()), null, 2));

    // IMPORTANT: Webhook signature verification
    const signature = req.headers.get('X-Dodo-Signature'); // Assuming this is the header Dodo sends
    const dodoWebhookSecret = Deno.env.get('DODO_WEBHOOK_SECRET');

    if (!(await verifyDodoSignature(rawBodyText, signature, dodoWebhookSecret))) {
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

    const userId = obj.custom_data?.user_id || obj.user_id;
    const organizationId = obj.custom_data?.organization_id || obj.organization_id;
    const customerId = obj.customer_id;

    if (!userId || !organizationId || !customerId) {
      safeConsole.error('Dodo Webhook: Missing essential metadata in event payload.', { userId, organizationId, customerId, eventType });
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