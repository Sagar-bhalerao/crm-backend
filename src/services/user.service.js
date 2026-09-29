import bcrypt from "bcryptjs";
import * as roleRepo from "../repositories/role.repository.js";
import * as userRepo from "../repositories/user.repository.js";
import { ApiError } from "../utils/ApiError.js";

export const list = (query) => userRepo.findAll(query);

export async function getById(id) {
  const user = await userRepo.findById(id);
  if (!user) throw ApiError.notFound("That user does not exist.");
  return user;
}

async function checkRole(roleId) {
  const role = await roleRepo.findById(roleId);
  if (!role) throw ApiError.badRequest("Choose a role that exists.");
  if (role.status !== 1) throw ApiError.badRequest(`${role.name} is inactive. Pick an active role.`);
  return role;
}

async function checkLocations(brandId, locationIds) {
  const [missing, wrongBrand] = await userRepo.checkLocations(brandId, locationIds);
  if (missing?.length) throw ApiError.badRequest("One of the chosen locations does not exist.");
  if (wrongBrand?.length) {
    throw ApiError.badRequest(`${wrongBrand.join(", ")} does not belong to the chosen brand.`);
  }
}

export async function create(input) {
  const clash = await userRepo.findByEmail(input.email);
  if (clash) throw ApiError.conflict(`${input.email} already has an account.`);
  await checkRole(input.roleId);
  await checkLocations(input.brandId, input.locationIds);

  const { password, ...rest } = input;
  return userRepo.insert({ ...rest, passwordHash: await bcrypt.hash(password, 10) });
}

export async function update(id, changes) {
  const user = await getById(id);

  if (changes.email) {
    const clash = await userRepo.findByEmail(changes.email, id);
    if (clash) throw ApiError.conflict(`${changes.email} already has an account.`);
  }
  if (changes.roleId) await checkRole(changes.roleId);
  if (changes.locationIds) await checkLocations(changes.brandId ?? user.brandId, changes.locationIds);

  return userRepo.update(id, changes);
}

export async function setStatus(id, status) {
  await getById(id);
  return userRepo.update(id, { status });
}

/** An admin setting a new password. The old one is not needed. */
export async function setPassword(id, password) {
  await getById(id);
  await userRepo.update(id, { passwordHash: await bcrypt.hash(password, 10) });
  return { id, passwordChanged: true };
}

/**
 * Deleting a user is permanent. Deactivating is usually what you want,
 * since leads keep pointing at whoever handled them.
 */
export async function remove(id) {
  const user = await getById(id);
  if (user.roleCode === "super_admin") {
    const admins = await userRepo.findAll({ roleId: user.roleId, status: 1, pageSize: 100 });
    if (admins.total <= 1) throw ApiError.badRequest("This is the last active Super Admin, so it cannot be deleted.");
  }
  await userRepo.remove(id);
  return { id, deleted: true };
}