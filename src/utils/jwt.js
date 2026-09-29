import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

/**
 * The token carries the user id and nothing else. Permissions are read
 * from the database on every request, so a role change takes effect
 * immediately instead of waiting for the token to expire.
 */
export const signToken = (userId) =>
  jwt.sign({ sub: String(userId) }, env.jwt.secret, { expiresIn: env.jwt.expiresIn });

export function verifyToken(token) {
  try {
    return jwt.verify(token, env.jwt.secret);
  } catch {
    return null;
  }
}