import * as userService from "../services/user.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { listPayload, sendCreated, sendOk } from "../utils/response.js";

export const list = asyncHandler(async (req, res) => {
  const { items, ...meta } = await userService.list(req.query);
  sendOk(res, listPayload(items, meta), "Users loaded");
});

export const getOne = asyncHandler(async (req, res) => {
  sendOk(res, await userService.getById(req.params.id), "User loaded");
});

export const create = asyncHandler(async (req, res) => {
  sendCreated(res, await userService.create(req.body), "User created successfully");
});

export const update = asyncHandler(async (req, res) => {
  sendOk(res, await userService.update(req.params.id, req.body), "User updated successfully");
});

export const setStatus = asyncHandler(async (req, res) => {
  const user = await userService.setStatus(req.params.id, req.body.status);
  sendOk(res, user, user.status === 1 ? "User activated" : "User deactivated");
});

export const setPassword = asyncHandler(async (req, res) => {
  sendOk(res, await userService.setPassword(req.params.id, req.body.password), "Password updated");
});

export const remove = asyncHandler(async (req, res) => {
  sendOk(res, await userService.remove(req.params.id), "User deleted");
});