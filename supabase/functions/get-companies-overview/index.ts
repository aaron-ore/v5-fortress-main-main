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

  let requestBody: any = {};
  const contentType = req.headers.get('content-type');
  const contentLength = req.headers.get('content-length');

  if (req.method === 'POST' && contentType && contentType.includes('application/json')) {
    if (contentLength === '0') {
      console.warn('Edge Function: Received Content-Type: application/json with Content-Length: 0. Treating body as empty JSON object.');
      requestBody = {};
    } else {
      try {
        requestBody = await req.json();
        console.log('Edge Function: Successfully parsed request body:', JSON.stringify(requestBody, null, 2));
      } catch (parseError: any) {
        console.error('Edge Function: JSON parse error:', parseError.message);
        return new Response(JSON.stringify({ error: `Failed to parse request data as JSON: ${parseError.message}` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }
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

    // NEW: Implement robust role-based authorization
    const { data: adminProfile, error: adminProfileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (adminProfileError || adminProfile?.role !== 'admin') { // Assuming 'admin' can view all companies
      console.error('Edge Function: User is not an admin or profile not found:', adminProfileError?.message);
      return new Response(JSON.stringify({ error: 'Forbidden: Only administrators can view all companies overview.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    // Fetch all organizations
    const { data: organizations, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, name, plan, unique_code, updated_at'); // Include updated_at for last active check

    if (orgError) {
      console.error('Error fetching organizations:', orgError);
      return new Response(JSON.stringify({ error: `Failed to fetch organizations: ${orgError.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Fetch all profiles to count users and find last active user per organization
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, organization_id, updated_at')
      .order('updated_at', { ascending: false }); // Order by updated_at to easily find last active

    if (profileError) {
      console.error('Error fetching profiles:', profileError);
      return new Response(JSON.stringify({ error: `Failed to fetch profiles: ${profileError.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const companiesOverview = organizations.map(org => {
      const orgUsers = profiles.filter(profile => profile.organization_id === org.id);
      const userCount = orgUsers.length;

      // Find the last active user for this organization based on profile.updated_at
      const lastActiveUser = orgUsers.length > 0
        ? orgUsers.reduce((latest, current) => {
            const latestDate = new Date(latest.updated_at);
            const currentDate = new Date(current.updated_at);
            return currentDate > latestDate ? current : latest;
          }, orgUsers[0])
        : null;

      return {
        company_id: org.id,
        company_name: org.name,
        plan: org.plan,
        users: userCount,
        // For 'Total Usage (min)', you would need a separate table/mechanism to track this.
        // For now, we'll return a placeholder or derive a simple metric.
        // Let's use a simple placeholder for now.
        total_usage_min: Math.floor(Math.random() * 20000) + 5000, // Placeholder
        last_active_user: lastActiveUser ? lastActiveUser.full_name || lastActiveUser.id : 'N/A',
        last_updated_at: org.updated_at, // Organization's last update time
      };
    });

    return new Response(JSON.stringify(companiesOverview), {
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