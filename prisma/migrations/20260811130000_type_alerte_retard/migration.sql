-- Alertes & SMS enrichi : nouveau type d'alerte « retard » (le moteur alerte aussi sur les retards).
-- Écrite à la main (base = PROD). ADD VALUE ne réutilise pas la valeur dans la même transaction.

ALTER TYPE "TypeAlerteSMS" ADD VALUE IF NOT EXISTS 'retard';
