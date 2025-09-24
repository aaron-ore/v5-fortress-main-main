import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';
import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
// Inlined corsHeaders definition to resolve module import error
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Corrected: Extract token from Authorization header and use auth.admin.getUser
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Authorization header missing.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }
    const token = authHeader.split(' ')[1];
    const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUser(token);

    if (userError || !user || user.id !== userId) { // Added user.id !== userId check
      console.error('Edge Function: JWT verification failed or user mismatch:', userError?.message || 'User not found or ID mismatch');
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or mismatched user token.' }), {
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
    const worksheet = workbook.Sheets[sheetName];
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

    // Fetch existing categories, folders, and inventory items for validation and updates
    const { data: existingCategories, error: catError } = await supabaseAdmin
      .from('categories')
      .select('id, name')
      .eq('organization_id', organizationId);
    if (catError) throw catError;
    const categoryMap = new Map(existingCategories.map(c => [c.name.toLowerCase(), c.id]));

    const { data: existingFolders, error: folderError } = await supabaseAdmin
      .from('inventory_folders')
      .select('id, name')
      .eq('organization_id', organizationId);
    if (folderError) throw folderError;
    const folderMap = new Map(existingFolders.map(f => [f.name.toLowerCase(), f.id]));

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

      let folderName = String(row.folderName || '').trim();
      if (!folderName) folderName = 'Unassigned';
      let folderId: string | undefined = folderMap.get(folderName.toLowerCase());

      if (!folderId) {
        const { data: newFolder, error: insertFolderError } = await supabaseAdmin
          .from('inventory_folders')
          .insert({
            name: folderName,
            color: '#CCCCCC',
            organization_id: organizationId,
            user_id: user.id,
          })
          .select('id, name')
          .single();
        if (insertFolderError) {
          errors.push(`Row ${rowNumber} (SKU: ${sku}): Failed to create folder '${folderName}': ${insertFolderError.message}`);
          continue;
        }
        folderId = newFolder.id;
        folderMap.set(newFolder.name.toLowerCase(), newFolder.id);
      }

      const pickingBinFolderId = folderId; 

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
        folder_id: folderId,
        picking_bin_location: pickingBinFolderId,
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
            folder_id: folderId,
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