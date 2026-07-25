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

## Sous-modules (06-39)

| Document | Statut | Notes |
|---|---|---|
| 06-Scolarite.md | ✅ 🔧 | Livré (commit fd22a03, migration 20260727090000) : créances générées à l'inscription (idempotent), compte financier de l'élève, exonérations/bourses, plans de paiement, pénalités, avances imputées par ordre de catégorie, remboursements validés, règles de blocage (application effective différée aux modules concernés), recouvrement |
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
| 22-Ressources-Humaines.md | ✅ | Module RH complet : dossier agent, organigramme, affectations/contrats, carrière, congés, présence, évaluations, formations, compétences, discipline, fin de carrière — module distinct de l'Économat, chantier propre à programmer après la file Finance. ⚠ Collision de numérotation : ses RM-2200→2205 doublonnent ceux du 93-Securite ; citer avec le document d'origine (RM-2203 [22-RH] vs RM-2203 [93-SEC]). S'appuiera sur l'existant : demandes d'absence, affectations EDT, séminaires/LMS |
| 23-Patrimoine.md | ✅ | Gestion physique des biens (fiche patrimoine, localisation, affectations, états, maintenance préventive/corrective, incidents, garanties, inventaires QR, réforme/cession, réservations, assurances) — articulé avec le 15-Immobilisations (volet comptable : amortissements) ; « EduWeb Booking » lu comme le module de réservation à créer. ⚠ Collision de numérotation : ses RM-2300→2305 doublonnent ceux du 94-Tests ; citer avec le document d'origine |
| 24-Bibliotheque.md | ✅ | Bibliothèque hybride (catalogue Dewey/LCC, exemplaires, emprunts/retours, réservations, pénalités, abonnements, bibliothèque numérique, suggestions d'acquisition, conservation) + source documentaire principale du RAG (RM-2405). ⚠ Collision de numérotation : ses RM-2400→2405 doublonnent ceux du 95-Catalogue-KPI ; citer avec le document d'origine |
| 25-Courrier.md | ✅ | Bureau d'Ordre numérique (courrier arrivée/départ/interne/confidentiel, numérotation ARR-AAAA-000000 ≡ séquences de la fondation, circuits de traitement, parapheur électronique, visas/signatures, accusés, bordereaux, délais/escalades, 4 niveaux de confidentialité RBAC). ⚠ Collision de numérotation : ses RM-2500→2505 doublonnent ceux du 96-Glossaire ; citer avec le document d'origine |
| 26-Archives.md | ✅ | GED : cycle de vie documentaire (création→versement/élimination), plan de classement, versionning intégral, durées de conservation paramétrables par pays, OCR, empreintes SHA-256, coffre-fort numérique, journalisation des consultations (RM-2602 [26]). ⚠ Collision de numérotation : ses RM-2600→2605 doublonnent ceux du 97-RBAC ; citer avec le document d'origine |
| 27-Projets.md | ✅ | PMO intégré : hiérarchie Programme→Projet→Composante→Activité→Tâche→Livrable, jalons, Gantt/Kanban, ressources, budget lié aux modules 16/17/11, risques/incidents, livrables validés avant clôture (RM-2705 [27]) ; le module « Réunions » référencé = 28. ⚠ Collision de numérotation : ses RM-2700→2705 doublonnent ceux du 98-EventStorming ; citer avec le document d'origine |
| 28-Reunions.md | ✅ | Instances de gouvernance : conseils/commissions/comités (dont conseils de classe et de discipline), convocations + ordre du jour, présences (QR/badge), votes (main levée/secret/électronique/procuration), décisions numérotées → actions suivies, PV auto signé électroniquement puis figé (RM-2802), récurrences, RM-2800→2805 |
| 29-Gouvernance.md | ✅ | Cœur décisionnel : actes administratifs (décisions/arrêtés/notes/circulaires/délibérations/résolutions), numérotation DEC/ARR/NS-AAAA-00000 ≡ séquences de la fondation, workflow brouillon→archivage, signatures + délégations de signature bornées (RM-2903), publication/diffusion ciblée, suivi d'exécution, référentiel réglementaire versionné, RM-2900→2906 — reçoit les résolutions du 28 |
| 30-AI-Copilot.md | ✅ | Copilote IA transversal (approfondit le 21) : orchestration d'agents, mémoire 3 niveaux, personnalisation par rôle, génération documentaire, suggestions proactives, explicabilité, RM-3000→3005 — germes dans le dépôt : chatbot RBAC existant, IA consultative gated ANTHROPIC_API_KEY ; RM-3003 (confirmation humaine) et RM-3005 (multi-fournisseurs) alignés sur nos garde-fous ; « EduWeb Family/Booking/Governance » = modules compagnons à venir |
| 31-AI-Agents.md | ✅ | Architecture Multi-Agent (détaille le 21 et le 30) : AI Router orchestrateur, ~22 agents spécialisés (métier/documentaires/analytiques/prédictifs/techniques/supervision), exécution parallèle + fusion + arbitrage des conflits, mémoire partagée, tolérance aux pannes, monitoring par agent, RM-3100→3106 |
| 32-AI-Knowledge.md | ✅ | Knowledge Hub : socle RAG (pipeline import→OCR→chunking→embeddings→base vectorielle), recherche hybride (plein texte + vectorielle + filtres RBAC appliqués AVANT la recherche, RM-3203), citations avec niveau de confiance, mémoire institutionnelle et utilisateur, RM-3200→3206 — équivalence pressentie : PostgreSQL + extension vectorielle (pgvector sur Neon), option explicitement admise par le document |
| 33-AI-Predictions.md | ✅ | Intelligence prédictive : 12 domaines (effectifs, réussite/décrochage, RH, EDT, budgets, recouvrement, maintenance…), Feature Store, détection d'anomalies, simulations et scénarios optimiste/réaliste/pessimiste, score + intervalle de confiance, explicabilité, RM-3300→3306 (RM-3303 : jamais de décision automatique — aligné RM-025) |
| 34-AI-Recommendations.md | ✅ | Moteur de recommandations (« quelle décision prendre maintenant ? ») : 7 familles (pédagogiques→stratégiques), priorisation urgence/impact/coût, explication et simulation d'impact, boucle d'amélioration sur les décisions historisées (RM-3404), jamais de modification automatique de données sensibles (RM-3405), RM-3400→3406 — germe dans le dépôt : appréciations IA consultatives existantes |
| 35-AI-DocumentGeneration.md | ✅ | Génération documentaire IA : modèles institutionnels versionnés (RM-3501) à variables {{…}} ≡ banque de modèles de certificats existante, génération guidée/conversationnelle/assistée, contrôle de conformité avant génération, signature + archivage auto (RM-3505), exports PDF/DOCX/XLSX/PPTX, multilingue, RM-3500→3506 — germes : exports Word/PDF existants (bulletins, rapports APFC, fiches) |
| 36-AI-Automation.md | ✅ | Automatisation intelligente : workflows BPMN + moteur de règles versionnées + orchestration d'agents, 4 niveaux (simple/conditionnelle/multi-services/IA), déclencheurs événementiels ≡ propagation transactionnelle + crons Vercel, validations humaines préservées sur les workflows critiques (RM-3602), no-code (RM-3606), reprise/escalade sur erreur, RM-3600→3606 |
| 37-AI-Analytics.md | ✅ | BI augmentée : 4 niveaux d'analyse (descriptive/diagnostique/prédictive→33/prescriptive→34), BI conversationnelle, OLAP, segmentation, tendances/corrélations (jamais lues comme causalité), storytelling, tableaux de bord par profil (complète le 19), rapports narratifs auto, RM-3700→3706 (RM-3705 : faits ≠ hypothèses ≠ recommandations) — germes : Recharts + statistiques par rôle existantes ; Data Warehouse ≡ agrégats SQL/vues matérialisées Neon |
| 38-AI-Governance.md | ✅ | Centre de pilotage IA : registres des modèles/prompts/agents/connaissances versionnés, Policy Engine, suivi des coûts (par modèle/utilisateur/établissement), détection de dérives et hallucinations, validation avant production (RM-3803), basculement de fournisseur (Anthropic Claude cité — notre fournisseur actuel), RM-3800→3807 — germes : garde-fous coût IA + gating ANTHROPIC_API_KEY existants |
| 39-AI-Ethics.md | ✅ | IA responsable : 10 principes (primauté de l'humain, transparence, explicabilité, responsabilité, confidentialité, sécurité, équité/biais, proportionnalité, traçabilité, sobriété), Charte EduWeb de l'IA Responsable, utilisations interdites, contrôle humain obligatoire sur les décisions sensibles (RM-3903 ≡ RM-025), droit de contestation et de révision humaine, gestion des incidents IA, RM-3900→3906 — clôt la série AI 30-39 ; toute interaction IA identifiable comme telle (RM-3900, déjà notre pratique) |

## Référentiels transverses (90-99)

| Document | Statut | Notes |
|---|---|---|
| 90-API.md | ✅ | Standards API REST (RM-1900→1905) — équivalences : Server Actions + Route Handlers /api/*, versionnement par compatibilité des actions, pagination/tri/filtres déjà en usage ; OpenAPI/Gateway sans objet (02B) |
| 91-DTO.md | ✅ | Standards DTO/validation (RM-2000→2005) — équivalences : types TypeScript + validation serveur dans les actions (jamais d'Entity brute au client, champs sensibles filtrés), class-validator/Swagger sans objet |
| 92-Events.md | ✅ | Catalogue d'événements (RM-2100→2105) — équivalences : propagation transactionnelle (tout effet dans la même transaction Prisma ≡ Outbox), journal_audit_finance ≡ Audit Events, nommage au passé repris dans les actions du journal |
| 93-Securite.md | ✅ | Politique de sécurité (RM-2200→2205) — déjà couvert en grande partie : HTTPS Vercel, Auth.js + bcrypt, RBAC serveur centralisé, cloisonnement par périmètre, journal d'audit ; MFA/Passkeys = chantier sécurité séparé (différé, cf. 04) |
| 94-Tests.md | ✅ | Stratégie de tests — adaptation : vérifications par build + lint + sondes locales next start + contrôles pg en prod (pipeline du dépôt) ; pyramide Jest/Playwright = évolution future |
| 95-Catalogue-KPI.md | ✅ | Référentiel KPI officiel (KPI-GOV/SCO/PED/FIN/CPT/ACH/STK/IMM/RH/IT/SEC/AI/SAT/DEV, RM-2400→2404) — source unique des tableaux de bord 19 |
| 96-Glossaire.md | ✅ | Glossaire officiel (définitions faisant foi, abréviations, gouvernance des termes, RM-2500→2502) |
| 97-RBAC.md | ✅ | Modèle d'accès officiel : permissions module.ressource.action, hiérarchie de rôles, ABAC contextuel, séparation des responsabilités, délégations/permissions temporaires, audit des autorisations (RM-2600→2605) — DÉBLOQUE le chantier « rôles financiers & permissions » du 04 ; s'appuie sur le RBAC rang+périmètre existant |
| 98-EventStorming.md | ✅ | Cartographie DDD : 10 Bounded Contexts, Commands/Events/Aggregates/Policies/Sagas (RM-2700→2705) — équivalences : domaines src/lib/finances/* ≡ contextes, actions serveur ≡ Commands, propagation transactionnelle ≡ Policies, pages RSC ≡ Read Models |
| 99-Workflows-Metiers.md | ✅ | Grille de validation des chantiers (WF-001→010) |
| 99-Architecture-Globale.md | ✅ | Document directeur d'architecture d'entreprise (RA-001→007, feuille de route en 3 phases) — lu via les équivalences officielles (00-README/02B/05B) : monolithe modulaire Next.js ≡ microservices modulaires, propagation transactionnelle ≡ bus d'événements, Neon/Vercel Blob ≡ PostgreSQL/S3 ; clôt la série 90-99 |

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
| 110-AI-Operating-System.md | ✅ | Reçu sous le n° 110 (remplace le « 110-Microservices » pressenti) : AI OS = couche centrale IA à 14 composants (Router, Orchestrator, LLM Gateway multi-fournisseurs, Prompt/Memory Manager, Knowledge Hub, Decision/Workflow Intelligence, Analytics/Automation, Security, Trust Center, Cost Optimizer, Observability) — équivalences : LLM Gateway ≡ notre client Anthropic centralisé (fournisseur interchangeable), Event Bus ≡ propagation transactionnelle, Cost Optimizer ≡ garde-fous coût existants ; chapeau technique de la série AI 30-39 |
| 111-Agent-Runtime.md | ✅ | Reçu sous le n° 111 (remplace le « 111-NestJS » pressenti) : moteur d'exécution des agents IA (loader, scheduler à priorités, sandbox isolée, mémoire, bus, supervision, reprise multi-niveaux jusqu'à l'escalade humaine, versionnement réversible), RM-11100→11106 — équivalences : exécutions serverless Vercel bornées (timeout/mémoire) ≡ sandbox, un appel = un contexte utilisateur/périmètre ≡ Agent Context, Kubernetes sans objet (02B) |
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
| 06 Scolarité | 🔧 | commit fd22a03 · migration 20260727090000 VÉRIFIÉE en prod (10 tables, 9 colonnes frais, 2 index partiels) — build Vercel vert |
| Rôles financiers & permissions (04/97) | 🚧 | lancé après la livraison du 06 |
| 07→19 (Facturation, Encaissements, Caisses, Banque, Comptabilité, Achats, Fournisseurs, Stocks, Immobilisations, Budgets, Dépenses, Rapports, Tableaux de bord) | file d'attente | ordre numérique, un chantier à la fois |
