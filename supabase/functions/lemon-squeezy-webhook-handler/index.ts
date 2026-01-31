import { createClient } from 'npm:@supabase/supabase-js';
import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
import { Webhook } from 'npm:lemonsqueezy'; // Corrected import

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  let rawBodyText = '';
  const contentType = req.headers.get('content-type');

  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    // 1. Read raw body for signature verification
    rawBodyText = await req.text();
    
    const lemonSqueezyWebhookSecret = Deno.env.get('LEMON_SQUEEZY_WEBHOOK_SECRET');
    if (!lemonSqueezyWebhookSecret) {
      console.error('[LemonSqueezy Webhook] Server configuration error: LEMON_SQUEEZY_WEBHOOK_SECRET is missing.');
      return new Response(JSON.stringify({ error: 'Server configuration error: Webhook secret missing.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const signature = req.headers.get('X-Signature');
    if (!signature) {
      console.error('[LemonSqueezy Webhook] Webhook signature missing.');
      return new Response(JSON.stringify({ error: 'Webhook signature missing.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // 2. Verify webhook signature
    try {
      const webhook = new Webhook(lemonSqueezyWebhookSecret);
      webhook.verify(rawBodyText, signature);
      console.log('[LemonSqueezy Webhook] Signature verified successfully.');
    } catch (e) {
      console.error('[LemonSqueezy Webhook] Signature verification failed:', e);
      return new Response(JSON.stringify({ error: 'Webhook signature verification failed.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // 3. Parse body after verification
    const event = JSON.parse(rawBodyText);
    console.log('[LemonSqueezy Webhook] Received event:', event.meta.event_name, JSON.stringify(event, null, 2));

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const attributes = event.data.attributes;
    const meta = event.meta;
    const eventName = meta.event_name;

    const organizationId = meta.custom_data?.organization_id;
    const userId = meta.custom_data?.user_id;
    const planId = meta.custom_data?.plan_id;

    if (!organizationId || !userId || !planId) {
      console.error('[LemonSqueezy Webhook] Missing custom data in metadata:', meta.custom_data);
      return new Response(JSON.stringify({ error: 'Missing organization_id, user_id, or plan_id in webhook metadata.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    switch (eventName) {
      case 'subscription_created':
      case 'subscription_updated':
        const subscription = attributes;
        const newPlan = planId;
        const trialEndsAt = subscription.trial_ends_at;
        const customerId = subscription.customer_id;

        const { error: updateOrgError } = await supabaseAdmin
          .from('organizations')
          .update({
            plan: newPlan,
            lemon_squeezy_subscription_id: subscription.id,
            lemon_squeezy_customer_id: customerId,
            trial_ends_at: trialEndsAt,
          })
          .eq('id', organizationId);

        if (updateOrgError) {
          console.error('[LemonSqueezy Webhook] Error updating organization plan/subscription ID:', updateOrgError);
          throw new Error('Failed to update organization plan/subscription ID.');
        }
        console.log(`[LemonSqueezy Webhook] Organization ${organizationId} updated to plan ${newPlan} with subscription ID ${subscription.id}.`);
        break;

      case 'subscription_cancelled':
      case 'subscription_expired':
        // Revert to free plan
        const { error: cancelOrgError } = await supabaseAdmin
          .from('organizations')
          .update({
            plan: 'free',
            lemon_squeezy_subscription_id: null,
            trial_ends_at: null,
          })
          .eq('id', organizationId);

        if (cancelOrgError) {
          console.error('[LemonSqueezy Webhook] Error updating organization plan after cancellation:', cancelOrgError);
          throw new Error('Failed to update organization plan after cancellation.');
        }
        console.log(`[LemonSqueezy Webhook] Organization ${organizationId} subscription cancelled/expired. Reverted to free plan.`);
        break;

      case 'order_created':
        // Handle one-time purchases or other order types (e.g., perpetual licenses)
        console.log('[LemonSqueezy Webhook] Order created event received:', attributes.order_number);
        // Logic to update perpetual license features based on the purchased product
        break;

      default:
        console.log('[LemonSqueezy Webhook] Unhandled event type:', eventName);
    }

    return new Response(JSON.stringify({ message: 'Webhook processed successfully.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('[LemonSqueezy Webhook] Caught top-level error:', error);
    return new Response(JSON.stringify({ error: error.message, rawBody: rawBodyText, contentType: contentType }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});