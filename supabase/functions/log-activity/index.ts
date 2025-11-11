import { createClient } from 'npm:@supabase/supabase-js';
import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
// Inlined corsHeaders definition to resolve module import error
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to sanitize HTML content
const sanitizeHtml = (html: string): string => {
  // A simple, effective sanitizer for basic XSS prevention.
  // This implementation strips script tags and event handlers.
  const div = new DOMParser().parseFromString(html, 'text/html').body;

  // Remove script tags
  const scripts = div.getElementsByTagName('script');
  for (let i = scripts.length - 1; i >= 0; i--) {
    scripts[i].remove();
  }

  // Remove event handlers (e.g., onclick, onerror)
  const allElements = div.getElementsByTagName('*');
  for (let i = 0; i < allElements.length; i++) {
    const element = allElements[i] as HTMLElement;
    for (let j = 0; j < element.attributes.length; j++) {
      const attr = element.attributes[j];
      if (attr.name.startsWith('on')) {
        element.removeAttribute(attr.name);
      }
    }
  }

  return div.innerHTML;
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