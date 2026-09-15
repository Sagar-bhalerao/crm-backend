/** Turns ?page=&pageSize= into safe numbers with a limit. */
export function parsePagination({ page, pageSize }, defaultSize = 10, maxSize = 100) {
  const p = Math.max(1, Number(page) || 1);
  const size = Math.min(maxSize, Math.max(1, Number(pageSize) || defaultSize));
  return { page: p, pageSize: size, offset: (p - 1) * size };
}

/**
 * Turns ?sort=name:asc into a SQL fragment, allowing only known columns.
 * Never interpolate a raw sort value into SQL.
 */
export function parseSort(sort, allowed, fallback) {
  const [field, direction] = String(sort || "").split(":");
  const column = allowed.includes(field) ? field : fallback;
  const dir = direction?.toLowerCase() === "asc" ? "ASC" : direction?.toLowerCase() === "desc" ? "DESC" : "ASC";
  return `${column} ${dir}`;
}
