import * as leadRepo from "../repositories/lead.repository.js";
import * as quotationRepo from "../repositories/quotation.repository.js";
import * as leadService from "./lead.service.js";
import { generateQuotationPdf } from "./quotationPdf.js";
import { ApiError } from "../utils/ApiError.js";
import { fileExists } from "../utils/storage.js";
import { sendLeadEmail } from "./emailSender.js";
import { buildQuotationEmail } from "./quotationEmail.js";

/** Visibility follows the lead, so there is one rule, not two. */
export async function listForLead(leadId, user) {
  await leadService.getById(leadId, user);
  return quotationRepo.findByLead(leadId);
}

export async function getById(id, user) {
  const quotation = await quotationRepo.findById(id);
  if (!quotation) throw ApiError.notFound("That quotation does not exist.");
  await leadService.getById(quotation.leadId, user);
  return quotation;
}

/**
 * Saves a new version, then generates its PDF.
 *
 * The PDF is made after the row is committed: writing a file is not part of
 * the transaction, so doing it inside would leave an orphan file if the
 * commit failed. If generation fails the quotation still exists and the PDF
 * can be retried.
 */
export async function create(leadId, data, user) {
  const lead = await leadService.getById(leadId, user);
  if (["finalized", "cancelled"].includes(lead.status)) {
    throw ApiError.badRequest("This lead is closed, so a quotation cannot be added.");
  }
  if (!data.items?.length) throw ApiError.badRequest("Add at least one item.");

  const quotation = await quotationRepo.insertVersion(leadId, data, user.id);

  await leadRepo.addActivity(
    null, leadId, "quotation",
    `Quotation ${quotation.quotationCode} v${quotation.version} created (₹${quotation.total.toLocaleString("en-IN")})`,
    user.id
  );

  try {
    return await generatePdf(quotation.id, user);
  } catch (err) {
    // The quotation is saved; only the PDF is missing
    console.error("Quotation PDF failed:", err.message);
    return { ...quotation, pdfError: "The quotation was saved, but the PDF could not be generated." };
  }
}

export async function generatePdf(id, user) {
  const quotation = await getById(id, user);
  const context = await quotationRepo.findContext(quotation.leadId);
  if (!context) throw ApiError.notFound("The lead for this quotation no longer exists.");

  const path = await generateQuotationPdf(quotation, context);
  return quotationRepo.setPdfPath(id, path);
}

/** The file for the download route. */
export async function getPdf(id, user) {
  const quotation = await getById(id, user);
  if (!quotation.pdfPath || !(await fileExists(quotation.pdfPath))) {
    throw ApiError.notFound("The PDF has not been generated yet.");
  }
  return quotation;
}

/**
 * Marks the quotation shared and moves the lead to the Quotation stage.
 * Sending the message itself comes next; this records that it went out.
 */
/**
 * Emails the quotation with its PDF attached, marks it shared and moves the
 * lead forward. A failed send leaves the quotation as a draft, so Share can
 * simply be pressed again once the problem is fixed.
 */
export async function share(id, user) {
  const quotation = await getById(id, user);
  if (!quotation.pdfPath) throw ApiError.badRequest("Generate the PDF before sharing.");
  if (quotation.status === "superseded") throw ApiError.badRequest("This version has been replaced by a newer one.");

  const lead = await leadRepo.findById(quotation.leadId);
  const context = await quotationRepo.findContext(quotation.leadId);
  const { subject, body } = buildQuotationEmail(lead, quotation, context);

  try {
    await sendLeadEmail(lead, {
      messageType: "quotation",
      subject,
      body,
      attachments: [{ path: quotation.pdfPath, filename: `${quotation.quotationCode}-v${quotation.version}.pdf` }],
      userId: user.id,
    });
  } catch (err) {
    // The attempt is already logged against the lead, so just surface why
    throw ApiError.badRequest(err.message);
  }

  const shared = await quotationRepo.markShared(id);

  // Only move the lead forward; never drag it back from a later stage
  if (["new", "assigned", "in_progress"].includes(lead.status)) {
    await leadRepo.update(lead.id, { status: "quotation" });
  }

  await leadRepo.addActivity(
    null, quotation.leadId, "message_sent",
    `Quotation ${quotation.quotationCode} v${quotation.version} emailed to ${lead.email}`,
    user.id
  );

  return shared;
}

export async function setStatus(id, status, user) {
  await getById(id, user);
  return quotationRepo.setStatus(id, status);
}