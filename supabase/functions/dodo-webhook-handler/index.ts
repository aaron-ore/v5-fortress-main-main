import { createClient } from 'npm:@supabase/supabase-js';
import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
import { DodoPayments } from 'dodopayments';

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

    let requestBody: any = {};
    if (contentType && contentType.includes('application/json')) {
      try {
        requestBody = await req.json();
      } catch (parseError: any) {
        try {
          rawBodyText = await req.text();
        } catch (textError) {
          console.warn('Edge Function: Could not read raw body text after req.json() failure:', textError);
        }
        if (parseError instanceof SyntaxError && rawBodyText.trim() === '') {
          requestBody = {};
        } else {
          return new Response(JSON.stringify({ error: `Failed to parse request data as JSON: ${parseError.message}. Raw body: ${rawBodyText}` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        }
      }
    } else {
      return new Response(JSON.stringify({ error: 'Unsupported Content-Type. Expected application/json.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const dodoWebhookSecret = Deno.env.get('DODO_WEBHOOK_SECRET');
    if (!dodoWebhookSecret) {
      return new Response(JSON.stringify({ error: 'Server configuration error: DODO_WEBHOOK_SECRET is missing.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const signature = req.headers.get('X-Dodo-Signature');
    if (!signature) {
      return new Response(JSON.stringify({ error: 'Webhook signature missing.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const dodo = new DodoPayments(Deno.env.get('DODO_API_KEY') ?? '');

    // Verify webhook signature
    try {
      await dodo.webhooks.verify(JSON.stringify(requestBody), signature, dodoWebhookSecret);
    } catch (e) {
      console.error('Webhook signature verification failed:', e);
      return new Response(JSON.stringify({ error: 'Webhook signature verification failed.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const event = requestBody;
    console.log('Received Dodo webhook event:', event.type, JSON.stringify(event, null, 2));

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const organizationId = event.meta?.custom_data?.organization_id;
    const userId = event.meta?.custom_data?.user_id;
    const planId = event.meta?.custom_data?.plan_id; // Assuming planId is passed in metadata

    if (!organizationId || !userId || !planId) {
      console.error('Missing custom data in Dodo webhook metadata:', event.meta?.custom_data);
      return new Response(JSON.stringify({ error: 'Missing organization_id, user_id, or plan_id in webhook metadata.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    switch (event.type) {
      case 'subscription_created':
      case 'subscription_updated':
        const subscription = event.data;
        const newPlan = planId; // Use planId from metadata
        const trialEndsAt = subscription.trial_ends_at;

        const { error: updateOrgError } = await supabaseAdmin
          .from('organizations')
          .update({
            plan: newPlan,
            dodo_subscription_id: subscription.id,
            trial_ends_at: trialEndsAt,
          })
          .eq('id', organizationId);

        if (updateOrgError) {
          console.error('Error updating organization plan/subscription ID:', updateOrgError);
          throw new Error('Failed to update organization plan/subscription ID.');
        }
        console.log(`Organization ${organizationId} updated to plan ${newPlan} with subscription ID ${subscription.id}.`);
        break;

      case 'subscription_cancelled':
        // Revert to free plan or handle as needed
        const { error: cancelOrgError } = await supabaseAdmin
          .from('organizations')
          .update({
            plan: 'free',
            dodo_subscription_id: null,
            trial_ends_at: null,
          })
          .eq('id', organizationId);

        if (cancelOrgError) {
          console.error('Error updating organization plan after cancellation:', cancelOrgError);
          throw new Error('Failed to update organization plan after cancellation.');
        }
        console.log(`Organization ${organizationId} subscription cancelled. Reverted to free plan.`);
        break;

      case 'order_created':
        // Handle one-time purchases or other order types
        console.log('Dodo order created event received:', event.data.id);
        break;

      default:
        console.log('Unhandled Dodo webhook event type:', event.type);
    }

    return new Response(JSON.stringify({ message: 'Webhook processed successfully.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Edge Function error (caught at top level):', error);
    return new Response(JSON.stringify({ error: error.message, rawBody: rawBodyText, contentType: contentType }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});