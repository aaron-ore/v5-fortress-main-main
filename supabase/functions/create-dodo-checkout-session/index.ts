import { createClient } from 'npm:@supabase/supabase-js';
import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
import { DodoPayments } from 'npm:dodopayments'; // Add this import

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
    safeConsole.log('Edge Function: create-dodo-checkout-session - Invoked.');
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

    const { dodoProductId, organizationId, userId } = requestBody;

    safeConsole.log('Edge Function: Extracted dodoProductId:', dodoProductId);
    safeConsole.log('Edge Function: Extracted organizationId:', organizationId);
    safeConsole.log('Edge Function: Extracted userId:', userId);

    if (!dodoProductId || !organizationId || !userId) {
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

    const dodoPaymentsClient = new DodoPayments({
      bearerToken: dodoApiKey,
    });

    // Fetch organization details to get existing dodo_customer_id
    const { data: organizationDetails, error: orgDetailsError } = await supabaseAdmin
      .from('organizations')
      .select('id, dodo_customer_id')
      .eq('id', organizationId)
      .single();

    if (orgDetailsError || !organizationDetails) {
      safeConsole.error('Edge Function: Organization not found for ID:', organizationId, orgDetailsError?.message);
      return new Response(JSON.stringify({ error: 'Organization not found for the current user.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    let currentDodoCustomerId = organizationDetails.dodo_customer_id;

    if (!currentDodoCustomerId) {
      safeConsole.log('Edge Function: No existing Dodo Customer ID for organization. Creating a new Dodo customer.');
      // Create a Dodo customer
      const { data: dodoCustomer, error: createDodoCustomerError } = await dodoPaymentsClient.customers.create({
        email: user.email, // Use the authenticated user's email
        name: user.user_metadata.full_name || user.email, // Use user's full name or email
        // You can add more metadata here if needed, e.g., organizationId
        metadata: {
          organization_id: organizationId,
          user_id: userId,
        }
      });

      if (createDodoCustomerError) {
        safeConsole.error('Edge Function: Error creating Dodo customer:', createDodoCustomerError);
        return new Response(JSON.stringify({ error: `Failed to create Dodo customer: ${createDodoCustomerError.message}` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }

      currentDodoCustomerId = dodoCustomer.customer_id;
      safeConsole.log('Edge Function: New Dodo Customer created with ID:', currentDodoCustomerId);

      // Update our organization record with the new Dodo Customer ID
      const { error: updateOrgError } = await supabaseAdmin
        .from('organizations')
        .update({ dodo_customer_id: currentDodoCustomerId })
        .eq('id', organizationId);

      if (updateOrgError) {
        safeConsole.error('Edge Function: Error updating organization with new Dodo Customer ID:', updateOrgError);
        return new Response(JSON.stringify({ error: `Failed to link Dodo customer to organization: ${updateOrgError.message}` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }
      safeConsole.log('Edge Function: Organization updated with new Dodo Customer ID.');
    } else {
      safeConsole.log('Edge Function: Existing Dodo Customer ID found:', currentDodoCustomerId);
    }

    // Determine the correct Dodo product ID based on the requested plan
    let actualDodoProductId: string | undefined;
    if (dodoProductId === 'pdt_uB7ZQurvsyNW3y7s5x0qk') { // Standard plan
      actualDodoProductId = Deno.env.get('DODO_PRODUCT_ID_STANDARD');
    } else if (dodoProductId === 'pdt_xFu2HtpLC550GY0EnRCPk') { // Pro plan
      actualDodoProductId = Deno.env.get('DODO_PRODUCT_ID_PRO');
    } else {
      safeConsole.error('Edge Function: Invalid or unknown dodoProductId received:', dodoProductId);
      return new Response(JSON.stringify({ error: 'Invalid Dodo product ID provided.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    if (!actualDodoProductId) {
      safeConsole.error(`Edge Function: Dodo Product ID for ${dodoProductId} is not configured in environment variables.`);
      return new Response(JSON.stringify({ error: `Server configuration error: Dodo Product ID for ${dodoProductId} is missing.` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const dodoCheckoutApiUrl = `https://test.checkout.dodopayments.com/buy/${actualDodoProductId}`; // Use the actual product ID

    let clientAppBaseUrl = Deno.env.get('CLIENT_APP_BASE_URL');
    if (!clientAppBaseUrl) {
      safeConsole.error('Edge Function: CLIENT_APP_BASE_URL environment variable is not set.');
      return new Response(JSON.stringify({ error: 'Server configuration error: CLIENT_APP_BASE_URL is missing.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    clientAppBaseUrl = clientAppBaseUrl.trim();
    if (clientAppBaseUrl.endsWith('/')) {
      clientAppBaseUrl = clientAppBaseUrl.slice(0, -1);
    }
    safeConsole.log('Edge Function: Sanitized CLIENT_APP_BASE_URL:', clientAppBaseUrl);

    const returnUrl = `${clientAppBaseUrl}/billing?dodo_checkout_status={status}&organization_id=${organizationId}&user_id=${userId}`;
    // Pass the currentDodoCustomerId to Dodo checkout
    const checkoutUrl = `${dodoCheckoutApiUrl}?customer_id=${currentDodoCustomerId}&quantity=1&passthrough[user_id]=${userId}&passthrough[organization_id]=${organizationId}&return_url=${encodeURIComponent(returnUrl)}`;

    safeConsole.log('Edge Function: Constructed Dodo checkout URL:', checkoutUrl);

    return new Response(JSON.stringify({ checkoutUrl: checkoutUrl }), {
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