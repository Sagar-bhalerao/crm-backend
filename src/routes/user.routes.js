import { Router } from "express";
import * as userController from "../controllers/user.controller.js";
import { requirePermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  createUserSchema, listUsersSchema, passwordSchema,
  updateUserSchema, userIdParam, userStatusSchema,
} from "../validators/user.validator.js";

export const userRoutes = Router();

userRoutes.get("/", requirePermission("user.view"), validate({ query: listUsersSchema }), userController.list);

userRoutes.get("/:id", requirePermission("user.view"), validate({ params: userIdParam }), userController.getOne);

userRoutes.post("/", requirePermission("user.create"), validate({ body: createUserSchema }), userController.create);

userRoutes.put(
  "/:id",
  requirePermission("user.update"),
  validate({ params: userIdParam, body: updateUserSchema }),
  userController.update
);

userRoutes.patch(
  "/:id/status",
  requirePermission("user.update"),
  validate({ params: userIdParam, body: userStatusSchema }),
  userController.setStatus
);

userRoutes.post(
  "/:id/password",
  requirePermission("user.update"),
  validate({ params: userIdParam, body: passwordSchema }),
  userController.setPassword
);

userRoutes.delete("/:id", requirePermission("user.delete"), validate({ params: userIdParam }), userController.remove);