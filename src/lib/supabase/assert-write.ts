// Shared write-verification helper. Postgres UPDATE with a USING clause that
// matches 0 rows doesn't error — it just "succeeds" with an empty result
// (unlike INSERT, which throws on a failing WITH CHECK). Every UPDATE gated
// by an RLS grant must check a row actually came back, or a permission gap
// silently no-ops instead of failing loudly. This caught two real bugs in
// Phase 10b-3 (agv_documents, storage.objects), each fixed with the same ad
// hoc inline check — extracted here so a third call site doesn't repeat it.

export function assertRowReturned<T>(rows: T[] | null, message: string): T {
  if (!rows || rows.length === 0) {
    throw new Error(message);
  }
  return rows[0];
}
