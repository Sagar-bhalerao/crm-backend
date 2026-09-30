import { query } from "../config/database.js";
import { parsePagination, parseSort } from "../utils/pagination.js";

/**
 * One mail configuration per location. The brand is not stored here: it comes
 * from the location, so Brands and Locations stay the single source of truth.
 */
const SORT_MAP = {
  brand: "b.brand_name",
  location: "l.location_name",
  smtpHost: "m.smtp_host",
  smtpPort: "m.smtp_port",
  fromEmail: "m.from_email",
  status: "m.status",
  createdAt: "m.created_date",
  updatedAt: "m.updated_date",
};

/** Shape sent to the frontend. The encrypted password is never mapped, only whether one is saved. */
const toConfig = (row) => ({
  id: row.id,
  locationId: row.location_id,
  locationName: row.location_name,
  locationStatus: row.location_status != null ? Number(row.location_status) : undefined,
  brandId: row.brand_id,
  brandName: row.brand_name,
  brandStatus: row.brand_status != null ? Number(row.brand_status) : undefined,
  smtpHost: row.smtp_host,
  smtpPort: row.smtp_port,
  smtpUsername: row.smtp_username,
  smtpSecurity: row.smtp_security,
  smtpPasswordSet: Boolean(row.smtp_password_enc),
  smtpPasswordHint: row.smtp_password_hint,
  fromEmail: row.from_email,
  fromName: row.from_name,
  replyToEmail: row.reply_to_email,
  replyToName: row.reply_to_name,
  subject: row.subject,
  body: row.body,
  status: Number(row.status),
  createdAt: row.created_date,
  updatedAt: row.updated_date,
});

const FROM = `
  FROM mail_config m
  JOIN "location" l ON l.id = m.location_id
  LEFT JOIN "brand" b ON b.id = l.brand_id
`;

const SELECT = `
  SELECT m.*, l.location_name, l.status AS location_status, l.brand_id, b.brand_name, b.status AS brand_status
  ${FROM}
`;

export async function findAll({ search, status, brandId, locationId, sort, page, pageSize }) {
  const { offset, ...paging } = parsePagination({ page, pageSize });
  const where = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    const p = `$${params.length}`;
    where.push(`(m.smtp_host ILIKE ${p} OR m.from_email ILIKE ${p} OR m.from_name ILIKE ${p}
                 OR l.location_name ILIKE ${p} OR b.brand_name ILIKE ${p})`);
  }
  // `status !== undefined`, never `if (status)` — 0 is falsy.
  if (status !== undefined) {
    params.push(status);
    where.push(`m.status = $${params.length}`);
  }
  if (brandId) {
    params.push(brandId);
    where.push(`l.brand_id = $${params.length}`);
  }
  if (locationId) {
    params.push(locationId);
    where.push(`m.location_id = $${params.length}`);
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
  const { rows } = await query(`${SELECT} WHERE m.id = $1`, [id]);
  return rows[0] ? toConfig(rows[0]) : null;
}

/** A location can have only one configuration; pass excludeId when updating. */
export async function findByLocation(locationId, excludeId = null) {
  const { rows } = await query(
    `${SELECT} WHERE m.location_id = $1 AND ($2::int IS NULL OR m.id <> $2) LIMIT 1`,
    [locationId, excludeId]
  );
  return rows[0] ? toConfig(rows[0]) : null;
}

/**
 * The active configuration for a location, including the encrypted password.
 * Only for the code that sends email; never return this row from the API.
 */
export async function findActiveForSending(locationId) {
  const { rows } = await query(
    `${SELECT} WHERE m.location_id = $1 AND m.status = 1 LIMIT 1`,
    [locationId]
  );
  return rows[0] ? { ...toConfig(rows[0]), smtpPasswordEnc: rows[0].smtp_password_enc } : null;
}

const COLUMN_MAP = {
  locationId: "location_id",
  smtpHost: "smtp_host",
  smtpPort: "smtp_port",
  smtpUsername: "smtp_username",
  smtpPasswordEnc: "smtp_password_enc",
  smtpPasswordHint: "smtp_password_hint",
  smtpSecurity: "smtp_security",
  fromEmail: "from_email",
  fromName: "from_name",
  replyToEmail: "reply_to_email",
  replyToName: "reply_to_name",
  subject: "subject",
  body: "body",
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
    `INSERT INTO mail_config (${columns.join(", ")}, created_date, updated_date)
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
    `UPDATE mail_config SET ${sets.join(", ")}, updated_date = NOW() WHERE id = $${params.length} RETURNING id`,
    params
  );
  return rows[0] ? findById(rows[0].id) : null;
}

export async function remove(id) {
  const { rowCount } = await query(`DELETE FROM mail_config WHERE id = $1`, [id]);
  return rowCount > 0;
}
