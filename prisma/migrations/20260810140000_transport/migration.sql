-- Module « Transport d'élèves » — 7 tables. Écrite à la main (base = PRODUCTION),
-- appliquée par `prisma migrate deploy` (vercel-build). Additive : uniquement des
-- CREATE TABLE/INDEX IF NOT EXISTS, aucune donnée existante touchée.

CREATE TABLE IF NOT EXISTS "transport_settings" (
  "id" TEXT NOT NULL DEFAULT 'global',
  "price_fcfa" INTEGER NOT NULL DEFAULT 0,
  "price_month_fcfa" INTEGER,
  "price_year_fcfa" INTEGER,
  "upgrade_penalty_pct" INTEGER NOT NULL DEFAULT 20,
  "beep_interval_min" INTEGER NOT NULL DEFAULT 5,
  "center_lat" DOUBLE PRECISION,
  "center_lng" DOUBLE PRECISION,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transport_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "transport_buses" (
  "id" TEXT NOT NULL,
  "etablissement_id" TEXT,
  "matricule" TEXT NOT NULL,
  "label" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transport_buses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "transport_buses_etablissement_id_idx" ON "transport_buses" ("etablissement_id");

CREATE TABLE IF NOT EXISTS "transport_slots" (
  "id" TEXT NOT NULL,
  "etablissement_id" TEXT,
  "label" TEXT,
  "direction" TEXT NOT NULL DEFAULT 'aller',
  "days" INTEGER[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5],
  "start_time" TEXT NOT NULL,
  "end_time" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transport_slots_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "transport_slots_etablissement_id_idx" ON "transport_slots" ("etablissement_id");

CREATE TABLE IF NOT EXISTS "bus_positions" (
  "bus_id" TEXT NOT NULL,
  "driver_id" TEXT,
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "heading" DOUBLE PRECISION,
  "speed" DOUBLE PRECISION,
  "direction" TEXT,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bus_positions_pkey" PRIMARY KEY ("bus_id"),
  CONSTRAINT "bus_positions_bus_id_fkey" FOREIGN KEY ("bus_id") REFERENCES "transport_buses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "transport_drivers" (
  "user_id" TEXT NOT NULL,
  "email" TEXT,
  "etablissement_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transport_drivers_pkey" PRIMARY KEY ("user_id")
);
CREATE INDEX IF NOT EXISTS "transport_drivers_etablissement_id_idx" ON "transport_drivers" ("etablissement_id");

CREATE TABLE IF NOT EXISTS "transport_subscriptions" (
  "user_id" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "period" TEXT,
  "expires_at" TIMESTAMP(3),
  "etablissement_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transport_subscriptions_pkey" PRIMARY KEY ("user_id")
);
CREATE INDEX IF NOT EXISTS "transport_subscriptions_etablissement_id_idx" ON "transport_subscriptions" ("etablissement_id");

CREATE TABLE IF NOT EXISTS "transport_payments" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "etablissement_id" TEXT,
  "payer_email" TEXT,
  "amount_fcfa" INTEGER NOT NULL DEFAULT 0,
  "method" TEXT NOT NULL DEFAULT 'mobile_money',
  "reference" TEXT,
  "period" TEXT NOT NULL DEFAULT 'month',
  "is_upgrade" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmed_at" TIMESTAMP(3),
  "confirmed_by" TEXT,
  CONSTRAINT "transport_payments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "transport_payments_status_idx" ON "transport_payments" ("status");
CREATE INDEX IF NOT EXISTS "transport_payments_user_id_idx" ON "transport_payments" ("user_id");
CREATE INDEX IF NOT EXISTS "transport_payments_etablissement_id_idx" ON "transport_payments" ("etablissement_id");
