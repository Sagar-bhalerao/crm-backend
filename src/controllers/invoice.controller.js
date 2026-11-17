import * as invoiceService from "../services/invoice.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { readFile } from "../utils/storage.js";
import { listPayload, sendCreated, sendOk } from "../utils/response.js";


export const list = asyncHandler(async (req, res) => {
  const { items, ...meta } = await invoiceService.list(req.query, req.user);
  sendOk(res, listPayload(items, meta), "Proforma invoices loaded");
});
export const listForLead = asyncHandler(async (req, res) => {
  sendOk(res, await invoiceService.listForLead(req.params.leadId, req.user), "Proforma invoices loaded");
});

export const getOne = asyncHandler(async (req, res) => {
  sendOk(res, await invoiceService.getById(req.params.id, req.user), "Proforma invoice loaded");
});

export const create = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.create(req.params.leadId, req.body, req.user);
  sendCreated(res, invoice, `Proforma invoice ${invoice.invoiceNumber} created`);
});

export const update = asyncHandler(async (req, res) => {
  sendOk(res, await invoiceService.update(req.params.id, req.body, req.user), "Proforma invoice updated");
});

export const generatePdf = asyncHandler(async (req, res) => {
  sendOk(res, await invoiceService.generatePdf(req.params.id, req.user), "PDF generated");
});

export const downloadPdf = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.getPdf(req.params.id, req.user);
  const file = await readFile(invoice.pdfPath);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${invoice.invoiceNumber}.pdf"`);
  res.send(file);
});

export const send = asyncHandler(async (req, res) => {
  sendOk(res, await invoiceService.send(req.params.id, req.user), "Proforma invoice sent");
});

export const recordPayment = asyncHandler(async (req, res) => {
  sendOk(res, await invoiceService.recordPayment(req.params.id, req.body, req.user), "Advance payment recorded");
});

export const cancel = asyncHandler(async (req, res) => {
  sendOk(res, await invoiceService.cancel(req.params.id, req.body.reason, req.user), "Proforma invoice cancelled");
});