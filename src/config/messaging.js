/**
 * The kinds of message the CRM sends. Adding one here makes it appear on the
 * WhatsApp settings screen; no migration needed.
 */
export const MESSAGE_TYPES = [
  { key: "lead_received", label: "Enquiry received", hint: "Sent as soon as a website enquiry arrives." },
  { key: "quotation", label: "Quotation shared", hint: "Sent with the quotation." },
  { key: "proforma_invoice", label: "Proforma invoice", hint: "Sent with the invoice and advance amount." },
  { key: "booking_confirmation", label: "Booking confirmed", hint: "Sent once the booking is finalized." },
  { key: "follow_up", label: "Follow-up reminder", hint: "Optional nudge while a lead is open." },
  { key: "event_reminder", label: "Event reminder", hint: "Sent a day or two before the event." },
];

export const MESSAGE_TYPE_KEYS = MESSAGE_TYPES.map((t) => t.key);

/** How the auth key is attached to the provider's request. */
export const AUTH_TYPES = [
  { key: "bearer", label: "Bearer token", hint: "Authorization: Bearer <key>" },
  { key: "api_key", label: "API key header", hint: "x-api-key: <key>" },
  { key: "basic", label: "Basic auth", hint: "Authorization: Basic <key>" },
  { key: "query", label: "Query parameter", hint: "?auth_key=<key>" },
];

export const AUTH_TYPE_KEYS = AUTH_TYPES.map((t) => t.key);

/** Placeholders a message body may use, shown as help on the screen. */
export const MESSAGE_VARIABLES = [
  "{{customer.name}}", "{{customer.mobile}}",
  "{{lead.id}}", "{{event.date}}", "{{event.time}}", "{{event.guests}}",
  "{{brand.name}}", "{{location.name}}",
  "{{quotation.number}}", "{{quotation.total}}",
  "{{invoice.number}}", "{{invoice.advance}}",
  "{{booking.number}}", "{{poc.name}}", "{{poc.mobile}}",
];