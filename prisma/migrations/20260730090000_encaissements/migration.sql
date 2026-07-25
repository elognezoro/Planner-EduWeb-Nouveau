-- Sous-module ENCAISSEMENTS (docs/finance/08-Encaissements + 05B) : le flux d'encaissement
-- existant (reçus numérotés) est ENRICHI, jamais remplacé — aucune régression :
-- 1. détails des moyens de paiement (chèque : banque/titulaire ; mobile money : fournisseur ;
--    nouveau mode « carte » accepté par le domaine) ;
-- 2. VENTILATIONS paiement → factures (07) : un paiement peut solder plusieurs factures ;
--    le trop-perçu devient une avance (crédit du compte élève, 06) ;
-- 3. numérotation des reçus BRANCHÉE sur les séquences de la fondation (RM-014, promis en
--    20260726090000) : compteurs amorcés au MAX existant + 1 par établissement — continuité
--    stricte de la numérotation, zéro doublon (unique (etablissementId, numeroRecu) conservé).

-- ── 1. Détails des moyens de paiement (08) ──
ALTER TABLE "paiements_scolarite" ADD COLUMN "banque" TEXT;
ALTER TABLE "paiements_scolarite" ADD COLUMN "titulaire" TEXT;
ALTER TABLE "paiements_scolarite" ADD COLUMN "fournisseurMobile" TEXT;

-- ── 2. Ventilations paiement → factures ──
CREATE TABLE "ventilations_paiement" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "paiementId" TEXT NOT NULL,
    "factureId" TEXT NOT NULL,
    "montant" INTEGER NOT NULL,
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ventilations_paiement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ventilations_paiement_etablissementId_idx" ON "ventilations_paiement"("etablissementId");
CREATE INDEX "ventilations_paiement_paiementId_idx" ON "ventilations_paiement"("paiementId");
CREATE INDEX "ventilations_paiement_factureId_idx" ON "ventilations_paiement"("factureId");
ALTER TABLE "ventilations_paiement" ADD CONSTRAINT "ventilations_paiement_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ventilations_paiement" ADD CONSTRAINT "ventilations_paiement_paiementId_fkey" FOREIGN KEY ("paiementId") REFERENCES "paiements_scolarite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ventilations_paiement" ADD CONSTRAINT "ventilations_paiement_factureId_fkey" FOREIGN KEY ("factureId") REFERENCES "factures_eleve"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ventilations_paiement" ADD CONSTRAINT "ventilations_paiement_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 3. Reçus sur les séquences de la fondation : amorçage des compteurs au MAX + 1 ──
-- (idempotent : l'index unique partiel « sans exercice » posé par 20260726090000 fait
--  échouer silencieusement les doublons via ON CONFLICT DO NOTHING)
INSERT INTO "sequences_numerotation" ("id", "etablissementId", "exerciceId", "type", "prefixe", "prochainNumero", "largeur", "creeLe", "majLe")
SELECT
    'seqrecu_' || "etablissementId",
    "etablissementId",
    NULL,
    'recu',
    'REC',
    MAX("numeroRecu") + 1,
    6,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "paiements_scolarite"
GROUP BY "etablissementId"
ON CONFLICT DO NOTHING;
