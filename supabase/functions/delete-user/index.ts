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
    const { targetUserId } = await req.json();
    console.log('Edge Function: Received request to delete user:', targetUserId);

    if (!targetUserId) {
      console.error('Edge Function: Missing required parameter: targetUserId.');
      return new Response(JSON.stringify({ error: 'User ID to delete is missing.' }), {
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
      console.error('Edge Function: Authorization header missing.');
      return new Response(JSON.stringify({ error: 'Authentication required to perform this action.' }), {
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
      return new Response(JSON.stringify({ error: 'Invalid authentication. Please log in again.' }), {
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
      return new Response(JSON.stringify({ error: 'Permission denied: Only administrators can delete users.' }), {
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
      return new Response(JSON.stringify({ error: 'The user you are trying to delete was not found.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    if (targetProfile.organization_id !== adminProfile.organization_id) {
      console.error('Edge Function: Admin user trying to delete user from different organization.');
      return new Response(JSON.stringify({ error: 'Permission denied: Cannot delete users outside your organization.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    console.log(`Edge Function: Attempting to delete user ${targetUserId} from authentication system...`);
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
    console.log(`Edge Function: Authentication system delete user call completed.`);

    if (deleteUserError) {
      console.error('Edge Function: Error deleting user from authentication system:', deleteUserError);
      return new Response(JSON.stringify({ error: `Failed to delete user due to an internal issue. Please try again.` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    console.log(`Edge Function: User ${targetUserId} and their profile deleted successfully.`);
    return new Response(JSON.stringify({ message: `User deleted successfully.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Edge Function error (caught at top level):', error);
    return new Response(JSON.stringify({ error: `An unexpected error occurred during user deletion. Please contact support if the issue persists.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});