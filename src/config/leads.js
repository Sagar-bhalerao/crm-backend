/** The stages a lead moves through. */
export const LEAD_STATUSES = [
  { key: "new", label: "New", next: ["assigned", "in_progress", "not_interested"] },
  { key: "assigned", label: "Assigned", next: ["in_progress", "not_interested"] },
  { key: "in_progress", label: "In progress", next: ["quotation", "not_interested"] },
  { key: "quotation", label: "Quotation", next: ["proforma_invoice", "in_progress", "not_interested"] },
  { key: "proforma_invoice", label: "Proforma invoice", next: ["finalized", "quotation", "not_interested"] },
  { key: "finalized", label: "Finalized", next: [] },
  { key: "not_interested", label: "Not interested", next: ["in_progress"] },
  { key: "cancelled", label: "Cancelled", next: [] },
];

export const LEAD_STATUS_KEYS = LEAD_STATUSES.map((s) => s.key);

export const getStatus = (key) => LEAD_STATUSES.find((s) => s.key === key);

export const LEAD_TYPES = [
  { key: "birthday_party", label: "Birthday party" },
  { key: "party_booking", label: "Party booking" },
  { key: "corporate_event", label: "Corporate event" },
];

export const LEAD_TYPE_KEYS = LEAD_TYPES.map((t) => t.key);

export const LEAD_SOURCES = ["website", "phone", "walk_in", "email", "social_media", "referral"];

export const TIME_SLOTS = [
  { key: "morning", label: "Morning (11 AM – 2 PM)" },
  { key: "afternoon", label: "Afternoon (2 – 5 PM)" },
  { key: "evening", label: "Evening (5 – 8 PM)" },
  { key: "night", label: "Night (8 – 11 PM)" },
];

export const FOLLOWUP_CHANNELS = ["call", "whatsapp", "email", "visit"];

export const FOLLOWUP_OUTCOMES = [
  "spoke_with_customer", "no_answer", "asked_to_call_back",
  "negotiating_price", "awaiting_decision", "not_interested",
];