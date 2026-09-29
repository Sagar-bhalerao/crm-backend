import { query, withTransaction } from "../config/database.js";

const toRole = (row) => ({
  id: row.id,
  name: row.name,
  code: row.code,
  description: row.description,
  isSystem: Number(row.is_system) === 1,
  status: Number(row.status),
  userCount: row.user_count != null ? Number(row.user_count) : undefined,
  permissions: row.permissions || [],
  createdAt: row.created_date,
  updatedAt: row.updated_date,
});

/** Every role, with its permission keys and how many users hold it. */
export async function findAll({ search, status } = {}) {
  const where = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    where.push(`(r.name ILIKE $${params.length} OR r.code ILIKE $${params.length})`);
  }
  if (status !== undefined) {
    params.push(status);
    where.push(`r.status = $${params.length}`);
  }

  const { rows } = await query(
    `SELECT r.*,
            (SELECT count(*) FROM users u WHERE u.role_id = r.id) AS user_count,
            COALESCE(
              (SELECT array_agg(p.key ORDER BY p.key)
                 FROM role_permissions rp
                 JOIN permissions p ON p.id = rp.permission_id
                WHERE rp.role_id = r.id), '{}') AS permissions
       FROM roles r
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY r.id`,
    params
  );
  return rows.map(toRole);
}

export async function findById(id) {
  const rows = await findAll();
  return rows.find((r) => r.id === Number(id)) || null;
}

export async function findByCode(code, excludeId = null) {
  const { rows } = await query(
    `SELECT * FROM roles WHERE UPPER(code) = UPPER($1) AND ($2::int IS NULL OR id <> $2) LIMIT 1`,
    [code, excludeId]
  );
  return rows[0] ? toRole(rows[0]) : null;
}

/** The whole permission catalogue, for the checkbox list on screen. */
export async function listPermissions() {
  const { rows } = await query(`SELECT key, label, module FROM permissions ORDER BY module, sort_order`);
  return rows;
}

/** Replaces a role's permissions with exactly the keys given. */
async function savePermissions(client, roleId, keys) {
  await client.query(`DELETE FROM role_permissions WHERE role_id = $1`, [roleId]);
  if (keys.length === 0) return;
  await client.query(
    `INSERT INTO role_permissions (role_id, permission_id)
     SELECT $1, p.id FROM permissions p WHERE p.key = ANY($2::text[])`,
    [roleId, keys]
  );
}

export async function insert({ name, code, description, status, permissions }) {
  const id = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO roles (name, code, description, status) VALUES ($1, $2, $3, $4) RETURNING id`,
      [name, code, description, status]
    );
    await savePermissions(client, rows[0].id, permissions || []);
    return rows[0].id;
  });
  return findById(id);
}

export async function update(id, changes) {
  await withTransaction(async (client) => {
    const map = { name: "name", code: "code", description: "description", status: "status" };
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
        `UPDATE roles SET ${sets.join(", ")}, updated_date = now() WHERE id = $${params.length}`,
        params
      );
    }
    if (changes.permissions) await savePermissions(client, id, changes.permissions);
  });
  return findById(id);
}

export async function remove(id) {
  const { rowCount } = await query(`DELETE FROM roles WHERE id = $1`, [id]);
  return rowCount > 0;
}

export async function countUsers(roleId) {
  const { rows } = await query(`SELECT count(*)::int AS n FROM users WHERE role_id = $1`, [roleId]);
  return rows[0].n;
}