import * as mailConfigService from "../services/mailConfig.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { listPayload, sendCreated, sendOk } from "../utils/response.js";

export const list = asyncHandler(async (req, res) => {
  const { items, ...meta } = await mailConfigService.list(req.query);
  sendOk(res, listPayload(items, meta), "Mail configurations loaded");
});

export const getOne = asyncHandler(async (req, res) => {
  sendOk(res, await mailConfigService.getById(req.params.id), "Mail configuration loaded");
});

export const create = asyncHandler(async (req, res) => {
  sendCreated(res, await mailConfigService.create(req.body), "Mail configuration created");
});

export const update = asyncHandler(async (req, res) => {
  sendOk(res, await mailConfigService.update(req.params.id, req.body), "Mail configuration updated");
});

export const setStatus = asyncHandler(async (req, res) => {
  const config = await mailConfigService.setStatus(req.params.id, req.body.status);
  sendOk(res, config, config.status === 1 ? "Mail configuration activated" : "Mail configuration deactivated");
});

export const remove = asyncHandler(async (req, res) => {
  sendOk(res, await mailConfigService.remove(req.params.id), "Mail configuration deleted");
});
