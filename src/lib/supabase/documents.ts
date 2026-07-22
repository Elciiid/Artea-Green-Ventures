// Phase 10b-3d — real Storage for application documents. Upload attaches a
// file to an existing pending document row (this phase doesn't support
// adding a brand-new document type, only fulfilling one already on record);
// download signs a short-lived URL against the private "agv-documents"
// bucket. Storage RLS (see the 10b-3d migration) mirrors the same
// admin/staff-grant/client-grant boundary the database RLS already uses —
// this module doesn't decide who can upload or download, Postgres does.

import { getSupabaseClient } from "@/lib/supabase/client";
import { findApplicationId } from "@/lib/supabase/applications";

const BUCKET = "agv-documents";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/**
 * Upload a file for an existing pending document, marking it received.
 * Path is "{applicationId}/{documentId}-{filename}" — the storage RLS
 * policies extract the leading applicationId segment to check the grant.
 */
export async function uploadDocument(
  reference: string,
  documentId: string,
  file: File,
  actor: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const applicationId = await findApplicationId(reference);
  if (!applicationId) throw new Error(`${reference} not found or not accessible.`);

  const path = `${applicationId}/${documentId}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true });
  if (uploadError) throw uploadError;

  const { error: updateError } = await supabase
    .from("agv_documents")
    .update({
      storage_path: path,
      status: "received",
      size_label: formatSize(file.size),
      uploaded_by: actor,
      uploaded_at: new Date().toISOString(),
    })
    .eq("id", documentId);
  if (updateError) throw updateError;
}

/** A short-lived signed URL for downloading a received document. */
export async function getDocumentDownloadUrl(storagePath: string): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60);
  if (error) throw error;
  return data.signedUrl;
}
