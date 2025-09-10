"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plug, CheckCircle, RefreshCw, AlertTriangle, Loader2, MapPin, Link as LinkIcon, Trash2, Edit } from "lucide-react";
import { useProfile } from "@/context/ProfileContext";
import { showError, showSuccess } from "@/utils/toast";
import { supabase } from "@/lib/supabaseClient";
import { useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "next-themes";
import { useOnboarding } from "@/context/OnboardingContext"; // Import useOnboarding for Fortress locations
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ConfirmDialog from "@/components/ConfirmDialog"; // Import ConfirmDialog
import { Label } from "@/components/ui/label"; // NEW: Import Label

interface ShopifyLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  province: string;
  country: string;
  active: boolean;
}

interface ShopifyLocationMapping {
  id: string;
  organization_id: string;
  shopify_location_id: string;
  shopify_location_name: string;
  fortress_location_id: string;
  user_id: string;
  created_at: string;
}

const Integrations: React.FC = () => {
  const { profile, isLoadingProfile, fetchProfile } = useProfile();
  const { locations: fortressLocations, fetchLocations: fetchFortressLocations } = useOnboarding(); // Get Fortress locations
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();

  const [isSyncingQuickBooks, setIsSyncingQuickBooks] = useState(false);
  const [isSyncingShopify, setIsSyncingShopify] = useState(false);

  // Shopify Location Mapping States
  const [shopifyLocations, setShopifyLocations] = useState<ShopifyLocation[]>([]);
  const [shopifyMappings, setShopifyMappings] = useState<ShopifyLocationMapping[]>([]);
  const [isFetchingShopifyLocations, setIsFetchingShopifyLocations] = useState(false);
  const [isFetchingShopifyMappings, setIsFetchingShopifyMappings] = useState(false);
  const [isSavingMapping, setIsSavingMapping] = useState(false);
  const [isDeletingMapping, setIsDeletingMapping] = useState(false);

  const [selectedShopifyLocationId, setSelectedShopifyLocationId] = useState<string | null>(null);
  const [selectedFortressLocationId, setSelectedFortressLocationId] = useState<string | null>(null);
  const [mappingToEdit, setMappingToEdit] = useState<ShopifyLocationMapping | null>(null);
  const [mappingToDelete, setMappingToDelete] = useState<ShopifyLocationMapping | null>(null);
  const [isConfirmDeleteMappingOpen, setIsConfirmDeleteMappingOpen] = useState(false);

  // Ref to prevent re-processing URL parameters on re-renders
  const qbCallbackProcessedRef = React.useRef(false);
  const shopifyCallbackProcessedRef = React.useRef(false);

  // Determine which Shopify logo to use based on theme
  const shopifyLogoSrc = theme === 'dark' || theme === 'emerald' || theme === 'deep-forest'
    ? "/shopify_logo_white.png"
    : "/shopify_logo_black.png";

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const quickbooksSuccess = params.get('quickbooks_success');
    const quickbooksError = params.get('quickbooks_error');
    const shopifySuccess = params.get('shopify_success');
    const shopifyError = params.get('shopify_error');

    console.log('Integrations.tsx: quickbooks_success from URL parameters:', quickbooksSuccess);
    console.log('Integrations.tsx: quickbooks_error from URL parameters:', quickbooksError);
    console.log('Integrations.tsx: shopify_success from URL parameters:', shopifySuccess);
    console.log('Integrations.tsx: shopify_error from URL parameters:', shopifyError);

    if ((quickbooksSuccess || quickbooksError) && !qbCallbackProcessedRef.current) {
      if (quickbooksSuccess) {
        showSuccess("QuickBooks connected successfully!");
      } else if (quickbooksError) {
        showError(`QuickBooks connection failed: ${quickbooksError}`);
      }
      qbCallbackProcessedRef.current = true;
      navigate(location.pathname, { replace: true });
    }

    // Handle Shopify callback
    if ((shopifySuccess || shopifyError) && !shopifyCallbackProcessedRef.current) {
      if (shopifySuccess) {
        showSuccess("Shopify connected successfully!");
      } else if (shopifyError) {
        showError(`Shopify connection failed: ${shopifyError}`);
      }
      shopifyCallbackProcessedRef.current = true;
      navigate(location.pathname, { replace: true });
    }
  }, [location.search, location.pathname, navigate]);

  // Fetch Fortress locations and Shopify mappings on component mount/profile change
  useEffect(() => {
    if (!isLoadingProfile && profile?.organizationId) {
      fetchFortressLocations();
      fetchShopifyLocationMappings();
    }
  }, [isLoadingProfile, profile?.organizationId, fetchFortressLocations]);

  // --- QuickBooks Handlers ---
  const handleConnectQuickBooks = () => {
    if (!profile?.id) {
      showError("You must be logged in to connect to QuickBooks.");
      return;
    }

    const clientId = import.meta.env.VITE_QUICKBOOKS_CLIENT_ID;

    if (!clientId) {
      showError("QuickBooks Client ID is not configured. Please add VITE_QUICKBOOKS_CLIENT_ID to your .env file.");
      return;
    }

    const redirectUri = `https://nojumocxivfjsbqnnkqe.supabase.co/functions/v1/quickbooks-oauth-callback`;
    
    const scope = "com.intuit.quickbooks.accounting openid profile email address phone";
    const responseType = "code";
    
    const statePayload = {
      userId: profile.id,
      redirectToFrontend: window.location.origin,
    };
    const encodedState = btoa(JSON.stringify(statePayload));

    const authUrl = `https://appcenter.intuit.com/app/connect/oauth2?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&response_type=${responseType}&state=${encodedState}`;
    
    window.location.href = authUrl;
  };

  const handleDisconnectQuickBooks = async () => {
    if (!profile?.quickbooksAccessToken) {
      showError("Not connected to QuickBooks.");
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ quickbooks_access_token: null, quickbooks_refresh_token: null, quickbooks_realm_id: null })
        .eq('id', profile.id);
      
      if (updateError) throw updateError;

      await fetchProfile();
      showSuccess("Disconnected from QuickBooks.");
    } catch (error: any) {
      console.error("Error disconnecting QuickBooks:", error);
      showError(`Failed to disconnect from QuickBooks: ${error.message}`);
    }
  };

  const handleSyncSalesOrders = async () => {
    if (!profile?.quickbooksAccessToken || !profile?.quickbooksRealmId) {
      showError("QuickBooks is not fully connected. Please ensure your QuickBooks company is selected and try connecting again.");
      return;
    }
    setIsSyncingQuickBooks(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        showError("You must be logged in to sync with QuickBooks.");
        return;
      }

      const { data, error } = await supabase.functions.invoke('sync-sales-orders-to-quickbooks', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      showSuccess(data.message || "Sales orders synced successfully!");
      console.log("QuickBooks Sync Results:", data.results);
      await fetchProfile();
    } catch (error: any) {
      console.error("Error syncing sales orders to QuickBooks:", error);
      showError(`Failed to sync sales orders: ${error.message}`);
    } finally {
      setIsSyncingQuickBooks(false);
    }
  };

  // --- Shopify Integration Handlers ---
  const handleConnectShopify = () => {
    if (!profile?.id) {
      showError("You must be logged in to connect to Shopify.");
      return;
    }

    const clientId = import.meta.env.VITE_SHOPIFY_CLIENT_ID;
    const shopifyStoreName = prompt("Please enter your Shopify store name (e.g., your-store.myshopify.com):");

    if (!shopifyStoreName) {
      showError("Shopify store name is required to connect.");
      return;
    }

    if (!clientId) {
      showError("Shopify Client ID is not configured. Please add VITE_SHOPIFY_CLIENT_ID to your .env file.");
      return;
    }

    const redirectUri = `https://nojumocxivfjsbqnnkqe.supabase.co/functions/v1/shopify-oauth-callback`;
    
    // Define the required Shopify scopes
    const scopes = [
      "read_products",
      "write_products",
      "read_orders",
      "write_orders",
      "read_customers",
      "write_customers",
      "read_fulfillments",
      "write_fulfillments",
      "read_inventory",
      "write_inventory",
    ];
    const scope = scopes.join(',');
    
    const statePayload = {
      userId: profile.id,
      redirectToFrontend: window.location.origin,
    };
    const encodedState = btoa(JSON.stringify(statePayload));

    const authUrl = `https://${shopifyStoreName}/admin/oauth/authorize?client_id=${clientId}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodedState}`;
    
    window.location.href = authUrl;
  };

  const handleDisconnectShopify = async () => {
    if (!profile?.organizationId || !profile?.shopifyAccessToken) {
      showError("Not connected to Shopify.");
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('organizations')
        .update({ shopify_access_token: null, shopify_refresh_token: null, shopify_store_name: null })
        .eq('id', profile.organizationId);
      
      if (updateError) throw updateError;

      await fetchProfile();
      showSuccess("Disconnected from Shopify.");
      setShopifyLocations([]); // Clear Shopify locations on disconnect
      setShopifyMappings([]); // Clear mappings on disconnect
    } catch (error: any) {
      console.error("Error disconnecting Shopify:", error);
      showError(`Failed to disconnect from Shopify: ${error.message}`);
    }
  };

  const handleSyncShopifyProducts = async () => {
    if (!profile?.shopifyAccessToken || !profile?.shopifyStoreName) {
      showError("Shopify is not connected. Please connect your Shopify store first.");
      return;
    }
    setIsSyncingShopify(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        showError("You must be logged in to sync with Shopify.");
        return;
      }

      const { data, error } = await supabase.functions.invoke('sync-shopify-products', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      showSuccess(data.message || "Shopify products synced successfully!");
      console.log("Shopify Product Sync Results:", data.results);
      await fetchProfile(); // Refresh profile to ensure latest Shopify tokens/status
    } catch (error: any) {
      console.error("Error syncing Shopify products:", error);
      showError(`Failed to sync Shopify products: ${error.message}`);
    } finally {
      setIsSyncingShopify(false);
    }
  };

  // --- Shopify Location Mapping Handlers ---
  const fetchShopifyLocations = async () => {
    if (!profile?.shopifyAccessToken || !profile?.shopifyStoreName) {
      showError("Shopify is not connected. Please connect your Shopify store first.");
      return;
    }
    setIsFetchingShopifyLocations(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showError("You must be logged in to fetch Shopify locations.");
        return;
      }

      const { data, error } = await supabase.functions.invoke('fetch-shopify-locations', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw error;
      }
      if (data.error) {
        throw new Error(data.error);
      }

      setShopifyLocations(data.locations);
      showSuccess("Shopify locations fetched successfully!");
    } catch (error: any) {
      console.error("Error fetching Shopify locations:", error);
      showError(`Failed to fetch Shopify locations: ${error.message}`);
    } finally {
      setIsFetchingShopifyLocations(false);
    }
  };

  const fetchShopifyLocationMappings = async () => {
    if (!profile?.organizationId) return;
    setIsFetchingShopifyMappings(true);
    try {
      const { data, error } = await supabase
        .from('shopify_location_mappings')
        .select('*')
        .eq('organization_id', profile.organizationId);

      if (error) throw error;
      setShopifyMappings(data);
    } catch (error: any) {
      console.error("Error fetching Shopify location mappings:", error);
      showError(`Failed to fetch Shopify location mappings: ${error.message}`);
    } finally {
      setIsFetchingShopifyMappings(false);
    }
  };

  const handleSaveLocationMapping = async () => {
    if (!profile?.organizationId || !profile?.id || !selectedShopifyLocationId || !selectedFortressLocationId) {
      showError("Please select both a Shopify location and a Fortress location.");
      return;
    }

    const shopifyLoc = shopifyLocations.find(loc => loc.id === selectedShopifyLocationId);
    if (!shopifyLoc) {
      showError("Selected Shopify location not found.");
      return;
    }

    setIsSavingMapping(true);
    try {
      // Check if mapping already exists
      const existingMapping = shopifyMappings.find(m => m.shopify_location_id === selectedShopifyLocationId);

      if (existingMapping) {
        // Update existing mapping
        const { error } = await supabase
          .from('shopify_location_mappings')
          .update({ fortress_location_id: selectedFortressLocationId })
          .eq('id', existingMapping.id)
          .eq('organization_id', profile.organizationId);
        if (error) throw error;
        showSuccess(`Mapping for ${shopifyLoc.name} updated successfully!`);
      } else {
        // Insert new mapping
        const { error } = await supabase
          .from('shopify_location_mappings')
          .insert({
            organization_id: profile.organizationId,
            shopify_location_id: selectedShopifyLocationId,
            shopify_location_name: shopifyLoc.name,
            fortress_location_id: selectedFortressLocationId,
            user_id: profile.id,
          });
        if (error) throw error;
        showSuccess(`Mapping for ${shopifyLoc.name} created successfully!`);
      }
      
      await fetchShopifyLocationMappings(); // Refresh mappings
      setSelectedShopifyLocationId(null);
      setSelectedFortressLocationId(null);
      setMappingToEdit(null);
    } catch (error: any) {
      console.error("Error saving location mapping:", error);
      showError(`Failed to save mapping: ${error.message}`);
    } finally {
      setIsSavingMapping(false);
    }
  };

  const handleEditMappingClick = (mapping: ShopifyLocationMapping) => {
    setMappingToEdit(mapping);
    setSelectedShopifyLocationId(mapping.shopify_location_id);
    setSelectedFortressLocationId(mapping.fortress_location_id);
  };

  const handleDeleteMappingClick = (mapping: ShopifyLocationMapping) => {
    setMappingToDelete(mapping);
    setIsConfirmDeleteMappingOpen(true);
  };

  const confirmDeleteMapping = async () => {
    if (!mappingToDelete || !profile?.organizationId) return;
    setIsDeletingMapping(true);
    try {
      const { error } = await supabase
        .from('shopify_location_mappings')
        .delete()
        .eq('id', mappingToDelete.id)
        .eq('organization_id', profile.organizationId);
      if (error) throw error;
      showSuccess(`Mapping for ${mappingToDelete.shopify_location_name} deleted.`);
      await fetchShopifyLocationMappings();
    } catch (error: any) {
      console.error("Error deleting mapping:", error);
      showError(`Failed to delete mapping: ${error.message}`);
    } finally {
      setIsDeletingMapping(false);
      setIsConfirmDeleteMappingOpen(false);
      setMappingToDelete(null);
    }
  };

  const getFortressLocationDisplayName = (id: string) => {
    const loc = fortressLocations.find(l => l.id === id);
    return loc ? (loc.displayName || loc.fullLocationString) : "Unknown Location";
  };

  const isQuickBooksConnected = profile?.quickbooksAccessToken && profile?.quickbooksRefreshToken && profile?.quickbooksRealmId;
  const isShopifyConnected = profile?.shopifyAccessToken && profile?.shopifyStoreName;
  const isAdmin = profile?.role === 'admin';

  if (isLoadingProfile) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading integrations...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-6 p-6">
      <h1 className="text-3xl font-bold">Integrations</h1>
      <p className="text-muted-foreground">Connect Fortress with your favorite business tools for enhanced workflow.</p>

      {/* QuickBooks Integration Card */}
      <Card className="bg-card border-border rounded-lg shadow-sm p-6">
        <CardHeader className="pb-4 flex flex-row items-center gap-4">
          <img src="/Intuit_QuickBooks_logo.png" alt="QuickBooks Logo" className="h-10 object-contain" />
          <CardTitle className="text-xl font-semibold">QuickBooks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isQuickBooksConnected ? (
            <div className="flex flex-col gap-2">
              <p className="text-green-500 font-semibold">
                <CheckCircle className="inline h-4 w-4 mr-2" /> Connected to QuickBooks!
              </p>
              <p className="text-sm text-muted-foreground">
                Your Fortress account is linked with QuickBooks. You can now synchronize data.
              </p>
              <Button onClick={handleSyncSalesOrders} disabled={isSyncingQuickBooks}>
                {isSyncingQuickBooks ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" /> Sync Sales Orders to QuickBooks
                  </>
                )}
              </Button>
              <Button variant="destructive" onClick={handleDisconnectQuickBooks}>
                Disconnect QuickBooks
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-muted-foreground">
                Connect your QuickBooks account to enable automatic syncing of orders, inventory, and more.
              </p>
              <Button onClick={handleConnectQuickBooks} disabled={!profile?.id}>
                Connect to QuickBooks
              </Button>
              {!profile?.id && (
                <p className="text-sm text-red-500">
                  Please log in to connect to QuickBooks.
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                <AlertTriangle className="inline h-3 w-3 mr-1" />
                **Important:** Ensure the following `redirect_uri` is registered in your Intuit Developer application settings:
                <code className="block bg-muted/20 p-1 rounded-sm mt-1 text-xs font-mono break-all">
                  https://nojumocxivfjsbqnnkqe.supabase.co/functions/v1/quickbooks-oauth-callback
                </code>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shopify Integration Card */}
      <Card className="bg-card border-border rounded-lg shadow-sm p-6">
        <CardHeader className="pb-4 flex flex-row items-center gap-4">
          <img src={shopifyLogoSrc} alt="Shopify Logo" className="h-10 object-contain" />
          <CardTitle className="text-xl font-semibold">Shopify</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isShopifyConnected ? (
            <div className="flex flex-col gap-2">
              <p className="text-green-500 font-semibold">
                <CheckCircle className="inline h-4 w-4 mr-2" /> Connected to Shopify Store: {profile?.shopifyStoreName}!
              </p>
              <p className="text-sm text-muted-foreground">
                Your Fortress account is linked with Shopify. You can now synchronize product data.
              </p>
              <Button onClick={handleSyncShopifyProducts} disabled={isSyncingShopify}>
                {isSyncingShopify ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" /> Sync Products from Shopify
                  </>
                )}
              </Button>
              <Button variant="destructive" onClick={handleDisconnectShopify}>
                Disconnect Shopify
              </Button>

              {/* Shopify Location Mapping Section */}
              <div className="mt-6 pt-4 border-t border-border space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" /> Shopify Location Mappings
                </h3>
                <p className="text-sm text-muted-foreground">
                  Map your Shopify fulfillment locations to your Fortress inventory locations to ensure accurate stock deduction.
                </p>
                <Button onClick={fetchShopifyLocations} disabled={isFetchingShopifyLocations}>
                  {isFetchingShopifyLocations ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Fetching Locations...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" /> Fetch Shopify Locations
                    </>
                  )}
                </Button>

                {shopifyLocations.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="font-semibold text-md">Create/Update Mapping</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                      <div className="space-y-2">
                        <Label htmlFor="shopify-location-select">Shopify Location</Label>
                        <Select
                          value={selectedShopifyLocationId || ""}
                          onValueChange={(value) => {
                            setSelectedShopifyLocationId(value);
                            const existing = shopifyMappings.find(m => m.shopify_location_id === value);
                            setSelectedFortressLocationId(existing?.fortress_location_id || null);
                            setMappingToEdit(existing || null);
                          }}
                          disabled={isSavingMapping}
                        >
                          <SelectTrigger id="shopify-location-select">
                            <SelectValue placeholder="Select Shopify Location" />
                          </SelectTrigger>
                          <SelectContent>
                            {shopifyLocations.map(loc => (
                              <SelectItem key={loc.id} value={loc.id}>
                                {loc.name} ({loc.city}, {loc.country})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fortress-location-select">Fortress Location</Label>
                        <Select
                          value={selectedFortressLocationId || ""}
                          onValueChange={setSelectedFortressLocationId}
                          disabled={isSavingMapping || fortressLocations.length === 0}
                        >
                          <SelectTrigger id="fortress-location-select">
                            <SelectValue placeholder="Select Fortress Location" />
                          </SelectTrigger>
                          <SelectContent>
                            {fortressLocations.map(loc => (
                              <SelectItem key={loc.id} value={loc.id}>
                                {loc.displayName || loc.fullLocationString}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        onClick={handleSaveLocationMapping}
                        disabled={isSavingMapping || !selectedShopifyLocationId || !selectedFortressLocationId}
                      >
                        {isSavingMapping ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                          </>
                        ) : (
                          <>
                            <LinkIcon className="h-4 w-4 mr-2" /> {mappingToEdit ? "Update Mapping" : "Save Mapping"}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {isFetchingShopifyMappings ? (
                  <div className="flex items-center justify-center h-24">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="ml-2 text-muted-foreground">Loading mappings...</span>
                  </div>
                ) : shopifyMappings.length > 0 && (
                  <div className="mt-6 space-y-2">
                    <h4 className="font-semibold text-md">Existing Mappings</h4>
                    <div className="border rounded-md">
                      {shopifyMappings.map(mapping => (
                        <div key={mapping.id} className="flex items-center justify-between p-3 border-b last:border-b-0">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span>
                              <span className="font-medium">{mapping.shopify_location_name}</span>
                              <span className="text-muted-foreground"> &rarr; </span>
                              <span className="font-medium">{getFortressLocationDisplayName(mapping.fortress_location_id)}</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEditMappingClick(mapping)}>
                              <Edit className="h-4 w-4 text-primary" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteMappingClick(mapping)} disabled={isDeletingMapping}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-muted-foreground">
                Connect your Shopify store to import products and synchronize inventory levels.
              </p>
              <Button onClick={handleConnectShopify} disabled={!profile?.id}>
                Connect to Shopify
              </Button>
              {!profile?.id && (
                <p className="text-sm text-red-500">
                  Please log in to connect to Shopify.
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                <AlertTriangle className="inline h-3 w-3 mr-1" />
                **Important:** Ensure the following `redirect_uri` is registered in your Shopify Partner Dashboard application settings:
                <code className="block bg-muted/20 p-1 rounded-sm mt-1 text-xs font-mono break-all">
                  https://nojumocxivfjsbqnnkqe.supabase.co/functions/v1/shopify-oauth-callback
                </code>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Future Integrations Placeholder */}
      <Card className="bg-card border-border rounded-lg shadow-sm p-6">
        <CardHeader className="pb-4 flex flex-row items-center gap-4">
          <Plug className="h-6 w-6 text-muted-foreground" />
          <CardTitle className="text-xl font-semibold">Future Integrations</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            We're constantly working to bring you more integrations with popular business tools.
            Stay tuned for updates!
          </p>
          <ul className="list-disc list-inside text-muted-foreground mt-4 space-y-1">
            <li>Amazon Seller Central</li>
            <li>Stripe</li>
            <li>And more...</li>
          </ul>
        </CardContent>
      </Card>

      {mappingToDelete && (
        <ConfirmDialog
          isOpen={isConfirmDeleteMappingOpen}
          onClose={() => setIsConfirmDeleteMappingOpen(false)}
          onConfirm={confirmDeleteMapping}
          title="Confirm Delete Mapping"
          description={`Are you sure you want to delete the mapping for Shopify location "${mappingToDelete.shopify_location_name}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
        />
      )}
    </div>
  );
};

export default Integrations;