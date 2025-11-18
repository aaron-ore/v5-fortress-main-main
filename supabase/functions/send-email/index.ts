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
        requestBody = JSON.parse(rawBodyText); // Parse only if not empty
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

  try {
    const { to, subject, htmlContent } = requestBody;

    if (!to || !subject || !htmlContent) {
      return new Response(JSON.stringify({ error: 'Missing required parameters: to, subject, htmlContent.' }), {
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

    if (userError || !user) {
      console.error('JWT verification failed or user not found:', userError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or mismatched user token.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const brevoApiKey = Deno.env.get('BREVO_API_KEY');
    if (!brevoApiKey) {
      console.error('Edge Function: Brevo API key not configured.');
      return new Response(JSON.stringify({ error: 'Brevo API key not configured.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Sanitize htmlContent before sending to Brevo
    const sanitizedHtmlContent = sanitizeHtml(htmlContent);

    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': brevoApiKey,
      },
      body: JSON.stringify({
        sender: { email: 'noreply@fortress.com', name: 'Fortress Inventory' },
        to: [{ email: to }],
        subject: subject,
        htmlContent: sanitizedHtmlContent, // Use sanitized content
      }),
    });

    if (!brevoResponse.ok) {
      const errorData = await brevoResponse.json();
      console.error('Brevo API error:', errorData);
      return new Response(JSON.stringify({ error: `Failed to send email via Brevo: ${errorData.message || 'Unknown error'}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: brevoResponse.status,
      });
    }

    const responseData = await brevoResponse.json();
    return new Response(JSON.stringify({ message: 'Email sent successfully!', data: responseData }), {
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