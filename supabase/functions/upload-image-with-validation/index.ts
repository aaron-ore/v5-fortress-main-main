import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js';
import { fileTypeFromBuffer } from 'npm:file-type'; // Import file-type library

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let requestBody: any = {};
  const contentType = req.headers.get('content-type');
  let rawBodyText = '';

  // Always attempt to read the body as text first for methods that typically have a body
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    try {
      rawBodyText = await req.text();
      console.log('Edge Function: Raw body text received (length):', rawBodyText.length);
    } catch (readError: any) {
      console.error('Edge Function: Error reading request body as text:', readError.message);
      return new Response(JSON.stringify({ error: `Failed to read request body: ${readError.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
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
    const { base64Data, mimeType, fileName, bucketName, folderPath } = requestBody;

    if (!base64Data || !mimeType || !fileName || !bucketName || !folderPath) {
      return new Response(JSON.stringify({ error: 'Missing required parameters: base64Data, mimeType, fileName, bucketName, folderPath.' }), {
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
      console.error('Edge Function: JWT verification failed or user not found:', userError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or mismatched user token.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Decode base64 data to a buffer
    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const buffer = bytes.buffer;

    // Server-side file type validation using magic bytes
    const fileType = await fileTypeFromBuffer(buffer);

    if (!fileType || !ALLOWED_MIME_TYPES.includes(fileType.mime)) {
      return new Response(JSON.stringify({ error: `Invalid file type detected: ${fileType?.mime || 'unknown'}. Only images (JPEG, PNG, GIF, WEBP, SVG) are allowed.` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Additional check for SVG content if SVG is allowed
    if (fileType.mime === 'image/svg+xml') {
      const svgContent = new TextDecoder().decode(bytes);
      // Simple SVG sanitization: remove script tags and event handlers
      if (/<script[\s\S]*?>[\s\S]*?<\/script>/i.test(svgContent) || /on\w+=/i.test(svgContent)) {
        return new Response(JSON.stringify({ error: 'Malicious SVG content detected. Script tags and event handlers are not allowed.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }
    }

    const filePath = `${folderPath}${fileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(filePath, buffer, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading file to Supabase Storage:', uploadError);
      return new Response(JSON.stringify({ error: `Failed to upload file: ${uploadError.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    return new Response(JSON.stringify({ filePath }), {
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