import { createClient } from 'npm:@supabase/supabase-js';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';
import { serve } from "https://deno.land/std@0.200.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to sanitize HTML content
const sanitizeHtml = (html: string): string => {
  let sanitized = html;
  sanitized = sanitized.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  sanitized = sanitized.replace(/(\s)(on[a-zA-Z]+)="[^"]*"/gi, '$1');
  sanitized = sanitized.replace(/(\s)(on[a-zA-Z]+)='[^"]*'/gi, '$1');
  sanitized = sanitized.replace(/(src|href)="data:[^"]*"/gi, '$1=""');
  sanitized = sanitized.replace(/(src|href)='data:[^"]*'/gi, '$1=""');
  return sanitized;
};

serve(async (req) => {
  let rawBodyText = '';
  const contentType = req.headers.get('content-type');

  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    let requestBody: any = {};
    if (contentType && contentType.includes('application/json')) {
      try {
        requestBody = await req.json();
      } catch (parseError: any) {
        rawBodyText = await req.text();
        return new Response(JSON.stringify({ error: `Failed to parse request data as JSON: ${parseError.message}. Raw body: ${rawBodyText}` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }
    }

    const { filePath, organizationId, userId, actionForDuplicates } = requestBody;

    if (!filePath || !organizationId || !userId || !actionForDuplicates) {
      return new Response(JSON.stringify({ error: 'Missing required parameters: filePath, organizationId, userId, actionForDuplicates.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey || !supabaseAnonKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error: Missing Supabase environment variables.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.split(' ')[1];
    
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Authorization header missing.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // 1. Download CSV from Supabase Storage
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('csv-uploads')
      .download(filePath);

    if (downloadError || !fileData) {
      return new Response(JSON.stringify({ error: `Failed to download CSV file: ${downloadError?.message || 'File not found.'}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // 2. Read and parse CSV
    const buffer = await fileData.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

    if (jsonData.length === 0) {
      return new Response(JSON.stringify({ error: 'The CSV file is empty or contains no data rows.', success: false, errors: ['CSV file is empty.'] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const newItemsToInsert: any[] = [];
    const itemsToUpdate: any[] = [];
    const errors: string[] = [];

    // Fetch existing categories, folders, and inventory items
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
      .select('id, name, sku, picking_bin_quantity, overstock_quantity, quantity, reorder_level')
      .eq('organization_id', organizationId);
    if (invError) throw invError;
    
    const existingInventoryMap = new Map(
      existingInventoryRaw.map((i: any) => [i.sku.toLowerCase(), i])
    );

    // Process each row
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      const rowNumber = i + 2;

      const itemName = sanitizeHtml(String(row.name || '').trim());
      const sku = sanitizeHtml(String(row.sku || '').trim());

      if (!itemName || !sku) {
        errors.push(`Row ${rowNumber}: Missing Item Name or SKU.`);
        continue;
      }

      // --- Data Parsing and Validation ---
      let pickingBinQuantity = parseInt(String(row.pickingBinQuantity || '0'));
      if (isNaN(pickingBinQuantity) || pickingBinQuantity < 0) pickingBinQuantity = 0;
      let overstockQuantity = parseInt(String(row.overstockQuantity || '0'));
      if (isNaN(overstockQuantity) || overstockQuantity < 0) overstockQuantity = 0;
      let unitCost = parseFloat(String(row.unitCost || '0'));
      if (isNaN(unitCost) || unitCost < 0) unitCost = 0;
      let retailPrice = parseFloat(String(row.retailPrice || '0'));
      if (isNaN(retailPrice) || retailPrice < 0) retailPrice = 0;
      let reorderLevel = parseInt(String(row.reorderLevel || '0'));
      if (isNaN(reorderLevel) || reorderLevel < 0) reorderLevel = 0;
      let pickingReorderLevel = parseInt(String(row.pickingReorderLevel || '0'));
      if (isNaN(pickingReorderLevel) || pickingReorderLevel < 0) pickingReorderLevel = 0;

      const description = sanitizeHtml(String(row.description || '').trim()) || undefined;
      const imageUrl = sanitizeHtml(String(row.imageUrl || '').trim()) || undefined;
      const vendorId = sanitizeHtml(String(row.vendorId || '').trim()) || undefined;
      const barcodeUrl = sanitizeHtml(String(row.barcodeUrl || '').trim()) || sku;
      const autoReorderEnabled = String(row.autoReorderEnabled || 'false').toLowerCase() === 'true';
      const autoReorderQuantity = parseInt(String(row.autoReorderQuantity || '0'));
      const tags = String(row.tags || '').split(',').map((tag: string) => sanitizeHtml(tag.trim())).filter(Boolean);
      const notes = sanitizeHtml(String(row.notes || '').trim()) || undefined;

      let categoryName = sanitizeHtml(String(row.category || '').trim()) || 'Uncategorized';
      if (!categoryMap.has(categoryName.toLowerCase())) {
        const { data: newCat, error: insertCatError } = await supabaseAdmin
          .from('categories')
          .insert({ name: categoryName, organization_id: organizationId, user_id: userId })
          .select('id, name')
          .single();
        if (insertCatError) {
          errors.push(`Row ${rowNumber} (SKU: ${sku}): Failed to create category '${categoryName}'.`);
          continue;
        }
        categoryMap.set(newCat.name.toLowerCase(), newCat.id);
      }

      let folderName = sanitizeHtml(String(row.folderName || '').trim()) || 'Unassigned';
      let folderId: string | undefined = folderMap.get(folderName.toLowerCase());

      if (!folderId) {
        const { data: newFolder, error: insertFolderError } = await supabaseAdmin
          .from('inventory_folders')
          .insert({ name: folderName, color: '#CCCCCC', organization_id: organizationId, user_id: userId })
          .select('id, name')
          .single();
        if (insertFolderError) {
          errors.push(`Row ${rowNumber} (SKU: ${sku}): Failed to create folder '${folderName}'.`);
          continue;
        }
        folderId = newFolder.id;
        folderMap.set(newFolder.name.toLowerCase(), newFolder.id);
      }

      const pickingBinFolderId = folderId;
      const existingItem = existingInventoryMap.get(sku.toLowerCase());
      const totalQuantity = pickingBinQuantity + overstockQuantity;
      const status = totalQuantity > reorderLevel ? "In Stock" : (totalQuantity > 0 ? "Low Stock" : "Out of Stock");
      const currentTimestamp = new Date().toISOString();

      const itemPayload = {
        name: itemName,
        description: description,
        sku: sku,
        category: categoryName,
        picking_bin_quantity: pickingBinQuantity,
        overstock_quantity: overstockQuantity,
        reorder_level: reorderLevel,
        picking_reorder_level: pickingReorderLevel,
        committed_stock: 0,
        incoming_stock: 0,
        unit_cost: unitCost,
        retail_price: retailPrice,
        folder_id: folderId,
        picking_bin_folder_id: pickingBinFolderId,
        tags: tags,
        notes: notes,
        status: status,
        last_updated: currentTimestamp,
        image_url: imageUrl,
        vendor_id: vendorId,
        barcode_url: barcodeUrl,
        user_id: userId,
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
            status: (updatedPickingBinQty + updatedOverstockQty) > existingItem.reorder_level ? "In Stock" : ((updatedPickingBinQty + updatedOverstockQty) > 0 ? "Low Stock" : "Out of Stock"),
            last_updated: currentTimestamp,
          });
          await supabaseAdmin.from('stock_movements').insert({
            item_id: existingItem.id,
            item_name: existingItem.name,
            type: 'add',
            amount: pickingBinQuantity + overstockQuantity,
            old_quantity: existingItem.quantity,
            new_quantity: updatedPickingBinQty + updatedOverstockQty,
            reason: 'Customer CSV Import - Added to stock',
            user_id: userId,
            organization_id: organizationId,
            folder_id: folderId,
          });
        } else if (actionForDuplicates === "update") {
          itemsToUpdate.push({ id: existingItem.id, ...itemPayload, quantity: totalQuantity });
        }
      } else {
        newItemsToInsert.push({ ...itemPayload, quantity: totalQuantity, user_id: userId, organization_id: organizationId, created_at: currentTimestamp });
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

    // Clean up the uploaded CSV file from storage
    const { error: deleteFileError } = await supabaseAdmin.storage
      .from('csv-uploads')
      .remove([filePath]);

    if (deleteFileError) {
      console.warn('Error deleting uploaded CSV file from storage:', deleteFileError);
    }

    return new Response(JSON.stringify({
      message: `Customer import complete. Inserted ${insertCount} items, updated ${updateCount} items.`,
      errors: errors,
      success: errors.length === 0,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: errors.length > 0 ? 400 : 200,
    });

  } catch (error: any) {
    console.error('Edge Function error (caught at top level):', error);
    let errorMessage = 'An unknown error occurred during processing.';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (error && typeof error === 'object' && 'message' in error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    return new Response(JSON.stringify({ error: errorMessage, success: false, errors: [errorMessage] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});