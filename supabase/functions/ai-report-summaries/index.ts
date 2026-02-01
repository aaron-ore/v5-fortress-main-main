import { createClient } from 'npm:@supabase/supabase-js';
import { serve } from "https://deno.land/std@0.200.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENROUTER_API_KEY = Deno.env.get('GEMINI_API_KEY'); // Using the provided secret name

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

    if (!OPENROUTER_API_KEY) {
      return new Response(JSON.stringify({ error: '[ai-report-summaries] AI service not configured. GEMINI_API_KEY (OpenRouter Key) is missing.' }), {
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

    console.log('[ai-report-summaries] Sending prompt to OpenRouter...');
    
    const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini', // Using a fast, capable model
        messages: [
          { role: 'system', content: 'You are an expert inventory and supply chain analyst. Your response must be a concise, actionable summary in three bullet points, based strictly on the provided JSON data.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 500,
      }),
    });

    if (!openRouterResponse.ok) {
      const errorData = await openRouterResponse.json();
      console.error('[ai-report-summaries] OpenRouter API error:', openRouterResponse.status, errorData);
      return new Response(JSON.stringify({ error: `OpenRouter API failed: ${errorData.error?.message || openRouterResponse.statusText}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: openRouterResponse.status,
      });
    }

    const responseData = await openRouterResponse.json();
    const summary = responseData.choices?.[0]?.message?.content?.trim() || 'AI failed to generate a summary.';
    console.log('[ai-report-summaries] Received summary from OpenRouter.');

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