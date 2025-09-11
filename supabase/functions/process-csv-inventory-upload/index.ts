import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';
import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
import { corsHeaders } from '../_shared/cors.ts';

interface ExistingInventoryItem {
  id: string;
  name: string;
  sku: string;
  picking_bin_quantity: number;
  overstock_quantity: number;
  quantity: number; // Total quantity
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { filePath, organizationId, userId, actionForDuplicates } = await req.json();

    if (!filePath || !organizationId || !userId || !actionForDuplicates) {
      return new Response(JSON.stringify({ error: 'Missing required parameters: filePath, organizationId, userId, actionForDuplicates.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!;
    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader);

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: User not authenticated.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('csv-uploads')
      .download(filePath);

    if (downloadError) {
      console.error('Error downloading file from storage:', downloadError);
      return new Response(JSON.stringify({ error: `Failed to download CSV file: ${downloadError.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const buffer = await fileData.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = XLSX.Sheets[sheetName];
    const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

    if (jsonData.length === 0) {
      return new Response(JSON.stringify({ error: 'The CSV file is empty or contains no data rows.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const newItemsToInsert: any[] = [];
    const itemsToUpdate: any[] = [];
    const errors: string[] = [];

    const { data: existingCategories, error: catError } = await supabaseAdmin
      .from('categories')
      .select('id, name')
      .eq('organization_id', organizationId);
    if (catError) throw catError;
    const categoryMap = new Map(existingCategories.map(c => [c.name.toLowerCase(), c.id]));

    const { data: existingLocations, error: locError } = await supabaseAdmin
      .from('locations')
      .select('id, full_location_string, display_name')
      .eq('organization_id', organizationId);
    if (locError) throw locError;
    const locationMap = new Map(existingLocations.map(l => [l.full_location_string.toLowerCase(), l.id]));

    const { data: existingInventoryRaw, error: invError } = await supabaseAdmin
      .from('inventory_items')
      .select('id, name, sku, picking_bin_quantity, overstock_quantity, quantity')
      .eq('organization_id', organizationId);
    if (invError) throw invError;
    
    const existingInventoryMap: Map<string, ExistingInventoryItem> = new Map(
      existingInventoryRaw.map((i: any) => [i.sku.toLowerCase(), i as ExistingInventoryItem])
    );

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      const rowNumber = i + 2;

      const itemName = String(row.name || '').trim();
      const sku = String(row.sku || '').trim();

      if (!itemName) {
        errors.push(`Row ${rowNumber} (SKU: ${sku || 'N/A'}): Item Name is required.`);
        continue;
      }
      if (!sku) {
        errors.push(`Row ${rowNumber} (Item: ${itemName}): SKU is required.`);
        continue;
      }

      let pickingBinQuantity = parseInt(String(row.pickingBinQuantity || '0'));
      if (isNaN(pickingBinQuantity) || pickingBinQuantity < 0) {
        errors.push(`Row ${rowNumber} (SKU: ${sku}): Picking Bin Quantity is required and must be a non-negative number.`);
        continue;
      }
      let overstockQuantity = parseInt(String(row.overstockQuantity || '0'));
      if (isNaN(overstockQuantity) || overstockQuantity < 0) {
        errors.push(`Row ${rowNumber} (SKU: ${sku}): Overstock Quantity is required and must be a non-negative number.`);
        continue;
      }
      let unitCost = parseFloat(String(row.unitCost || '0'));
      if (isNaN(unitCost) || unitCost < 0) {
        errors.push(`Row ${rowNumber} (SKU: ${sku}): Unit Cost is required and must be a non-negative number.`);
        continue;
      }
      let retailPrice = parseFloat(String(row.retailPrice || '0'));
      if (isNaN(retailPrice) || retailPrice < 0) {
        errors.push(`Row ${rowNumber} (SKU: ${sku}): Retail Price is required and must be a non-negative number.`);
        continue;
      }

      const description = String(row.description || '').trim() || undefined;
      const imageUrl = String(row.imageUrl || '').trim() || undefined;
      const vendorId = String(row.vendorId || '').trim() || undefined;
      const barcodeUrl = String(row.barcodeUrl || '').trim() || sku;
      const autoReorderEnabled = String(row.autoReorderEnabled || 'false').toLowerCase() === 'true';
      
      let reorderLevel = parseInt(String(row.reorderLevel || '0'));
      if (isNaN(reorderLevel) || reorderLevel < 0) reorderLevel = 0;
      let pickingReorderLevel = parseInt(String(row.pickingReorderLevel || '0'));
      if (isNaN(pickingReorderLevel) || pickingReorderLevel < 0) pickingReorderLevel = 0;
      let committedStock = parseInt(String(row.committedStock || '0'));
      if (isNaN(committedStock) || committedStock < 0) committedStock = 0;
      let incomingStock = parseInt(String(row.incomingStock || '0'));
      if (isNaN(incomingStock) || incomingStock < 0) incomingStock = 0;
      let autoReorderQuantity = parseInt(String(row.autoReorderQuantity || '0'));
      if (isNaN(autoReorderQuantity) || autoReorderQuantity < 0) autoReorderQuantity = 0;

      let categoryName = String(row.category || '').trim();
      if (!categoryName) categoryName = 'Uncategorized';
      if (!categoryMap.has(categoryName.toLowerCase())) {
        const { data: newCat, error: insertCatError } = await supabaseAdmin
          .from('categories')
          .insert({ name: categoryName, organization_id: organizationId, user_id: user.id })
          .select('id, name')
          .single();
        if (insertCatError) {
          errors.push(`Row ${rowNumber} (SKU: ${sku}): Failed to create category '${categoryName}': ${insertCatError.message}`);
          continue;
        }
        categoryMap.set(newCat.name.toLowerCase(), newCat.id);
      }

      let mainLocationString = String(row.location || '').trim();
      if (!mainLocationString) mainLocationString = 'Unassigned';
      if (!locationMap.has(mainLocationString.toLowerCase())) {
        const { data: newLoc, error: insertLocError } = await supabaseAdmin
          .from('locations')
          .insert({
            full_location_string: mainLocationString,
            display_name: mainLocationString,
            area: 'N/A', row: 'N/A', bay: 'N/A', level: 'N/A', pos: 'N/A',
            color: '#CCCCCC',
            organization_id: organizationId,
            user_id: user.id,
          })
          .select('id, full_location_string')
          .single();
        if (insertLocError) {
          errors.push(`Row ${rowNumber} (SKU: ${sku}): Failed to create location '${mainLocationString}': ${insertLocError.message}`);
          continue;
        }
        locationMap.set(newLoc.full_location_string.toLowerCase(), newLoc.id);
      }

      let pickingBinLocationString = String(row.pickingBinLocation || '').trim();
      if (!pickingBinLocationString) pickingBinLocationString = mainLocationString;
      if (!locationMap.has(pickingBinLocationString.toLowerCase())) {
        const { data: newLoc, error: insertLocError } = await supabaseAdmin
          .from('locations')
          .insert({
            full_location_string: pickingBinLocationString,
            display_name: pickingBinLocationString,
            area: 'N/A', row: 'N/A', bay: 'N/A', level: 'N/A', pos: 'N/A',
            color: '#CCCCCC',
            organization_id: organizationId,
            user_id: user.id,
          })
          .select('id, full_location_string')
          .single();
        if (insertLocError) {
          errors.push(`Row ${rowNumber} (SKU: ${sku}): Failed to create picking bin location '${pickingBinLocationString}': ${insertLocError.message}`);
          continue;
        }
        locationMap.set(newLoc.full_location_string.toLowerCase(), newLoc.id);
      }

      const existingItem = existingInventoryMap.get(sku.toLowerCase());
      const totalQuantity = pickingBinQuantity + overstockQuantity;
      const status = totalQuantity > reorderLevel ? "In Stock" : (totalQuantity > 0 ? "Low Stock" : "Out of Stock");

      const itemPayload = {
        name: itemName,
        description: description,
        sku: sku,
        category: categoryName,
        picking_bin_quantity: pickingBinQuantity,
        overstock_quantity: overstockQuantity,
        reorder_level: reorderLevel,
        picking_reorder_level: pickingReorderLevel,
        committed_stock: committedStock,
        incoming_stock: incomingStock,
        unit_cost: unitCost,
        retail_price: retailPrice,
        location: mainLocationString,
        picking_bin_location: pickingBinLocationString,
        status: status,
        last_updated: new Date().toISOString(),
        image_url: imageUrl,
        vendor_id: vendorId,
        barcode_url: barcodeUrl,
        user_id: user.id,
        organization_id: organizationId,
        auto_reorder_enabled: autoReorderEnabled,
        auto_reorder_quantity: autoReorderQuantity,
      };

      if (existingItem) {
        if (actionForDuplicates === "skip") {
          errors.push(`Row ${rowNumber} (SKU: ${sku}): Skipped due to duplicate entry confirmation.`);
          continue;
        } else if (actionForDuplicates === "add_to_stock") {
          const updatedPickingBinQty = existingItem.picking_bin_quantity + pickingBinQuantity;
          const updatedOverstockQty = existingItem.overstock_quantity + overstockQuantity;
          itemsToUpdate.push({
            id: existingItem.id,
            picking_bin_quantity: updatedPickingBinQty,
            overstock_quantity: updatedOverstockQty,
            quantity: updatedPickingBinQty + updatedOverstockQty,
            status: (updatedPickingBinQty + updatedOverstockQty) > reorderLevel ? "In Stock" : ((updatedPickingBinQty + updatedOverstockQty) > 0 ? "Low Stock" : "Out of Stock"),
            last_updated: new Date().toISOString(),
          });
          await supabaseAdmin.from('stock_movements').insert({
            item_id: existingItem.id,
            item_name: existingItem.name,
            type: 'add',
            amount: pickingBinQuantity + overstockQuantity,
            old_quantity: existingItem.quantity,
            new_quantity: updatedPickingBinQty + updatedOverstockQty,
            reason: 'CSV Bulk Import - Added to stock',
            user_id: user.id,
            organization_id: organizationId,
          });
        } else if (actionForDuplicates === "update") {
          itemsToUpdate.push({ id: existingItem.id, ...itemPayload, quantity: totalQuantity });
        }
      } else {
        newItemsToInsert.push({ ...itemPayload, quantity: totalQuantity });
      }
    }

    let insertCount = 0;
    let updateCount = 0;

    if (newItemsToInsert.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('inventory_items')
        .insert(newItemsToInsert);
      if (insertError) {
        errors.push(`Failed to insert new items: ${insertError.message}`);
      } else {
        insertCount = newItemsToInsert.length;
      }
    }

    if (itemsToUpdate.length > 0) {
      for (const updateItem of itemsToUpdate) {
        const { error: updateError } = await supabaseAdmin
          .from('inventory_items')
          .update(updateItem)
          .eq('id', updateItem.id);
        if (updateError) {
          errors.push(`Failed to update item ${updateItem.id}: ${updateError.message}`);
        } else {
          updateCount++;
        }
      }
    }

    const { error: deleteFileError } = await supabaseAdmin.storage
      .from('csv-uploads')
      .remove([filePath]);

    if (deleteFileError) {
      console.warn('Error deleting uploaded CSV file from storage:', deleteFileError);
    }

    return new Response(JSON.stringify({
      message: `Bulk import complete. Inserted ${insertCount} items, updated ${updateCount} items.`,
      errors: errors,
      success: errors.length === 0,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: errors.length > 0 ? 400 : 200,
    });

  } catch (error: any) {
    console.error('Edge Function error:', error);
    let errorMessage = 'An unknown error occurred.';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (error && typeof error === 'object' && 'message' in error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});