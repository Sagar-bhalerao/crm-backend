import { query } from "../config/database.js";
import { TABLES } from "../config/tables.js";
import { parsePagination, parseSort } from "../utils/pagination.js";

const SORTABLE = ["location_name", "code", "city", "status", "created_at", "updated_at"];

const toLocation = (row) => ({
  id: row.id,
  brandId: row.brand_id,
  brandName: row.brand_name,
  brandCode: row.brand_code,
  name: row.location_name,
  code: row.code,
  city: row.city,
  state: row.state,
  address: row.address,
  pincode: row.pincode,
  contactNumber: row.contact_number,
  email: row.email,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const selectSql = () =>
  `SELECT l.*, b.brand_name AS brand_name, b.code AS brand_code
     FROM "${TABLES.locations}" l
     LEFT JOIN "${TABLES.brands}" b ON b.id = l.brand_id`;

export async function findAll({ search, status, brandId, sort, page, pageSize }) {
  const { offset, ...paging } = parsePagination({ page, pageSize });
  const where = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    where.push(`(l.location_name ILIKE $${params.length} OR l.code ILIKE $${params.length} OR l.city ILIKE $${params.length})`);
  }
  if (status) {
    params.push(status);
    where.push(`l.status = $${params.length}`);
  }
  if (brandId) {
    params.push(brandId);
    where.push(`l.brand_id = $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const { rows: countRows } = await query(
    `SELECT count(*)::int AS total FROM "location" l ${whereSql}`,
    params
  );

  const { rows } = await query(
    `${selectSql()} ${whereSql} ORDER BY ${parseSort(sort, SORTABLE, "location_name")}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, paging.pageSize, offset]
  );

  return { items: rows.map(toLocation), total: countRows[0].total, ...paging };
}

export async function findById(id) {
  const { rows } = await query(`${selectSql()} WHERE l.id = $1`, [id]);
  return rows[0] ? toLocation(rows[0]) : null;
}

export async function findByCode(code, excludeId = null) {
  const { rows } = await query(
    `SELECT * FROM "location" WHERE UPPER(code) = UPPER($1) AND ($2::int IS NULL OR id <> $2) LIMIT 1`,
    [code, excludeId]
  );
  return rows[0] ? toLocation(rows[0]) : null;
}

export async function insert(data) {
  const { rows } = await query(
    `INSERT INTO "location"
       (brand_id, location_name, status)
     VALUES ($1, $2, 1) RETURNING id`,
    [
      data.brandId, data.name, data.status,
    ]
  );
  return findById(rows[0].id);
}

export async function update(id, changes) {
  const map = {
    brandId: "brand_id", name: "name", code: "code", city: "city", state: "state",
    address: "address", pincode: "pincode", contactNumber: "contact_number",
    email: "email", status: "status",
  };
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
  await query(`UPDATE "location" SET ${sets.join(", ")}, updated_date = NOW() WHERE id = $${params.length}`, params);
  return findById(id);
}

export async function remove(id) {
  const { rowCount } = await query(`DELETE FROM "location" WHERE id = $1`, [id]);
  return rowCount > 0;
}
