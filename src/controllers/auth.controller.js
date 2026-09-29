import * as authService from "../services/auth.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendOk } from "../utils/response.js";

export const login = asyncHandler(async (req, res) => {
  sendOk(res, await authService.login(req.body), "Signed in");
});

export const me = asyncHandler(async (req, res) => {
  sendOk(res, await authService.getSession(req.user.id), "Session loaded");
});

/**
 * Tokens are stateless, so signing out is the browser dropping the token.
 * This exists so the frontend has one place to call, and so a token
 * blocklist can be added here later without touching the frontend.
 */
export const logout = asyncHandler(async (req, res) => {
  sendOk(res, { signedOut: true }, "Signed out");
});