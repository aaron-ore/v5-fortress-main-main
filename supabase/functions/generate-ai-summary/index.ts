import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.15.0";
// Removed: import { corsHeaders } from '../_shared/cors.ts';

// Inlined corsHeaders definition to resolve module import error
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { reportId, reportData } = await req.json();
    console.log('Edge Function: Received reportId:', reportId);
    console.log('Edge Function: Received reportData (type:', typeof reportData, 'value:', JSON.stringify(reportData, null, 2).substring(0, 500) + (JSON.stringify(reportData, null, 2).length > 500 ? '...' : ''));

    if (!reportId || !reportData) {
      console.error('Edge Function: Missing required parameters for AI summary. reportId:', reportId, 'reportData:', reportData);
      return new Response(JSON.stringify({ error: 'Missing required parameters: reportId, reportData.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY environment variable not set in Edge Function.');
      return new Response(JSON.stringify({ error: 'Server configuration error: Gemini API key is missing.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500, // Changed to 500 as this is a server config error
      });
    }
    console.log('Edge Function: GEMINI_API_KEY is present.');

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    let prompt = `Generate a concise, professional summary (max 150 words) for the following inventory management report. Focus on key insights, trends, and actionable takeaways. If there are numbers, highlight the most significant ones.

Report Type: ${reportId}
Report Data: ${JSON.stringify(reportData, null, 2)}

Summary:`;

    // Customize prompt based on report type for better results
    switch (reportId) {
      case "dashboard-summary":
        prompt = `Generate a concise, professional summary (max 150 words) for this dashboard overview. Highlight total stock value, total units, low/out of stock items, and recent order activity. Focus on key operational insights.

Report Data: ${JSON.stringify(reportData, null, 2)}

Summary:`;
        break;
      case "inventory-valuation":
        prompt = `Generate a concise, professional summary (max 150 words) for this inventory valuation report. Highlight the total inventory value, total units, and key insights from the grouped data (e.g., highest value categories/folders).

Report Data: ${JSON.stringify(reportData, null, 2)}

Summary:`;
        break;
      case "low-stock-out-of-stock":
        prompt = `Generate a concise, professional summary (max 150 words) for this low stock/out of stock report. Highlight the number of affected items, the most critical items, and the implications for operations.

Report Data: ${JSON.stringify(reportData, null, 2)}

Summary:`;
        break;
      case "inventory-movement":
        prompt = `Generate a concise, professional summary (max 150 words) for this inventory movement report. Highlight the overall activity, significant additions or subtractions, and any unusual patterns.

Report Data: ${JSON.stringify(reportData, null, 2)}

Summary:`;
        break;
      case "sales-by-customer":
        prompt = `Generate a concise, professional summary (max 150 words) for this sales by customer report. Highlight total sales revenue, total items sold, and identify top-performing customers or any notable customer trends.

Report Data: ${JSON.stringify(reportData, null, 2)}

Summary:`;
        break;
      case "sales-by-product":
        prompt = `Generate a concise, professional summary (max 150 words) for this sales by product report. Highlight total sales revenue, total units sold, and identify top-selling products or categories.

Report Data: ${JSON.stringify(reportData, null, 2)}

Summary:`;
        break;
      case "purchase-order-status":
        prompt = `Generate a concise, professional summary (max 150 words) for this purchase order status report. Highlight the total number and value of purchase orders, and provide an overview of their statuses (e.g., pending, shipped).

Report Data: ${JSON.stringify(reportData, null, 2)}

Summary:`;
        break;
      case "profitability":
        prompt = `Generate a concise, professional summary (max 150 words) for this profitability report. Highlight gross profit, net profit, and key margin percentages. Provide insights into the financial performance.

Report Data: ${JSON.stringify(reportData, null, 2)}

Summary:`;
        break;
      case "stock-discrepancy":
        prompt = `Generate a concise, professional summary (max 150 words) for this stock discrepancy report. Highlight the number of discrepancies, the total difference in units, and any common reasons or locations for discrepancies.

Report Data: ${JSON.stringify(reportData, null, 2)}

Summary:`;
        break;
      default:
        // Use generic prompt
        break;
    }

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const summary = response.text();

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Gemini Edge Function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});