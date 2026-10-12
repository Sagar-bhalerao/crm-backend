/**
 * Which rate applies on a given date.
 *
 * Several rows can share a name ("Birthday package" weekday, weekend,
 * festival). The one that matches the event date with the highest priority
 * wins; if none match, the row with no dates and no days is the base rate.
 */
export function matchesDate(item, eventDate, bookingDate = new Date()) {
  const event = toDate(eventDate);
  const booked = toDate(bookingDate);

  if (item.visitFrom && event < toDate(item.visitFrom)) return false;
  if (item.visitTo && event > toDate(item.visitTo)) return false;
  if (item.bookingFrom && booked < toDate(item.bookingFrom)) return false;
  if (item.bookingTo && booked > toDate(item.bookingTo)) return false;

  if (item.days?.length) {
    // JavaScript counts Sunday as 0; we store Sunday as 7
    const day = event.getDay() === 0 ? 7 : event.getDay();
    if (!item.days.includes(day)) return false;
  }
  return true;
}

/** Strips the time so a date comparison is not thrown off by hours. */
function toDate(value) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Picks one row per item name from a list of variants.
 * Without an event date there is nothing to match on, so the plainest row
 * (no dates, no days) is used and flagged so the screen can say why.
 */
export function pickRates(items, eventDate, bookingDate = new Date()) {
  const byName = {};
  for (const item of items) (byName[item.name.toLowerCase()] ||= []).push(item);

  return Object.values(byName).map((variants) => {
    if (!eventDate) {
      const base = variants.find((v) => !v.visitFrom && !v.visitTo && !v.days?.length) || variants[0];
      return { ...base, needsEventDate: variants.length > 1 };
    }

    const matching = variants.filter((v) => matchesDate(v, eventDate, bookingDate));

    const blackout = matching.find((v) => v.ruleType === "blackout");
    if (blackout) return { ...blackout, blocked: true };

    const best = matching
      .filter((v) => v.ruleType === "price")
      .sort((a, b) => b.priority - a.priority)[0];

    // Nothing matched the date, so fall back to the row with no restrictions
    return best || { ...(variants.find((v) => !v.visitFrom && !v.days?.length) || variants[0]), unmatched: true };
  });
}