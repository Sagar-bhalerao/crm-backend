import bcrypt from "bcryptjs";
import * as userRepo from "../repositories/user.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { signToken } from "../utils/jwt.js";

export async function login({ email, password }) {
  const row = await userRepo.findForLogin(email);

  // Same message whether the email is unknown or the password is wrong,
  // so this cannot be used to find out which accounts exist.
  const invalid = ApiError.unauthorized("Email or password is incorrect.");
  if (!row || !row.password_hash) throw invalid;

  const matches = await bcrypt.compare(password, row.password_hash);
  if (!matches) throw invalid;

  if (Number(row.status) !== 1) {
    throw ApiError.forbidden("This account is deactivated. Ask an admin to activate it.");
  }

  await userRepo.touchLastLogin(row.id);
  const user = await userRepo.findAuthUser(row.id);
  return { token: signToken(user.id), user };
}

export async function getSession(userId) {
  const user = await userRepo.findAuthUser(userId);
  if (!user) throw ApiError.unauthorized("Your account no longer exists.");
  if (Number(user.status) !== 1) throw ApiError.forbidden("This account is deactivated.");
  return user;
}