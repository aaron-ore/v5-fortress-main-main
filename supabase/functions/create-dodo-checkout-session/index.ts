import { createClient } from 'npm:@supabase/supabase-js';
import { serve } from "https://deno.land/std@0.200.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('Edge Function: create-dodo-checkout-session - Invoked.');
  console.log('Full incoming request URL:', req.url);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get('content-type');
    console.log('Edge Function: Received Content-Type header:', contentType);

    let requestBody;
    let rawBody = '';
    try {
      if (contentType && contentType.includes('application/json')) {
        rawBody = await req.text();
        console.log('Edge Function: Raw request body length:', rawBody.length);
        console.log('Edge Function: Raw request body (first 500 chars):', rawBody.substring(0, 500) + (rawBody.length > 500 ? '...' : ''));
        requestBody = JSON.parse(rawBody);
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

    const { dodoProductId, organizationId, userId } = requestBody;

    console.log('Edge Function: Extracted dodoProductId:', dodoProductId);
    console.log('Edge Function: Extracted organizationId:', organizationId);
    console.log('Edge Function: Extracted userId:', userId);

    if (!dodoProductId || !organizationId || !userId) {
      console.error('Edge Function: Missing required parameters after parsing. dodoProductId:', dodoProductId, 'organizationId:', organizationId, 'userId:', userId);
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
      console.error('Edge Function: Unauthorized: Authorization header missing.');
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
    console.log('Edge Function: User authenticated and matched:', user.id);

    const dodoApiKey = Deno.env.get('DODO_API_KEY');
    console.log('Edge Function: DODO_API_KEY is', dodoApiKey ? 'present' : 'MISSING');
    if (!dodoApiKey) {
      console.error('Edge Function: DODO_API_KEY environment variable is not set.');
      return new Response(JSON.stringify({ error: 'Server configuration error: Dodo API Key is missing.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Placeholder for Dodo API endpoint - **You will need to replace this with the actual Dodo API endpoint for creating checkout sessions.**
    const dodoCheckoutApiUrl = 'https://api.dodo.com/checkout-session'; 

    const clientAppBaseUrl = Deno.env.get('CLIENT_APP_BASE_URL');
    console.log('Edge Function: CLIENT_APP_BASE_URL is', clientAppBaseUrl ? 'present' : 'MISSING');
    if (!clientAppBaseUrl) {
      console.error('Edge Function: CLIENT_APP_BASE_URL environment variable is not set.');
      return new Response(JSON.stringify({ error: 'Server configuration error: CLIENT_APP_BASE_URL is missing.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const successUrl = `${clientAppBaseUrl}/billing?dodo_checkout_success=true`;
    const cancelUrl = `${clientAppBaseUrl}/billing?dodo_checkout_cancel=true`;

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

    console.log('Edge Function: Calling Dodo API with URL:', dodoCheckoutApiUrl);
    console.log('Edge Function: Dodo API Payload:', JSON.stringify(checkoutSessionPayload, null, 2));

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
      console.error('Edge Function: Dodo API response status:', dodoResponse.status);
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
    console.log('Edge Function: Successfully received Dodo checkout URL:', checkoutUrl);

    return new Response(JSON.stringify({ checkoutUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Edge Function error (caught at top level):', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});