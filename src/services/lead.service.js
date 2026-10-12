import { getStatus, LEAD_STATUSES } from "../config/leads.js";
import * as leadRepo from "../repositories/lead.repository.js";
import * as locationRepo from "../repositories/location.repository.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * What this user is allowed to see, from their permissions:
 *   lead.view.all      every lead
 *   lead.view.outlet   leads at the locations they cover
 *   lead.view          only the ones assigned to them
 */
export function scopeFor(user) {
  const has = (p) => user.permissions.includes(p);
  if (has("lead.view.all")) return { all: true };
  if (has("lead.view.outlet")) return { locationIds: user.locationIds || [] };
  return { assignedTo: user.id };
}

export const list = (query, user) => leadRepo.findAll(query, scopeFor(user));

export async function getById(id, user) {
  const lead = await leadRepo.findById(id);
  if (!lead) throw ApiError.notFound("That lead does not exist.");

  const scope = scopeFor(user);
  const allowed =
    scope.all ||
    (scope.locationIds?.includes(lead.locationId)) ||
    (scope.assignedTo && lead.assignedTo === scope.assignedTo);

  // Same message as a missing lead, so the id cannot be used to probe
  if (!allowed) throw ApiError.notFound("That lead does not exist.");
  return lead;
}

/** Leads created in the CRM by a user, and by the website form. */
export async function create(input, user = null) {
  const location = await locationRepo.findById(input.locationId);
  if (!location) throw ApiError.badRequest("Choose a location that exists.");
  if (location.status !== 1) throw ApiError.badRequest(`${location.name} is inactive.`);

  // Unassigned leads go to the Sales POC at that location with the least on
  let assignedTo = input.assignedTo || null;
  if (!assignedTo) assignedTo = await leadRepo.findLeastBusyPoc(input.locationId);

  return leadRepo.insert({
    ...input,
    brandId: location.brandId,
    assignedTo,
    status: assignedTo ? "assigned" : "new",
    createdBy: user?.id || null,
  });
}

export async function update(id, changes, user) {
  const lead = await getById(id, user);
  if (["finalized", "cancelled"].includes(lead.status)) {
    throw ApiError.badRequest("A finalized or cancelled lead cannot be edited.");
  }

  // Moving to another location changes the brand too
  if (changes.locationId && changes.locationId !== lead.locationId) {
    const location = await locationRepo.findById(changes.locationId);
    if (!location) throw ApiError.badRequest("Choose a location that exists.");
    changes.brandId = location.brandId;
  }

  const updated = await leadRepo.update(id, changes);
  await leadRepo.addActivity(null, id, "updated", "Lead details updated", user.id);
  return updated;
}

/** Only the moves listed in config/leads.js are allowed. */
export async function changeStatus(id, { status, reason }, user) {
  const lead = await getById(id, user);
  if (lead.status === status) return lead;

  const current = getStatus(lead.status);
  if (!current?.next.includes(status)) {
    const target = getStatus(status);
    throw ApiError.badRequest(`A lead cannot move from ${current?.label} to ${target?.label || status}.`);
  }
  if (status === "not_interested" && !reason) {
    throw ApiError.badRequest("Give a reason when marking a lead as not interested.");
  }

  const updated = await leadRepo.update(id, {
    status,
    lostReason: status === "not_interested" ? reason : null,
  });

  const label = getStatus(status).label;
  await leadRepo.addActivity(null, id, "status_changed", `Status changed to ${label}${reason ? `: ${reason}` : ""}`, user.id);
  return updated;
}

export async function assign(id, assignedTo, user) {
  const lead = await getById(id, user);

  const updated = await leadRepo.update(id, {
    assignedTo,
    assignedAt: new Date(),
    // A brand new lead becomes assigned; later stages keep their stage
    status: lead.status === "new" ? "assigned" : lead.status,
  });
  await leadRepo.addActivity(null, id, "assigned", `Assigned to ${updated.assignedToName}`, user.id);
  return updated;
}

export async function addFollowup(id, input, user) {
  const lead = await getById(id, user);
  if (["finalized", "cancelled"].includes(lead.status)) {
    throw ApiError.badRequest("This lead is closed, so follow-ups cannot be added.");
  }

  await leadRepo.addFollowup(id, input, user.id);

  // Logging the first follow-up means work has started
  if (["new", "assigned"].includes(lead.status)) {
    await leadRepo.update(id, { status: "in_progress" });
  }
  return leadRepo.findById(id);
}

export async function getDetail(id, user) {
  const lead = await getById(id, user);
  const [activities, followups, messages] = await Promise.all([
    leadRepo.listActivities(id),
    leadRepo.listFollowups(id),
    leadRepo.listMessages(id),
  ]);
  return { ...lead, activities, followups, messages };
}

export async function remove(id, user) {
  const lead = await getById(id, user);
  if (lead.status === "finalized") {
    throw ApiError.badRequest("A finalized lead cannot be deleted.");
  }
  await leadRepo.remove(id);
  return { id, deleted: true };
}

export async function getSummary(user) {
  const byStatus = await leadRepo.countByStatus(scopeFor(user));
  const total = Object.values(byStatus).reduce((sum, n) => sum + n, 0);
  return {
    total,
    byStatus: Object.fromEntries(LEAD_STATUSES.map((s) => [s.key, byStatus[s.key] || 0])),
  };
}