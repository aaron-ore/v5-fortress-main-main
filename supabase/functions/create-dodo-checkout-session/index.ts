import { createClient } from 'npm:@supabase/supabase-js';
import { serve } from "https://deno.land/std@0.200.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Define a safe console wrapper to prevent 'console is not a function' errors
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
  let rawBodyText = ''; // Declared at a higher scope
  const contentType = req.headers.get('content-type');

  // --- START: Global Error Handling for the entire Edge Function ---
  try {
    safeConsole.log('Edge Function: create-dodo-checkout-session - Invoked.');
    safeConsole.log('Edge Function: Request method:', req.method);
    safeConsole.log('Edge Function: Request headers:', JSON.stringify(Object.fromEntries(req.headers.entries()), null, 2));

    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    let requestBody: any = {};
    

    // Only attempt to read body for methods that are expected to have one
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      if (contentType && contentType.includes('application/json')) {
        try {
          requestBody = await req.json();
          safeConsole.log('Edge Function: Successfully parsed request body via req.json():', JSON.stringify(requestBody, null, 2));
        } catch (parseError: any) {
          // If req.json() fails, it might be due to empty body or malformed JSON
          // Try to read as text for better error logging
          try {
            rawBodyText = await req.text();
          } catch (textError) {
            safeConsole.warn('Edge Function: Could not read raw body text after req.json() failure:', textError);
          }

          if (parseError instanceof SyntaxError && rawBodyText.trim() === '') {
            safeConsole.warn('Edge Function: req.json() failed with SyntaxError on empty/whitespace body. Treating as empty JSON object.');
            requestBody = {}; // Treat empty body as empty JSON object
          } else {
            safeConsole.error('Edge Function: JSON parse error for textBody:', rawBodyText, 'Error:', parseError.message);
            return new Response(JSON.stringify({ error: `Failed to parse request data as JSON: ${parseError.message}. Raw body: ${rawBodyText}` }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400,
            });
          }
        }
      } else if (req.body) { // If there's a body but not JSON, try to read as text for logging
        try {
          rawBodyText = await req.text();
          safeConsole.warn('Edge Function: Received non-JSON body for POST/PUT/PATCH. Raw body:', rawBodyText);
        } catch (textError) {
          safeConsole.warn('Edge Function: Could not read raw body text for non-JSON body:', textError);
        }
        // For non-JSON bodies, requestBody remains {} or is handled by specific logic
      }
    }

    const { dodoProductId, organizationId, userId } = requestBody; // MODIFIED: Removed returnUrl from destructuring

    safeConsole.log('Edge Function: Extracted dodoProductId:', dodoProductId);
    safeConsole.log('Edge Function: Extracted organizationId:', organizationId);
    safeConsole.log('Edge Function: Extracted userId:', userId);

    if (!dodoProductId || !organizationId || !userId) { // MODIFIED: returnUrl is no longer required here
      safeConsole.error('Edge Function: Missing required parameters after parsing. dodoProductId:', dodoProductId, 'organizationId:', organizationId, 'userId:', userId);
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
      safeConsole.error('Edge Function: Unauthorized: Authorization header missing.');
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
      safeConsole.error('Edge Function: JWT verification failed or user mismatch:', userError?.message || 'User not found or ID mismatch');
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or mismatched user token.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }
    safeConsole.log('Edge Function: User authenticated and matched:', user.id);

    const dodoApiKey = Deno.env.get('DODO_API_KEY');
    safeConsole.log('Edge Function: DODO_API_KEY is', dodoApiKey ? 'present' : 'MISSING', `(length: ${dodoApiKey?.length || 0})`);
    if (!dodoApiKey) {
      safeConsole.error('Edge Function: DODO_API_KEY environment variable is not set.');
      return new Response(JSON.stringify({ error: 'Server configuration error: Dodo API Key is missing.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const dodoApiBaseUrl = 'https://live.dodopayments.com'; 
    const dodoCheckoutApiUrl = `${dodoApiBaseUrl}/checkout-sessions`;
    safeConsole.log('Edge Function: Using Dodo API URL for checkout sessions:', dodoCheckoutApiUrl);

    safeConsole.log('Edge Function: Performing diagnostic GET request to Dodo /products endpoint...');
    try {
      const diagnosticDodoResponse = await fetch(`${dodoApiBaseUrl}/products`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${dodoApiKey}`,
          'User-Agent': 'Fortress-Diagnostic-Agent/1.0 (Supabase-Edge-Function)',
          'Accept': 'application/json',
        },
      });

      if (diagnosticDodoResponse.ok) {
        safeConsole.log('Edge Function: Diagnostic GET to Dodo /products SUCCESS. Status:', diagnosticDodoResponse.status);
      } else {
        const errorText = await diagnosticDodoResponse.text();
        safeConsole.error(`Edge Function: Diagnostic GET to Dodo /products FAILED with status ${diagnosticDodoResponse.status}. Response: ${errorText}`);
        return new Response(JSON.stringify({ error: `Dodo API Key validation failed (GET /products returned ${diagnosticDodoResponse.status}). Please check your Dodo API Key and its permissions. Details: ${errorText.substring(0, 200)}...` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }
    } catch (diagnosticDodoError: any) {
      safeConsole.error('Edge Function: Diagnostic GET to Dodo /products encountered NETWORK ERROR:', String(diagnosticDodoError));
      return new Response(JSON.stringify({ error: `Network error during Dodo API Key validation: ${String(diagnosticDodoError).substring(0, 200)}...` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }
    safeConsole.log('Edge Function: Diagnostic GET to Dodo /products complete.');

    // NEW: Construct return_url using CLIENT_APP_BASE_URL from environment variables
    const clientAppBaseUrl = Deno.env.get('CLIENT_APP_BASE_URL');
    if (!clientAppBaseUrl) {
      safeConsole.error('Edge Function: CLIENT_APP_BASE_URL environment variable is not set.');
      return new Response(JSON.stringify({ error: 'Server configuration error: CLIENT_APP_BASE_URL is missing.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }
    const constructedReturnUrl = `${clientAppBaseUrl}/billing?dodo_checkout_status={status}&organization_id=${organizationId}&user_id=${userId}`;
    safeConsole.log('Edge Function: Constructed return_url:', constructedReturnUrl);


    const checkoutSessionPayload = {
      product_cart: [{
        product_id: dodoProductId,
        quantity: 1,
      }],
      return_url: constructedReturnUrl, // MODIFIED: Use the internally constructed return_url
      metadata: {
        user_id: userId,
        organization_id: organizationId,
      },
    };

    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${dodoApiKey}`,
      },
      body: JSON.stringify(checkoutSessionPayload),
    };

    safeConsole.log('Edge Function: Outgoing Dodo API Request Details:');
    safeConsole.log('  URL:', dodoCheckoutApiUrl);
    safeConsole.log('  Method:', fetchOptions.method);
    safeConsole.log('  Headers:', JSON.stringify(fetchOptions.headers, null, 2));
    safeConsole.log('  Body:', fetchOptions.body);

    let dodoResponse: Response;
    try {
      dodoResponse = await fetch(dodoCheckoutApiUrl, fetchOptions);
      safeConsole.log('Edge Function: Dodo API response status:', dodoResponse.status);
      safeConsole.log('Edge Function: Dodo API response headers:', JSON.stringify(Object.fromEntries(dodoResponse.headers.entries()), null, 2));
      
      if (!dodoResponse.ok) {
        const errorText = await dodoResponse.text();
        safeConsole.error('Edge Function: Dodo API returned non-OK status. Raw error response:', errorText);
        
        const errorMessage = `Failed to create Dodo checkout session. Status: ${dodoResponse.status}. Details: ${errorText.substring(0, 200)}...`;
        
        return new Response(JSON.stringify({ error: errorMessage }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: dodoResponse.status,
        });
      }
    } catch (fetchError: any) {
      safeConsole.error('Edge Function: Error during fetch to Dodo API:', fetchError);
      return new Response(JSON.stringify({ error: `Network error connecting to Dodo API: ${fetchError.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const dodoSession = await dodoResponse.json();
    const checkoutUrl = dodoSession.checkout_url;

    if (!checkoutUrl) {
      safeConsole.error('Edge Function: Dodo API did not return a checkout URL.');
      return new Response(JSON.stringify({ error: 'Failed to get checkout URL from Dodo.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }
    safeConsole.log('Edge Function: Successfully received Dodo checkout URL:', checkoutUrl);

    return new Response(JSON.stringify({ checkoutUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    safeConsole.error('Edge Function error (caught at top level):', error);
    return new Response(JSON.stringify({ error: error.message, rawBody: rawBodyText, contentType: contentType }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});