import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
);

export const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET!;

export async function uploadGroupCover(file: File, groupId: string): Promise<string | null> {
  const ext = file.name.split(".").pop() || "png";
  const path = `${groupId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    console.error("Upload error:", error.message);
    return null;
  }

  const { data } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(path);

  return data.publicUrl;
}
