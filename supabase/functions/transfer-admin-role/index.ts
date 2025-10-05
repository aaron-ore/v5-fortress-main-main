import { createClient } from 'npm:@supabase/supabase-js';
import { serve } from "https://deno.land/std@0.200.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { newAdminUserId } = await req.json();

    if (!newAdminUserId) {
      return new Response(JSON.stringify({ error: 'Missing required parameter: newAdminUserId.' }), {
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

    const { data: { user: currentAdminUser }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !currentAdminUser) {
      console.error('Edge Function: JWT verification failed or current admin user not found:', userError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or mismatched admin user token.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const { data: currentAdminProfile, error: currentAdminProfileError } = await supabaseAdmin
      .from('profiles')
      .select('role, organization_id')
      .eq('id', currentAdminUser.id)
      .single();

    if (currentAdminProfileError || currentAdminProfile?.role !== 'admin' || !currentAdminProfile?.organization_id) {
      console.error('Current admin profile error or not an admin:', currentAdminProfileError);
      return new Response(JSON.stringify({ error: 'Forbidden: Only administrators can transfer admin roles.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    if (currentAdminUser.id === newAdminUserId) {
      return new Response(JSON.stringify({ error: 'Cannot transfer admin role to yourself.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const { data: newAdminProfile, error: newAdminProfileError } = await supabaseAdmin
      .from('profiles')
      .select('organization_id')
      .eq('id', newAdminUserId)
      .single();

    if (newAdminProfileError || newAdminProfile?.organization_id !== currentAdminProfile.organization_id) {
      console.error('New admin profile error or organization mismatch:', newAdminProfileError);
      return new Response(JSON.stringify({ error: 'Target user not found or not in the same organization.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    // Perform the role updates in a transaction-like manner (sequential updates)
    // 1. Set the new admin's role to 'admin'
    const { error: updateNewAdminError } = await supabaseAdmin
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', newAdminUserId)
      .eq('organization_id', currentAdminProfile.organization_id);

    if (updateNewAdminError) {
      console.error('Error updating new admin role:', updateNewAdminError);
      return new Response(JSON.stringify({ error: `Failed to assign admin role to new user: ${updateNewAdminError.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // 2. Demote the current admin's role to 'inventory_manager'
    const { error: demoteCurrentAdminError } = await supabaseAdmin
      .from('profiles')
      .update({ role: 'inventory_manager' }) // Default demotion role
      .eq('id', currentAdminUser.id)
      .eq('organization_id', currentAdminProfile.organization_id);

    if (demoteCurrentAdminError) {
      console.error('Error demoting current admin role:', demoteCurrentAdminError);
      // IMPORTANT: If demotion fails, the new admin is still admin, but the old one might also be.
      // In a real-world scenario, you might want to revert the new admin's role or alert extensively.
      return new Response(JSON.stringify({ error: `Admin role transferred, but failed to demote current admin: ${demoteCurrentAdminError.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    return new Response(JSON.stringify({ message: 'Admin role transferred successfully.' }), {
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