import { query } from "../config/database.js";
import { parsePagination, parseSort } from "../utils/pagination.js";

const SORT_MAP = {
  name: "l.location_name",
  brand: "b.brand_name",
  status: "l.status",
  createdAt: "l.created_date",
  updatedAt: "l.updated_date",
};

/** Shape sent to the frontend: camelCase, brand flattened in. Status stays 1/0. */
const toLocation = (row) => ({
  id: row.id,
  brandId: row.brand_id,
  brandName: row.brand_name ?? undefined,
  name: row.location_name,
  status: row.status,
  createdAt: row.created_date,
  updatedAt: row.updated_date,
});

const BASE_SELECT = `
  SELECT l.*, b.brand_name
  FROM "location" l
  JOIN "brand" b ON b.id = l.brand_id
`;

export async function findAll({ search, brandId, status, sort, page, pageSize }) {
  const { offset, ...paging } = parsePagination({ page, pageSize });
  const conditions = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`l.location_name ILIKE $${params.length}`);
  }
  if (brandId) {
    params.push(brandId);
    conditions.push(`l.brand_id = $${params.length}`);
  }
  // `status !== undefined`, never `if (status)` — 0 is falsy.
  if (status !== undefined) {
    params.push(status);
    conditions.push(`l.status = $${params.length}`);
  }

  const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const countSql = `
    SELECT COUNT(*)::int AS total
    FROM "location" l
    JOIN "brand" b ON b.id = l.brand_id
    ${whereSql}
  `;
  const { rows: countRows } = await query(countSql, params);

  const orderBy = parseSort(sort, SORT_MAP, "name");
  const itemsSql = `
    ${BASE_SELECT}
    ${whereSql}
    ORDER BY ${orderBy}
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;
  const { rows } = await query(itemsSql, [...params, paging.pageSize, offset]);

  return { items: rows.map(toLocation), total: countRows[0].total, ...paging };
}

export async function findById(id) {
  const { rows } = await query(`${BASE_SELECT} WHERE l.id = $1`, [id]);
  return rows[0] ? toLocation(rows[0]) : null;
}

/** Name must be unique inside its brand; pass excludeId when updating. */
export async function findByName(brandId, name, excludeId = null) {
  const sql = `
    SELECT * FROM "location"
    WHERE brand_id = $1
      AND LOWER(location_name) = LOWER($2)
      AND ($3::int IS NULL OR id <> $3)
    LIMIT 1
  `;
  const { rows } = await query(sql, [brandId, name, excludeId]);
  return rows[0] ? toLocation(rows[0]) : null;
}

export async function insert({ brandId, name, status = 1 }) {
  const sql = `
    INSERT INTO "location" (brand_id, location_name, status)
    VALUES ($1, $2, $3)
    RETURNING id
  `;
  const { rows } = await query(sql, [brandId, name, status]);
  return findById(rows[0].id);
}

/** Updates only the fields present in `changes`. */
export async function update(id, changes) {
  const columnMap = { brandId: "brand_id", name: "location_name", status: "status" };
  const setStatements = [];
  const params = [];

  for (const [key, columnName] of Object.entries(columnMap)) {
    if (key in changes) {
      params.push(changes[key]);
      setStatements.push(`${columnName} = $${params.length}`);
    }
  }
  if (!setStatements.length) return findById(id);

  params.push(id);
  const sql = `
    UPDATE "location"
    SET ${setStatements.join(", ")}, updated_date = NOW()
    WHERE id = $${params.length}
    RETURNING id
  `;
  const { rows } = await query(sql, params);
  return rows[0] ? findById(rows[0].id) : null;
}

export async function remove(id) {
  const { rowCount } = await query(`DELETE FROM "location" WHERE id = $1`, [id]);
  return rowCount > 0;
}