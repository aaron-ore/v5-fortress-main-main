import { serve } from "https://deno.land/std@0.200.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'Server configuration error: Gemini API key is missing.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const geminiApiUrl = "https://generativelanguage.googleapis.com/v1beta/models"; // Using v1beta for ListModels
    
    const geminiResponse = await fetch(geminiApiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY,
      },
    });

    if (!geminiResponse.ok) {
      const errorData = await geminiResponse.json();
      console.error('Gemini API ListModels error:', errorData);
      throw new Error(`Gemini API ListModels error: ${errorData.error?.message || geminiResponse.statusText}`);
    }

    const models = await geminiResponse.json();
    
    // Filter models to show only those supporting 'generateContent'
    const supportedModels = models.models.filter((model: any) => 
      model.supportedGenerationMethods && model.supportedGenerationMethods.includes('generateContent')
    ).map((model: any) => ({
      name: model.name,
      displayName: model.displayName,
      version: model.version,
      supportedGenerationMethods: model.supportedGenerationMethods,
      inputTokenLimit: model.inputTokenLimit,
      outputTokenLimit: model.outputTokenLimit,
    }));

    return new Response(JSON.stringify({ availableModels: supportedModels }), {
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