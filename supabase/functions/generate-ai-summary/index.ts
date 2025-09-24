import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.15.0";
import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
import { corsHeaders } from '../_shared/cors.ts'; // Re-import corsHeaders

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Edge Function: Incoming request headers:', JSON.stringify(Object.fromEntries(req.headers.entries()), null, 2));
    const contentType = req.headers.get('content-type');
    console.log('Edge Function: Content-Type header:', contentType);

    let requestBody;
    if (contentType && contentType.includes('application/json')) {
      const rawBody = await req.text(); // Read as text first
      console.log('Edge Function: Raw request body length:', rawBody.length); // NEW: Log body length
      console.log('Edge Function: Raw request body (first 500 chars):', rawBody.substring(0, 500) + (rawBody.length > 500 ? '...' : ''));
      try {
        requestBody = JSON.parse(rawBody); // Then parse manually
      } catch (parseError: any) { // NEW: Catch parsing errors
        console.error('Edge Function: JSON parse error:', parseError.message);
        console.error('Edge Function: Raw body that failed to parse:', rawBody);
        throw new Error(`Failed to parse request body as JSON: ${parseError.message}`);
      }
    } else {
      throw new Error(`Unsupported Content-Type: ${contentType || 'none'}. Expected application/json.`);
    }

    const { reportId, reportData } = requestBody;
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
        status: 500,
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