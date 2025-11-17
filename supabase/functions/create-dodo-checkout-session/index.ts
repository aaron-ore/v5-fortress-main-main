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

  try {
    const { dodoProductId, organizationId, userId } = await req.json();

    if (!dodoProductId || !organizationId || !userId) {
      return new Response(JSON.stringify({ error: 'Missing required parameters: dodoProductId, organizationId, userId.' }), {
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

    if (userError || !user || user.id !== userId) {
      console.error('Edge Function: JWT verification failed or user mismatch:', userError?.message || 'User not found or ID mismatch');
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or mismatched user token.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const dodoApiKey = Deno.env.get('DODO_API_KEY');
    if (!dodoApiKey) {
      console.error('Edge Function: DODO_API_KEY environment variable is not set.');
      return new Response(JSON.stringify({ error: 'Server configuration error: Dodo API Key is missing.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Placeholder for Dodo API endpoint - **You will need to replace this with the actual Dodo API endpoint for creating checkout sessions.**
    const dodoCheckoutApiUrl = 'https://api.dodo.com/checkout-session'; 

    const successUrl = `${Deno.env.get('CLIENT_APP_BASE_URL')}/billing?dodo_checkout_success=true`;
    const cancelUrl = `${Deno.env.get('CLIENT_APP_BASE_URL')}/billing?dodo_checkout_cancel=true`;

    const checkoutSessionPayload = {
      product_id: dodoProductId,
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: user.email, // Pass user's email to Dodo
      metadata: {
        organization_id: organizationId,
        user_id: userId,
      },
    };

    console.log('Edge Function: Calling Dodo API with payload:', JSON.stringify(checkoutSessionPayload, null, 2));

    const dodoResponse = await fetch(dodoCheckoutApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${dodoApiKey}`, // Use Dodo API Key
      },
      body: JSON.stringify(checkoutSessionPayload),
    });

    if (!dodoResponse.ok) {
      const errorData = await dodoResponse.json();
      console.error('Edge Function: Dodo API error creating checkout session:', errorData);
      return new Response(JSON.stringify({ error: `Failed to create Dodo checkout session: ${errorData.message || 'Unknown error'}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: dodoResponse.status,
      });
    }

    const dodoSession = await dodoResponse.json();
    const checkoutUrl = dodoSession.checkout_url; // Assuming Dodo returns a checkout_url

    if (!checkoutUrl) {
      console.error('Edge Function: Dodo API did not return a checkout URL.');
      return new Response(JSON.stringify({ error: 'Failed to get checkout URL from Dodo.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    return new Response(JSON.stringify({ checkoutUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Edge Function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});