export type BulkStatus = { text: string; ok: boolean };

// Maps the outcome of a bulk add-to-set request to the message shown beside the
// selection toolbar. `result` is null when the request never completed (network
// failure), which must not read as success.
//
// 403 gets its own message because it isn't worth retrying: the sets list is
// rehydrated from sessionStorage on mount, so a set the user has since lost
// write access to can still be offered until the fresh fetch replaces it.
export function bulkAddStatus(
  setName: string,
  result: { ok: boolean; status: number } | null
): BulkStatus {
  if (result?.ok) return { text: `Added to ${setName}`, ok: true };
  if (result?.status === 403) return { text: `No longer have access to ${setName}`, ok: false };
  return { text: `Couldn't add to ${setName}`, ok: false };
}
