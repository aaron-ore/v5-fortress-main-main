"use client";

import React, { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useProfile } from "@/context/ProfileContext";
import { showError, showSuccess } from "@/utils/toast";
import { Loader2, Palette, Settings as SettingsIcon, ImageIcon, X } from "lucide-react";
import { uploadFileToSupabase, getPublicUrlFromSupabase, getFilePathFromPublicUrl } from "@/integrations/supabase/storage"; // NEW: Import getFilePathFromPublicUrl
import { supabase } from "@/lib/supabaseClient";

void getPublicUrlFromSupabase; // Suppress TS6133: 'getPublicUrlFromSupabase' is declared but its value is never read.

const Settings: React.FC = () => {
  const { setTheme } = useTheme();
  const { profile, updateCompanyProfile, updateOrganizationTheme } = useProfile();

  const [companyName, setCompanyName] = useState(profile?.companyProfile?.companyName || "");
  const [companyAddress, setCompanyAddress] = useState(profile?.companyProfile?.companyAddress || "");
  const [companyCurrency, setCompanyCurrency] = useState(profile?.companyProfile?.companyCurrency || "USD");
  const [companyLogoFile, setCompanyLogoFile] = useState<File | null>(null);
  const [companyLogoUrlPreview, setCompanyLogoUrlPreview] = useState<string | undefined>(profile?.companyProfile?.companyLogoUrl || undefined); // This is a PUBLIC URL
  const [isSavingCompanyProfile, setIsSavingCompanyProfile] = useState(false);
  const [organizationCodeInput, setOrganizationCodeInput] = useState<string>(profile?.companyProfile?.organizationCode || "");
  const [isSavingOrganizationCode, setIsSavingOrganizationCode] = useState(false);

  const [selectedTheme, setSelectedTheme] = useState(profile?.companyProfile?.organizationTheme || "dark");
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isLogoCleared, setIsLogoCleared] = useState(false); // Flag to indicate if logo was explicitly cleared

  useEffect(() => {
    if (profile?.companyProfile) {
      setCompanyName(profile.companyProfile.companyName || "");
      setCompanyAddress(profile.companyProfile.companyAddress || "");
      setCompanyCurrency(profile.companyProfile.companyCurrency || "USD");
      setCompanyLogoUrlPreview(profile.companyProfile.companyLogoUrl || undefined); // profile.companyProfile.companyLogoUrl is already a PUBLIC URL from context
      setOrganizationCodeInput(profile.companyProfile.organizationCode || "");
      setSelectedTheme(profile.companyProfile.organizationTheme || "dark");
      setIsLogoCleared(false); // Reset on profile load
      console.log("[Settings] useEffect: Profile loaded. companyLogoUrl (public from context):", profile.companyProfile.companyLogoUrl, "companyLogoUrlPreview (state):", companyLogoUrlPreview);
    }
  }, [profile?.companyProfile]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      if (file.type.startsWith("image/")) {
        setCompanyLogoFile(file);
        setIsLogoCleared(false);
        const reader = new FileReader();
        reader.onloadend = () => {
          setCompanyLogoUrlPreview(reader.result as string); // This is a data:URL for immediate preview
        };
        reader.readAsDataURL(file);
        console.log("[Settings] handleFileChange: New file selected. File name:", file.name);
      } else {
        showError("Please select an image file (PNG, JPG, GIF, SVG).");
        setCompanyLogoFile(null);
        // Revert preview to current logo if invalid file selected
        setCompanyLogoUrlPreview(profile?.companyProfile?.companyLogoUrl || undefined);
        console.log("[Settings] handleFileChange: Invalid file type. Reverting preview to:", profile?.companyProfile?.companyLogoUrl || undefined);
      }
    } else {
      setCompanyLogoFile(null);
      // Revert preview to current logo if file input cleared without selection
      setCompanyLogoUrlPreview(profile?.companyProfile?.companyLogoUrl || undefined);
      console.log("[Settings] handleFileChange: File input cleared without selection. Reverting preview to:", profile?.companyProfile?.companyLogoUrl || undefined);
    }
  };

  const handleClearLogo = () => {
    setCompanyLogoFile(null);
    setCompanyLogoUrlPreview(undefined); // Set to undefined to clear preview
    setIsLogoCleared(true); // Mark that the logo was intentionally cleared
    showSuccess("Logo cleared. Save changes to apply.");
    console.log("[Settings] handleClearLogo: Logo explicitly cleared. isLogoCleared:", true);
  };

  const handleSaveCompanyProfile = async () => {
    if (!companyName || !companyCurrency || !companyAddress) {
      showError("Please fill in all company profile fields.");
      return;
    }

    setIsSavingCompanyProfile(true);
    let finalCompanyLogoUrlForDb: string | undefined; // This will be the INTERNAL PATH to pass to context

    console.log("[Settings] handleSaveCompanyProfile: Initial profile.companyProfile.companyLogoUrl (public from context):", profile?.companyProfile?.companyLogoUrl);
    console.log("[Settings] handleSaveCompanyProfile: companyLogoFile (new file selected):", companyLogoFile);
    console.log("[Settings] handleSaveCompanyProfile: isLogoCleared (explicitly cleared):", isLogoCleared);

    try {
      if (companyLogoFile) {
        setIsUploadingImage(true);
        console.log("[Settings] handleSaveCompanyProfile: New companyLogoFile detected.");
        if (profile?.companyProfile?.companyLogoUrl) { // If there was an existing logo (public URL from context)
          console.log("[Settings] handleSaveCompanyProfile: Existing logo found, attempting to delete old one from storage. Old public URL:", profile.companyProfile.companyLogoUrl);
          const internalPathToDelete = getFilePathFromPublicUrl(profile.companyProfile.companyLogoUrl, 'company-logos');
          if (internalPathToDelete) {
            const { error: deleteError } = await supabase.storage.from('company-logos').remove([internalPathToDelete]);
            if (deleteError) console.warn("Failed to delete old image from storage:", deleteError);
            else showSuccess("Old image deleted from storage.");
          }
        }
        finalCompanyLogoUrlForDb = await uploadFileToSupabase(companyLogoFile, 'company-logos', 'logos/'); // Returns INTERNAL PATH
        showSuccess("Company logo uploaded successfully!");
        console.log("[Settings] handleSaveCompanyProfile: New logo uploaded. Internal path for DB:", finalCompanyLogoUrlForDb);
      } else if (isLogoCleared) {
        console.log("[Settings] handleSaveCompanyProfile: Logo was explicitly cleared (isLogoCleared is true).");
        if (profile?.companyProfile?.companyLogoUrl) { // If there was an existing logo to clear (public URL from context)
          console.log("[Settings] handleSaveCompanyProfile: Existing logo found, attempting to delete from storage. Old public URL:", profile.companyProfile.companyLogoUrl);
          const internalPathToDelete = getFilePathFromPublicUrl(profile.companyProfile.companyLogoUrl, 'company-logos');
          if (internalPathToDelete) {
            const { error: deleteError } = await supabase.storage.from('company-logos').remove([internalPathToDelete]);
            if (deleteError) console.warn("Failed to delete old image from storage:", deleteError);
            else showSuccess("Old image deleted from storage.");
          }
        }
        finalCompanyLogoUrlForDb = undefined; // Set to undefined to clear in DB
        console.log("[Settings] handleSaveCompanyProfile: finalCompanyLogoUrlForDb set to undefined (logo cleared).");
      } else {
        // No new file and not explicitly cleared. Keep existing internal path.
        finalCompanyLogoUrlForDb = profile?.companyProfile?.companyLogoUrl ? getFilePathFromPublicUrl(profile.companyProfile.companyLogoUrl, 'company-logos') || undefined : undefined;
        console.log("[Settings] handleSaveCompanyProfile: No image change. Keeping existing internal path:", finalCompanyLogoUrlForDb);
      }
      console.log("[Settings] handleSaveCompanyProfile: Final companyLogoUrlForDb before calling updateCompanyProfile:", finalCompanyLogoUrlForDb);

    } catch (error: any) {
      console.error("Error processing company logo:", error);
      showError(`Failed to process company logo: ${error.message}`);
      setIsSavingCompanyProfile(false);
      setIsUploadingImage(false);
      return;
    } finally {
      setIsUploadingImage(false);
    }

    try {
      await updateCompanyProfile({
        companyName: companyName,
        companyAddress: companyAddress,
        companyCurrency: companyCurrency,
        companyLogoUrl: finalCompanyLogoUrlForDb, // This is the INTERNAL path or undefined
      }, organizationCodeInput);
    } catch (error: any) {
      showError(`Failed to update company profile: ${error.message}`);
    } finally {
      setIsSavingCompanyProfile(false);
    }
  };

  const handleSaveOrganizationCode = async () => {
    if (!profile?.organizationId) {
      showError("Organization not found. Please set up your company profile first.");
      return;
    }
    if (!organizationCodeInput.trim()) {
      showError("Organization Code cannot be empty.");
      return;
    }
    if (organizationCodeInput === (profile?.companyProfile?.organizationCode || "")) {
      showSuccess("No changes to save for Organization Code.");
      return;
    }

    setIsSavingOrganizationCode(true);
    try {
      await updateCompanyProfile({
        organizationCode: organizationCodeInput.trim(),
      }, organizationCodeInput.trim());
    } catch (error: any) {
      showError(`Failed to update Organization Code: ${error.message}`);
    } finally {
      setIsSavingOrganizationCode(false);
    }
  };

  const handleSaveTheme = async () => {
    if (!profile?.organizationId) {
      showError("Organization not found. Please set up your company profile first.");
      return;
    }
    if (selectedTheme === (profile?.companyProfile?.organizationTheme || "dark")) {
      showSuccess("No changes to save for Theme.");
      return;
    }
    setIsSavingTheme(true);
    try {
      await updateOrganizationTheme(selectedTheme);
      setTheme(selectedTheme);
    } catch (error: any) {
      console.error("Error updating organization theme:", error);
      showError(`Failed to update theme: ${error.message}`);
    } finally {
      setIsSavingTheme(false);
    }
  };

  const hasCompanyProfileChanges =
    companyName !== (profile?.companyProfile?.companyName || "") ||
    companyAddress !== (profile?.companyProfile?.companyAddress || "") ||
    companyCurrency !== (profile?.companyProfile?.companyCurrency || "USD") ||
    (companyLogoFile !== null) || // New file selected
    isLogoCleared; // Explicitly cleared

  const hasOrganizationCodeChanges = organizationCodeInput !== (profile?.companyProfile?.organizationCode || "");
  const hasThemeChanges = selectedTheme !== (profile?.companyProfile?.organizationTheme || "dark");

  const availableThemes = ['dark', 'emerald', 'deep-forest', 'tropical-indigo', 'light-grey-indigo'];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Company Profile</CardTitle>
          <CardDescription>Manage your company's basic information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name <span className="text-red-500">*</span></Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyCurrency">Default Currency</Label>
              <Select value={companyCurrency} onValueChange={setCompanyCurrency}>
                <SelectTrigger id="companyCurrency">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                  <SelectItem value="GBP">GBP (£)</SelectItem>
                  <SelectItem value="JPY">JPY (¥)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyAddress">Company Address</Label>
            <Textarea
              id="companyAddress"
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              placeholder="123 Business Rd, Suite 100, City, State, Zip"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyLogoFile">Company Logo (Optional)</Label>
            <Input
              id="companyLogoFile"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
            />
            {companyLogoUrlPreview ? (
              <div className="mt-2 p-2 border border-border rounded-md flex items-center justify-between bg-muted/20">
                <img src={companyLogoUrlPreview} alt="Company Logo Preview" className="max-h-24 object-contain" />
                <Button variant="ghost" size="icon" onClick={handleClearLogo} aria-label="Clear logo">
                  <X className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ) : (
              <div className="mt-2 p-4 border border-dashed border-muted-foreground/50 rounded-md flex items-center justify-center text-muted-foreground text-sm">
                <ImageIcon className="h-5 w-5 mr-2" /> No logo selected
              </div>
            )}
          </div>
          <Button onClick={handleSaveCompanyProfile} disabled={isSavingCompanyProfile || !hasCompanyProfileChanges || isUploadingImage}>
            {isSavingCompanyProfile || isUploadingImage ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              "Save Company Profile"
            )}
          </Button>
        </CardContent>
      </Card>

      {profile?.role === 'admin' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-6 w-6 text-primary" /> Organization Theme
            </CardTitle>
            <CardDescription>
              Select a theme for your entire organization. This will apply to all users.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup value={selectedTheme} onValueChange={setSelectedTheme} className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {availableThemes.map(t => (
                <div key={t} className="flex items-center space-x-2">
                  <RadioGroupItem value={t} id={`theme-${t}`} />
                  <Label htmlFor={`theme-${t}`} className="capitalize">
                    {t.replace(/-/g, ' ')}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            <Button onClick={handleSaveTheme} disabled={isSavingTheme || !hasThemeChanges}>
              {isSavingTheme ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving Theme...
                </>
              ) : (
                "Save Theme"
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {profile?.role === 'admin' && profile?.organizationId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="h-6 w-6 text-primary" /> Organization Code
            </CardTitle>
            <CardDescription>
              Set or update the unique code for your organization. New users can use this code to join.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="organizationCode">Unique Organization Code</Label>
              <Input
                id="organizationCode"
                value={organizationCodeInput}
                onChange={(e) => setOrganizationCodeInput(e.target.value)}
                placeholder="e.g., MYCOMPANY123"
              />
            </div>
            <Button onClick={handleSaveOrganizationCode} disabled={isSavingOrganizationCode || !hasOrganizationCodeChanges}>
              {isSavingOrganizationCode ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving Code...
                </>
              ) : (
                "Save Organization Code"
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Settings;