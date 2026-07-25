# Adaptation du modèle de données au dépôt EduWeb Planner
## Module Finance — document d'application du 05

Version : 1.0 — Statut : règle d'implémentation officielle (complète le 05, ne le remplace pas)

---

# Justification explicite

Le dépôt possède déjà un schéma Prisma unique en conventions FRANÇAISES (modèles PascalCase
français, colonnes camelCase françaises : `creeLe`, `majLe`, `etablissementId`, tables mappées
en français : `grilles_supervision`, `rapports_antennes`…) et un module financier en
production (frais, échéanciers, paiements avec reçus numérotés, dépenses, économat, écritures
OHADA en partie double, rapprochement bancaire, budgets, exercices avec clôture). Renommer
l'existant en snake_case anglais casserait la base de PRODUCTION et la cohérence du dépôt.

Le 05 est donc appliqué par ÉQUIVALENCES : sa STRUCTURE (colonnes obligatoires, suppression
logique, historisation, index, périmétrage automatique, domaines) est obligatoire ; ses noms
anglais sont transposés en français, conformément aux conventions du projet (CLAUDE.md) et au
02B.

---

# Équivalences de conventions

| Exigence du 05 | Application dans le dépôt |
|---|---|
| Tables/colonnes snake_case anglais (`student_accounts`, `created_at`) | Modèles/colonnes français existants (`creeLe`, `majLe`) ; nouvelles tables mappées en français (`@@map("...")`) — correspondance documentée table par table dans chaque spec de sous-module |
| `id UUID` | `id String @id @default(cuid())` (identifiant unique immuable — RM-002 satisfaite) |
| Colonnes obligatoires `created_at/updated_at/deleted_at/created_by/updated_by/tenant_id/school_id/academic_year_id` | `creeLe` / `majLe` / `annuleLe` + `annuleParId` (suppression logique) / `creeParId` / `majParId` / périmètre : `etablissementId` + `exerciceId` — le TENANT est porté par l'établissement (pays, réseau/diocèse) via le RBAC central : pas de colonne tenant_id redondante |
| `deleted_at`/`deleted_by` | `annuleLe`/`annuleParId` — toute suppression financière devient une annulation historisée ; lectures filtrées `annuleLe: null` |
| ON UPDATE CASCADE partout | Comportement PostgreSQL/Prisma par défaut sur clés immuables (cuid jamais modifié) ; ON DELETE choisi cas par cas et documenté (jamais de cascade détruisant l'audit) |
| Index obligatoires et composites | Repris tels quels sur les colonnes équivalentes (`etablissementId`, `exerciceId`, `statut`, `reference`, `creeLe`, composites `(etablissementId, exerciceId)`…) |
| Vues SQL / vues matérialisées | Agrégations Prisma calculées + instantanés persistés quand la performance l'exige (tableaux de bord — doc 19) ; des vues PostgreSQL peuvent être créées par migration manuscrite si nécessaire |
| Partitionnement `payments_2026` | Différé : volumétrie actuelle sans commune mesure ; le périmétrage par exercice + index composites tient les objectifs de performance du 05 ; le partitionnement Postgres reste possible par migration future sans changement de code |
| Sauvegardes multi-niveaux / restauration fine | Neon (sauvegardes gérées + point-in-time recovery) ; la restauration par enregistrement est couverte par l'inviolabilité du journal d'audit et les annulations logiques |
| Archivage post-clôture en lecture seule | Mécanique de clôture d'exercice EXISTANTE, étendue au fil des sous-modules |
| Filtrage automatique tenant/école/exercice | Gardes RBAC serveur centralisées (rôle + périmètre) appliquées dans chaque action/lecture — jamais dupliquées (règle projet) |

---

# Trajectoire des domaines

Les ~120 tables du 05 sont créées PROGRESSIVEMENT, chacune au moment où sa spec de
sous-module (06 à 21) est livrée — jamais en bloc. L'existant est réutilisé et mis à niveau
(jamais dupliqué) : les modèles financiers actuels tiennent lieu de première itération des
domaines Frais / Paiements / Caisses / Banques / Comptabilité / Budgets / Stocks.

La FONDATION TRANSVERSE (déclenchée par le présent document, cf. RM-003/004/007/008/011/014/
017/019) couvre : journal d'audit financier inviolable (avec IP/navigateur, anciennes/
nouvelles valeurs), annulations logiques, devise + taux historisés, dates comptables,
verrouillage optimiste, séquences de numérotation configurables (équivalent
`numbering_sequences`).

---

# Portée

Ce document fait foi pour toutes les migrations et modèles du module Finance dans ce dépôt.
Chaque spec de sous-module recevra sa table de correspondance « tables du 05 → modèles du
dépôt » au moment de son implémentation.
