import * as locationService from "../services/location.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { listPayload, sendCreated, sendOk } from "../utils/response.js";

export const list = asyncHandler(async (req, res) => {
  const { items, ...meta } = await locationService.list(req.query);
  sendOk(res, listPayload(items, meta), "Locations loaded");
});

export const getOne = asyncHandler(async (req, res) => {
  sendOk(res, await locationService.getById(req.params.id), "Location loaded");
});

export const create = asyncHandler(async (req, res) => {
  sendCreated(res, await locationService.create(req.body), "Location created successfully");
});

export const update = asyncHandler(async (req, res) => {
  sendOk(res, await locationService.update(req.params.id, req.body), "Location updated successfully");
});

export const setStatus = asyncHandler(async (req, res) => {
  const location = await locationService.setStatus(req.params.id, req.body.status);
  sendOk(res, location, location.status === "active" ? "Location activated" : "Location deactivated");
});

export const remove = asyncHandler(async (req, res) => {
  sendOk(res, await locationService.remove(req.params.id), "Location deleted");
});
