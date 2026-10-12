export const RATE_CATEGORIES = [
  { key: "package", label: "Package" },
  { key: "food", label: "Food & beverages" },
  { key: "addon", label: "Add-on" },
  { key: "decoration", label: "Decoration" },
];

export const RATE_UNITS = [
  { key: "per_guest", label: "Per guest", hint: "Quantity starts at the lead's guest count." },
  { key: "per_item", label: "Per item", hint: "Quantity starts at 1 and can be changed." },
  { key: "flat", label: "Flat charge", hint: "One fixed amount." },
];

export const RATE_CATEGORY_KEYS = RATE_CATEGORIES.map((c) => c.key);
export const RATE_UNIT_KEYS = RATE_UNITS.map((u) => u.key);