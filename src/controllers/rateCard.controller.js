import { RATE_CATEGORIES, RATE_UNITS } from "../config/rateCards.js";
import * as leadService from "../services/lead.service.js";
import * as rateCardService from "../services/rateCard.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendCreated, sendOk } from "../utils/response.js";

export const options = asyncHandler(async (req, res) => {
  sendOk(res, { categories: RATE_CATEGORIES, units: RATE_UNITS }, "Options loaded");
});

export const list = asyncHandler(async (req, res) => {
  sendOk(res, await rateCardService.list(req.query), "Rate card loaded");
});

export const getOne = asyncHandler(async (req, res) => {
  sendOk(res, await rateCardService.getById(req.params.id), "Item loaded");
});

export const create = asyncHandler(async (req, res) => {
  sendCreated(res, await rateCardService.create(req.body), "Item added to the rate card");
});

export const update = asyncHandler(async (req, res) => {
  sendOk(res, await rateCardService.update(req.params.id, req.body), "Item updated");
});

export const setStatus = asyncHandler(async (req, res) => {
  const item = await rateCardService.setStatus(req.params.id, req.body.status);
  sendOk(res, item, item.status === 1 ? "Item activated" : "Item deactivated");
});

export const remove = asyncHandler(async (req, res) => {
  sendOk(res, await rateCardService.remove(req.params.id), "Item deleted");
});

export const copy = asyncHandler(async (req, res) => {
  const result = await rateCardService.copy(req.body.fromLocationId, req.body.toLocationId);
  sendOk(res, result, `${result.copied} item${result.copied === 1 ? "" : "s"} copied from ${result.from} to ${result.to}`);
});

/** What the quotation builder offers for one lead. */
export const forLead = asyncHandler(async (req, res) => {
  const lead = await leadService.getById(req.params.leadId, req.user);
  sendOk(res, await rateCardService.forLead(lead), "Rate card loaded");
});