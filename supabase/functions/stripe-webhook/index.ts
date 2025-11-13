import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js';
import Stripe from 'https://esm.sh/stripe@16.2.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
    apiVersion: '2024-06-20',
    httpClient: Stripe.createFetchHttpClient(),
  });

  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!webhookSecret) {
    return new Response('Stripe webhook secret not set.', { status: 500 });
  }

  let event: Stripe.Event;
  try {
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      throw new Error('Stripe signature header missing.');
    }
    const body = await req.text();
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    switch (event.type) {
      case 'product.created':
      case 'product.updated':
        const product = event.data.object as Stripe.Product;
        await supabaseAdmin.from('products').upsert({
          id: product.id,
          active: product.active,
          name: product.name,
          description: product.description,
          image: product.images[0] || null,
          metadata: product.metadata,
        });
        break;
      case 'price.created':
      case 'price.updated':
        const price = event.data.object as Stripe.Price;
        await supabaseAdmin.from('prices').upsert({
          id: price.id,
          product_id: price.product as string,
          active: price.active,
          unit_amount: price.unit_amount,
          currency: price.currency,
          type: price.type,
          interval: price.recurring?.interval || null,
          interval_count: price.recurring?.interval_count || null,
          trial_period_days: price.recurring?.trial_period_days || null,
          metadata: price.metadata,
        });
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        const subscription = event.data.object as Stripe.Subscription;
        const organizationId = subscription.metadata.organization_id;
        if (organizationId) {
          const priceId = subscription.items.data[0].price.id;
          const { data: priceData, error: priceError } = await supabaseAdmin
            .from('prices')
            .select('product_id')
            .eq('id', priceId)
            .single();

          if (priceError || !priceData) {
            console.error('Error fetching price data for subscription:', priceError);
            throw new Error('Price data not found for subscription.');
          }

          const { data: productData, error: productError } = await supabaseAdmin
            .from('products')
            .select('name')
            .eq('id', priceData.product_id)
            .single();

          if (productError || !productData) {
            console.error('Error fetching product data for subscription:', productError);
            throw new Error('Product data not found for subscription.');
          }

          await supabaseAdmin.from('organizations').update({
            stripe_customer_id: subscription.customer as string,
            stripe_subscription_id: subscription.id,
            plan: productData.name.toLowerCase(), // Assuming product name is the plan name
            trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
            perpetual_features: null, // Clear perpetual features if switching to subscription
            perpetual_license_version: null, // Clear perpetual license version
          }).eq('id', organizationId);
        }
        break;
      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object as Stripe.Subscription;
        const deletedOrganizationId = deletedSubscription.metadata.organization_id;
        if (deletedOrganizationId) {
          await supabaseAdmin.from('organizations').update({
            stripe_subscription_id: null,
            plan: 'free', // Revert to free plan
            trial_ends_at: null,
            perpetual_features: null, // Clear perpetual features if reverting to free
            perpetual_license_version: null, // Clear perpetual license version
          }).eq('id', deletedOrganizationId);
        }
        break;
      case 'checkout.session.completed':
        const checkoutSession = event.data.object as Stripe.Checkout.Session;
        const customerId = checkoutSession.customer as string;
        const organizationIdFromSession = checkoutSession.metadata?.organization_id;
        const productNameFromMetadata = checkoutSession.metadata?.product_name;
        const perpetualFeaturesString = checkoutSession.metadata?.perpetual_features; // NEW: Get perpetual features string
        const perpetualLicenseVersion = checkoutSession.metadata?.perpetual_license_version; // NEW: Get perpetual license version

        if (organizationIdFromSession) {
          const updatePayload: {
            stripe_customer_id?: string;
            plan?: string;
            stripe_subscription_id?: string | null;
            trial_ends_at?: string | null;
            perpetual_features?: string[] | null; // NEW: Add to update payload
            perpetual_license_version?: string | null; // NEW: Add to update payload
          } = {
            stripe_customer_id: customerId,
            stripe_subscription_id: null, // Ensure subscription ID is null for one-time payments
            trial_ends_at: null, // Ensure trial ends at is null for one-time payments
          };

          if (productNameFromMetadata) {
            updatePayload.plan = productNameFromMetadata.toLowerCase();
          }

          if (perpetualFeaturesString) { // NEW: If perpetual features are present
            try {
              updatePayload.perpetual_features = JSON.parse(perpetualFeaturesString);
              updatePayload.perpetual_license_version = perpetualLicenseVersion;
              // If a perpetual license is purchased, ensure plan reflects it
              updatePayload.plan = productNameFromMetadata ? productNameFromMetadata.toLowerCase() : 'perpetual';
            } catch (parseError) {
              console.error('Error parsing perpetual_features from metadata:', parseError);
            }
          } else {
            // If not a perpetual license, ensure these fields are cleared
            updatePayload.perpetual_features = null;
            updatePayload.perpetual_license_version = null;
          }

          await supabaseAdmin.from('organizations').update(updatePayload).eq('id', organizationIdFromSession);
        }
        break;
      default:
        console.warn(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Stripe webhook handler error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});