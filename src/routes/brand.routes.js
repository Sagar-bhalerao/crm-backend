import { Router } from "express";
import * as brandController from "../controllers/brand.controller.js";
import { requirePermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import { brandIdParam, brandStatusSchema, createBrandSchema, listBrandsSchema, updateBrandSchema } from "../validators/brand.validator.js";
import { listLocationsSchema } from "../validators/location.validator.js";

export const brandRoutes = Router();

brandRoutes.get("/", requirePermission("brand.view"), validate({ query: listBrandsSchema }), brandController.list);

brandRoutes.get("/:id", requirePermission("brand.view"), validate({ params: brandIdParam }), brandController.getOne);

brandRoutes.get("/:id/locations",
  requirePermission("location.view"),
  validate({ params: brandIdParam, query: listLocationsSchema }),
  brandController.listLocations
);

brandRoutes.post("/", requirePermission("brand.create"), validate({ body: createBrandSchema }), brandController.create);

brandRoutes.put(
  "/:id",
  requirePermission("brand.update"),
  validate({ params: brandIdParam, body: updateBrandSchema }),
  brandController.update
);

brandRoutes.patch(
  "/:id/status",
  requirePermission("brand.update"),
  validate({ params: brandIdParam, body: brandStatusSchema }),
  brandController.setStatus
);
