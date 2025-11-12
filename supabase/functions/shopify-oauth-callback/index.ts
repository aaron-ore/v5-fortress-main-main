import { createClient } from 'npm:@supabase/supabase-js';
import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
// Inlined corsHeaders definition to resolve module import error
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('Shopify OAuth Callback: Edge Function invoked.'); // NEW: Log at start
  console.log('Full incoming request URL:', req.url);
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
    console.log('Shopify OAuth Callback: Received shop parameter:', shop); // NEW: Log shop parameter

    console.log('Shopify OAuth Callback: All URL search parameters:', JSON.stringify(Object.fromEntries(url.searchParams.entries()), null, 2));

    let userIdFromState: string | null = null;
    let redirectToFrontend: string | null = null;
    const FALLBACK_CLIENT_APP_BASE_URL = 'https://v4-fortress-main.vercel.app';

    if (state) {
      try {
        const decodedState = JSON.parse(atob(state));
        userIdFromState = decodedState.userId;
        redirectToFrontend = decodedState.redirectToFrontend;
        console.log('Shopify OAuth Callback: Decoded state - userIdFromState:', userIdFromState, 'redirectToFrontend:', redirectToFrontend);
      } catch (e) {
        console.error('Shopify OAuth Callback: Error decoding state parameter:', e);
      }
    }
    const finalRedirectBase = redirectToFrontend || FALLBACK_CLIENT_APP_BASE_URL;

    if (error) {
      console.error('Shopify OAuth Callback: Error parameter received:', error, errorDescription); // NEW: More explicit log
      return Response.redirect(`${finalRedirectBase}/integrations?shopify_error=${encodeURIComponent(errorDescription || error)}`, 302);
    }

    if (!code || !userIdFromState) {
      console.error('Shopify OAuth Callback: Missing authorization code or userIdFromState in Shopify OAuth callback. Code:', code ? 'present' : 'missing', 'UserIdFromState:', userIdFromState ? 'present' : 'missing'); // NEW: More explicit log
      return Response.redirect(`${finalRedirectBase}/integrations?shopify_error=${encodeURIComponent('Missing authorization code or user ID.')}`, 302);
    }

    const SHOPIFY_CLIENT_ID = Deno.env.get('SHOPIFY_CLIENT_ID');
    const SHOPIFY_CLIENT_SECRET = Deno.env.get('SHOPIFY_CLIENT_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    console.log('Shopify OAuth Callback: SHOPIFY_CLIENT_ID (from env):', SHOPIFY_CLIENT_ID ? 'present' : 'MISSING'); // NEW: Log presence
    console.log('Shopify OAuth Callback: SHOPIFY_CLIENT_SECRET (from env):', SHOPIFY_CLIENT_SECRET ? 'present' : 'MISSING'); // NEW: Log presence

    if (!SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Shopify OAuth Callback: Missing Supabase or Shopify environment variables.');
      return new Response(JSON.stringify({ error: 'Server configuration error: Missing environment variables.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // NEW: Verify userId from JWT against userId from state
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Shopify OAuth Callback: Authorization header missing for JWT verification.');
      return Response.redirect(`${finalRedirectBase}/integrations?shopify_error=${encodeURIComponent('Authentication required for Shopify connection.')}`, 302);
    }
    const token = authHeader.split(' ')[1];
    const supabaseClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data: { user: authenticatedUser }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !authenticatedUser || authenticatedUser.id !== userIdFromState) {
      console.error('Shopify OAuth Callback: Authenticated user ID mismatch with state userId or user not found.', authError?.message);
      return Response.redirect(`${finalRedirectBase}/integrations?shopify_error=${encodeURIComponent('Authentication mismatch or invalid state. Please try again.')}`, 302);
    }
    console.log('Shopify OAuth Callback: Authenticated user ID matched with state userId:', authenticatedUser.id);


    const redirectUri = `https://nojumocxivfjsbqnnkqe.supabase.co/functions/v1/shopify-oauth-callback`;
    console.log('Shopify OAuth Callback: Using redirectUri for token exchange:', redirectUri); // NEW: Log redirectUri

    console.log(`Shopify OAuth Callback: Attempting token exchange with Shopify for shop: ${shop}`);
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
      console.error('Shopify OAuth Callback: Error exchanging Shopify code for tokens:', errorData);
      console.error('Shopify OAuth Callback: Token exchange response status:', tokenResponse.status, 'statusText:', tokenResponse.statusText); // NEW: Log full status
      console.error('Shopify OAuth Callback: Token exchange response headers:', JSON.stringify(Object.fromEntries(tokenResponse.headers.entries()), null, 2)); // NEW: Log headers
      return Response.redirect(`${finalRedirectBase}/integrations?shopify_error=${encodeURIComponent(errorData.error_description || 'Failed to get Shopify tokens.')}`, 302);
    }

    const tokens = await tokenResponse.json();
    console.log('Shopify OAuth Callback: Full tokens object received:', JSON.stringify(tokens, null, 2));

    const shopifyAccessToken = tokens.access_token;
    const shopifyRefreshToken = tokens.refresh_token;
    const shopDomain = shop;

    // Use userIdFromState (which is now verified against authenticatedUser.id) to find the organization.
    console.log('Shopify OAuth Callback: Fetching user profile to get organization_id for update.');
    const { data: userProfile, error: profileFetchError } = await supabaseAdmin
      .from('profiles')
      .select('organization_id')
      .eq('id', userIdFromState)
      .single();

    if (profileFetchError || !userProfile?.organization_id) {
      console.error('Shopify OAuth Callback: Error fetching user profile or organization ID using userIdFromState:', profileFetchError);
      return Response.redirect(`${finalRedirectBase}/integrations?shopify_error=${encodeURIComponent('User organization not found or profile access denied.')}`, 302);
    }

    const organizationId = userProfile.organization_id;
    console.log('Shopify OAuth Callback: Identified organizationId for update:', organizationId);

    const updatePayload = {
      shopify_access_token: shopifyAccessToken,
      shopify_refresh_token: shopifyRefreshToken,
      shopify_store_name: shopDomain,
    };
    console.log('Shopify OAuth Callback: Attempting to update organization with payload:', JSON.stringify(updatePayload, null, 2));

    const { data: updatedOrganizationData, error: updateError } = await supabaseAdmin
      .from('organizations')
      .update(updatePayload)
      .eq('id', organizationId)
      .select()
      .single();

    if (updateError) {
      console.error('Shopify OAuth Callback: Error updating organization profile with Shopify tokens:', updateError);
      // Log the full error object for more details
      console.error('Shopify OAuth Callback: Supabase update error details:', JSON.stringify(updateError, null, 2));
      return Response.redirect(`${finalRedirectBase}/integrations?shopify_error=${encodeURIComponent('Failed to save Shopify tokens: ' + updateError.message)}`, 302); // Include error message
    }

    console.log('Shopify OAuth Callback: Organization updated successfully. Data returned:', JSON.stringify(updatedOrganizationData, null, 2));
    console.log('Shopify OAuth Callback: Redirecting to frontend with success.');
    return Response.redirect(`${finalRedirectBase}/integrations?shopify_success=true`, 302);
  } catch (error: any) { // Catch any unexpected errors
    console.error('Shopify OAuth Callback: Caught top-level unexpected error:', error); // NEW: Log unexpected errors
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});