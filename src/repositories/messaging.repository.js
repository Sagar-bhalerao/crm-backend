import { query } from "../config/database.js";


/** Joins brand and location names onto any of the three tables. */
const scopeSelect = (table, alias = "t") => `
  SELECT ${alias}.*, b.brand_name AS brand_name, l.location_name AS location_name
    FROM ${table} ${alias}
    LEFT JOIN "brand" b ON b.id = ${alias}.brand_id
    LEFT JOIN "location" l ON l.id = ${alias}.location_id`;

const scopeFields = (row) => ({
  id: row.id,
  brandId: row.brand_id,
  brandName: row.brand_name,
  locationId: row.location_id,
  locationName: row.location_name,
  scope: row.location_id ? row.location_name : "All locations",
  status: Number(row.status),
  createdAt: row.created_date,
  updatedAt: row.updated_date,
});

// ── WhatsApp providers ────────────────────────────────────────────────────

const toProvider = (row) => ({
  ...scopeFields(row),
  provider: row.provider,
  apiUrl: row.api_url,
  authType: row.auth_type,
  authKey: row.auth_key,
  senderId: row.sender_id,
});

export async function listProviders({ brandId } = {}) {
  const params = [];
  let where = "";
  if (brandId) {
    params.push(brandId);
    where = `WHERE t.brand_id = $1`;
  }
  const { rows } = await query(
    `${scopeSelect("whatsapp_providers")} ${where} ORDER BY b.brand_name, l.location_name NULLS FIRST`,
    params
  );
  return rows.map(toProvider);
}

export async function findProvider(id) {
  const { rows } = await query(`${scopeSelect("whatsapp_providers")} WHERE t.id = $1`, [id]);
  return rows[0] ? toProvider(rows[0]) : null;
}

/** Location credentials if there are any, otherwise the brand's. */
export async function resolveProvider(brandId, locationId = null) {
  const { rows } = await query(
    `${scopeSelect("whatsapp_providers")}
      WHERE t.brand_id = $1 AND t.status = 1 AND (t.location_id = $2 OR t.location_id IS NULL)
      ORDER BY t.location_id NULLS LAST
      LIMIT 1`,
    [brandId, locationId]
  );
  return rows[0] ? toProvider(rows[0]) : null;
}

export async function insertProvider(d) {
  const { rows } = await query(
    `INSERT INTO whatsapp_providers (brand_id, location_id, provider, api_url, auth_type, auth_key, sender_id, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [d.brandId, d.locationId, d.provider, d.apiUrl, d.authType, d.authKey, d.senderId, d.status]
  );
  return findProvider(rows[0].id);
}

export async function updateProvider(id, changes) {
  const map = {
    brandId: "brand_id", locationId: "location_id", provider: "provider", apiUrl: "api_url",
    authType: "auth_type", authKey: "auth_key", senderId: "sender_id", status: "status",
  };
  await applyUpdate("whatsapp_providers", id, changes, map);
  return findProvider(id);
}

export const removeProvider = (id) => remove("whatsapp_providers", id);

// ── WhatsApp messages ─────────────────────────────────────────────────────

const toMessage = (row) => ({
  ...scopeFields(row),
  messageType: row.message_type,
  templateName: row.template_name,
  language: row.language,
  body: row.body,
});

export async function listMessages({ brandId, messageType } = {}) {
  const params = [];
  const where = [];
  if (brandId) {
    params.push(brandId);
    where.push(`t.brand_id = $${params.length}`);
  }
  if (messageType) {
    params.push(messageType);
    where.push(`t.message_type = $${params.length}`);
  }
  const { rows } = await query(
    `${scopeSelect("whatsapp_messages")}
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY b.brand_name, t.message_type, l.location_name NULLS FIRST`,
    params
  );
  return rows.map(toMessage);
}

export async function findMessage(id) {
  const { rows } = await query(`${scopeSelect("whatsapp_messages")} WHERE t.id = $1`, [id]);
  return rows[0] ? toMessage(rows[0]) : null;
}

/** The message to send for one type, location first then brand. */
export async function resolveMessage(brandId, locationId, messageType) {
  const { rows } = await query(
    `${scopeSelect("whatsapp_messages")}
      WHERE t.brand_id = $1 AND t.message_type = $3 AND t.status = 1
        AND (t.location_id = $2 OR t.location_id IS NULL)
      ORDER BY t.location_id NULLS LAST
      LIMIT 1`,
    [brandId, locationId, messageType]
  );
  return rows[0] ? toMessage(rows[0]) : null;
}

export async function findMessageByScope({ brandId, locationId, messageType, excludeId = null }) {
  const { rows } = await query(
    `SELECT id FROM whatsapp_messages
      WHERE brand_id = $1 AND COALESCE(location_id, 0) = COALESCE($2, 0)
        AND message_type = $3 AND ($4::int IS NULL OR id <> $4) LIMIT 1`,
    [brandId, locationId, messageType, excludeId]
  );
  return rows[0] || null;
}

export async function insertMessage(d) {
    
  const { rows } = await query(
    `INSERT INTO whatsapp_messages (brand_id, location_id, provider_id, message_type, template_name, template_id, language, body, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [d.brandId, d.locationId, d.providerId, d.messageType, d.templateName, d.templateId, d.language, d.body, d.status]
  );
  return findMessage(rows[0].id);
}

export async function updateMessage(id, changes) {
  const map = {
    brandId: "brand_id", locationId: "location_id", providerId:"provider_id", messageType: "message_type",
    templateName: "template_name", templateId: "template_id", language: "language", body: "body", status: "status",
  };
  await applyUpdate("whatsapp_messages", id, changes, map);
  return findMessage(id);
}

export const removeMessage = (id) => remove("whatsapp_messages", id);

// ── Email configs ─────────────────────────────────────────────────────────

const toEmailConfig = (row) => ({
  ...scopeFields(row),
  smtpHost: row.smtp_host,
  smtpPort: row.smtp_port,
  smtpSecure: Number(row.smtp_secure),
  smtpUsername: row.smtp_username,
  smtpPassword: row.smtp_password,
  fromEmail: row.from_email,
  fromName: row.from_name,
  replyToEmail: row.reply_to_email,
  replyToName: row.reply_to_name,
});

export async function listEmailConfigs({ brandId } = {}) {
  const params = [];
  let where = "";
  if (brandId) {
    params.push(brandId);
    where = `WHERE t.brand_id = $1`;
  }
  const { rows } = await query(
    `${scopeSelect("email_configs")} ${where} ORDER BY b.brand_name, l.location_name NULLS FIRST`,
    params
  );
  return rows.map(toEmailConfig);
}

export async function findEmailConfig(id) {
  const { rows } = await query(`${scopeSelect("email_configs")} WHERE t.id = $1`, [id]);
  return rows[0] ? toEmailConfig(rows[0]) : null;
}

export async function resolveEmailConfig(brandId, locationId = null) {
  const { rows } = await query(
    `${scopeSelect("email_configs")}
      WHERE t.brand_id = $1 AND t.status = 1 AND (t.location_id = $2 OR t.location_id IS NULL)
      ORDER BY t.location_id NULLS LAST
      LIMIT 1`,
    [brandId, locationId]
  );
  return rows[0] ? toEmailConfig(rows[0]) : null;
}

export async function insertEmailConfig(d) {
  const { rows } = await query(
    `INSERT INTO email_configs
       (brand_id, location_id, smtp_host, smtp_port, smtp_secure, smtp_username, smtp_password,
        from_email, from_name, reply_to_email, reply_to_name, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [
      d.brandId, d.locationId, d.smtpHost, d.smtpPort, d.smtpSecure, d.smtpUsername, d.smtpPassword,
      d.fromEmail, d.fromName, d.replyToEmail, d.replyToName, d.status,
    ]
  );
  return findEmailConfig(rows[0].id);
}

export async function updateEmailConfig(id, changes) {
  const map = {
    brandId: "brand_id", locationId: "location_id", smtpHost: "smtp_host", smtpPort: "smtp_port",
    smtpSecure: "smtp_secure", smtpUsername: "smtp_username", smtpPassword: "smtp_password",
    fromEmail: "from_email", fromName: "from_name", replyToEmail: "reply_to_email",
    replyToName: "reply_to_name", status: "status",
  };
  await applyUpdate("email_configs", id, changes, map);
  return findEmailConfig(id);
}

export const removeEmailConfig = (id) => remove("email_configs", id);

// ── Shared bits ───────────────────────────────────────────────────────────

/** Builds and runs an UPDATE from whichever fields were sent. */
async function applyUpdate(table, id, changes, map) {
  console.log("applyUpdate", table, id, changes, map);
  const sets = [];
  const params = [];

  for (const [key, column] of Object.entries(map)) {
    
    if (key in changes) {
        
      params.push(changes[key]);
      sets.push(`${column} = $${params.length}`);
        
    }
  }
  if (sets.length === 0) return;

  params.push(id);  
  await query(`UPDATE ${table} SET ${sets.join(", ")}, updated_date = now() WHERE id = $${params.length}`, params);
}

async function remove(table, id) {
  const { rowCount } = await query(`DELETE FROM ${table} WHERE id = $1`, [id]);
  return rowCount > 0;
}

/** Used by the duplicate check on providers and email configs. */
export async function findByScope(table, { brandId, locationId, excludeId = null }) {
  const { rows } = await query(
    `SELECT id FROM ${table}
      WHERE brand_id = $1 AND COALESCE(location_id, 0) = COALESCE($2, 0)
        AND ($3::int IS NULL OR id <> $3) LIMIT 1`,
    [brandId, locationId, excludeId]
  );
  return rows[0] || null;
}