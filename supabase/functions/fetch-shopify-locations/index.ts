import { createClient } from 'npm:@supabase/supabase-js';
import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
// Inlined corsHeaders definition to resolve module import error
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('Edge Function: fetch-shopify-locations - Invoked.');
  console.log('Full incoming request URL:', req.url);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let requestBody: any = {};
  const contentType = req.headers.get('content-type');

  if (contentType && contentType.includes('application/json')) {
    try {
      const textBody = await req.text(); // Read as text first
      if (textBody.trim() === '') {
        console.warn('Edge Function: Received Content-Type: application/json with empty body. Treating body as empty JSON object.');
        requestBody = {};
      } else {
        try {
          requestBody = JSON.parse(textBody); // Parse only if not empty
          console.log('Edge Function: Successfully parsed request body:', JSON.stringify(requestBody, null, 2));
        } catch (parseError: any) {
          console.error('Edge Function: JSON parse error for textBody:', textBody, 'Error:', parseError.message);
          return new Response(JSON.stringify({ error: `Failed to parse request data as JSON: ${parseError.message}. Raw body: ${textBody}` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        }
      }
    } catch (readError: any) {
      console.error('Edge Function: Error reading request body as text:', readError.message);
      return new Response(JSON.stringify({ error: `Failed to read request body: ${readError.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
  } else if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    console.error('Edge Function: Unsupported Content-Type or missing for a body-expecting method:', contentType);
    return new Response(JSON.stringify({ error: `Unsupported request format. Expected application/json for this method.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Edge Function: fetch-shopify-locations - Unauthorized: Authorization header missing.');
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
      console.error('Edge Function: fetch-shopify-locations - JWT verification failed or user not found:', userError?.message);
      return new Response(JSON.stringify({ error: `Unauthorized: ${userError?.message || 'User not authenticated.'}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }
    console.log('Edge Function: fetch-shopify-locations - Authenticated user ID:', user.id);

    console.log('Edge Function: fetch-shopify-locations - Fetching profile and organization data...');
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('organization_id, organizations(shopify_access_token, shopify_store_name)')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Edge Function: fetch-shopify-locations - Error fetching profile or organization data:', profileError);
      return new Response(JSON.stringify({ error: 'Failed to retrieve user or organization profile data.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    console.log('Edge Function: fetch-shopify-locations - Fetched profileData:', JSON.stringify(profileData, null, 2));

    if (!profileData || !profileData.organization_id) {
      console.error('Edge Function: fetch-shopify-locations - User profile or organization ID not found. ProfileData:', profileData);
      return new Response(JSON.stringify({ error: 'User profile or organization ID not found. Please ensure your company profile is set up.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    if (!profileData.organizations) {
      console.error('Edge Function: fetch-shopify-locations - profileData.organizations is null. This indicates a missing or unlinked organization record for ID:', profileData.organization_id);
      return new Response(JSON.stringify({ error: 'Organization record not found for your profile. This may indicate a data inconsistency. Please contact support.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const shopifyAccessToken = profileData.organizations.shopify_access_token;
    const shopifyStoreName = profileData.organizations.shopify_store_name;

    console.log('Edge Function: fetch-shopify-locations - shopifyAccessToken from DB:', shopifyAccessToken ? 'present' : 'missing');
    console.log('Edge Function: fetch-shopify-locations - shopifyStoreName from DB:', shopifyStoreName ? 'present' : 'missing');

    if (!shopifyAccessToken || !shopifyStoreName) {
      console.error('Edge Function: fetch-shopify-locations - Shopify access token or store name missing from organization record. Returning 400.');
      return new Response(JSON.stringify({ error: 'Shopify integration not fully set up. Please connect your Shopify store first.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const shopifyApiBaseUrl = `https://${shopifyStoreName}/admin/api/2024-07`;
    const headers = {
      'X-Shopify-Access-Token': shopifyAccessToken,
      'Content-Type': 'application/json',
    };

    console.log(`Edge Function: fetch-shopify-locations - Attempting to fetch from Shopify API: ${shopifyApiBaseUrl}/locations.json`);
    const shopifyResponse = await fetch(`${shopifyApiBaseUrl}/locations.json`, { headers });
    
    if (!shopifyResponse.ok) {
      const errorData = await shopifyResponse.json();
      console.error('Edge Function: fetch-shopify-locations - Shopify API error fetching locations:', errorData);
      throw new Error(`Failed to fetch locations from Shopify: ${errorData.errors || shopifyResponse.statusText}`);
    }
    const data = await shopifyResponse.json();
    const locations = data.locations.map((loc: any) => ({
      id: String(loc.id),
      name: loc.name,
      address: loc.address1,
      city: loc.city,
      province: loc.province,
      country: loc.country,
      active: loc.active,
    }));

    console.log('Edge Function: fetch-shopify-locations - Successfully fetched Shopify locations. Returning 200.');
    return new Response(JSON.stringify({ locations }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Edge Function: fetch-shopify-locations - Caught top-level error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});