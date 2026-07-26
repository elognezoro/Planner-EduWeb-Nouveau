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
| 04-Profils.md | ✅ 🔧 | Rôles financiers & permissions livrés (commit e1e4704, migration 20260728090000) : 6 rôles (gestionnaire_financier, comptable, caissier, magasinier, auditeur, commissaire_comptes), 27 permissions atomiques en code, garde unique exigerPermissionFinance, séparation demandeur/validateur, délégations temporaires auditées |
| 05-Base-de-donnees.md | ✅ | |
| 05B-Adaptation-Base-de-donnees-EduWeb.md | ✅ (interne) | Équivalences de conventions — fait foi ici |

## Sous-modules (06-39)

| Document | Statut | Notes |
|---|---|---|
| 06-Scolarite.md | ✅ 🔧 | Livré (commit fd22a03, migration 20260727090000) : créances générées à l'inscription (idempotent), compte financier de l'élève, exonérations/bourses, plans de paiement, pénalités, avances imputées par ordre de catégorie, remboursements validés, règles de blocage (application effective différée aux modules concernés), recouvrement |
| 07-Facturation.md | ✅ 🔧 | Livré (commit 4f77087, migration 20260729090000) : factures/proformas adossées aux créances du 06, cycle brouillon→validée→émise→soldée (numéro à l'émission seulement), avoirs + notes de débit, annulation logique motivée, facture imprimable A4, paiements→statuts en transaction, +6 permissions finance.factures.* |
| 08-Encaissements.md | ✅ 🔧 | Livré (commit 7f4ffa3, migration 20260730090000) : flux existant enrichi sans régression — détails des moyens de paiement + mode carte, règlement ventilé multi-factures (un reçu), trop-perçu→avance, reçus sur les séquences de la fondation (amorçage MAX+1), KPI d'encaissement, export CSV |
| 09-Caisse.md | ✅ 🔧 | Livré (commit e9e35b0, migration 20260731090000) : caisses + sessions (une seule ouverte par caisse/caissier, totaux figés à la clôture), écarts justifiés validés par un second acteur, mouvements internes à seuils 50k/500k, contrôle « caisse fermée » actif si caisses physiques, journal imprimable A4 + sélecteur d'établissement admin (constat client) |
| 10-Banque.md | ✅ 🔧 | Livré (commit 817416a, migration 20260801090000) : comptes bancaires à solde calculé, mouvements à pièce obligatoire, boucle 09→10 (confirmation unique des versements de caisse), virements en paire, frais→63/intérêts→77, registre des chèques 5 statuts, relevés par compte, rapprochement enrichi sans régression, situation imprimable |
| 11-Comptabilite.md | ✅ 🔧 | Livré (commit d5a2a20, migration 20260802090000) : registre formel en partie double (plan paramétrable semé OHADA, 7 journaux, équilibre strict, contre-passation, numérotation à la validation, périodes clôturées verrouillées), génération idempotente depuis les pièces 07-10 (571↔521 compris), balances formelle et âgée — la comptabilité calculée historique reste intacte |
| 11A-Plan-Comptable-OHADA.md | ⬜ | |
| 12-Achats.md | ✅ 🔧 | Livré (commit 05486c9, migration 20260803090000) : cycle demande→devis→BC→réception→facture→paiement→retour (10 tables), seuil direction 1M, engagement budgétaire bloquant (RM-905), anti-double-saisie facture (RM-903), écritures AC 60x→401→trésorerie sans double comptage (RM-904), réceptions alimentant l'économat, BC et BR imprimables |
| 13-Fournisseurs.md | ✅ 🔧 | Livré (commit f9a4a90, migration 20260804090000) : fiche enrichie par ajout strict (17 colonnes) + 6 satellites, qualification prospect→approbation par second acteur, transitions contrôlées, anti-doublon RCCM/NIF, score global dérivé, alertes documents/contrats, plafond de crédit vs encours, historique achats exposé — rétro-compatibilité 12 totale |
| 14-Stocks.md | ✅ 🔧 | Livré (commit bbffa86, migration 20260805090000) : magasins hiérarchisés (principal unique, reprise douce), répartition par magasin (Σ = stock total), CUMP en transaction, transferts en paire, sorties motivées à seuil 100k, lots/séries, réservations, inventaires compteur≠valideur à ajustements automatiques, documents imprimables — économat existant intact |
| 15-Immobilisations.md | ✅ 🔧 | Livré (commit 4e8bf78, migration 20260806090000) : passeport d'actif (4 tables), amortissement linéaire calculé + VNC dérivée, dotations idempotentes par exercice (681/28x), stock immobilisable→actif (RM-1104), sortie/cession par second acteur, semis des comptes classe 2/28/68 absents du plan V1, fiche d'actif et état des amortissements imprimables — zéro régression sur le 14 |
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
| 112-LLM-Gateway.md | ✅ | Reçu sous le n° 112 (remplace le « 112-Prisma » pressenti) : passerelle multi-modèles obligatoire (RM-11200 : tout appel IA y transite), routage intelligent coût/confidentialité/latence, 4 niveaux de confidentialité des fournisseurs, fallback en cascade, Prompt Adapter + normalisation, cache, multi-LLM avec vote, RM-11200→11206 — équivalence : notre client Anthropic centralisé EST la première incarnation du Gateway (fournisseur interchangeable, suivi des coûts) |
| 113-Prompt-Orchestrator.md | ✅ | Reçu sous le n° 113 (remplace le « 113-PostgreSQL » pressenti) : registre de prompts versionnés à validation avant publication (RM-11302), construction dynamique (système+métier+RAG+variables+historique), optimisation/compression du contexte, Prompt Firewall anti-injection AVANT chaque appel (RM-11304), A/B testing, RM-11300→11306 — germes : prompts structurés + tool use forcé existants |
| 114-Memory-Manager.md | ✅ | Reçu sous le n° 114 (remplace le « 114-Redis » pressenti) : mémoire unifiée à 10 niveaux (session→épisodique), cycle de vie validé/indexé/archivé, classification de confidentialité, déduplication/consolidation, sélection du contexte minimal avant chaque appel (RM-11406), RM-11400→11406 |
| 115-Vector-Search-Engine.md | ✅ | Reçu sous le n° 115 (remplace le « 115-ElasticSearch » pressenti) : moteur sémantique du RAG — pipeline chunking/métadonnées/embeddings, recherche hybride (texte + vectorielle + filtres), re-ranking, filtrage de sécurité AVANT toute recherche (RM-11506), citations conservées (RM-11504), versions en vigueur prioritaires (RM-11503), RM-11500→11506 — équivalence : PostgreSQL + pgvector sur Neon explicitement en tête de liste |
| 116-Knowledge-Graph.md | ✅ | Reçu sous le n° 116 (remplace le « 116-Queue » pressenti) : graphe de connaissances (entités personnes/organisations/documents/ressources/activités/concepts, relations versionnées et temporelles, ontologie, inférences traçables RM-11602, détection d'incohérences, requêtes à date donnée), complète le RAG vectoriel, RM-11600→11606 — équivalence de départ : nos relations Prisma ≡ premier graphe ; graphe dédié = évolution |
| 117-Decision-Intelligence-Engine.md | ✅ | Reçu sous le n° 117 (remplace le « 117-Stockage » pressenti) : cycle décisionnel complet (observation→diagnostic→prévision→simulation→optimisation→décision→suivi→apprentissage), scoring multicritère, arbitrage explicable, simulations reproductibles (RM-11703), décisions automatiques bornées aux cas non stratégiques sous politiques de délégation (RM-11704), mémoire décisionnelle, RM-11700→11706 |
| 118-Workflow-Intelligence.md | ✅ | Reçu sous le n° 118 (remplace le « 118-Docker » pressenti) : BPM intelligent (workflows adaptatifs, détection de blocages, escalade, routage vers le validateur compétent, tâches humaines/IA/collaboratives, Process Mining, simulation avant déploiement, Workflow Designer no-code), optimisations proposées mais validées avant production (RM-11804), RM-11800→11806 — germes : circuits demande→validation existants (absences, remboursements, approbations) |
| 119-Model-Registry-LLMOps.md | ✅ | Reçu sous le n° 119 (remplace le « 119-Kubernetes » pressenti) : gouvernance du cycle de vie des modèles (registre versionné, catalogue, validation obligatoire avant déploiement RM-11902, benchmark inter-fournisseurs, canary/rollback, détection de dérive, certification expérimental→certifié→retiré), RM-11900→11906 — opérationnalise le Model Registry du 38 |
| 120-AI-Security-Center.md | ✅ | Reçu sous le n° 120 (remplace le « 120-CICD » pressenti) : cybersécurité dédiée à l'IA — Prompt/Model Firewall, détection PII + masquage AVANT transmission au LLM (RM-12001), coffre-fort de secrets (≡ variables d'env Vercel), détection de menaces et comportementale, réponse aux incidents (blocage/suspension/isolement), RM-12000→12006 — complète le 93-Securite et le 39-AI-Ethics |
| 121-AI-Trust-Center.md | ✅ | Reçu sous le n° 121 (remplace le « 121-Observabilite » pressenti) : centre de confiance IA — score de confiance par réponse (RM-12100), preuves et citations historisées (RM-12102), détection de biais et équité (RM-12104), supervision humaine des traitements sensibles (RM-12105), consentements, réclamations/révisions suivies (RM-12103), RM-12100→12106 — opérationnalise le 39-AI-Ethics (droit de contestation) et le Trust Center du 110 |
| 122-AI-Cost-Optimization.md | ✅ | Reçu sous le n° 122 (remplace le « 122-Sauvegardes » pressenti) : maîtrise des coûts IA — sélection du modèle le plus rentable, optimisation/compression des tokens et du contexte, cache (question identique = coût nul), budgets et quotas par entité appliqués AVANT exécution (RM-12202), prévisions, alertes de dépassement (RM-12204), ROI, RM-12200→12206 — nos garde-fous de coût IA existants en sont le germe direct |
| 123-AI-Observability.md | ✅ | Reçu sous le n° 123 (remplace le « 123-HauteDisponibilite » pressenti) : supervision de l'écosystème IA — télémétrie, traces distribuées de bout en bout (RM-12300), métriques spécifiques IA (hallucinations détectées, confiance, tokens, coûts), détection de dérives, analyse de causes racines historisée (RM-12305), incidents et alertes, RM-12300→12306 — équivalence actuelle : journaux Vercel + journal d'audit finance |
| 124-Plugin-SDK.md | ✅ | La série se prolonge au-delà du plan initial : kit de développement d'extensions (manifeste avec permissions déclarées RM-12402, hooks, SDK IA/UI/Workflow, signature numérique avant publication RM-12401, exécution en environnement contraint RM-12406, versionnement), RM-12400→12406 — évolution d'écosystème, sans équivalent actuel dans le dépôt (extension future) |
| 125-Plugin-Marketplace.md | ✅ | Place de marché des extensions : catalogue certifié (publication après certification RM-12501, signature vérifiée à chaque installation, compatibilité contrôlée RM-12506), licences/tarification/facturation, évaluations modérées (RM-12504), tableaux de bord développeur et administrateur, RM-12500→12506 — évolution d'écosystème liée au 124 |
| 126-AI-API-Gateway.md | ✅ | Point d'entrée unique des services IA : routage intelligent, authentification/autorisation avant routage (RM-12605), limites de débit appliquées avant exécution (RM-12602), validation de schémas avec refus (RM-12606), versionnement d'API, découverte de services, cache, RM-12600→12606 — équivalence : Route Handlers /api/* + garde RBAC serveur centralisée ≡ Gateway du dépôt |
| 127-Edge-AI.md | ✅ | IA en périphérie pour connectivité limitée (contexte très pertinent pour les établissements ivoiriens) : modèles locaux, mode hors ligne avec synchronisation différée et résolution de conflits (RM-12703), arbitrage local/cloud/hybride, chiffrement des données locales sensibles (RM-12706), gestion de flotte d'équipements, RM-12700→12706 — évolution (le dépôt est 100 % cloud Vercel aujourd'hui) |
| 128-Federated-Learning.md | ✅ | Apprentissage fédéré : les données restent dans chaque établissement (RM-12800), seuls les paramètres de modèles circulent (RM-12801), confidentialité différentielle + agrégation sécurisée, validation avant publication (RM-12803), contributions suspectes isolées (RM-12805), fédérations hiérarchiques établissement→région→ministère en évolution — cohérent avec notre cloisonnement par périmètre ; évolution annoncée dès les 21/31 |
| 129-Enterprise-AI-Reference-Architecture.md | ✅ | Document de synthèse (EAIRA) qui CLÔT la série AI OS 110-129 : vue globale fédérant les 18 composants des 110-128, 7 couches (présentation→infrastructure), 10 principes (dont Human-in-the-Loop), flux de traitement de bout en bout, roadmap en 5 phases (Fondations→Connaissance→Automatisation→Gouvernance→Ouverture), RM-12900→12906 — pendant IA du 99-Architecture-Globale ; référentiel de conception des évolutions futures |

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
| Rôles financiers & permissions (04/97) | 🔧 | commit e1e4704 · migration 20260728090000 VÉRIFIÉE en prod (table delegations_finance + 6 rôles insérés) — build Vercel vert (07f84a9) |
| 07 Facturation | 🔧 | commit 4f77087 · migration 20260729090000 VÉRIFIÉE en prod (4 tables, 3 index partiels de numéros) — build Vercel vert |
| 08 Encaissements | 🔧 | commit 7f4ffa3 · migration 20260730090000 VÉRIFIÉE en prod (ventilations_paiement + 3 colonnes moyens de paiement ; amorçage des séquences = no-op justifié : aucun paiement historique en prod, la 1re séquence naîtra à 1) — build Vercel vert |
| 09 Caisse | 🔧 | commit e9e35b0 · migration 20260731090000 VÉRIFIÉE en prod (3 tables, 3 index partiels, sessionCaisseId sur paiements et opérations) + sélecteur admin déployé — build Vercel vert |
| 10 Banque | 🔧 | commit 817416a · migration 20260801090000 VÉRIFIÉE en prod (3 tables, 5 index partiels, relevés par compte, ancien index composite remplacé) — build Vercel vert |
| 11 Comptabilité | 🔧 | commit d5a2a20 · migration 20260802090000 VÉRIFIÉE en prod (5 tables, 4 index partiels dont « une pièce = une écriture active ») — build Vercel vert ; 11A toujours attendu : plan V1 = dépôt, s'intégrera par ajout de comptes |
| 12 Achats | 🔧 | commit 05486c9 · migration 20260803090000 VÉRIFIÉE en prod (10 tables, 5 index partiels dont l'anti-double-saisie des factures fournisseurs) — build Vercel vert |
| 13 Fournisseurs | 🔧 | commit f9a4a90 · migration 20260804090000 VÉRIFIÉE en prod (6 tables satellites, fiche fournisseurs enrichie à 38 colonnes) — build Vercel vert |
| 14 Stocks | 🔧 | commit bbffa86 · migration 20260805090000 VÉRIFIÉE en prod (7 tables, CUMP, index « principal unique » ; reprise douce = no-op justifié : économat vide en prod, 0 article) — build Vercel vert |
| 15 Immobilisations | 🔧 | commit 4e8bf78 · migration 20260806090000 VÉRIFIÉE en prod (4 tables, unicité code actif + unicité (immo, période) des dotations = idempotence RM-1202) — build Vercel vert |
| 16 Budgets | 🚧 | chantier suivant |
| 07→19 (Facturation, Encaissements, Caisses, Banque, Comptabilité, Achats, Fournisseurs, Stocks, Immobilisations, Budgets, Dépenses, Rapports, Tableaux de bord) | file d'attente | ordre numérique, un chantier à la fois |
