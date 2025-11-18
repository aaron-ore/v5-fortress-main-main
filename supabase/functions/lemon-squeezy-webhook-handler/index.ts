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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let rawBodyText = '';
  try {
    rawBodyText = await req.text();
    const event = JSON.parse(rawBodyText);

    safeConsole.log('Lemon Squeezy Webhook: Received event:', JSON.stringify(event, null, 2));

    // IMPORTANT: Implement webhook signature verification here for production!
    // Lemon Squeezy provides a secret key to verify the authenticity of the webhook.
    // Example: const signature = req.headers.get('X-Signature');
    // if (!verifyLemonSqueezySignature(rawBodyText, signature, Deno.env.get('LEMON_SQUEEZY_WEBHOOK_SECRET'))) {
    //   return new Response('Unauthorized: Invalid signature', { status: 401 });
    // }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const eventType = event.meta.event_name;
    const obj = event.data; // The main object of the event

    safeConsole.log('Lemon Squeezy Webhook: Event Type:', eventType);
    safeConsole.log('Lemon Squeezy Webhook: Event Object:', JSON.stringify(obj, null, 2));

    // Extract metadata from checkout_data.custom or subscription.user_id/organization_id
    const userId = obj.attributes?.checkout_data?.custom?.user_id || obj.attributes?.user_id;
    const organizationId = obj.attributes?.checkout_data?.custom?.organization_id || obj.attributes?.organization_id;
    const customerId = obj.attributes?.customer_id || obj.attributes?.customer_id; // For subscriptions, customer_id is directly on attributes

    if (!userId || !organizationId || !customerId) {
      safeConsole.error('Lemon Squeezy Webhook: Missing essential metadata in event payload.', { userId, organizationId, customerId, eventType });
      return new Response('Missing essential metadata', { status: 400 });
    }

    let planName: string | null = null;
    let subscriptionId: string | null = null;

    if (eventType === 'subscription_created' || eventType === 'subscription_updated') {
      const productId = obj.attributes.product_id;
      subscriptionId = obj.id; // Lemon Squeezy subscription ID is the object ID

      // Map Lemon Squeezy Product ID to your internal plan name
      switch (String(productId)) { // Ensure productId is a string for comparison
        case Deno.env.get('LEMON_SQUEEZY_PRODUCT_ID_STANDARD'):
          planName = 'standard';
          break;
        case Deno.env.get('LEMON_SQUEEZY_PRODUCT_ID_PRO'):
          planName = 'pro';
          break;
        default:
          safeConsole.warn('Lemon Squeezy Webhook: Unknown product ID received:', productId);
          planName = 'unknown';
      }

      safeConsole.log(`Lemon Squeezy Webhook: Updating organization ${organizationId} for user ${userId} with plan: ${planName}, customerId: ${customerId}, subscriptionId: ${subscriptionId}`);

      const { data, error } = await supabaseAdmin
        .from('organizations')
        .update({
          plan: planName,
          lemon_squeezy_customer_id: customerId,
          lemon_squeezy_subscription_id: subscriptionId,
        })
        .eq('id', organizationId);

      if (error) {
        safeConsole.error('Lemon Squeezy Webhook: Error updating organization in Supabase:', error);
        return new Response('Failed to update organization', { status: 500 });
      }

      safeConsole.log('Lemon Squeezy Webhook: Organization updated successfully:', data);
      return new Response('Webhook processed successfully', { status: 200 });

    } else if (eventType === 'subscription_cancelled' || eventType === 'subscription_expired') {
      subscriptionId = obj.id; // Lemon Squeezy subscription ID is the object ID

      safeConsole.log(`Lemon Squeezy Webhook: Handling cancellation for organization ${organizationId}, customer ${customerId}. Setting plan to 'free'.`);

      const { data, error } = await supabaseAdmin
        .from('organizations')
        .update({
          plan: 'free',
          lemon_squeezy_subscription_id: null, // Clear subscription ID
        })
        .eq('id', organizationId);

      if (error) {
        safeConsole.error('Lemon Squeezy Webhook: Error updating organization on cancellation in Supabase:', error);
        return new Response('Failed to update organization on cancellation', { status: 500 });
      }

      safeConsole.log('Lemon Squeezy Webhook: Organization plan downgraded to free successfully:', data);
      return new Response('Cancellation webhook processed successfully', { status: 200 });

    } else {
      safeConsole.log('Lemon Squeezy Webhook: Unhandled event type:', eventType);
      return new Response('Unhandled event type', { status: 200 });
    }

  } catch (error: any) {
    safeConsole.error('Lemon Squeezy Webhook: Top-level error:', error.message, 'Raw body:', rawBodyText);
    return new Response(`Internal Server Error: ${error.message}`, { status: 500 });
  }
});