import { query } from "../config/database.js";
import { scopeClause } from "./lead.repository.js";

// Every venue is in India, so "today" and "this week" are Indian days,
// whatever time zone the database server runs in.
const TZ = "Asia/Kolkata";
const startOf = (unit) => `(date_trunc('${unit}', now() AT TIME ZONE '${TZ}') AT TIME ZONE '${TZ}')`;
const TODAY = `(now() AT TIME ZONE '${TZ}')::date`;

const CLOSED = `('finalized', 'not_interested', 'cancelled')`;

/** WHERE clause for the user's visibility scope plus any extra conditions. */
function scoped(scope, conditions = []) {
  const params = [];
  const where = [...conditions];
  const clause = scopeClause(scope, params);
  if (clause) where.push(clause);
  return { params, whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "" };
}

/**
 * One row per lead with what it is worth: the open invoice's total if there
 * is one (it may have been edited after the quote), otherwise the current
 * quotation's. Leads with neither are worth nothing yet.
 */
const deals = (whereSql) => `
  SELECT l.id, l.status, l.location_id, l.lead_type, l.created_date, l.event_date,
         l.assigned_to, l.next_followup_at, l.last_followup_at,
         COALESCE(pi.total, q.total) AS value,
         pi.status AS invoice_status, pi.advance_paid,
         q.status AS quotation_status, q.shared_at
    FROM leads l
    LEFT JOIN LATERAL (
      SELECT total, status, advance_paid FROM proforma_invoices
       WHERE lead_id = l.id AND status <> 'cancelled'
       LIMIT 1
    ) pi ON true
    LEFT JOIN LATERAL (
      SELECT total, status, shared_at FROM quotations
      WHERE lead_id = l.id AND status NOT IN ('cancelled', 'superseded')
       ORDER BY version DESC
       LIMIT 1
    ) q ON true
   ${whereSql}`;

/** Lead count and deal value per status. */
export async function countByStatus(scope) {
  const { params, whereSql } = scoped(scope);
  const { rows } = await query(
    `SELECT d.status, count(*)::int AS count, COALESCE(sum(d.value), 0) AS value
       FROM (${deals(whereSql)}) d
      GROUP BY d.status`,
    params
  );
  return rows.map((r) => ({ status: r.status, count: r.count, value: Number(r.value) }));
}

/** Headline counts, money and the "needs attention" numbers in one pass. */
export async function findTotals(scope) {
  const { params, whereSql } = scoped(scope);
  const { rows } = await query(
    `SELECT
       count(*) FILTER (WHERE d.created_date >= ${startOf("day")})::int   AS today,
       count(*) FILTER (WHERE d.created_date >= ${startOf("week")})::int  AS this_week,
       count(*) FILTER (WHERE d.created_date >= ${startOf("month")})::int AS this_month,

       COALESCE(sum(d.value) FILTER (WHERE d.status = 'quotation'), 0)        AS quotation_value,
       COALESCE(sum(d.value) FILTER (WHERE d.status = 'proforma_invoice'), 0) AS invoice_value,
       COALESCE(sum(d.value) FILTER (WHERE d.status = 'finalized'), 0)        AS booked_value,
       count(*) FILTER (WHERE d.status IN ('quotation', 'proforma_invoice') AND d.value IS NOT NULL)::int AS open_deals,

       COALESCE(sum(d.advance_paid) FILTER (WHERE d.invoice_status = 'paid'), 0) AS advance_collected,
       count(*) FILTER (WHERE d.invoice_status = 'paid')::int                    AS paid_invoices,
       -- Still to be collected at the venue for bookings that haven't happened yet
       COALESCE(sum(d.value - d.advance_paid) FILTER (
         WHERE d.status = 'finalized' AND d.invoice_status = 'paid' AND d.event_date >= ${TODAY}), 0) AS balance_upcoming,

       count(*) FILTER (WHERE d.status IN ('new', 'assigned') AND d.last_followup_at IS NULL
                          AND d.created_date < now() - interval '2 hours')::int AS uncontacted,
       count(*) FILTER (WHERE d.assigned_to IS NULL AND d.status NOT IN ${CLOSED})::int AS unassigned,
       count(*) FILTER (WHERE d.next_followup_at < now() AND d.status NOT IN ${CLOSED})::int AS overdue_followups,
       count(*) FILTER (WHERE d.status = 'quotation' AND d.quotation_status = 'shared'
                          AND d.shared_at < now() - interval '3 days')::int AS stale_quotes,
       count(*) FILTER (WHERE d.invoice_status = 'sent')::int AS awaiting_advance,
       count(*) FILTER (WHERE d.status IN ('quotation', 'proforma_invoice')
                          AND d.event_date BETWEEN ${TODAY} AND ${TODAY} + 7)::int AS upcoming_unconfirmed
     FROM (${deals(whereSql)}) d`,
    params
  );

  const r = rows[0];
  const money = ["quotation_value", "invoice_value", "booked_value", "advance_collected", "balance_upcoming"];
  return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, money.includes(k) ? Number(v) : v]));
}

export async function countByLocation(scope) {
  const { params, whereSql } = scoped(scope);
  const { rows } = await query(
    `SELECT l.location_id AS id, loc.location_name AS name, count(*)::int AS count
       FROM leads l
       LEFT JOIN "location" loc ON loc.id = l.location_id
       ${whereSql}
      GROUP BY l.location_id, loc.location_name
      ORDER BY count DESC, loc.location_name`,
    params
  );
  return rows;
}

export async function countByType(scope) {
  const { params, whereSql } = scoped(scope);
  const { rows } = await query(
    `SELECT l.lead_type AS type, count(*)::int AS count FROM leads l ${whereSql} GROUP BY l.lead_type`,
    params
  );
  return rows;
}

export async function findRecent(scope, limit = 6) {
  const { params, whereSql } = scoped(scope);
  const { rows } = await query(
    `SELECT l.id, l.lead_code, l.first_name, l.last_name, l.lead_type, l.status, l.source, l.created_date,
            loc.location_name,
            TRIM(CONCAT(a.first_name, ' ', COALESCE(a.last_name, ''))) AS assigned_to_name
       FROM leads l
       LEFT JOIN "location" loc ON loc.id = l.location_id
       LEFT JOIN users a ON a.id = l.assigned_to
       ${whereSql}
      ORDER BY l.created_date DESC
      LIMIT ${Number(limit)}`,
    params
  );
  return rows.map((r) => ({
    id: r.id,
    leadCode: r.lead_code,
    name: [r.first_name, r.last_name].filter(Boolean).join(" "),
    leadType: r.lead_type,
    status: r.status,
    source: r.source,
    locationName: r.location_name,
    assignedToName: r.assigned_to_name || null,
    createdAt: r.created_date,
  }));
}

/** Overdue, today and tomorrow: the same shape as the Follow-ups page rows. */
export async function findFollowupsDue(scope, limit = 6) {
  const { params, whereSql } = scoped(scope, [
    `l.next_followup_at IS NOT NULL`,
    `l.status NOT IN ${CLOSED}`,
    `l.next_followup_at < ${startOf("day")} + interval '2 days'`,
  ]);
  const { rows } = await query(
    `SELECT l.id, l.lead_code, l.first_name, l.last_name, l.status, l.next_followup_at,
            loc.location_name,
            TRIM(CONCAT(a.first_name, ' ', COALESCE(a.last_name, ''))) AS assigned_to_name,
            f.channel, f.outcome, f.note, f.created_at AS last_at
       FROM leads l
       LEFT JOIN "location" loc ON loc.id = l.location_id
       LEFT JOIN users a ON a.id = l.assigned_to
       LEFT JOIN LATERAL (
         SELECT channel, outcome, note, created_at FROM lead_followups
          WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1
       ) f ON true
       ${whereSql}
      ORDER BY l.next_followup_at ASC
      LIMIT ${Number(limit)}`,
    params
  );
  return rows.map((r) => ({
    id: r.id,
    leadCode: r.lead_code,
    name: [r.first_name, r.last_name].filter(Boolean).join(" "),
    status: r.status,
    nextFollowupAt: r.next_followup_at,
    locationName: r.location_name,
    assignedToName: r.assigned_to_name || null,
    lastFollowup: r.last_at ? { channel: r.channel, outcome: r.outcome, note: r.note, createdAt: r.last_at } : null,
  }));
}