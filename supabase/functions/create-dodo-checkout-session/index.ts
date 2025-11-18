import { createClient } from 'npm:@supabase/supabase-js';
import { serve } from "https://deno.land/std@0.200.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  let rawBodyText = ''; // Declared at a higher scope
  const contentType = req.headers.get('content-type');

  // --- START: Global Error Handling for the entire Edge Function ---
  try {
    console.log('Edge Function: create-dodo-checkout-session - Invoked.');
    console.log('Edge Function: Request method:', req.method);
    console.log('Edge Function: Request headers:', JSON.stringify(Object.fromEntries(req.headers.entries()), null, 2));

    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    let requestBody: any = {};
    

    // Only attempt to read body for methods that are expected to have one
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      if (contentType && contentType.includes('application/json')) {
        try {
          requestBody = await req.json();
          console.log('Edge Function: Successfully parsed request body via req.json():', JSON.stringify(requestBody, null, 2));
        } catch (parseError: any) {
          // If req.json() fails, it might be due to empty body or malformed JSON
          // Try to read as text for better error logging
          try {
            rawBodyText = await req.text();
          } catch (textError) {
            console.warn('Edge Function: Could not read raw body text after req.json() failure:', textError);
          }

          if (parseError instanceof SyntaxError && rawBodyText.trim() === '') {
            console.warn('Edge Function: req.json() failed with SyntaxError on empty/whitespace body. Treating as empty JSON object.');
            requestBody = {}; // Treat empty body as empty JSON object
          } else {
            console.error('Edge Function: JSON parse error for textBody:', rawBodyText, 'Error:', parseError.message);
            return new Response(JSON.stringify({ error: `Failed to parse request data as JSON: ${parseError.message}. Raw body: ${rawBodyText}` }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400,
            });
          }
        }
      } else if (req.body) { // If there's a body but not JSON, try to read as text for logging
        try {
          rawBodyText = await req.text();
          console.warn('Edge Function: Received non-JSON body for POST/PUT/PATCH. Raw body:', rawBodyText);
        } catch (textError) {
          console.warn('Edge Function: Could not read raw body text for non-JSON body:', textError);
        }
        // For non-JSON bodies, requestBody remains {} or is handled by specific logic
      }
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
    console.log('Edge Function: DODO_API_KEY is', dodoApiKey ? 'present' : 'MISSING', `(length: ${dodoApiKey?.length || 0})`); // Added length check
    if (!dodoApiKey) {
      console.error('Edge Function: DODO_API_KEY environment variable is not set.');
      return new Response(JSON.stringify({ error: 'Server configuration error: Dodo API Key is missing.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const dodoCheckoutApiUrl = 'https://api.dodopayments.com/checkouts'; // Changed to LIVE Mode URL
    console.log('Edge Function: Using Dodo API URL:', dodoCheckoutApiUrl);


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

    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${dodoApiKey}`,
        'User-Agent': 'Fortress-Inventory-App/1.0 (Supabase-Edge-Function)',
        'Accept': 'application/json',
      },
      body: JSON.stringify(checkoutSessionPayload),
    };

    console.log('Edge Function: Outgoing Dodo API Request Details:');
    console.log('  URL:', dodoCheckoutApiUrl);
    console.log('  Method:', fetchOptions.method);
    console.log('  Headers:', JSON.stringify(fetchOptions.headers, null, 2));
    console.log('  Body:', fetchOptions.body);

    let dodoResponse: Response;
    try {
      dodoResponse = await fetch(dodoCheckoutApiUrl, fetchOptions);
      console.log('Edge Function: Dodo API response status:', dodoResponse.status);
      
      if (!dodoResponse.ok) {
        const errorText = await dodoResponse.text();
        console.error('Edge Function: Dodo API returned non-OK status. Raw error response:', errorText);
        
        const errorMessage = `Failed to create Dodo checkout session. Status: ${dodoResponse.status}. Details: ${errorText.substring(0, 200)}...`;
        
        return new Response(JSON.stringify({ error: errorMessage }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: dodoResponse.status,
        });
      }
    } catch (fetchError: any) {
      console.error('Edge Function: Error during fetch to Dodo API:', fetchError);
      return new Response(JSON.stringify({ error: `Network error connecting to Dodo API: ${fetchError.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
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
    return new Response(JSON.stringify({ error: error.message, rawBody: rawBodyText, contentType: contentType }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
  // --- END: Global Error Handling for the entire Edge Function ---
});