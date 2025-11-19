import { createClient } from 'npm:@supabase/supabase-js';
import { serve } from "https://deno.land/std@0.200.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  let rawBodyText = '';
  const contentType = req.headers.get('content-type');

  try {
    safeConsole.log('Edge Function: create-lemon-squeezy-checkout-session - Invoked.');
    safeConsole.log('Edge Function: Request method:', req.method);
    safeConsole.log('Edge Function: Request headers:', JSON.stringify(Object.fromEntries(req.headers.entries()), null, 2));

    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    let requestBody: any = {};
    
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      if (contentType && contentType.includes('application/json')) {
        try {
          requestBody = await req.json();
          safeConsole.log('Edge Function: Successfully parsed request body via req.json():', JSON.stringify(requestBody, null, 2));
        } catch (parseError: any) {
          try {
            rawBodyText = await req.text();
          } catch (textError) {
            safeConsole.warn('Edge Function: Could not read raw body text after req.json() failure:', textError);
          }

          if (parseError instanceof SyntaxError && rawBodyText.trim() === '') {
            safeConsole.warn('Edge Function: req.json() failed with SyntaxError on empty/whitespace body. Treating as empty JSON object.');
            requestBody = {};
          } else {
            safeConsole.error('Edge Function: JSON parse error for textBody:', rawBodyText, 'Error:', parseError.message);
            return new Response(JSON.stringify({ error: `Failed to parse request data as JSON: ${parseError.message}. Raw body: ${rawBodyText}` }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400,
            });
          }
        }
      } else if (req.body) {
        try {
          rawBodyText = await req.text();
          safeConsole.warn('Edge Function: Received non-JSON body for POST/PUT/PATCH. Raw body:', rawBodyText);
        } catch (textError) {
          safeConsole.warn('Edge Function: Could not read raw body text for non-JSON body:', textError);
        }
      }
    }

    const { lemonSqueezyProductId, organizationId, userId } = requestBody;

    safeConsole.log('Edge Function: Extracted lemonSqueezyProductId:', lemonSqueezyProductId);
    safeConsole.log('Edge Function: Extracted organizationId:', organizationId);
    safeConsole.log('Edge Function: Extracted userId:', userId);

    if (!lemonSqueezyProductId || !organizationId || !userId) {
      safeConsole.error('Edge Function: Missing required parameters after parsing. lemonSqueezyProductId:', lemonSqueezyProductId, 'organizationId:', organizationId, 'userId:', userId);
      return new Response(JSON.stringify({ error: 'Missing required parameters: lemonSqueezyProductId, organizationId, userId.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Convert product_id to a number as required by Lemon Squeezy API
    const numericProductId = Number(lemonSqueezyProductId);
    if (isNaN(numericProductId)) {
      safeConsole.error('Edge Function: Invalid lemonSqueezyProductId. Expected a number, received:', lemonSqueezyProductId);
      return new Response(JSON.stringify({ error: 'Invalid product ID provided. Must be a valid number.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    safeConsole.log('Edge Function: Using numericProductId for Lemon Squeezy API:', numericProductId);


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

    const lemonSqueezyApiKey = Deno.env.get('LEMON_SQUEEZY_API_KEY');
    safeConsole.log('Edge Function: LEMON_SQUEEZY_API_KEY is', lemonSqueezyApiKey ? 'present' : 'MISSING', `(length: ${lemonSqueezyApiKey?.length || 0})`);
    if (!lemonSqueezyApiKey) {
      safeConsole.error('Edge Function: LEMON_SQUEEZY_API_KEY environment variable is not set.');
      return new Response(JSON.stringify({ error: 'Server configuration error: Lemon Squeezy API Key is missing.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const lemonSqueezyApiBaseUrl = 'https://api.lemonsqueezy.com/v1';
    const lemonSqueezyCheckoutApiUrl = `${lemonSqueezyApiBaseUrl}/checkouts`;
    safeConsole.log('Edge Function: Using Lemon Squeezy API URL for checkouts:', lemonSqueezyCheckoutApiUrl);

    let clientAppBaseUrl = Deno.env.get('CLIENT_APP_BASE_URL');
    if (!clientAppBaseUrl) {
      safeConsole.error('Edge Function: CLIENT_APP_BASE_URL environment variable is not set.');
      return new Response(JSON.stringify({ error: 'Server configuration error: CLIENT_APP_BASE_URL is missing.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // --- EXTREME MEASURE: Sanitize CLIENT_APP_BASE_URL ---
    clientAppBaseUrl = clientAppBaseUrl.trim(); // Remove leading/trailing whitespace
    if (clientAppBaseUrl.endsWith('/')) {
      clientAppBaseUrl = clientAppBaseUrl.slice(0, -1); // Remove trailing slash
    }
    safeConsole.log('Edge Function: Sanitized CLIENT_APP_BASE_URL:', clientAppBaseUrl);

    const constructedReturnUrl = `${clientAppBaseUrl}/billing?lemon_squeezy_checkout_status={status}`;
    safeConsole.log('Edge Function: Constructed return_url:', constructedReturnUrl);

    const checkoutSessionPayload = {
      data: {
        type: "checkouts",
        attributes: {
          product_id: numericProductId,
          checkout_data: {
            custom: {
              user_id: userId,
              organization_id: organizationId,
            },
            product_options: { // Correct nesting for redirect_url
              redirect_url: constructedReturnUrl,
            },
          },
        },
      },
    };

    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/vnd.api+json',
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${lemonSqueezyApiKey}`,
      },
      body: JSON.stringify(checkoutSessionPayload),
    };

    safeConsole.log('Edge Function: Outgoing Lemon Squeezy API Request Details:');
    safeConsole.log('  URL:', lemonSqueezyCheckoutApiUrl);
    safeConsole.log('  Method:', fetchOptions.method);
    safeConsole.log('  Headers:', JSON.stringify(fetchOptions.headers, null, 2));
    safeConsole.log('  Body:', fetchOptions.body);

    let lemonSqueezyResponse: Response;
    try {
      lemonSqueezyResponse = await fetch(lemonSqueezyCheckoutApiUrl, fetchOptions);
      safeConsole.log('Edge Function: Lemon Squeezy API response status:', lemonSqueezyResponse.status);
      safeConsole.log('Edge Function: Lemon Squeezy API response headers:', JSON.stringify(Object.fromEntries(lemonSqueezyResponse.headers.entries()), null, 2));
      
      if (!lemonSqueezyResponse.ok) {
        const errorText = await lemonSqueezyResponse.text();
        safeConsole.error('Edge Function: Lemon Squeezy API returned non-OK status. Raw error response:', errorText);
        
        const errorMessage = `Failed to create Lemon Squeezy checkout session. Status: ${lemonSqueezyResponse.status}. Details: ${errorText.substring(0, 200)}...`;
        
        return new Response(JSON.stringify({ error: errorMessage }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: lemonSqueezyResponse.status,
        });
      }
    } catch (fetchError: any) {
      safeConsole.error('Edge Function: Error during fetch to Lemon Squeezy API:', fetchError);
      return new Response(JSON.stringify({ error: `Network error connecting to Lemon Squeezy API: ${fetchError.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const lemonSqueezySession = await lemonSqueezyResponse.json();
    const checkoutUrl = lemonSqueezySession.data.attributes.url;

    if (!checkoutUrl) {
      safeConsole.error('Edge Function: Lemon Squeezy API did not return a checkout URL.');
      return new Response(JSON.stringify({ error: 'Failed to get checkout URL from Lemon Squeezy.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }
    safeConsole.log('Edge Function: Successfully received Lemon Squeezy checkout URL:', checkoutUrl);

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