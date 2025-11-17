import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let requestBody: any = {};
  try {
    // Attempt to parse JSON directly. req.json() handles content-type and empty bodies gracefully.
    // If the body is empty or not valid JSON, req.json() will throw an error.
    requestBody = await req.json();
    console.log('Edge Function: Successfully parsed request body:', JSON.stringify(requestBody, null, 2));
  } catch (parseError: any) {
    // If parsing fails, it means the body was either empty, malformed, or not JSON.
    // Log the error and proceed with an empty requestBody object.
    console.warn('Edge Function: Failed to parse request body as JSON. Assuming empty body. Error:', parseError.message);
    requestBody = {}; // Default to empty object
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
      console.error('Edge Function: JWT verification failed or user not found:', userError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or mismatched user token.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const quickbooksClientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
    const quickbooksEnvironment = Deno.env.get('QUICKBOOKS_ENVIRONMENT') || 'sandbox'; // NEW: Get environment

    if (!quickbooksClientId) {
      console.error('Edge Function: QUICKBOOKS_CLIENT_ID environment variable is not set.');
      return new Response(JSON.stringify({ error: 'Server configuration error: QuickBooks Client ID is missing.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    return new Response(JSON.stringify({ clientId: quickbooksClientId, environment: quickbooksEnvironment }), { // NEW: Return environment
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