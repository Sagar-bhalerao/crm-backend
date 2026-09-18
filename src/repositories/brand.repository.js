import { query } from "../config/database.js";
import { parsePagination, parseSort } from "../utils/pagination.js";

const SORT_MAP = {
  name: "b.brand_name",
  code: "b.code",
  status: "b.status",
  createdAt: "b.created_date",
  updatedAt: "b.updated_date",
};

/** Shape sent to the frontend: camelCase. Status stays 1 = active, 0 = inactive. */
const toBrand = (row) => ({
  id: row.id,
  name: row.brand_name,
  code: row.code,
  description: row.description,
  logoUrl: row.logo_url,
  status: row.status,
  locationCount: row.location_count != null ? Number(row.location_count) : undefined,
  createdAt: row.created_date,
  updatedAt: row.updated_date,
});

export async function findAll({ search, status, sort, page, pageSize }) {
  const { offset, ...paging } = parsePagination({ page, pageSize });
  const whereConditions = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    whereConditions.push(`(b.brand_name ILIKE $${params.length} OR b.code ILIKE $${params.length})`);
  }

  // `status !== undefined`, never `if (status)` — 0 is falsy.
  if (status !== undefined) {
    params.push(status);
    whereConditions.push(`b.status = $${params.length}`);
  }

  const whereSql = whereConditions.length > 0
    ? `WHERE ${whereConditions.join(" AND ")}`
    : "";

  const countSql = `SELECT COUNT(*)::int AS total FROM "brand" b ${whereSql}`;
  const { rows: countRows } = await query(countSql, params);

  const orderBy = parseSort(sort, SORT_MAP, "name");
  const limitParamIndex = params.length + 1;
  const offsetParamIndex = params.length + 2;

  const itemsSql = `
    SELECT
      b.*,
      (SELECT COUNT(*) FROM "location" l WHERE l.brand_id = b.id) AS location_count
    FROM "brand" b
    ${whereSql}
    ORDER BY ${orderBy}
    LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
  `;

  const { rows } = await query(itemsSql, [...params, paging.pageSize, offset]);

  return {
    items: rows.map(toBrand),
    total: countRows[0].total,
    ...paging,
  };
}

export async function findById(id) {
  const sql = `
    SELECT
      b.*,
      (SELECT COUNT(*) FROM "location" l WHERE l.brand_id = b.id) AS location_count
    FROM "brand" b
    WHERE b.id = $1
  `;

  const { rows } = await query(sql, [id]);
  return rows[0] ? toBrand(rows[0]) : null;
}

/** Code check is case-insensitive; pass excludeId when updating. */
export async function findByCode(code, excludeId = null) {
  const sql = `
    SELECT *
    FROM "brand"
    WHERE UPPER(code) = UPPER($1)
      AND ($2::int IS NULL OR id <> $2)
    LIMIT 1
  `;

  const { rows } = await query(sql, [code, excludeId]);
  return rows[0] ? toBrand(rows[0]) : null;
}

export async function insert({ name, code, description, logoUrl, status = 1 }) {
  const sql = `
    INSERT INTO "brand" (brand_name, code, description, logo_url, status, created_date, updated_date)
    VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
    RETURNING id
  `;

  const { rows } = await query(sql, [name, code, description, logoUrl, status]);
  return findById(rows[0].id);
}

/** Updates only the fields present in `changes`. */
export async function update(id, changes) {
  const columnMap = {
    name: "brand_name",
    code: "code",
    description: "description",
    logoUrl: "logo_url",
    status: "status",
  };

  const setStatements = [];
  const params = [];

  for (const [key, columnName] of Object.entries(columnMap)) {
    if (key in changes) {
      params.push(changes[key]);
      setStatements.push(`${columnName} = $${params.length}`);
    }
  }

  if (setStatements.length === 0) {
    return findById(id);
  }

  params.push(id);
  const idParamIndex = params.length;

  const sql = `
    UPDATE "brand"
    SET ${setStatements.join(", ")}, updated_date = NOW()
    WHERE id = $${idParamIndex}
    RETURNING id
  `;

  const { rows } = await query(sql, params);
  return rows[0] ? findById(rows[0].id) : null;
}

export async function countLocations(brandId) {
  const sql = `SELECT COUNT(*)::int AS n FROM "location" WHERE brand_id = $1`;
  const { rows } = await query(sql, [brandId]);
  return rows[0].n;
}

export async function remove(id) {
  const sql = `DELETE FROM "brand" WHERE id = $1`;
  const { rowCount } = await query(sql, [id]);
  return rowCount > 0;
}