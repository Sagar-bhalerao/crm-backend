import { query } from "../config/database.js";
import { TABLES } from "../config/tables.js";
import { parsePagination, parseSort } from "../utils/pagination.js";

const SORTABLE = ["brand_name", "code", "status", "created_date", "updated_date"];

/** Shape sent to the frontend: camelCase, with the location count. */
const toBrand = (row) => ({
  id: row.id,
  name: row.brand_name, // Map database 'brand_name' to frontend 'name'
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

  // 1. Build search filters step-by-step
  if (search) {
    params.push(`%${search}%`);
    whereConditions.push(`(b.brand_name ILIKE $${params.length} OR b.code ILIKE $${params.length})`);
  }

  if (status) {
    params.push(status);
    whereConditions.push(`b.status = $${params.length}`);
  }

  // Combine conditions into a simple WHERE clause string
  const whereSql = whereConditions.length > 0 
    ? `WHERE ${whereConditions.join(" AND ")}` 
    : "";

  // 2. Fetch total count
  const countSql = `SELECT COUNT(*)::int AS total FROM "brand" b ${whereSql}`;
  const { rows: countRows } = await query(countSql, params);

  // 3. Fetch items with pagination
  const orderBy = parseSort(sort, SORTABLE, "brand_name");
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
    ...paging 
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

export async function insert({ name, code, description, logoUrl, status }) {
  const sql = `
    INSERT INTO "brand" (brand_name, code, description, logo_url, status, created_date, updated_date)
    VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
    RETURNING *
  `;
  
  const { rows } = await query(sql, [name, code, description, logoUrl, status]);
  return toBrand(rows[0]);
}

/** Updates only the fields present in `changes`. */
export async function update(id, changes) {
  const columnMap = { 
    name: "brand_name", 
    code: "code", 
    description: "description", 
    logoUrl: "logo_url", 
    status: "status" 
  };
  
  const setStatements = [];
  const params = [];

  // Build key-value update strings clearly
  for (const [key, columnName] of Object.entries(columnMap)) {
    if (key in changes) {
      params.push(changes[key]);
      setStatements.push(`${columnName} = $${params.length}`);
    }
  }

  // Nothing to update
  if (setStatements.length === 0) {
    return findById(id);
  }

  params.push(id);
  const idParamIndex = params.length;

  const sql = `
    UPDATE "brand" 
    SET ${setStatements.join(", ")}, updated_date = NOW() 
    WHERE id = $${idParamIndex} 
    RETURNING *
  `;

  const { rows } = await query(sql, params);
  return rows[0] ? toBrand(rows[0]) : null;
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