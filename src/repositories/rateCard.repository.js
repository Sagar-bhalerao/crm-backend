import { query } from "../config/database.js";
import { TABLES } from "../config/tables.js";

const toRateCard = (row) => ({
  id: row.id,
  brandId: row.brand_id,
  locationId: row.location_id,
  locationName: row.location_name,
  name: row.name,
  code: row.code,
  leadType: row.lead_type,
  category: row.category,
  unit: row.unit,
  rate: Number(row.rate),
  minQty: row.min_qty,
  description: row.description,
  sortOrder: row.sort_order,
  status: Number(row.status),
  visitFrom: row.visit_from,
  visitTo: row.visit_to,
  bookingFrom: row.booking_from,
  bookingTo: row.booking_to,
  days: row.days || [],
  ruleType: row.rule_type,
  priority: row.priority,
  createdAt: row.created_date,
  updatedAt: row.updated_date,

});

const SELECT = () => `
  SELECT r.*, l.location_name AS location_name
    FROM rate_cards r
    LEFT JOIN "location" l ON l.id = r.location_id`;

export async function findAll({ locationId, leadType, category, status, search }) {
  const params = [];
  const where = [];

  if (locationId) {
    params.push(locationId);
    where.push(`r.location_id = $${params.length}`);
  }
  if (leadType) {
    // Items with no lead type apply to every type
    params.push(leadType);
    where.push(`(r.lead_type = $${params.length} OR r.lead_type IS NULL)`);
  }
  if (category) {
    params.push(category);
    where.push(`r.category = $${params.length}`);
  }
  if (status !== undefined) {
    params.push(status);
    where.push(`r.status = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    where.push(`(r.name ILIKE $${params.length} OR r.code ILIKE $${params.length})`);
  }

  const { rows } = await query(
    `${SELECT()} ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY r.category, r.sort_order, r.name, r.priority DESC`,
    params
  );
  return rows.map(toRateCard);
}

export async function findById(id) {
  const { rows } = await query(`${SELECT()} WHERE r.id = $1`, [id]);
  return rows[0] ? toRateCard(rows[0]) : null;
}

export async function findByCode(locationId, code, excludeId = null) {
  if (!code) return null;
  const { rows } = await query(
    `SELECT id, name FROM rate_cards
      WHERE location_id = $1 AND UPPER(code) = UPPER($2) AND ($3::int IS NULL OR id <> $3) LIMIT 1`,
    [locationId, code, excludeId]
  );
  return rows[0] || null;
}

export async function insert(d) {
  const { rows } = await query(
    `INSERT INTO rate_cards
       (brand_id, location_id, name, code, lead_type, category, unit, rate, min_qty, description, sort_order, status, visit_from, visit_to, booking_from, booking_to, days, rule_type, priority)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING id`,
    [
      d.brandId, d.locationId, d.name, d.code, d.leadType, d.category,
      d.unit, d.rate, d.minQty, d.description, d.sortOrder, d.status,
      d.visitFrom, d.visitTo, d.bookingFrom, d.bookingTo, d.days, d.ruleType, d.priority
    ]
  );
  return findById(rows[0].id);
}

export async function update(id, changes) {
  const map = {
    name: "name", code: "code", leadType: "lead_type", category: "category", unit: "unit",
    rate: "rate", minQty: "min_qty", description: "description", sortOrder: "sort_order", status: "status",
    visitFrom: "visit_from", visitTo: "visit_to",
    bookingFrom: "booking_from", bookingTo: "booking_to",
    days: "days", ruleType: "rule_type", priority: "priority",
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
  await query(`UPDATE rate_cards SET ${sets.join(", ")}, updated_date = now() WHERE id = $${params.length}`, params);
  return findById(id);
}

export async function remove(id) {
  const { rowCount } = await query(`DELETE FROM rate_cards WHERE id = $1`, [id]);
  return rowCount > 0;
}

/** Copies every active item from one location to another. */
export async function copyToLocation(fromLocationId, toLocationId) {
  const { rows } = await query(
    `INSERT INTO rate_cards (brand_id, location_id, name, code, lead_type, category, unit, rate, min_qty, description, sort_order, status)
     SELECT l.brand_id, $2, r.name, r.code, r.lead_type, r.category, r.unit, r.rate, r.min_qty, r.description, r.sort_order, r.status
       FROM rate_cards r
       JOIN "${TABLES.locations}" l ON l.id = $2
      WHERE r.location_id = $1 AND r.status = 1
        AND NOT EXISTS (
          SELECT 1 FROM rate_cards x
           WHERE x.location_id = $2 AND UPPER(x.name) = UPPER(r.name))
     RETURNING id`,
    [fromLocationId, toLocationId]
  );
  return rows.length;
}