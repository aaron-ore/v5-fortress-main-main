import { createClient } from 'npm:@supabase/supabase-js';
import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
// Inlined corsHeaders definition to resolve module import error
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
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

    if (!profileData || !profileData.organization_id) {
      console.error('Edge Function: fetch-shopify-locations - User profile or organization ID not found. ProfileData:', profileData);
      return new Response(JSON.stringify({ error: 'User profile or organization ID not found. Please ensure your company profile is set up.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    if (!profileData.organizations) {
      console.error('Edge Function: fetch-shopify-locations - Organization data is null, indicating a missing organization record for ID:', profileData.organization_id);
      return new Response(JSON.stringify({ error: 'Organization record not found for your profile. This may indicate a data inconsistency. Please contact support.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const shopifyAccessToken = profileData.organizations.shopify_access_token;
    const shopifyStoreName = profileData.organizations.shopify_store_name;

    if (!shopifyAccessToken || !shopifyStoreName) {
      console.error('Edge Function: fetch-shopify-locations - Shopify access token or store name missing. Tokens:', shopifyAccessToken ? 'present' : 'missing', 'Store Name:', shopifyStoreName ? 'present' : 'missing');
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
      // If Shopify returns an empty list of locations, it's still a 200 OK.
      // This error block is for non-2xx responses from Shopify.
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