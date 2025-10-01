import { createClient } from 'npm:@supabase/supabase-js';
import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
// Inlined corsHeaders definition to resolve module import error
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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
    const realmIdFromUrl = url.searchParams.get('realmId'); // Correctly capture realmId from URL

    console.log('QuickBooks OAuth Callback: All URL search parameters:', JSON.stringify(Object.fromEntries(url.searchParams.entries()), null, 2));

    let userId: string | null = null;
    let redirectToFrontend: string | null = null;
    const FALLBACK_CLIENT_APP_BASE_URL = 'https://v4-fortress-main.vercel.app';

    if (state) {
      try {
        const decodedState = JSON.parse(atob(state));
        userId = decodedState.userId;
        redirectToFrontend = decodedState.redirectToFrontend;
        console.log('QuickBooks OAuth Callback: Decoded state - userId:', userId, 'redirectToFrontend:', redirectToFrontend);
      } catch (e) {
        console.error('Error decoding state parameter:', e);
      }
    }
    const finalRedirectBase = redirectToFrontend || FALLBACK_CLIENT_APP_BASE_URL;

    if (error) {
      console.error('QuickBooks OAuth Error:', error, errorDescription);
      return Response.redirect(`${finalRedirectBase}/integrations?quickbooks_error=${encodeURIComponent(errorDescription || error)}`, 302);
    }

    if (!code || !userId) {
      console.error('Missing authorization code or userId in QuickBooks OAuth callback.');
      return Response.redirect(`${finalRedirectBase}/integrations?quickbooks_error=${encodeURIComponent('Missing authorization code or user ID.')}`, 302);
    }

    // CRITICAL: Ensure realmId is present from the URL. If not, it's a configuration issue.
    if (!realmIdFromUrl) {
      console.error('QuickBooks OAuth Callback: Realm ID is missing from the redirect URL. This is required for API calls.');
      return Response.redirect(`${finalRedirectBase}/integrations?quickbooks_error=${encodeURIComponent('QuickBooks company (realmId) not provided in callback. Please ensure you select a company during authorization and your Intuit app settings are correct.')}`, 302);
    }

    const QUICKBOOKS_CLIENT_ID = Deno.env.get('QUICKBOOKS_CLIENT_ID');
    const QUICKBOOKS_CLIENT_SECRET = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!QUICKBOOKS_CLIENT_ID || !QUICKBOOKS_CLIENT_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing Supabase or QuickBooks environment variables.');
      return Response.redirect(`${finalRedirectBase}/integrations?quickbooks_error=${encodeURIComponent('Server configuration error: Missing environment variables.')}`, 302);
    }

    const redirectUri = `https://nojumocxivfjsbqnnkqe.supabase.co/functions/v1/quickbooks-oauth-callback`;
    console.log('Using redirectUri for token exchange:', redirectUri);

    const tokenResponse = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'Authorization': `Basic ${btoa(`${QUICKBOOKS_CLIENT_ID}:${QUICKBOOKS_CLIENT_SECRET}`)}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    const tokenResponseIntuitTid = tokenResponse.headers.get('intuit_tid');
    if (tokenResponseIntuitTid) {
      console.log(`QuickBooks OAuth Callback: Token exchange intuit_tid: ${tokenResponseIntuitTid}`);
    }

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Error exchanging QuickBooks code for tokens:', errorData);
      return Response.redirect(`${finalRedirectBase}/integrations?quickbooks_error=${encodeURIComponent(errorData.error_description || 'Failed to get QuickBooks tokens.')}`, 302);
    }

    const tokens = await tokenResponse.json();
    console.log('QuickBooks OAuth Callback: Full tokens object received:', JSON.stringify(tokens, null, 2));

    const accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token;

    console.log('QuickBooks OAuth Callback: Final Realm ID to be stored:', realmIdFromUrl);

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
      console.error('QuickBooks OAuth Callback: JWT verification failed or user mismatch:', userVerificationError?.message || 'User not found or ID mismatch');
      return Response.redirect(`${finalRedirectBase}/integrations?quickbooks_error=${encodeURIComponent('Authentication mismatch. Please try again.')}`, 302);
    }

    const { data: updatedProfileData, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        quickbooks_access_token: accessToken,
        quickbooks_refresh_token: refreshToken,
        quickbooks_realm_id: realmIdFromUrl, // Use the realmId directly from the URL
      })
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating user profile with QuickBooks tokens:', updateError);
      console.error('QuickBooks OAuth Callback: Profile update error details:', JSON.stringify(updateError, null, 2));
      return Response.redirect(`${finalRedirectBase}/integrations?quickbooks_error=${encodeURIComponent('Failed to save QuickBooks tokens.')}`, 302);
    }

    console.log('QuickBooks OAuth Callback: Profile updated successfully. Data returned:', JSON.stringify(updatedProfileData, null, 2));

    console.log('QuickBooks tokens and Realm ID successfully stored for user:', userId);
    return Response.redirect(`${finalRedirectBase}/integrations?quickbooks_success=true&realmId_present=${!!realmIdFromUrl}`, 302);
  } catch (error) {
    console.error('QuickBooks OAuth callback Edge Function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});