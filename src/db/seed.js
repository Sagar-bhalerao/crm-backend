/**
 * Optional sample data so the screens are not empty on a fresh database:
 *   npm run db:seed
 * Safe to re-run; it skips anything whose code already exists.
 */
import { closePool } from "../config/database.js";
import { initTables } from "../config/tables.js";
import * as brandRepo from "../repositories/brand.repository.js";
import * as locationRepo from "../repositories/location.repository.js";

const BRANDS = [
  { name: "Dave & Buster's India", code: "DBI", description: "Entertainment and dining venues operated under franchise in India.", status: "active" },
  { name: "Imagicaa", code: "IMG", description: "Theme park.", status: "inactive" },
  { name: "Wet'nJoy", code: "WNJ", description: "Water park.", status: "inactive" },
];

const LOCATIONS = [
  { brand: "DBI", name: "Mumbai", code: "DB-MUM", city: "Mumbai", state: "Maharashtra", status: "active" },
  { brand: "DBI", name: "Bangalore", code: "DB-BLR", city: "Bengaluru", state: "Karnataka", status: "active" },
  { brand: "DBI", name: "Delhi", code: "DB-DEL", city: "New Delhi", state: "Delhi", status: "active" },
];

await initTables();

const ids = {};
for (const b of BRANDS) {
  const existing = await brandRepo.findByCode(b.code);
  const brand = existing || (await brandRepo.insert({ description: null, logoUrl: null, ...b }));
  ids[b.code] = brand.id;
  console.log(`${existing ? "exists" : "added "}  brand ${brand.code} ${brand.name}`);
}

for (const l of LOCATIONS) {
  const existing = await locationRepo.findByCode(l.code);
  if (existing) {
    console.log(`exists  location ${l.code}`);
    continue;
  }
  const { brand, ...rest } = l;
  await locationRepo.insert({
    brandId: ids[brand], address: null, pincode: null, contactNumber: null, email: null, ...rest,
  });
  console.log(`added   location ${l.code} ${l.name}`);
}

await closePool();
