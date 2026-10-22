import { query, withTransaction } from "../config/database.js";


const toItem = (row) => ({
  id: row.id,
  description: row.description,
  qty: Number(row.qty),
  rate: Number(row.rate),
  amount: Number(row.amount),
  sortOrder: row.sort_order,
});

const toQuotation = (row) => ({
  id: row.id,
  leadId: row.lead_id,
  leadCode: row.lead_code,
  customerName: row.customer_name,
  quotationCode: row.quotation_code,
  version: row.version,
  subtotal: Number(row.subtotal),
  discount: Number(row.discount),
  discountType: row.discount_type || "rupees",
  // What the discount actually came to, so the PDF and screens agree
  discountAmount: row.discount_type === "percentage"
    ? Math.round(Number(row.subtotal) * Number(row.discount)) / 100
    : Number(row.discount),
  taxRate: Number(row.tax_rate),
  taxAmount: Number(row.tax_amount),
  total: Number(row.total),
  validUntil: row.valid_until,
  notes: row.notes,
  pdfPath: row.pdf_path,
  pdfGeneratedAt: row.pdf_generated_at,
  status: row.status,
  sharedAt: row.shared_at,
  createdAt: row.created_date,
  createdBy: row.created_by,
  createdByName: row.created_by_name,
});

const SELECT = () => `
  SELECT q.*, l.lead_code,
         TRIM(CONCAT(l.first_name, ' ', COALESCE(l.last_name, ''))) AS customer_name,
         TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))) AS created_by_name
    FROM quotations q
    LEFT JOIN leads l ON l.id = q.lead_id
    LEFT JOIN users u ON u.id = q.created_by`;

/** Every version for a lead, newest first. */
export async function findByLead(leadId) {
  const { rows } = await query(`${SELECT()} WHERE q.lead_id = $1 ORDER BY q.version DESC`, [leadId]);
  return rows.map(toQuotation);
}

export async function findById(id) {
  const { rows } = await query(`${SELECT()} WHERE q.id = $1`, [id]);
  if (!rows[0]) return null;

  const { rows: items } = await query(
    `SELECT * FROM quotation_items WHERE quotation_id = $1 ORDER BY sort_order, id`,
    [id]
  );
  return { ...toQuotation(rows[0]), items: items.map(toItem) };
}

/** The version in play: the newest one that has not been superseded. */
export async function findCurrent(leadId) {
  const { rows } = await query(
    `SELECT id FROM quotations WHERE lead_id = $1 AND status <> 'superseded'
      ORDER BY version DESC LIMIT 1`,
    [leadId]
  );
  return rows[0] ? findById(rows[0].id) : null;
}

/** Totals are worked out here, never trusted from the browser. */
/**
 * Totals are worked out here, never trusted from the browser.
 * A percentage discount is taken off the subtotal; rupees is a flat amount.
 */
function calculate(items, discount, discountType, taxRate) {
  const subtotal = items.reduce((sum, i) => sum + Number(i.qty) * Number(i.rate), 0);

  const value = Number(discount || 0);
  const discountAmount = discountType === "percentage" ? (subtotal * value) / 100 : value;

  const afterDiscount = Math.max(0, subtotal - discountAmount);
  const taxAmount = (afterDiscount * Number(taxRate || 0)) / 100;

  return {
    subtotal: round(subtotal),
    discountAmount: round(discountAmount),
    taxAmount: round(taxAmount),
    total: round(afterDiscount + taxAmount),
  };
}

const round = (n) => Math.round(n * 100) / 100;

/**
 * Creates the next version for a lead. Any earlier version that is still
 * open becomes "superseded", so only one is ever current.
 */
export async function insertVersion(leadId, data, userId) {
  const id = await withTransaction(async (client) => {
    const { rows: last } = await client.query(
      `SELECT version, quotation_code FROM quotations WHERE lead_id = $1
        ORDER BY version DESC LIMIT 1 FOR UPDATE`,
      [leadId]
    );

    const version = (last[0]?.version || 0) + 1;

    // The code is set once on v1 and carried by every later version
    let code = last[0]?.quotation_code;
    if (!code) {
      const { rows: lead } = await client.query(`SELECT lead_code FROM leads WHERE id = $1`, [leadId]);
      code = `QT-${lead[0].lead_code}`;
    }

    await client.query(
      `UPDATE quotations SET status = 'superseded', updated_date = now()
        WHERE lead_id = $1 AND status IN ('draft', 'shared')`,
      [leadId]
    );

    const totals = calculate(data.items, data.discount, data.discountType, data.taxRate);

    const { rows } = await client.query(
      `INSERT INTO quotations
         (lead_id, quotation_code, version, subtotal, discount, discount_type, tax_rate, tax_amount, total,
          valid_until, notes, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'draft',$12) RETURNING id`,
      [
        leadId, code, version, totals.subtotal, data.discount || 0, data.discountType || "rupees",
        data.taxRate, totals.taxAmount, totals.total, data.validUntil, data.notes, userId,
      ]
    );

    const quotationId = rows[0].id;

    for (const [index, item] of data.items.entries()) {
      await client.query(
        `INSERT INTO quotation_items (quotation_id, description, qty, rate, amount, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [quotationId, item.description, item.qty, item.rate, round(item.qty * item.rate), index]
      );
    }

    return quotationId;
  });

  return findById(id);
}

export async function setPdfPath(id, pdfPath) {
  await query(
    `UPDATE quotations SET pdf_path = $2, pdf_generated_at = now(), updated_date = now() WHERE id = $1`,
    [id, pdfPath]
  );
  return findById(id);
}

export async function markShared(id) {
  await query(
    `UPDATE quotations SET status = 'shared', shared_at = now(), updated_date = now() WHERE id = $1`,
    [id]
  );
  return findById(id);
}

export async function setStatus(id, status) {
  await query(`UPDATE quotations SET status = $2, updated_date = now() WHERE id = $1`, [id, status]);
  return findById(id);
}

/** Details the PDF needs that do not live on the quotation itself. */
export async function findContext(leadId) {
  const { rows } = await query(
    `SELECT l.*, b.brand_name AS brand_name, b.code AS brand_code,
            loc.location_name AS location_name, loc.address AS location_address,
            loc.city AS location_city, loc.state AS location_state,
            loc.contact_number AS location_phone, loc.email AS location_email,
            TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))) AS poc_name,
            u.mobile AS poc_mobile, u.email AS poc_email
       FROM leads l
       LEFT JOIN "brand" b ON b.id = l.brand_id
       LEFT JOIN "location" loc ON loc.id = l.location_id
       LEFT JOIN users u ON u.id = l.assigned_to
      WHERE l.id = $1`,
    [leadId]
  );
  return rows[0] || null;
}