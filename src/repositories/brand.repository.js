import { query } from "../config/database.js";
import { TABLES } from "../config/tables.js";
import { parsePagination, parseSort } from "../utils/pagination.js";

const SORTABLE = ["name", "code", "status", "created_at", "updated_at"];

/** Shape sent to the frontend: camelCase, with the location count. */
const toBrand = (row) => ({
  id: row.id,
  name: row.name,
  code: row.code,
  description: row.description,
  logoUrl: row.logo_url,
  status: row.status,
  locationCount: row.location_count != null ? Number(row.location_count) : undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export async function findAll({ search, status, sort, page, pageSize }) {
  const { offset, ...paging } = parsePagination({ page, pageSize });
  const where = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    where.push(`(b.name ILIKE $${params.length} OR b.code ILIKE $${params.length})`);
  }
  if (status) {
    params.push(status);
    where.push(`b.status = $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const { rows: countRows } = await query(`SELECT count(*)::int AS total FROM "${TABLES.brands}" b ${whereSql}`, params);

  const { rows } = await query(
    `SELECT b.*, (SELECT count(*) FROM "${TABLES.locations}" l WHERE l.brand_id = b.id) AS location_count
       FROM "${TABLES.brands}" b
       ${whereSql}
      ORDER BY ${parseSort(sort, SORTABLE, "name")}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, paging.pageSize, offset]
  );

  return { items: rows.map(toBrand), total: countRows[0].total, ...paging };
}

export async function findById(id) {
  const { rows } = await query(
    `SELECT b.*, (SELECT count(*) FROM "${TABLES.locations}" l WHERE l.brand_id = b.id) AS location_count
       FROM "${TABLES.brands}" b WHERE b.id = $1`,
    [id]
  );
  return rows[0] ? toBrand(rows[0]) : null;
}

/** Code check is case-insensitive; pass excludeId when updating. */
export async function findByCode(code, excludeId = null) {
  const { rows} = await query(
    `SELECT * FROM "${TABLES.brands}" WHERE UPPER(code) = UPPER($1) AND ($2::int IS NULL OR id <> $2) LIMIT 1`,
    [code, excludeId]
  );
  return rows[0] ? toBrand(rows[0]) : null;
}

export async function insert({ name, code, description, logoUrl, status }) {
  const { rows } = await query(
    `INSERT INTO "${TABLES.brands}" (name, code, description, logo_url, status)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [name, code, description, logoUrl, status]
  );
  return toBrand(rows[0]);
}

/** Updates only the fields present in `changes`. */
export async function update(id, changes) {
  const map = { name: "name", code: "code", description: "description", logoUrl: "logo_url", status: "status" };
  const sets = [];
  const params = [];

  for (const [key, column] of Object.entries(map)) {
    if (key in changes) {
      params.push(changes[key]);
      sets.push(`${column} = $${params.length}`);
    }
  }
  if (sets.length === 0) return findById(id);

  params.push(id);
  const { rows } = await query(
    `UPDATE "${TABLES.brands}" SET ${sets.join(", ")}, updated_at = now() WHERE id = $${params.length} RETURNING *`,
    params
  );
  return rows[0] ? toBrand(rows[0]) : null;
}

export async function countLocations(brandId) {
  const { rows } = await query(`SELECT count(*)::int AS n FROM "${TABLES.locations}" WHERE brand_id = $1`, [brandId]);
  return rows[0].n;
}
