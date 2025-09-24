import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';
import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Interface for existing inventory items (kept for type consistency, though not used in this simplified version)
interface ExistingInventoryItem {
  id: string;
  name: string;
  sku: string;
  picking_bin_quantity: number;
  overstock_quantity: number;
  quantity: number; // Total quantity
  reorder_level: number; // Added reorder_level
}

serve(async (req) => {
  console.log('Edge Function: Request received at top level for debugging.');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get('content-type');
    console.log('Edge Function: Content-Type header:', contentType);

    let requestBody;
    let rawBody = '';
    if (contentType && contentType.includes('application/json')) {
      rawBody = await req.text();
      console.log('Edge Function: Raw request body length:', rawBody.length);
      console.log('Edge Function: Raw request body (first 500 chars):', rawBody.substring(0, 500) + (rawBody.length > 500 ? '...' : ''));
      requestBody = JSON.parse(rawBody);
      console.log('Edge Function: Parsed request body:', JSON.stringify(requestBody, null, 2));
    } else {
      console.error(`Edge Function: Unsupported Content-Type: ${contentType || 'none'}.`);
      return new Response(JSON.stringify({ error: `Unsupported Content-Type: ${contentType || 'none'}. Expected application/json.` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Just return success for now to see if parsing works
    return new Response(JSON.stringify({ message: 'Request body parsed successfully for debugging.', parsedBody: requestBody }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Edge Function: ERROR during request processing (top level catch):', error.message);
    return new Response(JSON.stringify({ error: `Edge Function internal error: ${error.message}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500, // Changed to 500 for internal errors
    });
  }
});