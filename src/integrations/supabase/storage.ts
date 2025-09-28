import { supabase } from "@/lib/supabaseClient";
import { v4 as uuidv4 } from 'uuid';

/**
 * Uploads a file to a specified Supabase Storage bucket and returns its internal file path.
 * @param file The File object to upload.
 * @param bucketName The name of the Supabase Storage bucket.
 * @param folderPath The path within the bucket (e.g., 'avatars/', 'company-logos/').
 * @returns A promise that resolves with the internal file path of the uploaded file.
 * @throws An error if the upload fails.
 */
export const uploadFileToSupabase = async (file: File, bucketName: string, folderPath: string = ''): Promise<string> => {
  if (!file) {
    throw new Error("No file provided for upload.");
  }

  const fileExtension = file.name.split('.').pop();
  const fileName = `${uuidv4()}.${fileExtension}`;
  const filePath = `${folderPath}${fileName}`; // This is the internal path

  console.log(`[Storage] Uploading file to bucket: ${bucketName}, path: ${filePath}`);

  const { error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error("[Storage] Supabase file upload error:", error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  console.log(`[Storage] File uploaded successfully. Internal path: ${filePath}`);
  return filePath; // Return the internal file path
};

/**
 * Extracts the file path within the bucket from a Supabase public URL.
 * This is needed for deleting files from storage.
 * @param publicUrl The public URL of the file.
 * @param bucketName The name of the bucket.
 * @returns The file path within the bucket, or null if not found.
 */
export const getFilePathFromPublicUrl = (publicUrl: string, bucketName: string): string | null => {
  // Ensure publicUrl is actually a URL and contains the bucket name
  if (!publicUrl || !publicUrl.includes(`/${bucketName}/`)) {
    console.warn(`[Storage] getFilePathFromPublicUrl: Invalid publicUrl or bucketName mismatch. Public URL: ${publicUrl}, Bucket: ${bucketName}`);
    return null;
  }
  const regex = new RegExp(`/${bucketName}/(.+)`);
  const match = publicUrl.match(regex);
  const filePath = match ? match[1] : null;
  console.log(`[Storage] getFilePathFromPublicUrl: Public URL: ${publicUrl}, Extracted internal path: ${filePath}`);
  return filePath;
};

/**
 * Generates the public URL for a file given its internal path and bucket name.
 * @param filePath The internal path of the file within the bucket (e.g., 'items/uuid.png').
 * @param bucketName The name of the Supabase Storage bucket.
 * @returns The full public URL of the file.
 */
export const getPublicUrlFromSupabase = (filePath: string, bucketName: string): string => {
  // Ensure filePath is not already a public URL
  if (filePath.startsWith('http')) {
    console.warn(`[Storage] getPublicUrlFromSupabase: filePath already looks like a public URL. Returning as is. FilePath: ${filePath}`);
    return filePath;
  }
  const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
  console.log(`[Storage] getPublicUrlFromSupabase: Internal path: ${filePath}, Generated public URL: ${data.publicUrl}`);
  return data.publicUrl;
};