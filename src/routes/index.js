import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { brandRoutes } from "./brand.routes.js";
import { locationRoutes } from "./location.routes.js";
import { mailConfigRoutes } from "./mailConfig.routes.js";
import { userRoutes } from "./user.routes.js";
import { permissionRoutes, roleRoutes } from "./role.routes.js";
import { authRoutes, publicAuthRoutes } from "./auth.routes.js";
import { whatsappConfigRoutes } from "./whatsappConfig.routes.js";

/** Everything under /api/v1 */
export const apiV1 = Router();

// Identify the caller first; each route then states the permission it needs.
apiV1.use("/auth", publicAuthRoutes);
apiV1.use("/auth", authRoutes);

// Everything below needs a valid token

apiV1.use(authenticate);

apiV1.use("/brands", brandRoutes);
apiV1.use("/locations", locationRoutes);
apiV1.use("/whatsapp-configs", whatsappConfigRoutes);
apiV1.use("/mail-configs", mailConfigRoutes);
apiV1.use("/users", userRoutes);
apiV1.use("/roles", roleRoutes);
apiV1.use("/permissions", permissionRoutes);

apiV1.get("/", (req, res) =>
  res.json({
    success: true,
    message: "CRM API v1",
    data: { endpoints: ["/brands", "/brands/:id/locations", "/locations", "/whatsapp-configs", "/mail-configs"] },
  })
);
