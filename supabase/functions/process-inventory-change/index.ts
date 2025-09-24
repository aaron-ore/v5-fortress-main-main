import { createClient } from 'npm:@supabase/supabase-js';
import { serve } from "https://deno.land/std@0.200.0/http/server.ts";

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
    const payload = await req.json();
    const { type, record, old_record } = payload;

    console.log('Edge Function: Received inventory change payload:', JSON.stringify(payload, null, 2));

    if (!record || !record.organization_id) {
      console.error('Edge Function: Missing new record data or organization_id in payload.');
      return new Response(JSON.stringify({ error: 'Missing record data or organization_id.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const organizationId = record.organization_id;

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

    const { data: rules, error: rulesError } = await supabaseAdmin
      .from('automation_rules')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true);

    if (rulesError) {
      console.error('Edge Function: Error fetching automation rules:', rulesError);
      return new Response(JSON.stringify({ error: 'Failed to fetch automation rules.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    if (!rules || rules.length === 0) {
      console.log('Edge Function: No active automation rules found for organization:', organizationId);
      return new Response(JSON.stringify({ message: 'No active automation rules to process.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const processedActions = [];

    for (const rule of rules) {
      console.log(`Edge Function: Evaluating rule: ${rule.name} (ID: ${rule.id})`);

      let triggerMatched = false;
      let conditionMet = false;

      if (rule.trigger_type === 'ON_STOCK_LEVEL_CHANGE' && type === 'UPDATE') {
        if (old_record && old_record.quantity !== record.quantity) {
          triggerMatched = true;
          console.log(`Edge Function: Trigger 'ON_STOCK_LEVEL_CHANGE' matched for item ${record.name}.`);
        }
      }

      if (!triggerMatched) {
        console.log(`Edge Function: Rule ${rule.name} - Trigger not matched.`);
        continue;
      }

      if (rule.condition_json) {
        if (rule.condition_json.field === 'quantity' && rule.condition_json.operator === 'lt') {
          const threshold = rule.condition_json.value;
          if (record.quantity < threshold) {
            conditionMet = true;
            console.log(`Edge Function: Rule ${rule.name} - Condition 'quantity < ${threshold}' met (current: ${record.quantity}).`);
          } else {
            console.log(`Edge Function: Rule ${rule.name} - Condition 'quantity < ${threshold}' NOT met (current: ${record.quantity}).`);
          }
        }
      } else {
        conditionMet = true;
        console.log(`Edge Function: Rule ${rule.name} - No conditions defined, condition met by default.`);
      }

      if (!conditionMet) {
        console.log(`Edge Function: Rule ${rule.name} - Condition not met. Skipping action.`);
        continue;
      }

      if (rule.action_json) {
        if (rule.action_json.type === 'SEND_NOTIFICATION') {
          let message = rule.action_json.message;
          message = message.replace(/{itemName}/g, record.name || 'N/A');
          message = message.replace(/{sku}/g, record.sku || 'N/A');
          message = message.replace(/{quantity}/g, record.quantity !== undefined ? String(record.quantity) : 'N/A');
          message = message.replace(/{oldQuantity}/g, old_record?.quantity !== undefined ? String(old_record.quantity) : 'N/A');
          message = message.replace(/{location}/g, record.location || 'N/A');

          const { error: logError } = await supabaseAdmin
            .from('activity_logs')
            .insert({
              user_id: rule.user_id,
              organization_id: organizationId,
              activity_type: "Automation Notification",
              description: message,
              details: {
                rule_id: rule.id,
                rule_name: rule.name,
                item_id: record.id,
                item_name: record.name,
                sku: record.sku,
                current_quantity: record.quantity,
                old_quantity: old_record?.quantity,
                location: record.location,
              },
            });

          if (logError) {
            console.error('Edge Function: Error logging automation notification:', logError);
            processedActions.push({ ruleId: rule.id, action: 'SEND_NOTIFICATION', status: 'failed', error: logError.message });
          } else {
            console.log(`Edge Function: Rule ${rule.name} - Notification sent: "${message}"`);
            processedActions.push({ ruleId: rule.id, action: 'SEND_NOTIFICATION', status: 'success', message });
          }
        }
      }
    }

    return new Response(JSON.stringify({ message: 'Automation rules processed.', results: processedActions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Edge Function error during request processing:', error);
    return new Response(JSON.stringify({ error: `Failed to process request: ${error.message}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});