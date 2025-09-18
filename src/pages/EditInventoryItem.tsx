"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useInventory } from "@/context/InventoryContext";
import { useCategories } from "@/context/CategoryContext";
import { useVendors } from "@/context/VendorContext";
import { PlusCircle, Loader2 } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { generateQrCodeSvg } from "@/utils/qrCodeGenerator";
import { useOnboarding } from "@/context/OnboardingContext"; // Now imports InventoryFolder
// Removed parseLocationString, buildLocationString, getUniqueLocationParts, LocationParts
import { uploadFileToSupabase, getFilePathFromPublicUrl } from "@/integrations/supabase/storage";
import { supabase } from "@/lib/supabaseClient";
import CustomFileInput from "@/components/CustomFileInput";
import { useProfile } from "@/context/ProfileContext"; // NEW: Import useProfile

const formSchema = z.object({
  name: z.string().min(1, "Item name is required"),
  description: z.string().optional(),
  sku: z.string().min(1, "SKU is required"),
  category: z.string().min(1, "Category is required"),
  pickingBinQuantity: z.number().min(0, "Must be non-negative"),
  overstockQuantity: z.number().min(0, "Must be non-negative"),
  reorderLevel: z.number().min(0, "Must be non-negative"),
  pickingReorderLevel: z.number().min(0, "Must be non-negative"),
  committedStock: z.number().min(0, "Must be non-negative"),
  incomingStock: z.number().min(0, "Must be non-negative"),
  unitCost: z.number().min(0, "Must be non-negative"),
  retailPrice: z.number().min(0, "Must be non-negative"),
  folderId: z.string().min(1, "Folder is required"), // Changed from location to folderId
  tags: z.string().optional(), // Added tags
  notes: z.string().optional(), // Added notes
  imageUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  vendorId: z.string().optional().or(z.literal("null-vendor")),
  autoReorderEnabled: z.boolean().default(false),
  autoReorderQuantity: z.number().min(0, "Must be non-negative").optional(),
});

const EditInventoryItem: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { inventoryItems, updateInventoryItem } = useInventory();
  const { categories, addCategory } = useCategories();
  const { vendors } = useVendors();
  const { inventoryFolders } = useOnboarding(); // Now imports InventoryFolder
  const { profile } = useProfile(); // NEW: Get profile for role checks

  const [itemNotFound, setItemNotFound] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [qrCodeSvg, setQrCodeSvg] = useState<string | undefined>(undefined);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrlPreview, setImageUrlPreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isImageCleared, setIsImageCleared] = useState(false);

  // NEW: Role-based permissions
  const canManageInventory = profile?.role === 'admin' || profile?.role === 'inventory_manager';

  // Removed mainLocationParts and pickingBinLocationParts states

  const item = useMemo(() => inventoryItems.find((i) => i.id === id), [inventoryItems, id]);

  // Removed uniqueAreas, uniqueRows, etc.

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: useMemo(() => {
      if (item) {
        return {
          name: item.name,
          description: item.description || "",
          sku: item.sku,
          category: item.category,
          pickingBinQuantity: item.pickingBinQuantity,
          overstockQuantity: item.overstockQuantity,
          reorderLevel: item.reorderLevel,
          pickingReorderLevel: item.pickingReorderLevel,
          committedStock: item.committedStock,
          incomingStock: item.incomingStock,
          unitCost: item.unitCost,
          retailPrice: item.retailPrice,
          folderId: item.folderId, // Updated to folderId
          tags: item.tags?.join(', ') || "", // Updated to tags
          notes: item.notes || "", // Updated to notes
          imageUrl: item.imageUrl || "",
          vendorId: item.vendorId || "null-vendor",
          autoReorderEnabled: item.autoReorderEnabled,
          autoReorderQuantity: item.autoReorderQuantity,
        };
      }
      return {
        name: "",
        description: "",
        sku: "",
        category: "",
        pickingBinQuantity: 0,
        overstockQuantity: 0,
        reorderLevel: 0,
        pickingReorderLevel: 0,
        committedStock: 0,
        incomingStock: 0,
        unitCost: 0,
        retailPrice: 0,
        folderId: "no-folders", // Updated to folderId
        tags: "", // Added tags
        notes: "", // Added notes
        imageUrl: "",
        vendorId: "null-vendor",
        autoReorderEnabled: false,
        autoReorderQuantity: 0,
      };
    }, [item]),
  });

  useEffect(() => {
    if (!item && id) {
      setItemNotFound(true);
    } else if (item) {
      setItemNotFound(false);
      form.reset({
        ...item,
        vendorId: item.vendorId || "null-vendor",
        tags: item.tags?.join(', ') || "", // Set tags for form
        notes: item.notes || "", // Set notes for form
      });
      // Removed setMainLocationParts and setPickingBinLocationParts

      setImageFile(null);
      setImageUrlPreview(item.imageUrl || null);
      setIsImageCleared(false);

      const generateAndSetQr = async () => {
        if (item.barcodeUrl) {
          try {
            const svg = await generateQrCodeSvg(item.barcodeUrl, 60);
            setQrCodeSvg(svg);
          } catch (error) {
            console.error("Error generating QR code for display:", error);
            setQrCodeSvg(undefined);
          }
        } else {
          setQrCodeSvg(undefined);
        }
      };
      generateAndSetQr();
    }
  }, [item, id, form]);

  const watchSku = form.watch("sku");
  useEffect(() => {
    const generateAndSetQr = async () => {
      if (watchSku) {
        try {
          const svg = await generateQrCodeSvg(watchSku, 60);
          setQrCodeSvg(svg);
        } catch (error) {
          console.error("Error generating QR code preview:", error);
          setQrCodeSvg(undefined);
        }
      } else {
        setQrCodeSvg(undefined);
      }
    };
    generateAndSetQr();
  }, [watchSku]);

  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      if (file.type.startsWith("image/")) {
        setImageFile(file);
        setIsImageCleared(false);
        const reader = new FileReader();
        reader.onloadend = () => {
          setImageUrlPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        showError("Please select an image file (PNG, JPG, GIF, SVG).");
        setImageFile(null);
        setImageUrlPreview(item?.imageUrl || null);
      }
    } else {
      setImageFile(null);
      setImageUrlPreview(item?.imageUrl || null);
    }
  };

  const handleClearImage = () => {
    setImageFile(null);
    setImageUrlPreview(null);
    setIsImageCleared(true);
    showSuccess("Image cleared. Save changes to apply.");
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!item) {
      showError("Item not found for update.");
      return;
    }
    if (!canManageInventory) { // NEW: Check permission before saving
      showError("You do not have permission to update inventory items.");
      return;
    }
    setIsSaving(true);
    let finalImageUrl: string | undefined = item.imageUrl;

    try {
      if (imageFile) {
        setIsUploadingImage(true);
        if (item.imageUrl) {
          const oldFilePath = getFilePathFromPublicUrl(item.imageUrl, 'inventory-images');
          if (oldFilePath) {
            const { error: deleteError } = await supabase.storage.from('inventory-images').remove([oldFilePath]);
            if (deleteError) console.warn("Failed to delete old image from storage:", deleteError);
          }
        }
        finalImageUrl = await uploadFileToSupabase(imageFile, 'inventory-images', 'items/');
        console.log("[EditInventoryItem] Uploaded image URL:", finalImageUrl);
        showSuccess("Product image uploaded successfully!");
      } else if (isImageCleared) {
        if (item.imageUrl) {
          const oldFilePath = getFilePathFromPublicUrl(item.imageUrl, 'inventory-images');
          if (oldFilePath) {
            const { error: deleteError } = await supabase.storage.from('inventory-images').remove([oldFilePath]);
            if (deleteError) console.warn("Failed to delete old image from storage:", deleteError);
          }
        }
        finalImageUrl = undefined;
        console.log("[EditInventoryItem] Image cleared. Final URL will be undefined.");
      }
    } catch (error: any) {
      console.error("Error processing product image:", error);
      showError(`Failed to process product image: ${error.message}`);
      setIsSaving(false);
      setIsUploadingImage(false);
      return;
    } finally {
      setIsUploadingImage(false);
    }

    try {
      const finalBarcodeValue = values.sku || undefined;

      // Removed location string building logic

      if (!values.folderId || values.folderId === "no-folders") { // Validate folderId
        showError("Please select a folder for the item.");
        setIsSaving(false);
        return;
      }

      console.log("[EditInventoryItem] Updating item with imageUrl:", finalImageUrl);
      await updateInventoryItem({
        ...item,
        ...values,
        folderId: values.folderId, // Updated to folderId
        tags: values.tags?.split(',').map(tag => tag.trim()).filter(Boolean), // Process tags
        notes: values.notes, // Process notes
        imageUrl: finalImageUrl,
        vendorId: values.vendorId === "null-vendor" ? undefined : values.vendorId,
        barcodeUrl: finalBarcodeValue,
      });
      showSuccess("Inventory item updated successfully!");
      navigate("/inventory");
    } catch (error: any) {
      console.error("Failed to update inventory item:", error);
      showError(`Failed to update item: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCategory = async () => {
    if (!canManageInventory) { // NEW: Check permission before adding category
      showError("You do not have permission to add categories.");
      return;
    }
    if (newCategoryName.trim()) {
      const newCat = await addCategory(newCategoryName.trim());
      if (newCat) {
        form.setValue("category", newCat.name);
        setNewCategoryName("");
        setIsAddingCategory(false);
      }
    }
  };

  if (itemNotFound) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-4">
        <h1 className="text-4xl font-bold text-destructive">404</h1>
        <p className="text-xl text-muted-foreground">Inventory Item Not Found</p>
        <Button onClick={() => navigate("/inventory")}>Back to Inventory</Button>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading item details...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Edit Inventory Item: {item.name}</h1>
        <Button variant="outline" onClick={() => navigate("/inventory")}>
          Back to Inventory
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Item Details */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Basic Information</h2>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Name</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={!canManageInventory} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={!canManageInventory} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {qrCodeSvg && (
                <FormItem>
                  <FormLabel>QR Code</FormLabel>
                  <FormControl>
                    <div dangerouslySetInnerHTML={{ __html: qrCodeSvg }} className="max-w-[100px] h-auto border p-4 rounded-md bg-white" />
                  </FormControl>
                  <FormDescription>This QR code is generated from the SKU.</FormDescription>
                </FormItem>
              )}
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!canManageInventory}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.name}>
                            {category.name}
                          </SelectItem>
                        ))}
                        <SelectItem value="add-new-category" onClick={() => setIsAddingCategory(true)} disabled={!canManageInventory}>
                          <PlusCircle className="mr-2 h-4 w-4" /> Add New Category
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {isAddingCategory && (
                <div className="flex space-x-2">
                  <Input
                    placeholder="New category name"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    disabled={!canManageInventory}
                  />
                  <Button type="button" onClick={handleAddCategory} disabled={!canManageInventory}>
                    Add
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setIsAddingCategory(false)} disabled={!canManageInventory}>
                    Cancel
                  </Button>
                </div>
              )}
              <FormField
                control={form.control}
                name="vendorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!canManageInventory}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a vendor (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="null-vendor">None</SelectItem>
                        {vendors.map((vendor) => (
                          <SelectItem key={vendor.id} value={vendor.id}>
                            {vendor.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} disabled={!canManageInventory} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Product Image Field using CustomFileInput */}
              <CustomFileInput
                id="itemImage"
                label="Product Image"
                file={imageFile}
                onChange={handleImageFileChange}
                onClear={handleClearImage}
                disabled={isUploadingImage || !canManageInventory}
                accept="image/*"
                isUploading={isUploadingImage}
                previewUrl={imageUrlPreview}
              />
            </div>

            {/* Stock & Pricing */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Stock & Pricing</h2>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="pickingBinQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Picking Bin Quantity</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value || '0'))} disabled={!canManageInventory} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="overstockQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Overstock Quantity</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value || '0'))} disabled={!canManageInventory} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="reorderLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reorder Level (Total)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value || '0'))} disabled={!canManageInventory} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pickingReorderLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Picking Reorder Level</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value || '0'))} disabled={!canManageInventory} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="committedStock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Committed Stock</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value || '0'))} disabled={!canManageInventory} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="incomingStock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Incoming Stock</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value || '0'))} disabled={!canManageInventory} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="unitCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit Cost</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value || '0'))} disabled={!canManageInventory} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="retailPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Retail Price</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value || '0'))} disabled={!canManageInventory} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {/* Folder Selection */}
              <FormField
                control={form.control}
                name="folderId"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Main Storage Folder <span className="text-red-500">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!canManageInventory || inventoryFolders.length === 0}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a folder" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {inventoryFolders.length > 0 ? (
                          inventoryFolders.map((folder) => (
                            <SelectItem key={folder.id} value={folder.id}>
                              {folder.name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-folders" disabled>
                            No folders set up.
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {inventoryFolders.length === 0 && (
                      <FormDescription>
                        You need to set up inventory folders first.
                        <Button variant="link" size="sm" asChild className="p-0 h-auto ml-1">
                          <Link to="/folders">Manage Folders</Link>
                        </Button>
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Tags Field */}
              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Tags (comma-separated)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., fragile, electronics, high-value" disabled={!canManageInventory} />
                    </FormControl>
                    <FormDescription>
                      Add keywords to help categorize and search for items.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Notes Field */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Any specific notes about this item..." rows={3} disabled={!canManageInventory} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="space-y-2 md:col-span-2 border-t border-border pt-4 mt-4">
            <h3 className="text-lg font-semibold">Auto-Reorder Settings</h3>
            <FormField
              control={form.control}
              name="autoReorderEnabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Enable Auto-Reorder
                    </FormLabel>
                    <FormDescription>
                      Automatically generate purchase orders when stock is low.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={!canManageInventory}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            {form.watch("autoReorderEnabled") && (
              <FormField
                control={form.control}
                name="autoReorderQuantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity to Auto-Reorder</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value || '0'))} min="1" disabled={!canManageInventory} />
                    </FormControl>
                    <FormDescription>
                      This quantity will be ordered when stock drops to or below the overall reorder level.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isSaving || isUploadingImage || !canManageInventory}>
            {isSaving || isUploadingImage ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
};

export default EditInventoryItem;