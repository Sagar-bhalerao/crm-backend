import * as locationRepo from "../repositories/location.repository.js";
import * as brandRepo from "../repositories/brand.repository.js";
import { ApiError } from "../utils/ApiError.js";

async function assertBrandExists(brandId) {
  const brand = await brandRepo.findById(brandId);
  if (!brand) throw ApiError.badRequest("That brand does not exist.");
  if (brand.status != "1") throw ApiError.badRequest("That brand is inactive.");
  return brand;
}

export const list = (query) => locationRepo.findAll(query);

export async function listByBrand(brandId, query) {
  await assertBrandExists(brandId);
  return locationRepo.findAll({ ...query, brandId });
}

export async function getById(id) {
  const location = await locationRepo.findById(id);
  if (!location) throw ApiError.notFound("Location not found.");
  return location;
}

export async function create(input) {
  await assertBrandExists(input.brandId);
  if (await locationRepo.findByName(input.brandId, input.name)) {
    throw ApiError.conflict(`That brand already has a location called "${input.name}".`);
  }
  return locationRepo.insert(input);
}

export async function update(id, changes) {
  const existing = await getById(id);
  const brandId = changes.brandId ?? existing.brandId;

  if (changes.brandId && changes.brandId !== existing.brandId) {
    await assertBrandExists(changes.brandId);
  }
  if (changes.name && (await locationRepo.findByName(brandId, changes.name, id))) {
    throw ApiError.conflict(`That brand already has a location called "${changes.name}".`);
  }
  return locationRepo.update(id, changes);
}

export async function setStatus(id, status) {
  await getById(id);
  return locationRepo.update(id, { status });
}

export async function remove(id) {
  await getById(id);
  await locationRepo.remove(id);
  return { id: Number(id) };
}