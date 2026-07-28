// A Supabase select returns at most one page of rows, so any query that needs the
// whole table has to walk it. `page` is handed an inclusive [from, to] range and
// should return the matching rows in a stable order — an unstable order can skip
// or duplicate rows across page boundaries.
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error?: any }>,
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw error;
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) return rows;
  }
}
