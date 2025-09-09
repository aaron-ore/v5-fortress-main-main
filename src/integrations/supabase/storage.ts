import { supabase } from "@/lib/supabaseClient";
import { v4 as uuidv4 } from 'uuid';

/**
 * Uploads a file to a specified Supabase Storage bucket and returns its public URL.
 * @param file The File object to upload.
 * @param bucketName The name of the Supabase Storage bucket.
 * @param folderPath The path within the bucket (e.g., 'avatars/', 'company-logos/').
 * @returns A promise that resolves with the public URL of the uploaded file.
 * @throws An error if the upload fails.
 */
export const uploadFileToSupabase = async (file: File, bucketName: string, folderPath: string = ''): Promise<string> => {
  if (!file) {
    throw new Error("No file provided for upload.");
  }

  const fileExtension = file.name.split('.').pop();
  const fileName = `${uuidv4()}.${fileExtension}`; // Generate a unique file name
  const filePath = `${folderPath}${fileName}`; // This is the path within the bucket

  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false, // Do not overwrite existing files with the same name
    });

  if (error) {
    console.error("Supabase file upload error:", error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  // Get the public URL of the uploaded file
  const { data: publicUrlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(filePath);

  if (!publicUrlData || !publicUrlData.publicUrl) {
    throw new Error("Failed to get public URL for the uploaded file.");
  }

  return publicUrlData.publicUrl;
};

/**
 * Extracts the file path within the bucket from a Supabase public URL.
 * This is needed for deleting files from storage.
 * @param publicUrl The public URL of the file.
 * @param bucketName The name of the bucket.
 * @returns The file path within the bucket, or null if not found.
 */
export const getFilePathFromPublicUrl = (publicUrl: string, bucketName: string): string | null => {
  const regex = new RegExp(`/${bucketName}/(.+)`);
  const match = publicUrl.match(regex);
  return match ? match[1] : null;
};