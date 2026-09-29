import * as userRepo from "../repositories/user.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { verifyToken } from "../utils/jwt.js";

/**
 * Reads the bearer token, then loads the user and their permissions from
 * the database. Nothing about the caller is taken from the request itself.
 */
export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return next(ApiError.unauthorized("Sign in to continue."));

    const payload = verifyToken(token);
    if (!payload) return next(ApiError.unauthorized("Your session has expired. Sign in again."));

    const user = await userRepo.findAuthUser(payload.sub);
    if (!user) return next(ApiError.unauthorized("Your account no longer exists."));
    if (Number(user.status) !== 1) return next(ApiError.forbidden("This account is deactivated."));

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

export const requireAuth = (req, res, next) => (req.user ? next() : next(ApiError.unauthorized()));

/** Route guard: requirePermission("brand.create") */
export const requirePermission = (permission) => (req, res, next) => {
  const held = req.user?.permissions || [];
  if (held.includes(permission)) return next();
  next(ApiError.forbidden(`This action needs the "${permission}" permission.`));
};