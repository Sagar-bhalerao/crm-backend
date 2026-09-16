# CRM backend

Express + PostgreSQL REST API for the CRM configuration module (brands and locations).
Full setup instructions, the API reference and the database notes are in the README one level up.

## Quick start

```bash
npm install
cp .env.example .env     # fill in your PostgreSQL user and password
npm run db:inspect       # optional: print the tables you already have
npm run db:migrate       # create or complete the brands / locations tables
npm run db:seed          # optional sample brands and locations
npm run dev              # http://localhost:5000
```

## Scripts

| Script | What it does |
|--------|--------------|
| `npm run dev` | Start with auto-restart on file changes |
| `npm start` | Start once (use this in production) |
| `npm run db:inspect` | Print every table and column in the database |
| `npm run db:migrate` | Add whatever is missing. Never drops anything, safe to re-run |
| `npm run db:seed` | Insert sample brands and locations, skipping any code that exists |

## What the API covers

Brands, locations and global settings. Every route declares the permission it will need:
`brand.view/create/update/delete`, `location.view/create/update/delete`, `settings.view/manage`.

## Structure

```
src/
├── config/       env.js, database.js (pg pool), tables.js (resolved table names)
├── db/           migrate.js, inspect.js, introspect.js, seed.js, schema.sql
├── routes/       one file per resource, mounted at /api/v1 by index.js
├── controllers/  read the request, call a service, send the response
├── services/     business rules (duplicate codes, brand must exist and be active)
├── repositories/ all SQL; the only layer that knows column names
├── validators/   Zod schemas for body, query and params
├── middlewares/  error, validation, auth (placeholder)
├── utils/        ApiError, asyncHandler, response envelope, pagination
├── app.js        Express app: middleware, routes, error handling
└── server.js     Connects to the database, runs migrations, listens
```

A controller contains no SQL and a repository contains no business rules.

## Adding a resource

1. `validators/thing.validator.js` — Zod schemas.
2. `repositories/thing.repository.js` — SQL, and the row-to-JSON mapping.
3. `services/thing.service.js` — rules and error cases.
4. `controllers/thing.controller.js` — thin wrappers around the service.
5. `routes/thing.routes.js` — paths, each with `requirePermission(...)` and `validate(...)`.
6. Mount it in `routes/index.js`.

## Notes

- Every response is `{ success, message, data }` or `{ success, message, error }`.
- All SQL uses parameters. Sort fields are checked against an allow-list, never interpolated.
- `AUTO_MIGRATE=true` runs pending schema changes at startup. Set it to `false` in production and run `npm run db:migrate` as a deploy step.
- Authentication is not implemented. `middlewares/auth.middleware.js` attaches a Super Admin to every request, so replace that one function when you add sessions or tokens.
