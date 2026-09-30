import * as brandRepo from "../repositories/brand.repository.js";
import * as locationRepo from "../repositories/location.repository.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * WhatsApp and mail configurations point at a location from the Locations
 * master (and through it, a brand). New or re-activated configurations may
 * only use an active location of an active brand, the same rule the rest of
 * the CRM uses for new work.
 */
export async function assertUsableLocation(locationId) {
  const fail = (message) => ApiError.badRequest(message, [{ field: "locationId", message }]);

  const location = await locationRepo.findById(locationId);
  if (!location) throw fail("That location does not exist.");
  if (Number(location.status) !== 1) throw fail(`${location.name} is inactive. Activate it under Locations first.`);

  const brand = await brandRepo.findById(location.brandId);
  if (!brand) throw fail("That location's brand does not exist.");
  if (Number(brand.status) !== 1) throw fail(`${brand.name} is inactive. Activate it under Brands first.`);

  return location;
}
