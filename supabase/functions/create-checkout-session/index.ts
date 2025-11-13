import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
import { createClient } 'npm:@supabase/supabase-js';
import Stripe from 'https://esm.sh/stripe@16.2.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Edge Function: Incoming request headers:', JSON.stringify(Object.fromEntries(req.headers.entries()), null, 2));
    const contentType = req.headers.get('content-type');
    console.log('Edge Function: Content-Type header:', contentType);

    let requestBody;
    let rawBody = '';
    try {
      if (contentType && contentType.includes('application/json')) {
        rawBody = await req.text(); // Read as text first
        console.log('Edge Function: Raw request body length:', rawBody.length);
        console.log('Edge Function: Raw request body (first 500 chars):', rawBody.substring(0, 500) + (rawBody.length > 500 ? '...' : ''));
        requestBody = JSON.parse(rawBody); // Then parse manually
        console.log('Edge Function: Parsed request body:', JSON.stringify(requestBody, null, 2));
      } else {
        throw new Error(`Unsupported Content-Type: ${contentType || 'none'}. Expected application/json.`);
      }
    } catch (parseError: any) {
      console.error('Edge Function: ERROR during JSON parsing:', parseError.message);
      console.error('Edge Function: Raw body that failed to parse:', rawBody);
      return new Response(JSON.stringify({ error: `Failed to parse request body as JSON: ${parseError.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const { priceId, organizationId, mode, trial_period_days, perpetualFeatures, perpetualLicenseVersion } = requestBody; // NEW: Destructure perpetualFeatures and perpetualLicenseVersion
    console.log('Edge Function: Extracted priceId:', priceId);
    console.log('Edge Function: Extracted organizationId:', organizationId);
    console.log('Edge Function: Extracted mode:', mode);
    console.log('Edge Function: Extracted trial_period_days:', trial_period_days);
    console.log('Edge Function: Extracted perpetualFeatures:', perpetualFeatures); // NEW: Log perpetualFeatures
    console.log('Edge Function: Extracted perpetualLicenseVersion:', perpetualLicenseVersion); // NEW: Log perpetualLicenseVersion

    if (!priceId || !organizationId || !mode) {
      console.error('Edge Function: Missing required parameters after extraction. priceId:', priceId, 'organizationId:', organizationId, 'mode:', mode);
      return new Response(JSON.stringify({ error: 'Missing required parameters: priceId, organizationId, mode.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Authorization header missing.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }
    const token = authHeader.split(' ')[1];

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.error('Edge Function: JWT verification failed or user not found:', userError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or mismatched user token.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Fetch organization to get existing Stripe Customer ID
    const { data: organization, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('stripe_customer_id')
      .eq('id', organizationId)
      .single();

    if (orgError) {
      console.error('Error fetching organization:', orgError);
      return new Response(JSON.stringify({ error: 'Failed to fetch organization details.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    let customerId = organization?.stripe_customer_id;

    if (!customerId) {
      // If no customer ID, create a new Stripe customer
      const { data: profileData, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('email, full_name')
        .eq('id', user.id)
        .single();

      if (profileError || !profileData) {
        console.error('Error fetching user profile:', profileError);
        return new Response(JSON.stringify({ error: 'Failed to fetch user profile for Stripe customer creation.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }

      const customer = await stripe.customers.create({
        email: profileData.email,
        name: profileData.full_name || profileData.email,
        metadata: {
          supabase_user_id: user.id,
          organization_id: organizationId,
        },
      });
      customerId = customer.id;

      // Update organization with new Stripe customer ID
      await supabaseAdmin.from('organizations').update({ stripe_customer_id: customerId }).eq('id', organizationId);
    }

    const checkoutSessionConfig: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      success_url: `${req.headers.get('referer')}billing?stripe_success=true`,
      cancel_url: `${req.headers.get('referer')}billing?stripe_cancel=true`,
      metadata: {
        organization_id: organizationId,
      },
    };

    if (mode === 'subscription') {
      checkoutSessionConfig.mode = 'subscription';
      checkoutSessionConfig.subscription_data = {
        trial_period_days: trial_period_days || undefined,
      };
    } else if (mode === 'payment') {
      checkoutSessionConfig.mode = 'payment';
      const { data: priceData, error: priceError } = await supabaseAdmin
        .from('prices')
        .select('product_id')
        .eq('id', priceId)
        .single();

      if (priceError || !priceData) {
        console.error('Error fetching price data for one-time payment:', priceError);
        return new Response(JSON.stringify({ error: 'Failed to fetch price details for one-time payment.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }

      const { data: productData, error: productError } = await supabaseAdmin
        .from('products')
        .select('name')
        .eq('id', priceData.product_id)
        .single();

      if (productError || !productData) {
        console.error('Error fetching product data for one-time payment:', productError);
        return new Response(JSON.stringify({ error: 'Failed to fetch product details for one-time payment.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }
      checkoutSessionConfig.metadata = {
        ...checkoutSessionConfig.metadata,
        product_name: productData.name, // Store product name for webhook
        perpetual_features: perpetualFeatures ? JSON.stringify(perpetualFeatures) : undefined, // NEW: Store perpetual features
        perpetual_license_version: perpetualLicenseVersion || undefined, // NEW: Store perpetual license version
      };
    } else {
      return new Response(JSON.stringify({ error: 'Invalid mode specified. Must be "subscription" or "payment".' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const checkoutSession = await stripe.checkout.sessions.create(checkoutSessionConfig);

    return new Response(JSON.stringify({ sessionId: checkoutSession.id, url: checkoutSession.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});