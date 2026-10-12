import { query, withTransaction } from "../config/database.js";
import { TABLES } from "../config/tables.js";
import { parsePagination, parseSort } from "../utils/pagination.js";

const SORTABLE = ["created_date", "event_date", "status", "first_name", "next_followup_at"];

const toLead = (row) => ({
  id: row.id,
  leadCode: row.lead_code,
  brandId: row.brand_id,
  brandName: row.brand_name,
  locationId: row.location_id,
  locationName: row.location_name,

  firstName: row.first_name,
  lastName: row.last_name,
  name: [row.first_name, row.last_name].filter(Boolean).join(" "),
  mobile: row.mobile,
  email: row.email,

  leadType: row.lead_type,
  source: row.source,
  eventDate: row.event_date,
  eventTimeSlot: row.event_time_slot,
  guests: row.guests,
  kids: row.kids,
  requirements: row.requirements,
  remarks: row.remarks,
  companyName: row.company_name,
  companyGstin: row.company_gstin,

  assignedTo: row.assigned_to,
  assignedToName: row.assigned_to_name,
  assignedAt: row.assigned_at,
  status: row.status,
  lostReason: row.lost_reason,

  lastFollowupAt: row.last_followup_at,
  nextFollowupAt: row.next_followup_at,

  createdAt: row.created_date,
  updatedAt: row.updated_date,
  createdBy: row.created_by,
  createdByName: row.created_by_name,
});

const SELECT = () => `
  SELECT l.*,
         b.brand_name AS brand_name,
         loc.location_name AS location_name,
         TRIM(CONCAT(a.first_name, ' ', COALESCE(a.last_name, ''))) AS assigned_to_name,
         TRIM(CONCAT(c.first_name, ' ', COALESCE(c.last_name, ''))) AS created_by_name
    FROM leads l
    LEFT JOIN "brand" b ON b.id = l.brand_id
    LEFT JOIN "location" loc ON loc.id = l.location_id
    LEFT JOIN users a ON a.id = l.assigned_to
    LEFT JOIN users c ON c.id = l.created_by`;

/**
 * `scope` narrows what the signed-in user may see:
 *   { all: true }                  every lead
 *   { locationIds: [1, 2] }        leads at those locations
 *   { assignedTo: 5 }              only their own
 */
function scopeClause(scope, params) {
  if (!scope || scope.all) return null;

  if (scope.locationIds?.length) {
    params.push(scope.locationIds);
    return `l.location_id = ANY($${params.length}::int[])`;
  }
  if (scope.assignedTo) {
    params.push(scope.assignedTo);
    return `l.assigned_to = $${params.length}`;
  }
  return "1 = 0"; // no scope means no leads, never all of them
}

export async function findAll({ search, status, locationId, brandId, leadType, assignedTo, fromDate, toDate, sort, page, pageSize }, scope) {
  const { offset, ...paging } = parsePagination({ page, pageSize });
  const params = [];
  const where = [];

  const scoped = scopeClause(scope, params);
  if (scoped) where.push(scoped);

  if (search) {
    params.push(`%${search}%`);
    where.push(`(l.first_name ILIKE $${params.length} OR l.last_name ILIKE $${params.length}
                 OR l.mobile ILIKE $${params.length} OR l.email ILIKE $${params.length}
                 OR l.lead_code ILIKE $${params.length})`);
  }
  if (status) {
    params.push(status);
    where.push(`l.status = $${params.length}`);
  }
  if (locationId) {
    params.push(locationId);
    where.push(`l.location_id = $${params.length}`);
  }
  if (brandId) {
    params.push(brandId);
    where.push(`l.brand_id = $${params.length}`);
  }
  if (leadType) {
    params.push(leadType);
    where.push(`l.lead_type = $${params.length}`);
  }
  if (assignedTo) {
    params.push(assignedTo);
    where.push(`l.assigned_to = $${params.length}`);
  }
  if (fromDate) {
    params.push(fromDate);
    where.push(`l.created_date >= $${params.length}`);
  }
  if (toDate) {
    params.push(toDate);
    where.push(`l.created_date < ($${params.length}::date + 1)`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const { rows: countRows } = await query(`SELECT count(*)::int AS total FROM leads l ${whereSql}`, params);

  // const { rows } = await query(
  //   `${SELECT()} ${whereSql}
  //     ORDER BY ${parseSort(sort, SORTABLE, "created_date")} DESC NULLS LAST
  //     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
  //   [...params, paging.pageSize, offset]
  // );
  const { rows } = await query(
    `${SELECT()}`);

  return { items: rows.map(toLead), total: countRows[0].total, ...paging };
}

export async function findById(id) {
  const { rows } = await query(`${SELECT()} WHERE l.id = $1`, [id]);
  return rows[0] ? toLead(rows[0]) : null;
}

/**
 * The next code for a location, e.g. DNBMUM7.
 * Runs inside the caller's transaction, and SELECT ... FOR UPDATE makes two
 * enquiries arriving at the same moment wait their turn instead of
 * both taking the same number.
 */
async function nextLeadCode(client, locationId) {
  const { rows: loc } = await client.query(
    `SELECT l.code AS location_code, b.code AS brand_code
       FROM "location" l
       JOIN "brand" b ON b.id = l.brand_id
      WHERE l.id = $1`,
    [locationId]
  );
  if (loc.length === 0) throw new Error("Location not found");

  await client.query(
    `INSERT INTO lead_counters (location_id, last_number) VALUES ($1, 0) ON CONFLICT DO NOTHING`,
    [locationId]
  );
  const { rows } = await client.query(
    `UPDATE lead_counters SET last_number = last_number + 1 WHERE location_id = $1 RETURNING last_number`,
    [locationId]
  );

  // DB-MUM + DBI -> DBIDBMUM1, so strip anything that is not a letter or digit
  const prefix = `${loc[0].brand_code}${loc[0].location_code}`.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return `${prefix}${rows[0].last_number}`;
}

export async function insert(data) {
  return withTransaction(async (client) => {
    const leadCode = await nextLeadCode(client, data.locationId);

    const { rows } = await client.query(
      `INSERT INTO leads
         (lead_code, brand_id, location_id, first_name, last_name, mobile, email,
          lead_type, source, event_date, event_time_slot, guests, kids, requirements, remarks,
          company_name, company_gstin, assigned_to, assigned_at, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       RETURNING id`,
      [
        leadCode, data.brandId, data.locationId, data.firstName, data.lastName, data.mobile, data.email,
        data.leadType, data.source, data.eventDate, data.eventTimeSlot, data.guests, data.kids,
        data.requirements, data.remarks, data.companyName, data.companyGstin,
        data.assignedTo, data.assignedTo ? new Date() : null, data.status, data.createdBy,
      ]
    );

    const id = rows[0].id;
    await addActivity(client, id, "created", `Lead ${leadCode} created from ${data.source}`, data.createdBy);
    if (data.assignedTo) {
      await addActivity(client, id, "assigned", "Assigned to the sales team", data.createdBy);
    }
    return id;
  }).then(findById);
}

export async function update(id, changes) {
  const map = {
    firstName: "first_name", lastName: "last_name", mobile: "mobile", email: "email",
    leadType: "lead_type", eventDate: "event_date", eventTimeSlot: "event_time_slot",
    guests: "guests", kids: "kids", requirements: "requirements", remarks: "remarks",
    companyName: "company_name", companyGstin: "company_gstin",
    locationId: "location_id", brandId: "brand_id",
    assignedTo: "assigned_to", assignedAt: "assigned_at",
    status: "status", lostReason: "lost_reason",
    lastFollowupAt: "last_followup_at", nextFollowupAt: "next_followup_at",
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
  await query(`UPDATE leads SET ${sets.join(", ")}, updated_date = now() WHERE id = $${params.length}`, params);
  return findById(id);
}

export async function remove(id) {
  const { rowCount } = await query(`DELETE FROM leads WHERE id = $1`, [id]);
  return rowCount > 0;
}

// ── Activity trail ────────────────────────────────────────────────────────

/** `client` lets this run inside a transaction; without one it uses the pool. */
export async function addActivity(client, leadId, type, message, userId = null) {
  const run = client ? client.query.bind(client) : query;
  await run(
    `INSERT INTO lead_activities (lead_id, type, message, created_by) VALUES ($1, $2, $3, $4)`,
    [leadId, type, message, userId]
  );
}

export async function listActivities(leadId) {
  const { rows } = await query(
    `SELECT a.*, TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))) AS user_name
       FROM lead_activities a
       LEFT JOIN users u ON u.id = a.created_by
      WHERE a.lead_id = $1
      ORDER BY a.created_at DESC, a.id DESC`,
    [leadId]
  );
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    message: r.message,
    createdAt: r.created_at,
    userName: r.user_name || null,
  }));
}

// ── Follow-ups ────────────────────────────────────────────────────────────

export async function addFollowup(leadId, data, userId) {
  return withTransaction(async (client) => {
    await client.query(
      `INSERT INTO lead_followups (lead_id, channel, outcome, note, next_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [leadId, data.channel, data.outcome, data.note, data.nextAt, userId]
    );
    await client.query(
      `UPDATE leads SET last_followup_at = now(), next_followup_at = $2, updated_date = now()
        WHERE id = $1`,
      [leadId, data.nextAt]
    );
    await addActivity(client, leadId, "followup", `${data.channel}: ${data.outcome}`, userId);
  });
}

export async function listFollowups(leadId) {
  const { rows } = await query(
    `SELECT f.*, TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))) AS user_name
       FROM lead_followups f
       LEFT JOIN users u ON u.id = f.created_by
      WHERE f.lead_id = $1
      ORDER BY f.created_at DESC`,
    [leadId]
  );
  return rows.map((r) => ({
    id: r.id,
    channel: r.channel,
    outcome: r.outcome,
    note: r.note,
    nextAt: r.next_at,
    createdAt: r.created_at,
    userName: r.user_name,
  }));
}

// ── Messages sent ─────────────────────────────────────────────────────────

export async function listMessages(leadId) {
  const { rows } = await query(
    `SELECT id, channel, message_type, recipient, subject, status, error_message, sent_at, created_at
       FROM lead_messages WHERE lead_id = $1 ORDER BY created_at DESC`,
    [leadId]
  );
  return rows.map((r) => ({
    id: r.id,
    channel: r.channel,
    messageType: r.message_type,
    recipient: r.recipient,
    subject: r.subject,
    status: r.status,
    errorMessage: r.error_message,
    sentAt: r.sent_at,
    createdAt: r.created_at,
  }));
}

/** Counts by status, for the dashboard. */
export async function countByStatus(scope) {
  const params = [];
  const scoped = scopeClause(scope, params);
  const { rows } = await query(
    `SELECT status, count(*)::int AS total FROM leads l
      ${scoped ? `WHERE ${scoped}` : ""}
      GROUP BY status`,
    params
  );
  return Object.fromEntries(rows.map((r) => [r.status, r.total]));
}

/** The Sales POC at a location with the fewest open leads. */
export async function findLeastBusyPoc(locationId) {
  const { rows } = await query(
    `SELECT u.id,
            (SELECT count(*) FROM leads l
              WHERE l.assigned_to = u.id
                AND l.status NOT IN ('finalized', 'not_interested', 'cancelled')) AS open_leads
       FROM users u
       JOIN user_locations ul ON ul.user_id = u.id
       JOIN roles r ON r.id = u.role_id
      WHERE ul.location_id = $1 AND u.status = 1 AND r.code = 'sales_poc'
      ORDER BY open_leads ASC, u.id ASC
      LIMIT 1`,
    [locationId]
  );
  return rows[0]?.id || null;
}