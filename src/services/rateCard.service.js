import * as locationRepo from "../repositories/location.repository.js";
import * as rateCardRepo from "../repositories/rateCard.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { pickRates } from "../utils/rateRules.js";

export const list = (query) => rateCardRepo.findAll(query);

export async function getById(id) {
  const item = await rateCardRepo.findById(id);
  if (!item) throw ApiError.notFound("That rate card item does not exist.");
  return item;
}

export async function create(input) {
  const location = await locationRepo.findById(input.locationId);
  if (!location) throw ApiError.badRequest("Choose a location that exists.");

  if (input.code) {
    const clash = await rateCardRepo.findByCode(input.locationId, input.code);
    if (clash) throw ApiError.conflict(`Code "${input.code}" is already used by ${clash.name} at this location.`);
  }
  return rateCardRepo.insert({ ...input, brandId: location.brandId });
}

export async function update(id, changes) {
  const item = await getById(id);
  if (changes.code) {
    const clash = await rateCardRepo.findByCode(item.locationId, changes.code, id);
    if (clash) throw ApiError.conflict(`Code "${changes.code}" is already used by ${clash.name} at this location.`);
  }
  // Quotations keep the rate they were built with, so changing this is safe
  return rateCardRepo.update(id, changes);
}

export async function setStatus(id, status) {
  await getById(id);
  return rateCardRepo.update(id, { status });
}

export async function remove(id) {
  await getById(id);
  await rateCardRepo.remove(id);
  return { id, deleted: true };
}

/** Saves setting up a second outlet from scratch. */
export async function copy(fromLocationId, toLocationId) {
  if (fromLocationId === toLocationId) throw ApiError.badRequest("Choose two different locations.");

  const [from, to] = await Promise.all([
    locationRepo.findById(fromLocationId),
    locationRepo.findById(toLocationId),
  ]);
  if (!from || !to) throw ApiError.badRequest("Choose locations that exist.");

  const copied = await rateCardRepo.copyToLocation(fromLocationId, toLocationId);
  return { copied, from: from.name, to: to.name };
}

/**
 * What the quotation screen offers for one lead: the location's active items
 * for that lead type, with the quantity already worked out.
 */
export async function forLead(lead) {
  const items = await rateCardRepo.findAll({
    locationId: lead.locationId,
    leadType: lead.leadType,
    status: 1,
  });

  return pickRates(items, lead.eventDate).map((item) => ({
    ...item,
    suggestedQty: item.unit === "per_guest" ? lead.guests || 1 : 1,
  }));
}