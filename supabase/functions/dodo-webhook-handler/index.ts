import { createClient } from 'npm:@supabase/supabase-js';
import { serve } from "https://deno.land/std@0.200.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let rawBodyText = '';
  try {
    rawBodyText = await req.text();
    const event = JSON.parse(rawBodyText);

    console.log('Dodo Webhook: Received event:', JSON.stringify(event, null, 2));

    // IMPORTANT: Implement webhook signature verification here for production!
    // Dodo should provide a secret key to verify the authenticity of the webhook.
    // Example: const signature = req.headers.get('X-Dodo-Signature');
    // if (!verifyDodoSignature(rawBodyText, signature, Deno.env.get('DODO_WEBHOOK_SECRET'))) {
    //   return new Response('Unauthorized: Invalid signature', { status: 401 });
    // }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Handle different Dodo event types
    if (event.type === 'checkout_session.completed' || event.type === 'subscription.created' || event.type === 'subscription.updated') {
      const checkoutSession = event.data.object;
      const customerId = checkoutSession.customer_id || checkoutSession.customer;
      const subscriptionId = checkoutSession.subscription_id || checkoutSession.subscription;
      const productId = checkoutSession.product_id || (checkoutSession.items && checkoutSession.items[0]?.product_id);
      const userId = checkoutSession.metadata?.user_id; // Assuming userId is passed in metadata
      const organizationId = checkoutSession.metadata?.organization_id; // Assuming organizationId is passed in metadata

      if (!customerId || !subscriptionId || !productId || !userId || !organizationId) {
        console.error('Dodo Webhook: Missing essential data in event payload.', { customerId, subscriptionId, productId, userId, organizationId });
        return new Response('Missing essential data', { status: 400 });
      }

      let planName: string;
      // Map Dodo Product ID to your internal plan name
      switch (productId) {
        case Deno.env.get('DODO_PRODUCT_ID_STANDARD'): // Use environment variable for product IDs
          planName = 'standard';
          break;
        case Deno.env.get('DODO_PRODUCT_ID_PRO'):
          planName = 'pro';
          break;
        // Add other product IDs as needed
        default:
          console.warn('Dodo Webhook: Unknown product ID received:', productId);
          planName = 'unknown'; // Default to unknown or handle as an error
      }

      console.log(`Dodo Webhook: Updating organization ${organizationId} for user ${userId} with plan: ${planName}, customerId: ${customerId}, subscriptionId: ${subscriptionId}`);

      const { data, error } = await supabaseAdmin
        .from('organizations')
        .update({
          plan: planName,
          dodo_customer_id: customerId,
          dodo_subscription_id: subscriptionId,
          // trial_ends_at: null, // Clear trial end date if applicable
        })
        .eq('id', organizationId);

      if (error) {
        console.error('Dodo Webhook: Error updating organization in Supabase:', error);
        return new Response('Failed to update organization', { status: 500 });
      }

      console.log('Dodo Webhook: Organization updated successfully:', data);
      return new Response('Webhook processed successfully', { status: 200 });

    } else if (event.type === 'subscription.cancelled' || event.type === 'checkout_session.expired') {
      const subscription = event.data.object;
      const customerId = subscription.customer_id || subscription.customer;
      const userId = subscription.metadata?.user_id;
      const organizationId = subscription.metadata?.organization_id;

      if (!customerId || !userId || !organizationId) {
        console.error('Dodo Webhook: Missing essential data for cancellation event.', { customerId, userId, organizationId });
        return new Response('Missing essential data for cancellation', { status: 400 });
      }

      console.log(`Dodo Webhook: Handling cancellation for organization ${organizationId}, customer ${customerId}. Setting plan to 'free'.`);

      const { data, error } = await supabaseAdmin
        .from('organizations')
        .update({
          plan: 'free',
          dodo_subscription_id: null, // Clear subscription ID
        })
        .eq('id', organizationId);

      if (error) {
        console.error('Dodo Webhook: Error updating organization on cancellation in Supabase:', error);
        return new Response('Failed to update organization on cancellation', { status: 500 });
      }

      console.log('Dodo Webhook: Organization plan downgraded to free successfully:', data);
      return new Response('Cancellation webhook processed successfully', { status: 200 });

    } else {
      console.log('Dodo Webhook: Unhandled event type:', event.type);
      return new Response('Unhandled event type', { status: 200 });
    }

  } catch (error: any) {
    console.error('Dodo Webhook: Top-level error:', error.message, 'Raw body:', rawBodyText);
    return new Response(`Internal Server Error: ${error.message}`, { status: 500 });
  }
});