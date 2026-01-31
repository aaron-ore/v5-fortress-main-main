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
      menu_item_name: string; // Changed from sku to menu_item_name
      quantity: number;
      unit_price: number;
      type: 'sale' | 'return' | 'adjustment';
      reason?: string;
    }>;
  };
}

// Helper function to convert quantity between units (simplified for Edge Function)
const convertQuantity = (quantity: number, fromUnitFactor: number, toUnitFactor: number): number => {
    if (fromUnitFactor === 0 || toUnitFactor === 0) return quantity;
    // Convert to base unit, then convert to target unit
    return (quantity * fromUnitFactor) / toUnitFactor;
};

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
    const systemUserId = apiKeyData.user_id || '00000000-0000-0000-0000-000000000000';

    console.log(`[pos-webhook-processor] Authenticated POS for Org ID: ${organizationId}, Event: ${event_type}`);

    // 2. Fetch all necessary data: Recipes, Ingredients, Units, and Inventory
    const [
      { data: recipesData, error: recipesError },
      { data: ingredientsData, error: ingredientsError },
      { data: unitsData, error: unitsError },
      { data: inventoryData, error: invError },
    ] = await Promise.all([
      supabaseAdmin.from('recipes').select('id, name, yield_unit_id').eq('organization_id', organizationId),
      supabaseAdmin.from('recipe_ingredients').select('*'),
      supabaseAdmin.from('units_of_measure').select('id, abbreviation, base_unit_factor, is_base_unit').eq('organization_id', organizationId),
      supabaseAdmin.from('inventory_items').select('id, name, sku, quantity, picking_bin_quantity, overstock_quantity, unit_cost, folder_id, yield_unit_id'),
    ]);

    if (recipesError || ingredientsError || unitsError || invError) {
      console.error('[pos-webhook-processor] Error fetching core data:', recipesError || ingredientsError || unitsError || invError);
      return new Response(JSON.stringify({ error: 'Failed to fetch core inventory/recipe data.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const recipeMap = new Map(recipesData.map(r => [r.name.toLowerCase(), r]));
    const unitMap = new Map(unitsData.map(u => [u.id, u]));
    const inventoryMap = new Map(inventoryData.map(i => [i.id, i]));
    const inventorySkuMap = new Map(inventoryData.map(i => [i.sku.toLowerCase(), i]));

    const updates = [];
    const movements = [];
    let totalSaleAmount = 0;
    let unmappedItems = [];

    // 3. Process Menu Items and Deplete Ingredients
    for (const menuItem of data.items) {
      const recipe = recipeMap.get(menuItem.menu_item_name.toLowerCase());
      
      if (!recipe) {
        unmappedItems.push(menuItem.menu_item_name);
        console.warn(`[pos-webhook-processor] Menu Item not mapped to a recipe: ${menuItem.menu_item_name}. Skipping depletion.`);
        continue;
      }

      if (event_type === 'SALE_COMPLETED' && menuItem.type === 'sale') {
        totalSaleAmount += menuItem.quantity * menuItem.unit_price;
      } else if (event_type === 'SALE_COMPLETED' && menuItem.type === 'return') {
        totalSaleAmount -= menuItem.quantity * menuItem.unit_price;
      }

      const recipeIngredients = ingredientsData.filter(ing => ing.recipe_id === recipe.id);
      
      for (const ingredient of recipeIngredients) {
        const inventoryItem = inventoryMap.get(ingredient.inventory_item_id);
        const ingredientUnit = unitMap.get(ingredient.unit_id);
        
        if (!inventoryItem || !ingredientUnit) {
          console.warn(`[pos-webhook-processor] Missing inventory item or unit for ingredient ID: ${ingredient.inventory_item_id}. Skipping.`);
          continue;
        }

        // Determine the base unit factor for the inventory item's current unit (assuming it's the same as the ingredient's unit for simplicity, or we need a yield unit on inventory_items)
        // Since we don't store the UoM on inventory_items, we'll assume the ingredient's unit is the base unit for depletion calculation.
        // For a robust system, we'd need to know the inventory item's base unit.
        // For now, we'll assume the ingredient's unit is the base unit for the raw material.
        
        // Calculate total raw quantity needed for the sale
        const rawQuantityNeeded = parseFloat(ingredient.quantity_needed) * menuItem.quantity;
        
        // Find the current state of the item (use the latest state from the updates array if present)
        const currentUpdate = updates.find(u => u.id === inventoryItem.id);
        let currentPickingBinQuantity = currentUpdate?.picking_bin_quantity ?? inventoryItem.picking_bin_quantity;
        let currentOverstockQuantity = currentUpdate?.overstock_quantity ?? inventoryItem.overstock_quantity;
        let currentTotalQuantity = currentPickingBinQuantity + currentOverstockQuantity;
        
        const oldTotalQuantity = currentTotalQuantity;
        
        let quantityToDeplete = rawQuantityNeeded;
        
        if (menuItem.type === 'return') {
            quantityToDeplete = -quantityToDeplete; // Reverse depletion for returns
        } else if (menuItem.type !== 'sale') {
            continue; // Only process sales and returns for recipe depletion
        }

        if (quantityToDeplete > 0) { // Depletion (Sale)
            if (currentPickingBinQuantity >= quantityToDeplete) {
                currentPickingBinQuantity -= quantityToDeplete;
            } else {
                const remaining = quantityToDeplete - currentPickingBinQuantity;
                currentPickingBinQuantity = 0;
                currentOverstockQuantity -= remaining;
            }
        } else if (quantityToDeplete < 0) { // Replenishment (Return)
            currentPickingBinQuantity += Math.abs(quantityToDeplete);
        }

        // Ensure non-negative
        currentPickingBinQuantity = Math.max(0, currentPickingBinQuantity);
        currentOverstockQuantity = Math.max(0, currentOverstockQuantity);
        currentTotalQuantity = currentPickingBinQuantity + currentOverstockQuantity;

        // Prepare update payload
        const existingUpdateIndex = updates.findIndex(u => u.id === inventoryItem.id);
        const updatePayload = {
            id: inventoryItem.id,
            picking_bin_quantity: currentPickingBinQuantity,
            overstock_quantity: currentOverstockQuantity,
            quantity: currentTotalQuantity,
            last_updated: new Date().toISOString().split('T')[0],
        };

        if (existingUpdateIndex !== -1) {
            updates[existingUpdateIndex] = updatePayload;
        } else {
            updates.push(updatePayload);
        }

        // Log movement
        movements.push({
            item_id: inventoryItem.id,
            item_name: inventoryItem.name,
            type: quantityToDeplete > 0 ? 'subtract' : 'add',
            amount: Math.abs(quantityToDeplete),
            old_quantity: oldTotalQuantity,
            new_quantity: currentTotalQuantity,
            reason: `${menuItem.type === 'sale' ? 'POS Sale Depletion' : 'POS Return Replenishment'} for ${menuItem.menu_item_name}`,
            user_id: systemUserId,
            organization_id: organizationId,
            folder_id: inventoryItem.folder_id,
        });
      }
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
      }
    }

    // 6. Create a corresponding Sales Order
    if (event_type === 'SALE_COMPLETED' && data.transaction_id) {
      const orderItems: any[] = data.items.map(item => ({
        id: Math.random(),
        itemName: item.menu_item_name,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        // inventoryItemId is not directly available here, but the depletion happened via recipe
      }));

      const newOrder = {
        id: `POS-${data.transaction_id}`,
        type: "Sales",
        customer_supplier: data.customer_name || 'POS Customer',
        created_at: data.timestamp,
        status: "Shipped",
        total_amount: totalSaleAmount,
        due_date: data.timestamp.split('T')[0],
        item_count: orderItems.length,
        notes: `Auto-generated from POS transaction ${data.transaction_id}. Unmapped items: ${unmappedItems.join(', ') || 'None'}.`,
        order_type: "Retail",
        shipping_method: "POS Pickup",
        items: orderItems,
        user_id: systemUserId,
        organization_id: organizationId,
      };

      const { error: orderError } = await supabaseAdmin.from('orders').insert(newOrder);
      if (orderError) {
        console.error('[pos-webhook-processor] Error creating POS Sales Order:', orderError);
      }
    }

    return new Response(JSON.stringify({ message: 'Webhook processed successfully.', updates: updates.length, movements: movements.length, unmapped_menu_items: unmappedItems }), {
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