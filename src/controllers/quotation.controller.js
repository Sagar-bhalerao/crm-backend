import * as quotationService from "../services/quotation.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { readFile } from "../utils/storage.js";
import { sendCreated, sendOk } from "../utils/response.js";

export const listForLead = asyncHandler(async (req, res) => {
  sendOk(res, await quotationService.listForLead(req.params.leadId, req.user), "Quotations loaded");
});

export const getOne = asyncHandler(async (req, res) => {
  sendOk(res, await quotationService.getById(req.params.id, req.user), "Quotation loaded");
});

export const create = asyncHandler(async (req, res) => {
  const quotation = await quotationService.create(req.params.leadId, req.body, req.user);
  sendCreated(res, quotation, `Quotation ${quotation.quotationCode} v${quotation.version} created`);
});

export const generatePdf = asyncHandler(async (req, res) => {
  sendOk(res, await quotationService.generatePdf(req.params.id, req.user), "PDF generated");
});

export const downloadPdf = asyncHandler(async (req, res) => {
  const quotation = await quotationService.getPdf(req.params.id, req.user);
  const file = await readFile(quotation.pdfPath);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${quotation.quotationCode}-v${quotation.version}.pdf"`);
  res.send(file);
});

export const share = asyncHandler(async (req, res) => {
  sendOk(res, await quotationService.share(req.params.id, req.user), "Quotation shared");
});

export const setStatus = asyncHandler(async (req, res) => {
  sendOk(res, await quotationService.setStatus(req.params.id, req.body.status, req.user), "Quotation updated");
});