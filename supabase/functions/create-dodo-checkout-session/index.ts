import { createClient } from 'npm:@supabase/supabase-js';
import { serve } from "https://deno.land/std@0.200.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('Edge Function: create-dodo-checkout-session - Invoked.');
  console.log('Edge Function: Request method:', req.method);
  console.log('Edge Function: Request headers:', JSON.stringify(Object.fromEntries(req.headers.entries()), null, 2));

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let requestBody: any = {}; // Initialize as empty object to ensure it's always defined

  try {
    const contentType = req.headers.get('content-type');
    const contentLength = req.headers.get('content-length'); // NEW: Get Content-Length header
    console.log('Edge Function: Received Content-Type header:', contentType);
    console.log('Edge Function: Received Content-Length header:', contentLength);

    if (contentType && contentType.includes('application/json')) {
      if (contentLength === '0') { // NEW: Handle empty body explicitly
        console.warn('Edge Function: Received Content-Type: application/json with Content-Length: 0. Treating body as empty JSON object.');
        requestBody = {}; // Explicitly set to empty object
      } else if (req.body) { // NEW: Check if req.body is not null/undefined
        let rawBody = '';
        try {
          const buffer = await req.arrayBuffer(); // Try arrayBuffer
          if (buffer.byteLength > 0) {
            rawBody = new TextDecoder().decode(buffer);
          }
        } catch (bufferError: any) {
          console.warn('Edge Function: Error reading request body as ArrayBuffer:', bufferError.message);
          // If reading buffer fails, treat as empty body
        }

        if (rawBody.trim()) { // Only attempt JSON.parse if there's actual non-whitespace content
          try {
            requestBody = JSON.parse(rawBody);
            console.log('Edge Function: Successfully parsed request body:', JSON.stringify(requestBody, null, 2));
          } catch (parseError: any) {
            console.error('Edge Function: JSON parse error:', parseError.message, 'Raw body that failed to parse:', rawBody);
            return new Response(JSON.stringify({ error: `Failed to parse request data as JSON: ${parseError.message}` }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400,
            });
          }
        } else {
          console.warn('Edge Function: Received empty or whitespace-only JSON body after ArrayBuffer. Proceeding with empty requestBody.');
          // requestBody remains {} as initialized, which will lead to missing parameter errors later
        }
      } else { // NEW: Handle case where req.body is null/undefined
        console.warn('Edge Function: Content-Type: application/json but req.body is null/undefined. Proceeding with empty requestBody.');
      }
    } else {
      console.error('Edge Function: Unsupported Content-Type:', contentType);
      return new Response(JSON.stringify({ error: `Unsupported request format. Expected application/json.` }), {
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

    const dodoCheckoutApiUrl = 'https://test.dodopayments.com/checkouts'; // Using Test Mode URL as per documentation

    const clientAppBaseUrl = Deno.env.get('CLIENT_APP_BASE_URL');
    console.log('Edge Function: CLIENT_APP_BASE_URL is', clientAppBaseUrl ? 'present' : 'MISSING');
    if (!clientAppBaseUrl) {
      console.error('Edge Function: CLIENT_APP_BASE_URL environment variable is not set.');
      return new Response(JSON.stringify({ error: 'Server configuration error: CLIENT_APP_BASE_URL is missing.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const returnUrl = `${clientAppBaseUrl}/billing?dodo_checkout_status={status}&organization_id=${organizationId}&user_id=${userId}`;

    const checkoutSessionPayload = {
      product_cart: [{
        product_id: dodoProductId,
        quantity: 1,
      }],
      customer: {
        email: user.email,
        name: user.user_metadata.full_name || user.email,
      },
      confirm: true,
      return_url: returnUrl,
      metadata: {
        organization_id: organizationId,
        user_id: userId,
      },
      allowed_payment_method_types: ['credit', 'debit'],
    };

    console.log('Edge Function: Calling Dodo API with URL:', dodoCheckoutApiUrl);
    console.log('Edge Function: Dodo API Payload:', JSON.stringify(checkoutSessionPayload, null, 2));

    const dodoResponse = await fetch(dodoCheckoutApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${dodoApiKey}`,
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
    const checkoutUrl = dodoSession.checkout_url;

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