import * as brandService from "../services/brand.service.js";
import * as locationService from "../services/location.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { listPayload, sendCreated, sendOk } from "../utils/response.js";

export const list = asyncHandler(async (req, res) => {
  const { items, ...meta } = await brandService.list(req.query);
  sendOk(res, listPayload(items, meta), "Brands loaded");
});

export const getOne = asyncHandler(async (req, res) => {
  sendOk(res, await brandService.getById(req.params.id), "Brand loaded");
});

export const create = asyncHandler(async (req, res) => {
  sendCreated(res, await brandService.create(req.body), "Brand created successfully");
});

export const update = asyncHandler(async (req, res) => {
  sendOk(res, await brandService.update(req.params.id, req.body), "Brand updated successfully");
});

export const setStatus = asyncHandler(async (req, res) => {
  const brand = await brandService.setStatus(req.params.id, req.body.status);
  sendOk(res, brand, brand.status === "active" ? "Brand activated" : "Brand deactivated");
});

export const listLocations = asyncHandler(async (req, res) => {
  const { items, ...meta } = await locationService.listByBrand(req.params.id, req.query);
  sendOk(res, listPayload(items, meta), "Locations loaded");
});
