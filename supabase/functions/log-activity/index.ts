import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
// Inlined corsHeaders to avoid module resolution issues
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to sanitize HTML content for Deno environment
const sanitizeHtml = (html: string): string => {
  let sanitized = html;

  // 1. Remove script tags
  sanitized = sanitized.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

  // 2. Remove common event handlers (e.g., onclick, onerror)
  sanitized = sanitized.replace(/(\s)(on[a-zA-Z]+)="[^"]*"/gi, '$1');
  sanitized = sanitized.replace(/(\s)(on[a-zA-Z]+)='[^"]*'/gi, '$1');

  // 3. Remove data: URLs from src/href attributes
  sanitized = sanitized.replace(/(src|href)="data:[^"]*"/gi, '$1=""');
  sanitized = sanitized.replace(/(src|href)='data:[^"]*'/gi, '$1=""');

  return sanitized;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let requestBody: any = {};
  const contentType = req.headers.get('content-type');
  const contentLength = req.headers.get('content-length');

  const isJsonContentType = contentType && contentType.includes('application/json');
  const isBodyEmpty = !contentLength || parseInt(contentLength) === 0;

  if (isJsonContentType) {
    if (isBodyEmpty) {
      console.warn('Edge Function: Received Content-Type: application/json with empty/missing Content-Length. Treating body as empty JSON object.');
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
    const { activity_type, description, details, user_id, organization_id } = requestBody;

    if (!activity_type || !description || !user_id || !organization_id) {
      return new Response(JSON.stringify({ error: 'Missing required parameters: activity_type, description, user_id, organization_id.' }), {
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

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user || user.id !== user_id) {
      console.error('JWT verification failed or user mismatch:', userError?.message || 'User not found');
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or mismatched user token.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Sanitize description and any string values in details before insertion
    const sanitizedDescription = sanitizeHtml(description);
    const sanitizedDetails = details ? JSON.parse(JSON.stringify(details, (key, value) => {
      if (typeof value === 'string') {
        return sanitizeHtml(value);
      }
      return value;
    })) : {};

    const { data, error } = await supabaseAdmin
      .from('activity_logs')
      .insert({
        activity_type,
        description: sanitizedDescription,
        details: sanitizedDetails,
        user_id,
        organization_id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting activity log:', error);
      return new Response(JSON.stringify({ error: `Failed to log activity: ${error.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    return new Response(JSON.stringify({ message: 'Activity logged successfully!', log: data }), {
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