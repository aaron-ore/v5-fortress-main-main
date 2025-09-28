import { supabase } from "@/lib/supabaseClient";
import { v4 as uuidv4 } from 'uuid';

/**
 * Uploads a file to a specified Supabase Storage bucket and returns its internal path.
 * @param file The File object to upload.
 * @param bucketName The name of the Supabase Storage bucket.
 * @param folderPath The path within the bucket (e.g., 'avatars/', 'company-logos/').
 * @returns A promise that resolves with the internal path of the uploaded file within the bucket.
 * @throws An error if the upload fails.
 */
export const uploadFileToSupabase = async (file: File, bucketName: string, folderPath: string = ''): Promise<string> => {
  if (!file) {
    throw new Error("No file provided for upload.");
  }

  const fileExtension = file.name.split('.').pop();
  const fileName = `${uuidv4()}.${fileExtension}`;
  const filePath = `${folderPath}${fileName}`; // This is the internal path

  const { error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error("Supabase file upload error:", error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  // Return the internal file path, as this is what the Edge Function expects for download.
  return filePath;
};

/**
 * Extracts the file path within the bucket from a Supabase public URL.
 * This is needed for deleting files from storage.
 * @param publicUrl The public URL of the file.
 * @param bucketName The name of the bucket.
 * @returns The file path within the bucket, or null if not found.
 */
export const getFilePathFromPublicUrl = (publicUrl: string, bucketName: string): string | null => {
  // This function is no longer strictly needed if we consistently store internal paths in DB.
  // However, it can be useful for parsing existing public URLs if they were stored directly.
  const regex = new RegExp(`/${bucketName}/(.+)`);
  const match = publicUrl.match(regex);
  return match ? match[1] : null;
};

/**
 * Generates the public URL for a file given its internal path and bucket name.
 * @param filePath The internal path of the file within the bucket (e.g., 'items/uuid.png').
 * @param bucketName The name of the Supabase Storage bucket.
 * @returns The full public URL of the file.
 */
export const getPublicUrlFromSupabase = (filePath: string, bucketName: string): string => {
  const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
  return data.publicUrl;
};