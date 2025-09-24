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

    if (profileError || !profileData?.organization_id || !profileData.organizations?.shopify_access_token || !profileData.organizations?.shopify_store_name) {
      return new Response(JSON.stringify({ error: 'Shopify integration not fully set up for this user/organization.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const shopifyAccessToken = profileData.organizations.shopify_access_token;
    const shopifyStoreName = profileData.organizations.shopify_store_name;

    const shopifyApiBaseUrl = `https://${shopifyStoreName}/admin/api/2024-07`;
    const headers = {
      'X-Shopify-Access-Token': shopifyAccessToken,
      'Content-Type': 'application/json',
    };

    const shopifyResponse = await fetch(`${shopifyApiBaseUrl}/locations.json`, { headers });
    if (!shopifyResponse.ok) {
      const errorData = await shopifyResponse.json();
      console.error('Shopify API error fetching locations:', errorData);
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
    console.error('Edge Function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});