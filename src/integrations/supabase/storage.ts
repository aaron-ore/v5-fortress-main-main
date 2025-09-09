import { supabase } from "@/lib/supabaseClient";
import { v4 as uuidv4 } from 'uuid';

/**
 * Uploads a file to a specified Supabase Storage bucket and returns its path within the bucket.
 * @param file The File object to upload.
 * @param bucketName The name of the Supabase Storage bucket.
 * @param folderPath The path within the bucket (e.g., 'avatars/', 'company-logos/').
 * @returns A promise that resolves with the path of the uploaded file within the bucket.
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

  // Return the path within the bucket, which is what the Edge Function expects for download/delete.
  return filePath;
};