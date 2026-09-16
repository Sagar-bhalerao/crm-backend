import * as settingsService from "../services/settings.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendOk } from "../utils/response.js";

export const get = asyncHandler(async (req, res) => {
  sendOk(res, await settingsService.get(), "Settings loaded");
});

export const update = asyncHandler(async (req, res) => {
  sendOk(res, await settingsService.update(req.body), "Settings saved");
});

export const reset = asyncHandler(async (req, res) => {
  sendOk(res, await settingsService.reset(), "Settings reset to defaults");
});
