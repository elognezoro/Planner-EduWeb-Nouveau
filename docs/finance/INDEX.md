# Index du référentiel Finance / Économat
## Suivi documentaire et d'implémentation

Arborescence cible fournie par le client le 2026-07-25. Ce fichier est tenu à jour à chaque
réception de document et à chaque livraison de chantier.

Légende : ✅ archivé · 🔧 implémenté (déployé) · 🚧 chantier en cours · ⬜ attendu

---

## Socle (00-05)

| Document | Statut | Notes |
|---|---|---|
| 00-README.md | ✅ | + note d'équivalences techniques (pied de document) |
| 01-Vision.md | ✅ | |
| 02-Architecture.md | ✅ | |
| 02A-Arborescence-Projet.md | ✅ | |
| 02B-Adaptation-Arborescence-EduWeb.md | ✅ (interne) | Document d'application du 02A au dépôt — fait foi ici |
| 03-Regles-Metier.md | ✅ | RM-001→025 · fondation transverse 🔧 (commit 166aa61, migration 20260726090000 vérifiée en prod) |
| 04-Profils.md | ✅ | Nouveaux rôles financiers et politiques : à implémenter (chantier « rôles & permissions » à venir) |
| 05-Base-de-donnees.md | ✅ | |
| 05B-Adaptation-Base-de-donnees-EduWeb.md | ✅ (interne) | Équivalences de conventions — fait foi ici |

## Sous-modules (06-21)

| Document | Statut | Notes |
|---|---|---|
| 06-Scolarite.md | ✅ 🚧 | Chantier en cours (créances, compte élève, exonérations, bourses, plans, pénalités, avances, remboursements, blocages, recouvrement) |
| 07-Facturation.md | ✅ | En file derrière 06 |
| 08-Encaissements.md | ✅ | En file |
| 09-Caisse.md | ✅ | En file |
| 10-Banque.md | ✅ | En file |
| 11-Comptabilite.md | ✅ | En file |
| 11A-Plan-Comptable-OHADA.md | ⬜ | |
| 12-Achats.md | ✅ | En file |
| 13-Fournisseurs.md | ✅ | En file (référentiel unique, qualification, évaluations/score, contrats, litiges) |
| 14-Stocks.md | ✅ | En file (magasins hiérarchisés, lots/séries, CUMP, inventaires, réservations, seuils/EOQ) — étend l'économat existant |
| 15-Immobilisations.md | ✅ | En file (passeport numérique des actifs, amortissements auto, maintenance, inventaires QR) |
| 16-Budgets.md | ✅ | En file (voté/engagé/consommé/disponible temps réel, centres de coûts/profits, révisions, simulations) — étend le budget existant |
| 17-Depenses.md | ✅ | En file (workflow demande→validation à seuils→engagement→paiement, notes de frais, avances régularisées, dépenses récurrentes) |
| 18-Rapports.md | ✅ | En file (moteur de restitution : catalogues, exports, planification, comparatifs, générateur personnalisé) |
| 19-TableauxDeBord.md | ✅ | En file (cockpits par profil, widgets, filtres synchronisés, drill-down, score global, prévisions IA) |
| 20-Notifications.md | ✅ | En file (moteur événementiel : types/priorités/escalades, modèles à variables, préférences, accusés) — s'appuie sur les notifications internes + Resend + module Alertes & SMS existants |
| 21-Intelligence-Artificielle.md | ✅ | Architecture AI Core (Gateway, orchestrateur, 9 agents, RAG, copilote, explicabilité, audit, RM-1800→1805) — chapeau de la série AI/130-137 ; cadre du dépôt : IA consultative gated ANTHROPIC_API_KEY, RBAC serveur, jamais d'écriture automatique |

## Référentiels transverses (90-99)

| Document | Statut | Notes |
|---|---|---|
| 90-API.md | ✅ | Standards API REST (RM-1900→1905) — équivalences : Server Actions + Route Handlers /api/*, versionnement par compatibilité des actions, pagination/tri/filtres déjà en usage ; OpenAPI/Gateway sans objet (02B) |
| 91-DTO.md | ✅ | Standards DTO/validation (RM-2000→2005) — équivalences : types TypeScript + validation serveur dans les actions (jamais d'Entity brute au client, champs sensibles filtrés), class-validator/Swagger sans objet |
| 92-Events.md | ✅ | Catalogue d'événements (RM-2100→2105) — équivalences : propagation transactionnelle (tout effet dans la même transaction Prisma ≡ Outbox), journal_audit_finance ≡ Audit Events, nommage au passé repris dans les actions du journal |
| 93-Securite.md | ✅ | Politique de sécurité (RM-2200→2205) — déjà couvert en grande partie : HTTPS Vercel, Auth.js + bcrypt, RBAC serveur centralisé, cloisonnement par périmètre, journal d'audit ; MFA/Passkeys = chantier sécurité séparé (différé, cf. 04) |
| 94-Tests.md | ✅ | Stratégie de tests — adaptation : vérifications par build + lint + sondes locales next start + contrôles pg en prod (pipeline du dépôt) ; pyramide Jest/Playwright = évolution future |
| 95-Catalogue-KPI.md | ✅ | Référentiel KPI officiel (KPI-GOV/SCO/PED/FIN/CPT/ACH/STK/IMM/RH/IT/SEC/AI/SAT/DEV, RM-2400→2404) — source unique des tableaux de bord 19 |
| 96-Glossaire-Metier.md | ⬜ | |
| 97-RBAC-Permissions.md | ⬜ | Attendu avant le chantier « rôles & permissions » du 04 |
| 98-EventStorming.md | ⬜ | |
| 99-Workflows-Metiers.md | ✅ | Grille de validation des chantiers (WF-001→010) |

## UX (100-108)

| Document | Statut | Notes |
|---|---|---|
| UX/100-Ecrans.md | ⬜ | |
| UX/101-Design-System.md | ⬜ | À concilier avec la charte existante d'EduWeb Planner (cream/forest/gold) |
| UX/102-Navigation.md | ⬜ | La section Économat existe déjà dans le menu |
| UX/103-Composants.md | ⬜ | |
| UX/104-DarkMode.md | ⬜ | |
| UX/105-Responsive.md | ⬜ | |
| UX/106-Accessibilite.md | ⬜ | |
| UX/107-Parcours-Utilisateur.md | ⬜ | |
| UX/108-Maquettes.md | ⬜ | |

## Architecture technique (110-123)

Série lue à travers les ÉQUIVALENCES officielles (note du 00-README, 02B, 05B) : la stack du
dépôt est non négociable (Next.js App Router + Server Actions, Auth.js, Neon/Prisma, Vercel).
Chaque document reçu sera archivé verbatim ; s'il exige un arbitrage structurel, un document
d'application « B » l'accompagnera (comme 02B/05B).

| Document | Statut | Équivalence pressentie dans le dépôt |
|---|---|---|
| Architecture-Technique/110-Microservices.md | ⬜ | Monolithe modulaire (domaines src/lib/finances/*) — extraction future possible (02) |
| Architecture-Technique/111-NestJS.md | ⬜ | Server Actions + Route Handlers |
| Architecture-Technique/112-Prisma.md | ⬜ | Directement applicable (Prisma 7, migrations manuscrites) |
| Architecture-Technique/113-PostgreSQL.md | ⬜ | Directement applicable (Neon) |
| Architecture-Technique/114-Redis.md | ⬜ | Cache de rendu Next.js + revalidatePath |
| Architecture-Technique/115-ElasticSearch.md | ⬜ | PostgreSQL Full Text Search (déjà prévu au 00-README) |
| Architecture-Technique/116-Queue.md | ⬜ | Propagation transactionnelle + crons Vercel |
| Architecture-Technique/117-Stockage.md | ⬜ | Vercel Blob |
| Architecture-Technique/118-Docker.md | ⬜ | Sans objet (build Vercel) |
| Architecture-Technique/119-Kubernetes.md | ⬜ | Sans objet (Vercel serverless) |
| Architecture-Technique/120-CICD.md | ⬜ | Pipeline existant : vérifications locales + build Vercel sur push |
| Architecture-Technique/121-Observabilite.md | ⬜ | Journaux Vercel + journal d'audit finance |
| Architecture-Technique/122-Sauvegardes.md | ⬜ | Neon (sauvegardes gérées + PITR) |
| Architecture-Technique/123-HauteDisponibilite.md | ⬜ | Vercel/Neon managés |

## IA (130-137)

Cadre existant du dépôt : modules IA gated par ANTHROPIC_API_KEY, sorties structurées par
tool use forcé, replis heuristiques locaux, IA strictement consultative (RM-025 — jamais
d'écriture automatique).

| Document | Statut |
|---|---|
| AI/130-AI-Architecture.md | ⬜ |
| AI/131-AI-Agents.md | ⬜ |
| AI/132-AI-RAG.md | ⬜ |
| AI/133-AI-Prompts.md | ⬜ |
| AI/134-AI-Rules.md | ⬜ |
| AI/135-AI-Security.md | ⬜ |
| AI/136-AI-Audit.md | ⬜ |
| AI/137-AI-Explainability.md | ⬜ |

## Annexes

| Document | Statut |
|---|---|
| Annexes/A1-PlanComptableOHADA.pdf | ⬜ |
| Annexes/A2-BPMN.pdf | ⬜ |
| Annexes/A3-UML.pdf | ⬜ |
| Annexes/A4-SchemasBDD.pdf | ⬜ |
| Annexes/A5-ExemplesAPI.md | ⬜ |

---

## Chantiers d'implémentation

| Chantier | Statut | Livraison |
|---|---|---|
| Section « Économat » (navigation) | 🔧 | commit 5ccae4e |
| Fondation transverse (audit inviolable, annulations logiques, devise+taux, dates comptables, verrouillage optimiste, séquences de numérotation) | 🔧 | commit 166aa61 · migration 20260726090000 vérifiée en prod |
| 06 Scolarité | 🚧 | en cours |
| 07→12 (Facturation, Encaissements, Caisses, Banque, Comptabilité, Achats) | file d'attente | ordre 07 → 08 → 09 → 10 → 11 → 12 |
| Rôles financiers & permissions (04/97) | à programmer | après réception du 97-RBAC-Permissions.md |
