import * as whatsappConfigService from "../services/whatsappConfig.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { listPayload, sendCreated, sendOk } from "../utils/response.js";

export const list = asyncHandler(async (req, res) => {
  const { items, ...meta } = await whatsappConfigService.list(req.query);
  sendOk(res, listPayload(items, meta), "WhatsApp configurations loaded");
});

export const getOne = asyncHandler(async (req, res) => {
  sendOk(res, await whatsappConfigService.getById(req.params.id), "WhatsApp configuration loaded");
});

export const create = asyncHandler(async (req, res) => {
  sendCreated(res, await whatsappConfigService.create(req.body), "WhatsApp configuration created");
});

export const update = asyncHandler(async (req, res) => {
  sendOk(res, await whatsappConfigService.update(req.params.id, req.body), "WhatsApp configuration updated");
});

export const setStatus = asyncHandler(async (req, res) => {
  const config = await whatsappConfigService.setStatus(req.params.id, req.body.status);
  sendOk(res, config, config.status === 1 ? "WhatsApp configuration activated" : "WhatsApp configuration deactivated");
});

export const remove = asyncHandler(async (req, res) => {
  sendOk(res, await whatsappConfigService.remove(req.params.id), "WhatsApp configuration deleted");
});
