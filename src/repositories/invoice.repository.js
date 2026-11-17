import { query, withTransaction } from "../config/database.js";
import { parsePagination, parseSort } from "../utils/pagination.js";
import { scopeClause } from "./lead.repository.js";
import { calculate, round } from "./quotation.repository.js";

const toItem = (row) => ({
  id: row.id,
  description: row.description,
  qty: Number(row.qty),
  rate: Number(row.rate),
  amount: Number(row.amount),
  sortOrder: row.sort_order,
});

const toInvoice = (row) => ({
  id: row.id,
  leadId: row.lead_id,
  leadCode: row.lead_code,
  customerName: row.customer_name,
  quotationId: row.quotation_id,
  quotationVersion: row.quotation_version,
  // The quote was revised after this invoice was made, so the UI can warn
  quotationOutdated: row.newer_quotation_exists === true,
  invoiceNumber: row.invoice_number,
  status: row.status,

  billingName: row.billing_name,
  billingGstin: row.billing_gstin,
  billingAddress: row.billing_address,

  subtotal: Number(row.subtotal),
  discount: Number(row.discount),
  discountType: row.discount_type,
  discountAmount: row.discount_type === "percentage"
    ? Math.round(Number(row.subtotal) * Number(row.discount)) / 100
    : Number(row.discount),
  taxRate: Number(row.tax_rate),
  taxAmount: Number(row.tax_amount),
  total: Number(row.total),

  advanceDue: Number(row.advance_due),
  balanceDue: round(Number(row.total) - Number(row.advance_due)),
  advancePaid: row.advance_paid != null ? Number(row.advance_paid) : null,
  paidAt: row.paid_at,
  paymentMode: row.payment_mode,
  paymentReference: row.payment_reference,

  notes: row.notes,
  pdfPath: row.pdf_path,
  pdfGeneratedAt: row.pdf_generated_at,
  sentAt: row.sent_at,
  cancelledAt: row.cancelled_at,
  cancelReason: row.cancel_reason,
  createdAt: row.created_date,
  createdBy: row.created_by,
  createdByName: row.created_by_name,
});

const SELECT = () => `
  SELECT pi.*, l.lead_code, q.version AS quotation_version,
         TRIM(CONCAT(l.first_name, ' ', COALESCE(l.last_name, ''))) AS customer_name,
         TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))) AS created_by_name,
         EXISTS (SELECT 1 FROM quotations q2
                  WHERE q2.lead_id = pi.lead_id AND q2.version > q.version) AS newer_quotation_exists
    FROM proforma_invoices pi
    LEFT JOIN leads l ON l.id = pi.lead_id
    LEFT JOIN quotations q ON q.id = pi.quotation_id
    LEFT JOIN users u ON u.id = pi.created_by`;

/** Every invoice for a lead, cancelled ones included, newest first. */
export async function findByLead(leadId) {
  const { rows } = await query(`${SELECT()} WHERE pi.lead_id = $1 ORDER BY pi.id DESC`, [leadId]);
  return rows.map(toInvoice);
}

const LIST_SORT = { createdAt: "pi.created_date", eventDate: "l.event_date", total: "pi.total" };

/**
 * Invoices across every lead the user can see. Cancelled ones are left out
 * unless asked for by status, so the default list is the ones still in play.
 */
export async function findAll({ search, status, locationId, sort, page, pageSize }, scope) {
  const { offset, ...paging } = parsePagination({ page, pageSize });
  const params = [];
  const where = [];

  const scoped = scopeClause(scope, params);
  if (scoped) where.push(scoped);

  if (status) {
    params.push(status);
    where.push(`pi.status = $${params.length}`);
  } else {
    where.push(`pi.status <> 'cancelled'`);
  }
  if (locationId) {
    params.push(locationId);
    where.push(`l.location_id = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    where.push(`(pi.invoice_number ILIKE $${params.length} OR pi.billing_name ILIKE $${params.length}
                 OR l.lead_code ILIKE $${params.length} OR l.first_name ILIKE $${params.length}
                 OR l.last_name ILIKE $${params.length} OR l.mobile ILIKE $${params.length})`);
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;

  const { rows: countRows } = await query(
    `SELECT count(*)::int AS total FROM proforma_invoices pi JOIN leads l ON l.id = pi.lead_id ${whereSql}`,
    params
  );

  const { rows } = await query(
    `SELECT pi.*, l.lead_code, l.event_date, q.version AS quotation_version,
            TRIM(CONCAT(l.first_name, ' ', COALESCE(l.last_name, ''))) AS customer_name,
            loc.location_name,
            TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))) AS created_by_name,
            TRIM(CONCAT(a.first_name, ' ', COALESCE(a.last_name, ''))) AS assigned_to_name
       FROM proforma_invoices pi
       JOIN leads l ON l.id = pi.lead_id
       LEFT JOIN quotations q ON q.id = pi.quotation_id
       LEFT JOIN "location" loc ON loc.id = l.location_id
       LEFT JOIN users u ON u.id = pi.created_by
       LEFT JOIN users a ON a.id = l.assigned_to
       ${whereSql}
      ORDER BY ${parseSort(sort, LIST_SORT, "createdAt")}, pi.id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, paging.pageSize, offset]
  );

  return {
    items: rows.map((r) => ({
      ...toInvoice(r),
      locationName: r.location_name,
      eventDate: r.event_date,
      assignedToName: r.assigned_to_name || null,
    })),
    total: countRows[0].total,
    ...paging,
  };
}


export async function findById(id) {
  const { rows } = await query(`${SELECT()} WHERE pi.id = $1`, [id]);
  if (!rows[0]) return null;

  const { rows: items } = await query(
    `SELECT * FROM proforma_invoice_items WHERE proforma_invoice_id = $1 ORDER BY sort_order, id`,
    [id]
  );
  return { ...toInvoice(rows[0]), items: items.map(toItem) };
}

/** The one invoice in play for a lead: anything not cancelled. */
export async function findActive(leadId) {
  const { rows } = await query(
    `SELECT id FROM proforma_invoices WHERE lead_id = $1 AND status <> 'cancelled' LIMIT 1`,
    [leadId]
  );
  return rows[0] ? findById(rows[0].id) : null;
}

async function insertItems(client, invoiceId, items) {
  for (const [index, item] of items.entries()) {
    await client.query(
      `INSERT INTO proforma_invoice_items (proforma_invoice_id, description, qty, rate, amount, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [invoiceId, item.description, item.qty, item.rate, round(item.qty * item.rate), index]
    );
  }
}

/**
 * Copies a quotation's totals and items into a new draft invoice.
 * Billing details and the advance come from the caller.
 */
export async function insertFromQuotation(leadId, quotationId, data, userId) {
  const id = await withTransaction(async (client) => {
    // Locking the lead row makes two "Create invoice" clicks take turns,
    // so they can't both read the same count and pick the same number.
    const { rows: lead } = await client.query(
      `SELECT lead_code FROM leads WHERE id = $1 FOR UPDATE`,
      [leadId]
    );
    const { rows: count } = await client.query(
      `SELECT count(*)::int AS n FROM proforma_invoices WHERE lead_id = $1`,
      [leadId]
    );

    // Cancelled invoices keep their numbers, so a reissue gets a suffix
    const base = `PI-${lead[0].lead_code}`;
    const invoiceNumber = count[0].n === 0 ? base : `${base}-${count[0].n + 1}`;

    const { rows } = await client.query(
      `INSERT INTO proforma_invoices
         (lead_id, quotation_id, invoice_number, billing_name, billing_gstin, billing_address,
          subtotal, discount, discount_type, tax_rate, tax_amount, total, advance_due, notes, created_by)
       SELECT q.lead_id, q.id, $3, $4, $5, $6,
              q.subtotal, q.discount, q.discount_type, q.tax_rate, q.tax_amount, q.total, $7, $8, $9
         FROM quotations q
        WHERE q.id = $2 AND q.lead_id = $1
       RETURNING id`,
      [
        leadId, quotationId, invoiceNumber, data.billingName, data.billingGstin,
        data.billingAddress, data.advanceDue || 0, data.notes, userId,
      ]
    );
    if (rows.length === 0) throw new Error("Quotation not found for this lead");

    const invoiceId = rows[0].id;
    await client.query(
      `INSERT INTO proforma_invoice_items (proforma_invoice_id, description, qty, rate, amount, sort_order)
       SELECT $1, description, qty, rate, amount, sort_order
         FROM quotation_items WHERE quotation_id = $2`,
      [invoiceId, quotationId]
    );
    return invoiceId;
  });

  return findById(id);
}

/**
 * Edits a draft. Totals are recalculated whenever anything that feeds them
 * changes, using the new values where sent and the stored ones otherwise.
 */
export async function updateDraft(id, changes) {
  await withTransaction(async (client) => {
    const { rows } = await client.query(`SELECT * FROM proforma_invoices WHERE id = $1 FOR UPDATE`, [id]);
    const current = rows[0];

    if (changes.items) {
      await client.query(`DELETE FROM proforma_invoice_items WHERE proforma_invoice_id = $1`, [id]);
      await insertItems(client, id, changes.items);
    }

    const { rows: items } = await client.query(
      `SELECT qty, rate FROM proforma_invoice_items WHERE proforma_invoice_id = $1`,
      [id]
    );
    const discount = changes.discount ?? current.discount;
    const discountType = changes.discountType ?? current.discount_type;
    const taxRate = changes.taxRate ?? current.tax_rate;
    const totals = calculate(items, discount, discountType, taxRate);

    const map = {
      billingName: "billing_name", billingGstin: "billing_gstin", billingAddress: "billing_address",
      advanceDue: "advance_due", notes: "notes",
    };
    const sets = [];
    const params = [];

    for (const [key, column] of Object.entries(map)) {
      if (key in changes) {
        params.push(changes[key]);
        sets.push(`${column} = $${params.length}`);
      }
    }
    for (const [column, value] of [
      ["subtotal", totals.subtotal], ["discount", discount || 0], ["discount_type", discountType],
      ["tax_rate", taxRate], ["tax_amount", totals.taxAmount], ["total", totals.total],
    ]) {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    }

    params.push(id);
    await client.query(
      `UPDATE proforma_invoices SET ${sets.join(", ")}, updated_date = now() WHERE id = $${params.length}`,
      params
    );
  });

  return findById(id);
}

export async function setPdfPath(id, pdfPath) {
  await query(
    `UPDATE proforma_invoices SET pdf_path = $2, pdf_generated_at = now(), updated_date = now() WHERE id = $1`,
    [id, pdfPath]
  );
  return findById(id);
}

export async function markSent(id) {
  await query(
    `UPDATE proforma_invoices SET status = 'sent', sent_at = now(), updated_date = now() WHERE id = $1`,
    [id]
  );
  return findById(id);
}

export async function markPaid(id, { advancePaid, paidAt, paymentMode, paymentReference }) {
  await query(
    `UPDATE proforma_invoices
        SET status = 'paid', advance_paid = $2, paid_at = COALESCE($3, now()),
            payment_mode = $4, payment_reference = $5, updated_date = now()
      WHERE id = $1`,
    [id, advancePaid, paidAt, paymentMode, paymentReference]
  );
  return findById(id);
}

export async function cancel(id, reason) {
  await query(
    `UPDATE proforma_invoices
        SET status = 'cancelled', cancelled_at = now(), cancel_reason = $2, updated_date = now()
      WHERE id = $1`,
    [id, reason]
  );
  return findById(id);
}