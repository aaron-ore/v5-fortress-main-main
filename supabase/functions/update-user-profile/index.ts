import { createClient } from 'npm:@supabase/supabase-js';
import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
// Inlined corsHeaders definition to resolve module import error
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let requestBody: any = {};

  try {
    const contentType = req.headers.get('content-type');
    console.log('Edge Function: Received Content-Type header:', contentType);

    if (contentType && contentType.includes('application/json')) {
      const rawBody = await req.text();
      console.log('Edge Function: Raw request body length:', rawBody.length);
      console.log('Edge Function: Raw request body (first 500 chars):', rawBody.substring(0, 500) + (rawBody.length > 500 ? '...' : ''));

      if (rawBody.trim()) {
        try {
          requestBody = JSON.parse(rawBody);
          console.log('Edge Function: Successfully parsed request body:', JSON.stringify(requestBody, null, 2));
        } catch (parseError: any) {
          console.error('Edge Function: JSON parse error:', parseError.message, 'Raw body that failed to parse:', rawBody);
          return new Response(JSON.stringify({ error: `Failed to parse request data as JSON: ${parseError.message}` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        }
      } else {
        console.warn('Edge Function: Received empty or whitespace-only JSON body. Proceeding with empty requestBody.');
      }
    } else {
      console.error('Edge Function: Unsupported Content-Type:', contentType);
      return new Response(JSON.stringify({ error: `Unsupported request format. Expected application/json.` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const { targetUserId, newRole, organizationId } = requestBody;

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

    const { data: { user: adminUser }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !adminUser) {
      console.error('Edge Function: JWT verification failed or admin user not found:', userError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or mismatched admin user token.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const { data: adminProfile, error: adminProfileError } = await supabaseAdmin
      .from('profiles')
      .select('role, organization_id')
      .eq('id', adminUser.id)
      .single();

    if (adminProfileError || adminProfile?.role !== 'admin' || !adminProfile?.organization_id) {
      console.error('Admin profile error or not an admin:', adminProfileError);
      return new Response(JSON.stringify({ error: 'Forbidden: Only administrators can update user roles.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
      .from('profiles')
      .select('organization_id')
      .eq('id', targetUserId)
      .single();

    if (targetProfileError) {
      console.error('Target profile error:', targetProfileError);
      return new Response(JSON.stringify({ error: 'Target user profile not found.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    if (targetProfile.organization_id !== adminProfile.organization_id && targetProfile.organization_id !== null) {
      return new Response(JSON.stringify({ error: 'Forbidden: Cannot update users outside your organization.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        role: newRole,
        organization_id: organizationId,
      })
      .eq('id', targetUserId)
      .select('id, full_name, phone, address, avatar_url, role, organization_id, created_at, email, quickbooks_access_token, quickbooks_refresh_token, quickbooks_realm_id')
      .single();

    if (updateError) {
      console.error('Error updating profile:', updateError);
      return new Response(JSON.stringify({ error: updateError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    return new Response(JSON.stringify({ profile: updatedProfile }), {
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