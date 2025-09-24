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
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');
    const shop = url.searchParams.get('shop');

    console.log('Shopify OAuth Callback: All URL search parameters:', JSON.stringify(Object.fromEntries(url.searchParams.entries()), null, 2));

    let userId: string | null = null;
    let redirectToFrontend: string | null = null;
    const FALLBACK_CLIENT_APP_BASE_URL = 'https://v4-fortress-main.vercel.app';

    if (state) {
      try {
        const decodedState = JSON.parse(atob(state));
        userId = decodedState.userId;
        redirectToFrontend = decodedState.redirectToFrontend;
        console.log('Shopify OAuth Callback: Decoded state - userId:', userId, 'redirectToFrontend:', redirectToFrontend);
      } catch (e) {
        console.error('Error decoding state parameter:', e);
      }
    }
    const finalRedirectBase = redirectToFrontend || FALLBACK_CLIENT_APP_BASE_URL;

    if (error) {
      console.error('Shopify OAuth Error:', error, errorDescription);
      return Response.redirect(`${finalRedirectBase}/integrations?shopify_error=${encodeURIComponent(errorDescription || error)}`, 302);
    }

    if (!code || !userId) {
      console.error('Missing authorization code or userId in Shopify OAuth callback.');
      return Response.redirect(`${finalRedirectBase}/integrations?shopify_error=${encodeURIComponent('Missing authorization code or user ID.')}`, 302);
    }

    const SHOPIFY_CLIENT_ID = Deno.env.get('SHOPIFY_CLIENT_ID');
    const SHOPIFY_CLIENT_SECRET = Deno.env.get('SHOPIFY_CLIENT_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing Supabase or Shopify environment variables.');
      return new Response(JSON.stringify({ error: 'Server configuration error: Missing environment variables.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const redirectUri = `https://nojumocxivfjsbqnnkqe.supabase.co/functions/v1/shopify-oauth-callback`;
    console.log('Using redirectUri for token exchange:', redirectUri);

    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: SHOPIFY_CLIENT_ID,
        client_secret: SHOPIFY_CLIENT_SECRET,
        code: code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Error exchanging Shopify code for tokens:', errorData);
      return Response.redirect(`${finalRedirectBase}/integrations?shopify_error=${encodeURIComponent(errorData.error_description || 'Failed to get Shopify tokens.')}`, 302);
    }

    const tokens = await tokenResponse.json();
    console.log('Shopify OAuth Callback: Full tokens object received:', JSON.stringify(tokens, null, 2));

    const accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token;
    const shopDomain = shop;

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify the user's token using a client initialized with the anon key
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`, // Use the newly acquired access token for verification
          },
        },
      }
    );

    const { data: { user }, error: userVerificationError } = await supabaseClient.auth.getUser();

    if (userVerificationError || !user || user.id !== userId) {
      console.error('Shopify OAuth Callback: JWT verification failed or user mismatch:', userVerificationError?.message || 'User not found or ID mismatch');
      return Response.redirect(`${finalRedirectBase}/integrations?shopify_error=${encodeURIComponent('Authentication mismatch. Please try again.')}`, 302);
    }

    const { data: userProfile, error: profileFetchError } = await supabaseAdmin
      .from('profiles')
      .select('organization_id')
      .eq('id', userId)
      .single();

    if (profileFetchError || !userProfile?.organization_id) {
      console.error('Error fetching user profile or organization ID:', profileFetchError);
      return Response.redirect(`${finalRedirectBase}/integrations?shopify_error=${encodeURIComponent('User organization not found.')}`, 302);
    }

    const organizationId = userProfile.organization_id;

    const { data: updatedOrganizationData, error: updateError } = await supabaseAdmin
      .from('organizations')
      .update({
        shopify_access_token: accessToken,
        shopify_refresh_token: refreshToken,
        shopify_store_name: shopDomain,
      })
      .eq('id', organizationId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating organization profile with Shopify tokens:', updateError);
      return Response.redirect(`${finalRedirectBase}/integrations?shopify_error=${encodeURIComponent('Failed to save Shopify tokens.')}`, 302);
    }

    console.log('Shopify tokens and store name successfully stored for organization:', organizationId);
    return Response.redirect(`${finalRedirectBase}/integrations?shopify_success=true`, 302);
  } catch (error) {
    console.error('Shopify OAuth callback Edge Function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});