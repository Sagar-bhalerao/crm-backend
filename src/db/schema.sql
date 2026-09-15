-- Reference schema for the CRM configuration tables.
-- You do not have to run this by hand: `npm run db:migrate` creates anything
-- that is missing and leaves existing tables and data alone.
-- Run it in pgAdmin only if you prefer creating the tables yourself.

CREATE TABLE IF NOT EXISTS brands (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(120) NOT NULL,
  code         VARCHAR(20)  NOT NULL,
  description  TEXT,
  logo_url     TEXT,
  status       VARCHAR(20)  NOT NULL DEFAULT 'active',
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT brands_status_check CHECK (status IN ('active', 'inactive'))
);

-- Brand codes are unique regardless of case: "DBI" and "dbi" are the same code.
CREATE UNIQUE INDEX IF NOT EXISTS brands_code_unique_idx ON brands (UPPER(code));

CREATE TABLE IF NOT EXISTS locations (
  id             SERIAL PRIMARY KEY,
  brand_id       INTEGER      NOT NULL REFERENCES brands (id),
  name           VARCHAR(120) NOT NULL,
  code           VARCHAR(30)  NOT NULL,
  city           VARCHAR(80),
  state          VARCHAR(80),
  address        TEXT,
  pincode        VARCHAR(10),
  contact_number VARCHAR(20),
  email          VARCHAR(150),
  status         VARCHAR(20)  NOT NULL DEFAULT 'active',
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT locations_status_check CHECK (status IN ('active', 'inactive'))
);

CREATE UNIQUE INDEX IF NOT EXISTS locations_code_unique_idx ON locations (UPPER(code));
CREATE INDEX IF NOT EXISTS locations_brand_id_idx ON locations (brand_id);
