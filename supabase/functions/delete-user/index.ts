import { createClient } from 'npm:@supabase/supabase-js';
import { serve } from "https://deno.land/std@0.200.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // --- START: Global Error Handling for the entire Edge Function ---
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    let requestBody: any = {};
    const contentType = req.headers.get('content-type');
    let rawBodyText = '';

    // Only attempt to read body for methods that are expected to have one
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      if (req.body) {
        try {
          const reader = req.body.getReader();
          let chunks: Uint8Array[] = [];
          let done: boolean | undefined;
          let value: Uint8Array | undefined;

          while (!done) {
            ({ value, done } = await reader.read());
            if (value) {
              chunks.push(value);
            }
          }

          const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
          const combinedChunks = new Uint8Array(totalLength);
          let offset = 0;
          for (const chunk of chunks) {
            combinedChunks.set(chunk, offset);
            offset += chunk.length;
          }

          rawBodyText = new TextDecoder().decode(combinedChunks);
          console.log('Edge Function: Raw body text read from stream (length):', rawBodyText.length);

        } catch (readError: any) {
          console.error('Edge Function: Error reading request body stream (likely empty or malformed input):', readError.message);
          rawBodyText = ''; // Treat as empty if stream reading fails
        }
      } else {
        console.log('Edge Function: Request method does not typically have a body, or req.body is null.');
      }
    }

    if (contentType && contentType.includes('application/json')) {
      if (rawBodyText.trim() === '') {
        console.warn('Edge Function: Content-Type: application/json with empty/whitespace body. Treating body as empty JSON object.');
        requestBody = {};
      } else {
        try {
          requestBody = JSON.parse(rawBodyText);
          console.log('Edge Function: Successfully parsed request body:', JSON.stringify(requestBody, null, 2));
        } catch (parseError: any) {
          console.error('Edge Function: JSON parse error for textBody:', rawBodyText, 'Error:', parseError.message);
          return new Response(JSON.stringify({ error: `Failed to parse request data as JSON: ${parseError.message}. Raw body: ${rawBodyText}` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        }
      }
    } else if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      // If there was a body but it wasn't JSON, and it's a method that expects a body
      if (rawBodyText.length > 0) {
        console.error('Edge Function: Unsupported Content-Type for non-empty body:', contentType);
        return new Response(JSON.stringify({ error: `Unsupported request format. Expected application/json for this method with a non-empty body.` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }
      // If body was empty and not JSON, it's fine, requestBody remains {}
    }

    const { targetUserId } = requestBody;
    console.log('Edge Function: Extracted targetUserId:', targetUserId);

    if (!targetUserId) {
      console.error('Edge Function: Missing required parameter: targetUserId after parsing.');
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
      return new Response(JSON.stringify({ error: 'Invalid authentication token.' }), {
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
    return new Response(JSON.stringify({ error: `An unexpected error occurred during user deletion. Please contact support if the issue persists. Raw body: ${rawBodyText}, Content-Type: ${contentType}` }), { // Added rawBody and contentType for debugging
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
  // --- END: Global Error Handling for the entire Edge Function ---
});