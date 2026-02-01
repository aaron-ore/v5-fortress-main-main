import { createClient } from 'npm:@supabase/supabase-js';
import { GoogleGenAI } from 'npm:@google/generative-ai';
import { serve } from "https://deno.land/std@0.200.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

if (!GEMINI_API_KEY) {
  console.error("[ai-report-summaries] GEMINI_API_KEY is not set.");
}

const ai = GEMINI_API_KEY ? new GoogleGenAI(GEMINI_API_KEY) : null;

serve(async (req) => {
  let rawBodyText = '';
  const contentType = req.headers.get('content-type');

  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    let requestBody: any = {};
    if (contentType && contentType.includes('application/json')) {
      rawBodyText = await req.text();
      requestBody = JSON.parse(rawBodyText);
    } else {
      return new Response(JSON.stringify({ error: '[ai-report-summaries] Unsupported Content-Type. Expected application/json.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const { reportData, reportType } = requestBody;

    if (!reportData || !reportType) {
      return new Response(JSON.stringify({ error: '[ai-report-summaries] Missing required parameters: reportData or reportType.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    if (!ai) {
      return new Response(JSON.stringify({ error: '[ai-report-summaries] AI service not configured. GEMINI_API_KEY is missing.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: '[ai-report-summaries] Unauthorized: Authorization header missing.' }), {
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
      console.error('[ai-report-summaries] JWT verification failed or user not found:', userError?.message);
      return new Response(JSON.stringify({ error: '[ai-report-summaries] Unauthorized: Invalid user token.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Check user plan (assuming plan is stored on organization table)
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('organization_id, organizations(plan)')
      .eq('id', user.id)
      .single();

    const userPlan = profileData?.organizations?.plan?.toLowerCase() || 'free';
    const requiredPlan = ['premium', 'enterprise'];

    if (!requiredPlan.includes(userPlan)) {
      console.warn(`[ai-report-summaries] Access denied for user ${user.id}. Plan: ${userPlan}. Required: Premium/Enterprise.`);
      return new Response(JSON.stringify({ error: 'Access Denied: AI features require a Premium or Enterprise plan.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    // Construct the prompt
    const prompt = `Analyze the following inventory and order management report data of type "${reportType}". Provide a concise, actionable summary in three bullet points. Focus on key trends, potential risks (e.g., low stock, high losses), and opportunities (e.g., top sellers, high turnover). The data is provided as a JSON object: ${JSON.stringify(reportData)}`;

    console.log('[ai-report-summaries] Sending prompt to Gemini...');
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const summary = response.text.trim();
    console.log('[ai-report-summaries] Received summary from Gemini.');

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('[ai-report-summaries] Caught top-level error:', error);
    return new Response(JSON.stringify({ error: error.message, rawBody: rawBodyText, contentType: contentType }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});