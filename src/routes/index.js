import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { brandRoutes } from "./brand.routes.js";
import { locationRoutes } from "./location.routes.js";

import { userRoutes } from "./user.routes.js";
import { permissionRoutes, roleRoutes } from "./role.routes.js";
import { authRoutes, publicAuthRoutes } from "./auth.routes.js";

import { messagingRoutes } from "./messaging.routes.js";
import { leadRoutes, publicLeadRoutes } from "./lead.routes.js";
import { rateCardRoutes } from "./rateCard.routes.js";
import { quotationRoutes } from "./quotation.routes.js";

/** Everything under /api/v1 */
export const apiV1 = Router();

// Identify the caller first; each route then states the permission it needs.
apiV1.use("/auth", publicAuthRoutes);
apiV1.use("/auth", authRoutes);

apiV1.use("/public", publicLeadRoutes);

// Everything below needs a valid token

apiV1.use(authenticate);

apiV1.use("/brands", brandRoutes);
apiV1.use("/locations", locationRoutes);
apiV1.use("/users", userRoutes);
apiV1.use("/roles", roleRoutes);
apiV1.use("/permissions", permissionRoutes);
apiV1.use("/messaging", messagingRoutes);
apiV1.use("/leads", leadRoutes);
apiV1.use("/rate-cards", rateCardRoutes);
apiV1.use("/quotations", quotationRoutes);


apiV1.get("/", (req, res) =>
  res.json({
    success: true,
    message: "CRM API v1",
    data: { endpoints: ["/brands", "/brands/:id/locations", "/locations", "/whatsapp-configs", "/mail-configs"] },
  })
);
