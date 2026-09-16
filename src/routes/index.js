import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { brandRoutes } from "./brand.routes.js";
import { locationRoutes } from "./location.routes.js";
import { settingsRoutes } from "./settings.routes.js";

/** Everything under /api/v1 */
export const apiV1 = Router();

// Identify the caller first; each route then states the permission it needs.
apiV1.use(authenticate);

apiV1.use("/brands", brandRoutes);
apiV1.use("/locations", locationRoutes);
apiV1.use("/settings", settingsRoutes);

apiV1.get("/", (req, res) =>
  res.json({
    success: true,
    message: "CRM API v1",
    data: { endpoints: ["/brands", "/brands/:id/locations", "/locations", "/settings"] },
  })
);
