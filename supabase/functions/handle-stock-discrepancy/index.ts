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
    const { item_id, folder_id, location_type, physical_count, reason } = await req.json();

    if (!item_id || !folder_id || !location_type || physical_count === undefined || physical_count === null) {
      return new Response(JSON.stringify({ error: 'Missing required parameters: item_id, folder_id, location_type, physical_count.' }), {
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

    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('organization_id, full_name')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile?.organization_id) {
      console.error('Profile fetch error or missing organization_id:', profileError);
      return new Response(JSON.stringify({ error: 'User profile or organization ID not found.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    const organization_id = userProfile.organization_id;
    const userName = userProfile.full_name || user.email;

    const { data: itemData, error: itemError } = await supabaseAdmin
      .from('inventory_items')
      .select('name, sku, picking_bin_quantity, overstock_quantity')
      .eq('id', item_id)
      .eq('organization_id', organization_id)
      .single();

    if (itemError || !itemData) {
      console.error('Error fetching inventory item:', itemError);
      return new Response(JSON.stringify({ error: 'Inventory item not found or access denied.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    let original_quantity: number;
    let updatePayload: { picking_bin_quantity?: number; overstock_quantity?: number };

    if (location_type === 'picking_bin') {
      original_quantity = itemData.picking_bin_quantity;
      updatePayload = { picking_bin_quantity: physical_count };
    } else if (location_type === 'overstock') {
      original_quantity = itemData.overstock_quantity;
      updatePayload = { overstock_quantity: physical_count };
    } else {
      return new Response(JSON.stringify({ error: 'Invalid location_type provided.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    if (physical_count !== original_quantity) {
      const difference = physical_count - original_quantity;

      const { data: discrepancyData, error: discrepancyError } = await supabaseAdmin
        .from('discrepancies')
        .insert({
          item_id: item_id,
          folder_id: folder_id,
          location_type: location_type,
          original_quantity: original_quantity,
          counted_quantity: physical_count,
          difference: difference,
          reason: reason || 'Cycle Count Adjustment',
          status: 'pending',
          user_id: user.id,
          organization_id: organization_id,
        })
        .select()
        .single();

      if (discrepancyError) {
        console.error('Error inserting discrepancy:', discrepancyError);
        return new Response(JSON.stringify({ error: 'Failed to record discrepancy.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }

      const { error: updateInventoryError } = await supabaseAdmin
        .from('inventory_items')
        .update(updatePayload)
        .eq('id', item_id)
        .eq('organization_id', organization_id);

      if (updateInventoryError) {
        console.error('Error updating inventory item quantity:', updateInventoryError);
        return new Response(JSON.stringify({ error: 'Failed to update inventory quantity.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }

      // Fetch folder name for notification
      const { data: folderData, error: folderNameError } = await supabaseAdmin
        .from('inventory_folders')
        .select('name')
        .eq('id', folder_id)
        .single();

      const folderName = folderData?.name || folder_id;

      const notificationMessage = `Stock Discrepancy: ${itemData.name} (${itemData.sku}) at ${folderName} (${location_type}). Counted: ${physical_count}, System: ${original_quantity}. Difference: ${difference}. Reported by ${userName}.`;

      await supabaseAdmin
        .from('activity_logs')
        .insert({
          user_id: user.id,
          organization_id: organization_id,
          activity_type: "Stock Discrepancy",
          description: notificationMessage,
          details: {
            discrepancy_id: discrepancyData.id,
            item_id: item_id,
            item_name: itemData.name,
            sku: itemData.sku,
            folder_id: folder_id,
            location_type: location_type,
            original_quantity: original_quantity,
            counted_quantity: physical_count,
            difference: difference,
            reason: reason,
            reported_by: userName,
          },
        });

      return new Response(JSON.stringify({
        message: 'Discrepancy recorded and inventory updated.',
        discrepancy: discrepancyData,
        notification: notificationMessage,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } else {
      return new Response(JSON.stringify({ message: 'No discrepancy detected. Quantities match.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

  } catch (error) {
    console.error('Edge Function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});