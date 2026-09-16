import * as brandRepo from "../repositories/brand.repository.js";
import { ApiError } from "../utils/ApiError.js";

export const list = (query) => brandRepo.findAll(query);

export async function getById(id) {
  const brand = await brandRepo.findById(id);
  if (!brand) throw ApiError.notFound("That brand does not exist.");
  return brand;
}

export async function create(input) {
  const clash = await brandRepo.findByCode(input.code);
  if (clash) throw ApiError.conflict(`Brand code "${input.code}" is already used by ${clash.name}.`);
  return brandRepo.insert(input);
}

export async function update(id, changes) {
  await getById(id);
  if (changes.code) {
    const clash = await brandRepo.findByCode(changes.code, id);
    if (clash) throw ApiError.conflict(`Brand code "${changes.code}" is already used by ${clash.name}.`);
  }
  // An update never deletes and re-creates the row, so locations and leads
  // that point at this brand id stay untouched.
  return brandRepo.update(id, changes);
}

/**
 * Soft activate / deactivate. Locations and historical data are left as they
 * are: a deactivated brand simply stops being offered for new work.
 */
export async function setStatus(id, status) {
  const brand = await getById(id);
  if (brand.status === status) return brand;
  return brandRepo.update(id, { status });
}

/**
 * Permanent delete, allowed only when nothing depends on the brand.
 * Anything with history should be deactivated instead.
 */
export async function remove(id) {
  const brand = await getById(id);
  const locations = await brandRepo.countLocations(id);
  if (locations > 0) {
    throw ApiError.conflict(
      `${brand.name} still has ${locations} location${locations === 1 ? "" : "s"}. Delete or move them first, or deactivate the brand instead.`
    );
  }
  await brandRepo.remove(id);
  return { id, deleted: true };
}

/** Brands that can be chosen when creating new records. */
export const listActive = () => brandRepo.findAll({ status: "active", pageSize: 100, sort: "name:asc" });
