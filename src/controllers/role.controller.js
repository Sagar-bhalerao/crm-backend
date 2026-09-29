import * as roleService from "../services/role.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendCreated, sendOk } from "../utils/response.js";

export const list = asyncHandler(async (req, res) => {
  sendOk(res, await roleService.list(req.query), "Roles loaded");
});

export const listPermissions = asyncHandler(async (req, res) => {
  sendOk(res, await roleService.listPermissions(), "Permissions loaded");
});

export const getOne = asyncHandler(async (req, res) => {
  sendOk(res, await roleService.getById(req.params.id), "Role loaded");
});

export const create = asyncHandler(async (req, res) => {
  sendCreated(res, await roleService.create(req.body), "Role created successfully");
});

export const update = asyncHandler(async (req, res) => {
  sendOk(res, await roleService.update(req.params.id, req.body), "Role updated successfully");
});

export const setStatus = asyncHandler(async (req, res) => {
  const role = await roleService.setStatus(req.params.id, req.body.status);
  sendOk(res, role, role.status === 1 ? "Role activated" : "Role deactivated");
});

export const remove = asyncHandler(async (req, res) => {
  sendOk(res, await roleService.remove(req.params.id), "Role deleted");
});