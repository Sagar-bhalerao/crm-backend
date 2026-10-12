import { FOLLOWUP_CHANNELS, FOLLOWUP_OUTCOMES, LEAD_SOURCES, LEAD_STATUSES, LEAD_TYPES, TIME_SLOTS } from "../config/leads.js";
import * as leadService from "../services/lead.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { listPayload, sendCreated, sendOk } from "../utils/response.js";

/** Dropdown values for the lead screens. */
export const options = asyncHandler(async (req, res) => {
  sendOk(
    res,
    { statuses: LEAD_STATUSES, types: LEAD_TYPES, sources: LEAD_SOURCES, timeSlots: TIME_SLOTS, followupChannels: FOLLOWUP_CHANNELS, followupOutcomes: FOLLOWUP_OUTCOMES },
    "Options loaded"
  );
});

export const list = asyncHandler(async (req, res) => {
  const { items, ...meta } = await leadService.list(req.query, req.user);
  sendOk(res, listPayload(items, meta), "Leads loaded");
});

export const getOne = asyncHandler(async (req, res) => {
  sendOk(res, await leadService.getDetail(req.params.id, req.user), "Lead loaded");
});

export const create = asyncHandler(async (req, res) => {
  sendCreated(res, await leadService.create(req.body, req.user), "Lead created successfully");
});

/** The website form. No sign-in, so there is no req.user. */
export const createPublic = asyncHandler(async (req, res) => {
  const lead = await leadService.create({ ...req.body, source: "website" }, null);
  sendCreated(res, { leadCode: lead.leadCode }, "Thank you. Our team will contact you shortly.");
});

export const update = asyncHandler(async (req, res) => {
  sendOk(res, await leadService.update(req.params.id, req.body, req.user), "Lead updated");
});

export const changeStatus = asyncHandler(async (req, res) => {
  sendOk(res, await leadService.changeStatus(req.params.id, req.body, req.user), "Status updated");
});

export const assign = asyncHandler(async (req, res) => {
  sendOk(res, await leadService.assign(req.params.id, req.body.assignedTo, req.user), "Lead assigned");
});

export const addFollowup = asyncHandler(async (req, res) => {
  sendCreated(res, await leadService.addFollowup(req.params.id, req.body, req.user), "Follow-up saved");
});

export const summary = asyncHandler(async (req, res) => {
  sendOk(res, await leadService.getSummary(req.user), "Summary loaded");
});

export const remove = asyncHandler(async (req, res) => {
  sendOk(res, await leadService.remove(req.params.id, req.user), "Lead deleted");
});