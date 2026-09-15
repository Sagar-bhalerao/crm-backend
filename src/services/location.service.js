import * as brandRepo from "../repositories/brand.repository.js";
import * as locationRepo from "../repositories/location.repository.js";
import { ApiError } from "../utils/ApiError.js";

export const list = (query) => locationRepo.findAll(query);

export async function getById(id) {
  const location = await locationRepo.findById(id);
  if (!location) throw ApiError.notFound("That location does not exist.");
  return location;
}

async function requireBrand(brandId, { mustBeActive }) {
  const brand = await brandRepo.findById(brandId);
  if (!brand) throw ApiError.badRequest("Choose a brand that exists.");
  if (mustBeActive && brand.status !== "active") {
    throw ApiError.badRequest(`${brand.name} is inactive. Activate the brand before adding locations to it.`);
  }
  return brand;
}

export async function listByBrand(brandId, query) {
  await requireBrand(brandId, { mustBeActive: false });
  return locationRepo.findAll({ ...query, brandId });
}

export async function create(input) {
  await requireBrand(input.brandId, { mustBeActive: true });
  const clash = await locationRepo.findByCode(input.code);
  if (clash) throw ApiError.conflict(`Location code "${input.code}" is already used by ${clash.name}.`);
  return locationRepo.insert(input);
}

export async function update(id, changes) {
  await getById(id);
  if (changes.brandId) await requireBrand(changes.brandId, { mustBeActive: true });
  if (changes.code) {
    const clash = await locationRepo.findByCode(changes.code, id);
    if (clash) throw ApiError.conflict(`Location code "${changes.code}" is already used by ${clash.name}.`);
  }
  return locationRepo.update(id, changes);
}

export async function setStatus(id, status) {
  const location = await getById(id);
  if (location.status === status) return location;
  if (status === "active") await requireBrand(location.brandId, { mustBeActive: true });
  return locationRepo.update(id, { status });
}
