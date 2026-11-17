import * as invoiceRepo from "../repositories/invoice.repository.js";
import * as leadRepo from "../repositories/lead.repository.js";
import * as quotationRepo from "../repositories/quotation.repository.js";
import * as leadService from "./lead.service.js";
import { generateInvoicePdf } from "./invoicePdf.js";
import { buildInvoiceEmail } from "./invoiceEmail.js";
import { sendLeadEmail } from "./emailSender.js";
import { ApiError } from "../utils/ApiError.js";
import { fileExists } from "../utils/storage.js";

const rupees = (n) => `₹${Number(n).toLocaleString("en-IN")}`;
/** Visibility follows the lead, same rule as the Leads list. */
export const list = (query, user) => invoiceRepo.findAll(query, leadService.scopeFor(user));

/**
 * Sending an invoice or recording its payment moves the lead to the
 * Proforma Invoice stage, but only forward, never back from a later one.
 */
async function moveLeadForward(lead) {
  if (["new", "assigned", "in_progress", "quotation"].includes(lead.status)) {
    await leadRepo.update(lead.id, { status: "proforma_invoice" });
  }
}

/** Visibility follows the lead, same as quotations. */
export async function listForLead(leadId, user) {
  await leadService.getById(leadId, user);
  return invoiceRepo.findByLead(leadId);
}

export async function getById(id, user) {
  const invoice = await invoiceRepo.findById(id);
  if (!invoice) throw ApiError.notFound("That proforma invoice does not exist.");
  await leadService.getById(invoice.leadId, user);
  return invoice;
}

/** Copies the current quotation into a draft invoice, then makes its PDF. */
export async function create(leadId, data, user) {
  const lead = await leadService.getById(leadId, user);
  if (["finalized", "cancelled"].includes(lead.status)) {
    throw ApiError.badRequest("This lead is closed, so a proforma invoice cannot be issued.");
  }

  const open = await invoiceRepo.findActive(lead.id);
  if (open) {
    throw ApiError.conflict(`${open.invoiceNumber} is already open for this lead. Cancel it before issuing a new one.`);
  }

  const quotation = data.quotationId
    ? await quotationRepo.findById(data.quotationId)
    : await quotationRepo.findCurrent(lead.id);

  if (!quotation || quotation.leadId !== lead.id) {
    throw ApiError.badRequest("Create a quotation for this lead first.");
  }
  // Drafts are allowed on purpose: a customer with no email address can
  // never have their quotation "shared", and they still need an invoice.
  if (quotation.status === "superseded") {
    throw ApiError.badRequest("That quotation version has been replaced. Invoice the current one.");
  }

  const advanceDue = data.advanceDue ?? 0;
  if (advanceDue > quotation.total) {
    throw ApiError.badRequest(`The advance can't be more than the total of ${rupees(quotation.total)}.`);
  }

  let invoice;
  try {
    invoice = await invoiceRepo.insertFromQuotation(
      lead.id,
      quotation.id,
      {
        billingName: data.billingName || lead.companyName || lead.name,
        billingGstin: "billingGstin" in data ? data.billingGstin : lead.companyGstin || null,
        billingAddress: data.billingAddress ?? null,
        advanceDue,
        notes: data.notes ?? null,
      },
      user.id
    );
  } catch (err) {
    // Two people pressed Create at once; the one-open-invoice index caught it
    if (err.code === "23505") throw ApiError.conflict("An invoice is already open for this lead.");
    throw err;
  }

  await leadRepo.addActivity(
    null, lead.id, "invoice",
    `Proforma invoice ${invoice.invoiceNumber} created from ${quotation.quotationCode} v${quotation.version} (${rupees(invoice.total)})`,
    user.id
  );

  return withPdf(invoice, user);
}

/** Only drafts change. A sent invoice is cancelled and reissued instead. */
export async function update(id, changes, user) {
  const invoice = await getById(id, user);
  if (invoice.status !== "draft") {
    throw ApiError.badRequest("Only a draft can be edited. Cancel this invoice and issue a new one to change it.");
  }

  // Check the advance against the total these changes will produce,
  // not the total the invoice has now
  const totals = quotationRepo.calculate(
    changes.items ?? invoice.items,
    changes.discount ?? invoice.discount,
    changes.discountType ?? invoice.discountType,
    changes.taxRate ?? invoice.taxRate
  );
  const advanceDue = changes.advanceDue ?? invoice.advanceDue;
  if (advanceDue > totals.total) {
    throw ApiError.badRequest(`The advance can't be more than the total of ${rupees(totals.total)}.`);
  }

  const updated = await invoiceRepo.updateDraft(id, changes);
  // The old PDF no longer matches, so it is regenerated straight away
  return withPdf(updated, user);
}

/**
 * Generates the PDF after the row is saved, like quotations: a failure here
 * leaves the invoice intact and the PDF can be retried.
 */
async function withPdf(invoice, user) {
  try {
    return await generatePdf(invoice.id, user);
  } catch (err) {
    console.error("Invoice PDF failed:", err.message);
    return { ...invoice, pdfError: "The invoice was saved, but the PDF could not be generated." };
  }
}

export async function generatePdf(id, user) {
  const invoice = await getById(id, user);
  const context = await quotationRepo.findContext(invoice.leadId);
  if (!context) throw ApiError.notFound("The lead for this invoice no longer exists.");

  const path = await generateInvoicePdf(invoice, context);
  return invoiceRepo.setPdfPath(id, path);
}

export async function getPdf(id, user) {
  const invoice = await getById(id, user);
  if (!invoice.pdfPath || !(await fileExists(invoice.pdfPath))) {
    throw ApiError.notFound("The PDF has not been generated yet.");
  }
  return invoice;
}

/**
 * Emails the invoice with its PDF. Sending again is allowed (a customer
 * asking for it twice). A failed send leaves the status as it was.
 */
export async function send(id, user) {
  const invoice = await getById(id, user);
  if (invoice.status === "cancelled") throw ApiError.badRequest("This invoice has been cancelled.");
  if (invoice.status === "paid") throw ApiError.badRequest("The advance on this invoice has already been received.");
  if (!invoice.pdfPath) throw ApiError.badRequest("Generate the PDF before sending.");
  if (invoice.advanceDue <= 0) throw ApiError.badRequest("Set the advance amount before sending the invoice.");

  const lead = await leadRepo.findById(invoice.leadId);
  const context = await quotationRepo.findContext(invoice.leadId);
  const { subject, body } = buildInvoiceEmail(lead, invoice, context);

  try {
    await sendLeadEmail(lead, {
      messageType: "proforma_invoice",
      subject,
      body,
      attachments: [{ path: invoice.pdfPath, filename: `${invoice.invoiceNumber}.pdf` }],
      userId: user.id,
    });
  } catch (err) {
    // The attempt is already logged against the lead
    throw ApiError.badRequest(err.message);
  }

  const sent = await invoiceRepo.markSent(id);
  await moveLeadForward(lead);
  await leadRepo.addActivity(
    null, invoice.leadId, "message_sent",
    `Proforma invoice ${invoice.invoiceNumber} emailed to ${lead.email}`,
    user.id
  );
  return sent;
}

/**
 * Records the advance. Allowed on a draft too: a customer with no email
 * can pay at the venue without the invoice ever being emailed.
 * This does not finalize the lead; that stays a separate step.
 */
export async function recordPayment(id, data, user) {
  const invoice = await getById(id, user);
  if (invoice.status === "cancelled") throw ApiError.badRequest("This invoice has been cancelled.");
  if (invoice.status === "paid") throw ApiError.badRequest("Payment has already been recorded on this invoice.");

  if (data.advancePaid > invoice.total) {
    throw ApiError.badRequest(`The amount can't be more than the invoice total of ${rupees(invoice.total)}.`);
  }
  if (data.paidAt && data.paidAt > new Date()) {
    throw ApiError.badRequest("The payment date can't be in the future.");
  }

  const paid = await invoiceRepo.markPaid(id, data);

  const lead = await leadRepo.findById(invoice.leadId);
  await moveLeadForward(lead);

  // A short payment is accepted but called out, so it isn't missed later
  const short = data.advancePaid < invoice.advanceDue
    ? `, ${rupees(invoice.advanceDue - data.advancePaid)} short of the advance due`
    : "";
  await leadRepo.addActivity(
    null, invoice.leadId, "payment",
    `Advance of ${rupees(data.advancePaid)} received against ${invoice.invoiceNumber}${short}`,
    user.id
  );
  return paid;
}

/**
 * Cancelling frees the lead for a fresh invoice. A paid one can't be
 * cancelled: money is recorded against it, and refunds aren't handled here.
 * The lead stays at its current stage, since a reissue is the usual next step.
 */
export async function cancel(id, reason, user) {
  const invoice = await getById(id, user);
  if (invoice.status === "cancelled") throw ApiError.badRequest("This invoice is already cancelled.");
  if (invoice.status === "paid") {
    throw ApiError.badRequest("A paid invoice can't be cancelled, because the advance is recorded against it.");
  }

  const cancelled = await invoiceRepo.cancel(id, reason);
  await leadRepo.addActivity(
    null, invoice.leadId, "invoice",
    `Proforma invoice ${invoice.invoiceNumber} cancelled: ${reason}`,
    user.id
  );
  return cancelled;
}