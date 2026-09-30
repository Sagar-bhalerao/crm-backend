import { query } from "../config/database.js";
import { parsePagination, parseSort } from "../utils/pagination.js";

/**
 * One WhatsApp configuration per location. The brand is not stored here: it
 * comes from the location, so Brands and Locations stay the single source of
 * truth and a renamed brand or outlet shows up here automatically.
 */
const SORT_MAP = {
  brand: "b.brand_name",
  location: "l.location_name",
  apiProvider: "w.api_provider",
  authType: "w.auth_type",
  status: "w.status",
  createdAt: "w.created_date",
  updatedAt: "w.updated_date",
};

/** Shape sent to the frontend. The encrypted key is never mapped, only whether one is saved. */
const toConfig = (row) => ({
  id: row.id,
  locationId: row.location_id,
  locationName: row.location_name,
  locationStatus: row.location_status != null ? Number(row.location_status) : undefined,
  brandId: row.brand_id,
  brandName: row.brand_name,
  brandStatus: row.brand_status != null ? Number(row.brand_status) : undefined,
  apiProvider: row.api_provider,
  apiUrl: row.api_url,
  authType: row.auth_type,
  authHeader: row.auth_header,
  authUsername: row.auth_username,
  authKeySet: Boolean(row.auth_secret_enc),
  authKeyHint: row.auth_secret_hint,
  messageBody: row.message_body,
  status: Number(row.status),
  createdAt: row.created_date,
  updatedAt: row.updated_date,
});

const FROM = `
  FROM whatsapp_config w
  JOIN "location" l ON l.id = w.location_id
  LEFT JOIN "brand" b ON b.id = l.brand_id
`;

const SELECT = `
  SELECT w.*, l.location_name, l.status AS location_status, l.brand_id, b.brand_name, b.status AS brand_status
  ${FROM}
`;

export async function findAll({ search, status, brandId, locationId, sort, page, pageSize }) {
  const { offset, ...paging } = parsePagination({ page, pageSize });
  const where = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    const p = `$${params.length}`;
    where.push(`(w.api_provider ILIKE ${p} OR w.api_url ILIKE ${p} OR l.location_name ILIKE ${p} OR b.brand_name ILIKE ${p})`);
  }
  // `status !== undefined`, never `if (status)` — 0 is falsy.
  if (status !== undefined) {
    params.push(status);
    where.push(`w.status = $${params.length}`);
  }
  if (brandId) {
    params.push(brandId);
    where.push(`l.brand_id = $${params.length}`);
  }
  if (locationId) {
    params.push(locationId);
    where.push(`w.location_id = $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const { rows: countRows } = await query(`SELECT COUNT(*)::int AS total ${FROM} ${whereSql}`, params);

  const orderBy = parseSort(sort, SORT_MAP, "brand");
  const { rows } = await query(
    `${SELECT} ${whereSql}
     ORDER BY ${orderBy}, l.location_name ASC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, paging.pageSize, offset]
  );

  return { items: rows.map(toConfig), total: countRows[0].total, ...paging };
}

export async function findById(id) {
  const { rows } = await query(`${SELECT} WHERE w.id = $1`, [id]);
  return rows[0] ? toConfig(rows[0]) : null;
}

/** A location can have only one configuration; pass excludeId when updating. */
export async function findByLocation(locationId, excludeId = null) {
  const { rows } = await query(
    `${SELECT} WHERE w.location_id = $1 AND ($2::int IS NULL OR w.id <> $2) LIMIT 1`,
    [locationId, excludeId]
  );
  return rows[0] ? toConfig(rows[0]) : null;
}

/**
 * The active configuration for a location, including the encrypted key.
 * Only for the code that sends messages; never return this row from the API.
 */
export async function findActiveForSending(locationId) {
  const { rows } = await query(
    `${SELECT} WHERE w.location_id = $1 AND w.status = 1 LIMIT 1`,
    [locationId]
  );
  return rows[0] ? { ...toConfig(rows[0]), authSecretEnc: rows[0].auth_secret_enc } : null;
}

const COLUMN_MAP = {
  locationId: "location_id",
  apiProvider: "api_provider",
  apiUrl: "api_url",
  authType: "auth_type",
  authHeader: "auth_header",
  authUsername: "auth_username",
  authSecretEnc: "auth_secret_enc",
  authSecretHint: "auth_secret_hint",
  messageBody: "message_body",
  status: "status",
};

export async function insert(data) {
  const columns = [];
  const params = [];
  for (const [key, column] of Object.entries(COLUMN_MAP)) {
    if (key in data) {
      columns.push(column);
      params.push(data[key]);
    }
  }
  const placeholders = params.map((_, i) => `$${i + 1}`);
  const { rows } = await query(
    `INSERT INTO whatsapp_config (${columns.join(", ")}, created_date, updated_date)
     VALUES (${placeholders.join(", ")}, NOW(), NOW())
     RETURNING id`,
    params
  );
  return findById(rows[0].id);
}

/** Updates only the fields present in `changes`. */
export async function update(id, changes) {
  const sets = [];
  const params = [];
  for (const [key, column] of Object.entries(COLUMN_MAP)) {
    if (key in changes) {
      params.push(changes[key]);
      sets.push(`${column} = $${params.length}`);
    }
  }
  if (!sets.length) return findById(id);

  params.push(id);
  const { rows } = await query(
    `UPDATE whatsapp_config SET ${sets.join(", ")}, updated_date = NOW() WHERE id = $${params.length} RETURNING id`,
    params
  );
  return rows[0] ? findById(rows[0].id) : null;
}

export async function remove(id) {
  const { rowCount } = await query(`DELETE FROM whatsapp_config WHERE id = $1`, [id]);
  return rowCount > 0;
}
