import { query, withTransaction } from "../config/database.js";
import { TABLES } from "../config/tables.js";
import { parsePagination, parseSort } from "../utils/pagination.js";

const SORTABLE = ["first_name", "last_name", "email", "status", "created_date", "updated_date", "status", "location_id", "role_id", "password_hash", "last_login_date", "brand_id"];

const toUser = (row) => ({
  id: row.id,
  firstName: row.first_name,
  lastName: row.last_name,
  name: [row.first_name, row.last_name].filter(Boolean).join(" "),
  email: row.email,
  mobile: row.mobile,
  status: Number(row.status),
  brandId: row.brand_id,
  brandName: row.brand_name,
  roleId: row.role_id,
  roleName: row.role_name,
  roleCode: row.role_code,
  locations: row.locations || [],
  locationIds: (row.locations || []).map((l) => l.id),
  createdAt: row.created_date,
  updatedAt: row.updated_date,
  lastLoginAt: row.last_login_date,
  // password_hash is never mapped, so it can never leak out of the API
});

const SELECT = () => `
  SELECT u.id, u.first_name, u.last_name, u.email, u.mobile, u.status,
         u.brand_id, u.role_id, u.location_id, u.created_date, u.updated_date, u.last_login_date,
         r.name AS role_name, r.code AS role_code, b.brand_name AS brand_name,
         COALESCE(
           (SELECT json_agg(json_build_object('id', l.id, 'name', l.location_name) ORDER BY l.location_name)
              FROM user_locations ul
              JOIN "location" l ON l.id = ul.location_id
             WHERE ul.user_id = u.id), '[]') AS locations
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id
    LEFT JOIN "brand" b ON b.id = u.brand_id`;

export async function findAll({ search, status, roleId, brandId, locationId, sort, page, pageSize }) {
  const { offset, ...paging } = parsePagination({ page, pageSize });
  const where = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    where.push(`(u.first_name ILIKE $${params.length} OR u.last_name ILIKE $${params.length}
                 OR u.email ILIKE $${params.length} OR u.mobile ILIKE $${params.length})`);
  }
  if (status !== undefined) {
    params.push(status);
    where.push(`u.status = $${params.length}`);
  }
  if (roleId) {
    params.push(roleId);
    where.push(`u.role_id = $${params.length}`);
  }
  if (brandId) {
    params.push(brandId);
    where.push(`u.brand_id = $${params.length}`);
  }
  if (locationId) {
    params.push(locationId);
    where.push(`EXISTS (SELECT 1 FROM user_locations ul
                         WHERE ul.user_id = u.id AND ul.location_id = $${params.length})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const { rows: countRows } = await query(`SELECT count(*)::int AS total FROM users u ${whereSql}`, params);
  // const { rows } = await query(
  //   `${SELECT()} ${whereSql}
  //   ORDER BY ${parseSort(sort, SORTABLE, "first_name")}
  //   LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
  //   [...params, paging.pageSize, offset]
  // );
  const { rows } = await query(
    `${SELECT()} ${whereSql}     
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, paging.pageSize, offset]
  );
  
  
  return { items: rows.map(toUser), total: countRows[0].total, ...paging };
}

export async function findById(id) {
  const { rows } = await query(`${SELECT()} WHERE u.id = $1`, [id]);
  return rows[0] ? toUser(rows[0]) : null;
}

export async function findByEmail(email, excludeId = null) {
  const { rows } = await query(
    `SELECT id, email, first_name, last_name FROM users
      WHERE LOWER(email) = LOWER($1) AND ($2::int IS NULL OR id <> $2) LIMIT 1`,
    [email, excludeId]
  );
  return rows[0] || null;
}

/** Used by the login flow later; the only place the hash is read. */
export async function findForLogin(email) {
  const { rows } = await query(
    `SELECT id, email, password_hash, status FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [email]
  );
  return rows[0] || null;
}

/** Checks the chosen locations exist and belong to the chosen brand. */
export async function checkLocations(brandId, locationIds) {
  if (!locationIds || locationIds.length === 0) return [];
  const { rows } = await query(
    `SELECT id, name, brand_id FROM "${TABLES.locations}" WHERE id = ANY($1::int[])`,
    [locationIds]
  );
  const missing = locationIds.filter((id) => !rows.some((r) => r.id === id));
  const wrongBrand = rows.filter((r) => r.brand_id !== brandId).map((r) => r.name);
  return [missing, wrongBrand];
}

async function saveLocations(client, userId, locationIds) {
  await client.query(`DELETE FROM user_locations WHERE user_id = $1`, [userId]);
  for (const locationId of locationIds || []) {
    await client.query(
      `INSERT INTO user_locations (user_id, location_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, locationId]
    );
  }
  // Keep the primary location on the user row in step with the list
  await client.query(`UPDATE users SET location_id = $2 WHERE id = $1`, [userId, locationIds?.[0] ?? null]);
}

export async function insert(data) {
  const id = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO users (brand_id, role_id, first_name, last_name, email, mobile, password_hash, status, created_date, updated_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now()) RETURNING id`,
      [data.brandId, data.roleId, data.firstName, data.lastName, data.email, data.mobile, data.passwordHash, data.status]
    );
    await saveLocations(client, rows[0].id, data.locationIds);
    return rows[0].id;
  });
  return findById(id);
}

export async function update(id, changes) {
  await withTransaction(async (client) => {
    const map = {
      brandId: "brand_id", roleId: "role_id", firstName: "first_name", lastName: "last_name",
      email: "email", mobile: "mobile", status: "status", passwordHash: "password_hash",
    };
    const sets = [];
    const params = [];

    for (const [key, column] of Object.entries(map)) {
      if (key in changes) {
        params.push(changes[key]);
        sets.push(`${column} = $${params.length}`);
      }
    }
    if (sets.length > 0) {
      params.push(id);
      await client.query(
        `UPDATE users SET ${sets.join(", ")}, updated_date = now() WHERE id = $${params.length}`,
        params
      );
    }
    if (changes.locationIds) await saveLocations(client, id, changes.locationIds);
  });
  return findById(id);
}

export async function remove(id) {
  const { rowCount } = await query(`DELETE FROM users WHERE id = $1`, [id]);
  return rowCount > 0;
}

/** The signed-in user with their permission keys. Read on every request. */
export async function findAuthUser(id) {
  const user = await findById(id);
  if (!user) return null;

  const { rows } = await query(
    `SELECT p.key
       FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = $1`,
    [user.roleId]
  );
  return { ...user, permissions: rows.map((r) => r.key) };
}

export async function touchLastLogin(id) {
  await query(`UPDATE users SET last_login_date = now() WHERE id = $1`, [id]);
}