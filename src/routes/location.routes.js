import { Router } from "express";
import * as locationController from "../controllers/location.controller.js";
import { requirePermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  createLocationSchema, listLocationsSchema, locationIdParam,
  locationStatusSchema, updateLocationSchema,
} from "../validators/location.validator.js";

export const locationRoutes = Router();

locationRoutes.get("/", requirePermission("location.view"), validate({ query: listLocationsSchema }), locationController.list);
locationRoutes.get("/:id", requirePermission("location.view"), validate({ params: locationIdParam }), locationController.getOne);
locationRoutes.post("/", requirePermission("location.create"), validate({ body: createLocationSchema }), locationController.create);
locationRoutes.put("/:id", requirePermission("location.update"), validate({ params: locationIdParam, body: updateLocationSchema }), locationController.update);
locationRoutes.patch("/:id/status", requirePermission("location.update"), validate({ params: locationIdParam, body: locationStatusSchema }), locationController.setStatus);
locationRoutes.delete("/:id", requirePermission("location.delete"), validate({ params: locationIdParam }), locationController.remove);