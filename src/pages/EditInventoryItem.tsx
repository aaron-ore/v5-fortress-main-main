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
import { PlusCircle, Loader2, Image as ImageIcon, X } from "lucide-react"; // NEW: Import Image and X icons
import { showError, showSuccess } from "@/utils/toast";
import { generateQrCodeSvg } from "@/utils/qrCodeGenerator";
import { useOnboarding } from "@/context/OnboardingContext";
import { parseLocationString, buildLocationString, getUniqueLocationParts, LocationParts } from "@/utils/locationParser";
import { uploadFileToSupabase, getFilePathFromPublicUrl } from "@/integrations/supabase/storage"; // NEW: Import storage utilities
import { supabase } from "@/lib/supabaseClient"; // NEW: Import supabase client

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
  location: z.string().min(1, "Location is required"), // Keep as string for schema, handle parts in UI
  pickingBinLocation: z.string().min(1, "Picking bin location is required"), // Keep as string for schema, handle parts in UI
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
  const { locations: savedLocations } = useOnboarding();
  const [itemNotFound, setItemNotFound] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [qrCodeSvg, setQrCodeSvg] = useState<string | undefined>(undefined);

  // NEW: Image upload states
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrlPreview, setImageUrlPreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isImageCleared, setIsImageCleared] = useState(false); // Track if user explicitly cleared image

  // State for main location parts
  const [mainLocationParts, setMainLocationParts] = useState<LocationParts>({ area: '', row: '', bay: '', level: '', pos: '' });
  // State for picking bin location parts
  const [pickingBinLocationParts, setPickingBinLocationParts] = useState<LocationParts>({ area: '', row: '', bay: '', level: '', pos: '' });

  const item = useMemo(() => inventoryItems.find((i) => i.id === id), [inventoryItems, id]);

  // Derived unique options for dropdowns from all existing locations
  const uniqueAreas = getUniqueLocationParts(savedLocations.map(loc => loc.fullLocationString), 'area');
  const uniqueRows = getUniqueLocationParts(savedLocations.map(loc => loc.fullLocationString), 'row');
  const uniqueBays = getUniqueLocationParts(savedLocations.map(loc => loc.fullLocationString), 'bay');
  const uniqueLevels = getUniqueLocationParts(savedLocations.map(loc => loc.fullLocationString), 'level');
  const uniquePositions = getUniqueLocationParts(savedLocations.map(loc => loc.fullLocationString), 'pos');

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
          location: item.location, // Will be overridden by local state
          pickingBinLocation: item.pickingBinLocation, // Will be overridden by local state
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
        location: "",
        pickingBinLocation: "",
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
      });
      // Initialize local location parts state
      setMainLocationParts(parseLocationString(item.location));
      setPickingBinLocationParts(parseLocationString(item.pickingBinLocation));

      // Initialize image states
      setImageFile(null);
      setImageUrlPreview(item.imageUrl || null);
      setIsImageCleared(false); // Reset cleared state when item loads

      // Generate QR code SVG from item.barcodeUrl (which now stores raw data)
      const generateAndSetQr = async () => {
        if (item.barcodeUrl) {
          try {
            const svg = await generateQrCodeSvg(item.barcodeUrl, 60); // Adjusted size to 60
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
    // Regenerate QR code preview if SKU changes
    const generateAndSetQr = async () => {
      if (watchSku) {
        try {
          const svg = await generateQrCodeSvg(watchSku, 60); // Adjusted size to 60
          setQrCodeSvg(svg);
        } catch (error) {
          console.error("Error generating QR code preview:", error);
          setQrCodeSvg(undefined);
        }
      } else {
        setQrCodeSvg(undefined);
      }
    };
    generateAndSetQr(); // Corrected function call
  }, [watchSku]);

  // NEW: Handle image file selection
  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      if (file.type.startsWith("image/")) {
        setImageFile(file);
        setIsImageCleared(false); // If a new file is selected, it's not cleared
        const reader = new FileReader();
        reader.onloadend = () => {
          setImageUrlPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        showError("Please select an image file (PNG, JPG, GIF, SVG).");
        setImageFile(null);
        setImageUrlPreview(item?.imageUrl || null); // Revert to original preview
      }
    } else {
      setImageFile(null);
      setImageUrlPreview(item?.imageUrl || null); // Revert to original preview
    }
  };

  // NEW: Handle clearing the image
  const handleClearImage = () => {
    setImageFile(null);
    setImageUrlPreview(null);
    setIsImageCleared(true); // Mark as cleared
    showSuccess("Image cleared. Save changes to apply.");
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!item) {
      showError("Item not found for update.");
      return;
    }
    setIsSaving(true);
    let finalImageUrl: string | undefined = item.imageUrl; // Initialize with current DB value

    try {
      // Case 1: User uploaded a new image
      if (imageFile) {
        setIsUploadingImage(true);
        // If there was an old image URL, delete the old file from storage
        if (item.imageUrl) { // Check item.imageUrl (original from DB)
          const oldFilePath = getFilePathFromPublicUrl(item.imageUrl, 'inventory-images');
          if (oldFilePath) {
            const { error: deleteError } = await supabase.storage.from('inventory-images').remove([oldFilePath]);
            if (deleteError) console.warn("Failed to delete old image from storage:", deleteError);
          }
        }
        // Upload new image
        finalImageUrl = await uploadFileToSupabase(imageFile, 'inventory-images', 'items/');
        showSuccess("Product image uploaded successfully!");
      }
      // Case 2: User explicitly cleared the existing image
      else if (isImageCleared) { // No need to check item.imageUrl here, as we want to clear it regardless if it existed
        // If image was explicitly cleared and there was an old image, delete it
        if (item.imageUrl) { // Only attempt deletion if there was an actual URL
          const oldFilePath = getFilePathFromPublicUrl(item.imageUrl, 'inventory-images');
          if (oldFilePath) {
            const { error: deleteError } = await supabase.storage.from('inventory-images').remove([oldFilePath]);
            if (deleteError) console.warn("Failed to delete old image from storage:", deleteError);
          }
        }
        finalImageUrl = undefined; // Explicitly set to undefined to clear in DB
      }
      // Case 3: No new file uploaded, and existing image was NOT explicitly cleared (finalImageUrl remains item.imageUrl from initialization)
      // This covers the case where the user didn't touch the image field.

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

      // Construct full location strings from local state
      const finalMainLocationString = buildLocationString(mainLocationParts);
      const finalPickingBinLocationString = buildLocationString(pickingBinLocationParts);

      if (!finalMainLocationString || !finalPickingBinLocationString) {
        showError("Please select all parts for both Primary Location and Picking Bin Location.");
        setIsSaving(false);
        return;
      }

      await updateInventoryItem({
        ...item,
        ...values,
        location: finalMainLocationString, // Use constructed string
        pickingBinLocation: finalPickingBinLocationString, // Use constructed string
        imageUrl: finalImageUrl, // Use the final image URL
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
                      <Input {...field} />
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
                      <Input {...field} />
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
                    <Select onValueChange={field.onChange} value={field.value}>
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
                        <SelectItem value="add-new-category" onClick={() => setIsAddingCategory(true)}>
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
                  />
                  <Button type="button" onClick={handleAddCategory}>
                    Add
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setIsAddingCategory(false)}>
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
                    <Select onValueChange={field.onChange} value={field.value}>
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
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* NEW: Image Upload Field */}
              <FormItem>
                <FormLabel>Product Image</FormLabel>
                <FormControl>
                  <Input
                    id="itemImage"
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileChange}
                    disabled={isUploadingImage}
                  />
                </FormControl>
                {imageUrlPreview ? (
                  <div className="mt-2 p-2 border border-border rounded-md flex items-center justify-between bg-muted/20">
                    {isUploadingImage ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" /> Uploading...
                      </div>
                    ) : (
                      <img src={imageUrlPreview} alt="Product Preview" className="max-w-[100px] max-h-[100px] object-contain" />
                    )}
                    <Button variant="ghost" size="icon" onClick={handleClearImage} aria-label="Clear image">
                      <X className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ) : (
                  <div className="mt-2 p-4 border border-dashed border-muted-foreground/50 rounded-md flex items-center justify-center text-muted-foreground text-sm">
                    <ImageIcon className="h-5 w-5 mr-2" /> No image selected
                  </div>
                )}
                <FormDescription>Upload a product image. Max 5MB.</FormDescription>
                <FormMessage />
              </FormItem>
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
                        <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value || '0'))} />
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
                        <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value || '0'))} />
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
                        <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value || '0'))} />
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
                        <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value || '0'))} />
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
                        <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value || '0'))} />
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
                        <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value || '0'))} />
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
                        <Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value || '0'))} />
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
                        <Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value || '0'))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {/* Main Storage Location Dropdowns */}
              <div className="space-y-2 col-span-2">
                <FormLabel>Primary Location</FormLabel>
                <div className="grid grid-cols-3 gap-2">
                  <Select value={mainLocationParts.area} onValueChange={(val) => setMainLocationParts(prev => ({ ...prev, area: val }))} disabled={savedLocations.length === 0}>
                    <SelectTrigger><SelectValue placeholder="Area" /></SelectTrigger>
                    <SelectContent>
                      {uniqueAreas.map(val => <SelectItem key={val} value={val}>{val}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={mainLocationParts.row} onValueChange={(val) => setMainLocationParts(prev => ({ ...prev, row: val }))} disabled={savedLocations.length === 0}>
                    <SelectTrigger><SelectValue placeholder="Row" /></SelectTrigger>
                    <SelectContent>
                      {uniqueRows.map(val => <SelectItem key={val} value={val}>{val}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={mainLocationParts.bay} onValueChange={(val) => setMainLocationParts(prev => ({ ...prev, bay: val }))} disabled={savedLocations.length === 0}>
                    <SelectTrigger><SelectValue placeholder="Bay" /></SelectTrigger>
                    <SelectContent>
                      {uniqueBays.map(val => <SelectItem key={val} value={val}>{val}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={mainLocationParts.level} onValueChange={(val) => setMainLocationParts(prev => ({ ...prev, level: val }))} disabled={savedLocations.length === 0}>
                    <SelectTrigger><SelectValue placeholder="Level" /></SelectTrigger>
                    <SelectContent>
                      {uniqueLevels.map(val => <SelectItem key={val} value={val}>{val}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={mainLocationParts.pos} onValueChange={(val) => setMainLocationParts(prev => ({ ...prev, pos: val }))} disabled={savedLocations.length === 0}>
                    <SelectTrigger><SelectValue placeholder="Pos" /></SelectTrigger>
                    <SelectContent>
                      {uniquePositions.map(val => <SelectItem key={val} value={val}>{val}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {savedLocations.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    You need to set up inventory locations first.
                    <Button variant="link" size="sm" asChild className="p-0 h-auto ml-1">
                      <Link to="/locations">Manage Locations</Link>
                    </Button>
                  </p>
                )}
              </div>
              {/* Picking Bin Location Dropdowns */}
              <div className="space-y-2 col-span-2">
                <FormLabel>Picking Bin Location</FormLabel>
                <div className="grid grid-cols-3 gap-2">
                  <Select value={pickingBinLocationParts.area} onValueChange={(val) => setPickingBinLocationParts(prev => ({ ...prev, area: val }))} disabled={savedLocations.length === 0}>
                    <SelectTrigger><SelectValue placeholder="Area" /></SelectTrigger>
                    <SelectContent>
                      {uniqueAreas.map(val => <SelectItem key={val} value={val}>{val}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={pickingBinLocationParts.row} onValueChange={(val) => setPickingBinLocationParts(prev => ({ ...prev, row: val }))} disabled={savedLocations.length === 0}>
                    <SelectTrigger><SelectValue placeholder="Row" /></SelectTrigger>
                    <SelectContent>
                      {uniqueRows.map(val => <SelectItem key={val} value={val}>{val}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={pickingBinLocationParts.bay} onValueChange={(val) => setPickingBinLocationParts(prev => ({ ...prev, bay: val }))} disabled={savedLocations.length === 0}>
                    <SelectTrigger><SelectValue placeholder="Bay" /></SelectTrigger>
                    <SelectContent>
                      {uniqueBays.map(val => <SelectItem key={val} value={val}>{val}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={pickingBinLocationParts.level} onValueChange={(val) => setPickingBinLocationParts(prev => ({ ...prev, level: val }))} disabled={savedLocations.length === 0}>
                    <SelectTrigger><SelectValue placeholder="Level" /></SelectTrigger>
                    <SelectContent>
                      {uniqueLevels.map(val => <SelectItem key={val} value={val}>{val}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={pickingBinLocationParts.pos} onValueChange={(val) => setPickingBinLocationParts(prev => ({ ...prev, pos: val }))} disabled={savedLocations.length === 0}>
                    <SelectTrigger><SelectValue placeholder="Pos" /></SelectTrigger>
                    <SelectContent>
                      {uniquePositions.map(val => <SelectItem key={val} value={val}>{val}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
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
                      <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value || '0'))} min="1" />
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

          <Button type="submit" className="w-full" disabled={isSaving || isUploadingImage}>
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