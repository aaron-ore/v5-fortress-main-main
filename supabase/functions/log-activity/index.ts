import { createClient } from 'npm:@supabase/supabase-js';
import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
// Inlined corsHeaders definition to resolve module import error
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to sanitize HTML content for Deno environment
const sanitizeHtml = (html: string): string => {
  let sanitized = html;

  // 1. Remove script tags
  sanitized = sanitized.replace(new RegExp('<script\\b[^>]*>[\\s\\S]*?<\\/script>', 'gi'), '');

  // 2. Remove common event handlers (e.g., onclick, onerror)
  // Using new RegExp() for robustness
  sanitized = sanitized.replace(new RegExp('(\\s)(on[a-zA-Z]+)="[^"]*"', 'gi'), '$1');
  sanitized = sanitized.replace(new RegExp('(\\s)(on[a-zA-Z]+)=\'[^"]*\'', 'gi'), '$1');

  // 3. Remove data: URLs from src/href attributes
  // Using new RegExp() for robustness
  sanitized = sanitized.replace(new RegExp('(src|href)="data:[^"]*"', 'gi'), '$1=""');
  sanitized = sanitized.replace(new RegExp('(src|href)=\'data:[^"]*\'', 'gi'), '$1=""');

  return sanitized;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { activity_type, description, details, user_id, organization_id } = await req.json();

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