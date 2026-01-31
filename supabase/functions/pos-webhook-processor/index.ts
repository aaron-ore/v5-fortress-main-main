import { createClient } from 'npm:@supabase/supabase-js';
import { serve } from "https://deno.land/std@0.200.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Define the expected payload structure from the POS
interface PosWebhookPayload {
  event_type: 'SALE_COMPLETED' | 'INVENTORY_ADJUSTMENT';
  api_key: string; // API key for authentication
  organization_code: string; // Unique code to identify the organization
  data: {
    transaction_id?: string;
    timestamp: string;
    total_amount?: number;
    customer_name?: string;
    items: Array<{
      sku: string;
      quantity: number;
      unit_price: number;
      type: 'sale' | 'return' | 'adjustment';
      reason?: string;
    }>;
  };
}

serve(async (req) => {
  let rawBodyText = '';
  const contentType = req.headers.get('content-type');

  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    let requestBody: PosWebhookPayload;
    
    if (contentType && contentType.includes('application/json')) {
      rawBodyText = await req.text();
      requestBody = JSON.parse(rawBodyText);
    } else {
      return new Response(JSON.stringify({ error: 'Unsupported Content-Type. Expected application/json.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const { api_key, organization_code, event_type, data } = requestBody;

    if (!api_key || !organization_code || !event_type || !data || !data.items) {
      return new Response(JSON.stringify({ error: 'Missing required fields in payload (api_key, organization_code, event_type, or data.items).' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Authenticate POS using API Key and Organization Code
    const { data: apiKeyData, error: apiKeyError } = await supabaseAdmin
      .from('api_keys')
      .select('key, organization_id, is_active, organizations(id, unique_code)')
      .eq('key', api_key)
      .eq('is_active', true)
      .single();

    if (apiKeyError || !apiKeyData || apiKeyData.organizations?.unique_code !== organization_code) {
      console.error('[pos-webhook-processor] API Key or Organization Code mismatch/invalid:', apiKeyError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid API Key or Organization Code.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const organizationId = apiKeyData.organization_id;
    const systemUserId = apiKeyData.user_id || '00000000-0000-0000-0000-000000000000'; // Fallback to a system user ID if needed

    console.log(`[pos-webhook-processor] Authenticated POS for Org ID: ${organizationId}, Event: ${event_type}`);

    // 2. Fetch all relevant inventory items by SKU for the organization
    const skus = data.items.map(item => item.sku);
    const { data: inventoryData, error: invError } = await supabaseAdmin
      .from('inventory_items')
      .select('id, name, sku, quantity, picking_bin_quantity, overstock_quantity, unit_cost, folder_id')
      .in('sku', skus)
      .eq('organization_id', organizationId);

    if (invError) {
      console.error('[pos-webhook-processor] Error fetching inventory:', invError);
      return new Response(JSON.stringify({ error: 'Failed to fetch inventory data.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const inventoryMap = new Map(inventoryData.map(item => [item.sku, item]));
    const updates = [];
    const movements = [];
    let totalSaleAmount = 0;

    // 3. Process items and prepare updates
    for (const item of data.items) {
      const inventoryItem = inventoryMap.get(item.sku);
      if (!inventoryItem) {
        console.warn(`[pos-webhook-processor] Item not found in inventory for SKU: ${item.sku}. Skipping.`);
        continue;
      }

      const oldQuantity = inventoryItem.quantity;
      let newQuantity = oldQuantity;
      let newPickingBinQuantity = inventoryItem.picking_bin_quantity;
      let newOverstockQuantity = inventoryItem.overstock_quantity;
      let movementType: 'add' | 'subtract';
      let reason: string;

      if (event_type === 'SALE_COMPLETED' && item.type === 'sale') {
        // Sale: Subtract from picking bin first
        const quantityToSubtract = item.quantity;
        movementType = 'subtract';
        reason = `POS Sale: ${data.transaction_id || 'N/A'}`;

        if (newPickingBinQuantity >= quantityToSubtract) {
          newPickingBinQuantity -= quantityToSubtract;
        } else {
          const remaining = quantityToSubtract - newPickingBinQuantity;
          newPickingBinQuantity = 0;
          newOverstockQuantity -= remaining;
        }
        newQuantity = newPickingBinQuantity + newOverstockQuantity;
        totalSaleAmount += item.quantity * item.unit_price;

      } else if (event_type === 'SALE_COMPLETED' && item.type === 'return') {
        // Return: Add to picking bin
        movementType = 'add';
        reason = `POS Return: ${data.transaction_id || 'N/A'}`;
        newPickingBinQuantity += item.quantity;
        newQuantity = newPickingBinQuantity + newOverstockQuantity;
        totalSaleAmount -= item.quantity * item.unit_price; // Reduce total sale amount

      } else if (event_type === 'INVENTORY_ADJUSTMENT' && item.type === 'adjustment') {
        // Direct Adjustment (e.g., waste, count correction)
        movementType = item.quantity > 0 ? 'add' : 'subtract';
        reason = `POS Adjustment: ${item.reason || 'N/A'}`;
        
        // For simplicity, apply adjustment to picking bin
        newPickingBinQuantity += item.quantity;
        newQuantity = newPickingBinQuantity + newOverstockQuantity;
      } else {
        console.warn(`[pos-webhook-processor] Unhandled item type/event combination: ${event_type}/${item.type}. Skipping.`);
        continue;
      }

      // Ensure quantities don't go negative (though this should be handled by POS logic)
      newPickingBinQuantity = Math.max(0, newPickingBinQuantity);
      newOverstockQuantity = Math.max(0, newOverstockQuantity);
      newQuantity = newPickingBinQuantity + newOverstockQuantity;

      updates.push({
        id: inventoryItem.id,
        picking_bin_quantity: newPickingBinQuantity,
        overstock_quantity: newOverstockQuantity,
        quantity: newQuantity,
        last_updated: new Date().toISOString().split('T')[0],
      });

      movements.push({
        item_id: inventoryItem.id,
        item_name: inventoryItem.name,
        type: movementType,
        amount: Math.abs(item.quantity),
        old_quantity: oldQuantity,
        new_quantity: newQuantity,
        reason: reason,
        user_id: systemUserId,
        organization_id: organizationId,
        folder_id: inventoryItem.folder_id,
      });
    }

    // 4. Execute database updates
    if (updates.length > 0) {
      const { error: updateError } = await supabaseAdmin.from('inventory_items').upsert(updates, { onConflict: 'id' });
      if (updateError) {
        console.error('[pos-webhook-processor] Error updating inventory items:', updateError);
        throw new Error('Failed to update inventory items in database.');
      }
    }

    // 5. Log stock movements
    if (movements.length > 0) {
      const { error: movementError } = await supabaseAdmin.from('stock_movements').insert(movements);
      if (movementError) {
        console.error('[pos-webhook-processor] Error inserting stock movements:', movementError);
        // Note: We don't fail the whole transaction if logging fails, but we log the error.
      }
    }

    // 6. Create a corresponding Sales Order if it was a sale event
    if (event_type === 'SALE_COMPLETED' && data.transaction_id) {
      const orderItems: any[] = data.items.map(item => ({
        id: Math.random(),
        itemName: inventoryMap.get(item.sku)?.name || item.sku,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        inventoryItemId: inventoryMap.get(item.sku)?.id,
      }));

      const newOrder = {
        id: `POS-${data.transaction_id}`,
        type: "Sales",
        customer_supplier: data.customer_name || 'POS Customer',
        created_at: data.timestamp,
        status: "Shipped", // Assume POS sales are immediately shipped
        total_amount: totalSaleAmount,
        due_date: data.timestamp.split('T')[0],
        item_count: orderItems.length,
        notes: `Auto-generated from POS transaction ${data.transaction_id}.`,
        order_type: "Retail",
        shipping_method: "POS Pickup",
        items: orderItems,
        user_id: systemUserId,
        organization_id: organizationId,
      };

      const { error: orderError } = await supabaseAdmin.from('orders').insert(newOrder);
      if (orderError) {
        console.error('[pos-webhook-processor] Error creating POS Sales Order:', orderError);
        // Log error but don't fail the webhook response
      }
    }

    return new Response(JSON.stringify({ message: 'Webhook processed successfully.', updates: updates.length, movements: movements.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('[pos-webhook-processor] Caught top-level error:', error);
    return new Response(JSON.stringify({ error: error.message, rawBody: rawBodyText, contentType: contentType }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});