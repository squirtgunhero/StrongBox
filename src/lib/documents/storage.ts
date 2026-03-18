import { supabaseAdmin } from "@/lib/supabase/admin";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "strongbox-documents";

/**
 * Upload a file to Supabase Storage
 */
export async function uploadFile(
  path: string,
  file: File | Buffer,
  contentType: string
) {
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType,
      upsert: false,
    });

  if (error) throw error;
  return data;
}

/**
 * Generate a signed URL for file access
 */
export async function getSignedUrl(
  path: string,
  expiresIn = 3600
): Promise<string> {
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error) throw error;
  return data.signedUrl;
}

/**
 * Delete a file from storage
 */
export async function deleteFile(path: string) {
  const { error } = await supabaseAdmin.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}
