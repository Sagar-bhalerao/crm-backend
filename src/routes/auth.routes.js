import { Router } from "express";
import { z } from "zod";
import * as authController from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

/** Public: no token needed to reach these. */
export const publicAuthRoutes = Router();
publicAuthRoutes.post("/login", validate({ body: loginSchema }), authController.login);

/** Needs a token. */
export const authRoutes = Router();
authRoutes.get("/me", authenticate, authController.me);
authRoutes.post("/logout", authenticate, authController.logout);