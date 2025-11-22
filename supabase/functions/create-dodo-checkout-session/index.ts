import { createClient } from 'npm:@supabase/supabase-js';
import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
import { DodoPayments } from 'dodopayments';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  let rawBodyText = '';
  const contentType = req.headers.get('content-type');

  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    let requestBody: any = {};
    if (contentType && contentType.includes('application/json')) {
      try {
        requestBody = await req.json();
      } catch (parseError: any) {
        try {
          rawBodyText = await req.text();
        } catch (textError) {
          console.warn('Edge Function: Could not read raw body text after req.json() failure:', textError);
        }
        if (parseError instanceof SyntaxError && rawBodyText.trim() === '') {
          requestBody = {};
        } else {
          return new Response(JSON.stringify({ error: `Failed to parse request data as JSON: ${parseError.message}. Raw body: ${rawBodyText}` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        }
      }
    }

    const { productId, variantId, organizationId, userId, customerEmail, customerName, redirectTo } = requestBody;

    if (!productId || !variantId || !organizationId || !userId || !customerEmail || !customerName || !redirectTo) {
      return new Response(JSON.stringify({ error: 'Missing required parameters: productId, variantId, organizationId, userId, customerEmail, customerName, redirectTo.' }), {
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
      console.error('Edge Function: JWT verification failed or user mismatch:', userError?.message || 'User not found');
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or mismatched user token.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const dodoApiKey = Deno.env.get('DODO_API_KEY');
    if (!dodoApiKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error: DODO_API_KEY is missing.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const dodo = new DodoPayments(dodoApiKey);

    // Check if customer already exists in Dodo
    let dodoCustomerId = null;
    const { data: existingOrg, error: orgFetchError } = await supabaseAdmin
      .from('organizations')
      .select('dodo_customer_id')
      .eq('id', organizationId)
      .single();

    if (orgFetchError && orgFetchError.code !== 'PGRST116') { // PGRST116 means no rows found
      console.error('Error fetching organization for Dodo customer ID:', orgFetchError);
      throw new Error('Failed to fetch organization data.');
    }

    if (existingOrg?.dodo_customer_id) {
      dodoCustomerId = existingOrg.dodo_customer_id;
      console.log('Existing Dodo customer ID found:', dodoCustomerId);
    } else {
      // Create customer in Dodo if not found
      console.log('Creating new Dodo customer...');
      const customer = await dodo.customers.create({
        email: customerEmail,
        name: customerName,
        // You can add more customer details here if needed
      });
      dodoCustomerId = customer.id;
      console.log('New Dodo customer created:', dodoCustomerId);

      // Save Dodo customer ID to your organization table
      const { error: updateOrgError } = await supabaseAdmin
        .from('organizations')
        .update({ dodo_customer_id: dodoCustomerId })
        .eq('id', organizationId);

      if (updateOrgError) {
        console.error('Error saving Dodo customer ID to organization:', updateOrgError);
        throw new Error('Failed to save Dodo customer ID.');
      }
    }

    const checkoutSession = await dodo.checkout.create({
      product_id: productId,
      variant_id: variantId,
      customer_id: dodoCustomerId,
      redirect_url: `${redirectTo}?dodo_checkout_status={checkout_status}&organization_id=${organizationId}&user_id=${userId}`,
      // You can add custom data here to be passed through the webhook
      metadata: {
        organization_id: organizationId,
        user_id: userId,
        plan_id: variantId, // Assuming variantId maps to a plan
      },
    });

    return new Response(JSON.stringify({ checkoutUrl: checkoutSession.url }), {
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
});