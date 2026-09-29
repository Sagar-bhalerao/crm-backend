import * as roleRepo from "../repositories/role.repository.js";
import { ApiError } from "../utils/ApiError.js";

export const list = (query) => roleRepo.findAll(query);
export const listPermissions = () => roleRepo.listPermissions();

export async function getById(id) {
  const role = await roleRepo.findById(id);
  if (!role) throw ApiError.notFound("That role does not exist.");
  return role;
}

/** Every permission key that actually exists, so a typo cannot be granted. */
async function checkPermissions(keys = []) {
  const known = (await roleRepo.listPermissions()).map((p) => p.key);
  const unknown = keys.filter((k) => !known.includes(k));
  if (unknown.length) throw ApiError.badRequest(`Unknown permission: ${unknown.join(", ")}`);
}

export async function create(input) {
  const clash = await roleRepo.findByCode(input.code);
  if (clash) throw ApiError.conflict(`Role code "${input.code}" is already used by ${clash.name}.`);
  await checkPermissions(input.permissions);
  return roleRepo.insert(input);
}

export async function update(id, changes) {
  const role = await getById(id);

  // Built-in roles keep their code, so code that looks them up keeps working.
  if (role.isSystem && changes.code && changes.code !== role.code) {
    throw ApiError.badRequest(`${role.name} is a built-in role, so its code cannot be changed.`);
  }
  // Super Admin must keep full access, otherwise nobody can undo the change.
  if (role.code === "super_admin" && changes.permissions) {
    throw ApiError.badRequest("Super Admin always has every permission.");
  }
  if (changes.code) {
    const clash = await roleRepo.findByCode(changes.code, id);
    if (clash) throw ApiError.conflict(`Role code "${changes.code}" is already used by ${clash.name}.`);
  }
  if (changes.permissions) await checkPermissions(changes.permissions);

  return roleRepo.update(id, changes);
}

export async function setStatus(id, status) {
  const role = await getById(id);
  if (role.code === "super_admin" && status === 0) {
    throw ApiError.badRequest("Super Admin cannot be deactivated.");
  }
  return roleRepo.update(id, { status });
}

export async function remove(id) {
  const role = await getById(id);
  if (role.isSystem) throw ApiError.badRequest(`${role.name} is a built-in role and cannot be deleted.`);

  const users = await roleRepo.countUsers(id);
  if (users > 0) {
    throw ApiError.conflict(
      `${users} user${users === 1 ? " is" : "s are"} using ${role.name}. Move them to another role first.`
    );
  }
  await roleRepo.remove(id);
  return { id, deleted: true };
}