import { ApiError } from "../utils/ApiError.js";

/**
 * Placeholder for the real authentication layer.
 *
 * The chain is deliberately: authenticate -> requirePermission -> controller,
 * so when sessions or JWTs are added, only `authenticate` changes and every
 * route keeps its permission requirement.
 *
 * Nothing here trusts the client: the role and permissions must come from the
 * database row for the signed-in user, never from a request header or body.
 */

/** Replace this with a real session or token lookup. */
export function authenticate(req, res, next) {
  // TODO: read the session cookie / bearer token, load the user and their
  // permissions from the database, and attach it as req.user.
  req.user = { id: null, role: "super_admin", permissions: ["*"] };
  next();
}

export const requireAuth = (req, res, next) => (req.user ? next() : next(ApiError.unauthorized()));

/** Route guard: requirePermission("brand.create") */
export const requirePermission = (permission) => (req, res, next) => {
  const held = req.user?.permissions || [];
  if (held.includes("*") || held.includes(permission)) return next();
  next(ApiError.forbidden(`This action needs the "${permission}" permission.`));
};
