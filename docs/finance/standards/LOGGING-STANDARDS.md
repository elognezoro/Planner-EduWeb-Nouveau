---
title: EduWeb Logging Standards
version: 1.0
status: Official
category: Engineering Standards
code: STD-022
authors:
  - EduWeb Architecture Team
---

# LOGGING-STANDARDS.md

> Référentiel officiel de journalisation (Logging) de l'écosystème EduWeb.

---

# Sommaire

1. Objectifs
2. Principes
3. Architecture de journalisation
4. Niveaux de logs
5. Structure normalisée
6. Identifiants de corrélation
7. Journalisation des API
8. Journalisation des Server Actions
9. Journalisation métier
10. Journalisation des erreurs
11. Journalisation de sécurité
12. Journalisation des performances
13. Journalisation des traitements planifiés
14. Protection des données
15. Centralisation
16. Politique de rétention
17. Rotation et archivage
18. Audit
19. Analyse des journaux
20. Anti-patterns
21. Checklist

---

# 1. Objectifs

La journalisation permet :

- d'expliquer le comportement du système ;
- de diagnostiquer les anomalies ;
- de répondre aux incidents ;
- d'assurer la traçabilité ;
- de faciliter les audits ;
- d'alimenter les tableaux de bord d'observabilité.

Chaque événement significatif doit être journalisé.

---

# 2. Principes

Les journaux doivent être :

- structurés ;
- cohérents ;
- horodatés ;
- corrélables ;
- exploitables automatiquement.

Les logs sont destinés aussi bien aux développeurs qu'aux équipes d'exploitation.

---

# 3. Architecture de journalisation

```
Application

↓

Logger

↓

Logs JSON

↓

Collecteur

↓

Stockage centralisé

↓

Recherche

↓

Alertes

↓

Dashboards
```

Les applications ne doivent jamais écrire directement dans plusieurs destinations.

---

# 4. Niveaux de logs

Les niveaux autorisés sont :

## TRACE

Diagnostic extrêmement détaillé.

Utilisé uniquement en développement ou lors d'investigations.

---

## DEBUG

Informations utiles au développeur.

Exemples :

- valeurs intermédiaires ;
- appels internes ;
- exécution des services.

---

## INFO

Événements normaux.

Exemples :

- connexion ;
- création d'un élève ;
- publication d'un emploi du temps.

---

## WARN

Situation inhabituelle mais non bloquante.

Exemples :

- tentative d'accès refusée ;
- ressource absente mais non critique ;
- temps de réponse élevé.

---

## ERROR

Erreur empêchant l'exécution normale.

Exemples :

- exception métier ;
- erreur SQL ;
- erreur réseau.

---

## FATAL

Erreur critique compromettant la disponibilité de l'application.

Ces événements déclenchent immédiatement une alerte.

---

# 5. Structure normalisée

Tous les logs utilisent un format JSON.

Exemple :

```json
{
  "timestamp": "...",
  "level": "INFO",
  "service": "planning",
  "module": "Timetable",
  "action": "Publish",
  "message": "Timetable published",
  "requestId": "...",
  "traceId": "...",
  "userId": "...",
  "tenantId": "...",
  "schoolId": "...",
  "durationMs": 143
}
```

Les champs sont normalisés sur toute la plateforme.

---

# 6. Identifiants de corrélation

Chaque requête possède :

- Request ID ;
- Trace ID ;
- Span ID (si applicable).

Ces identifiants sont propagés entre les services afin de suivre un traitement de bout en bout.

---

# 7. Journalisation des API

Pour chaque appel API, journaliser :

- méthode HTTP ;
- endpoint ;
- statut HTTP ;
- durée ;
- taille de la réponse ;
- utilisateur authentifié (le cas échéant).

Le contenu des requêtes n'est enregistré que si cela est justifié et conforme aux règles de confidentialité.

---

# 8. Journalisation des Server Actions

Chaque Server Action consigne :

- son nom ;
- le début d'exécution ;
- la fin d'exécution ;
- la durée ;
- les erreurs éventuelles.

Les paramètres sensibles sont masqués.

---

# 9. Journalisation métier

Les événements métier importants sont journalisés.

Exemples :

- inscription d'un élève ;
- affectation d'un enseignant ;
- publication d'un bulletin ;
- génération d'un emploi du temps ;
- validation d'un conseil de classe ;
- création d'un établissement.

Ces logs complètent les journaux techniques.

---

# 10. Journalisation des erreurs

Pour chaque erreur, enregistrer :

- type ;
- message ;
- pile d'appels (stack trace) ;
- contexte ;
- Request ID ;
- utilisateur concerné ;
- impact.

Les erreurs sont regroupées afin de faciliter leur analyse.

---

# 11. Journalisation de sécurité

Journaliser notamment :

- authentifications réussies ;
- échecs d'authentification ;
- verrouillage de compte ;
- changement de mot de passe ;
- modification des rôles ;
- export de données sensibles ;
- tentative d'accès refusée.

Ces événements sont conservés plus longtemps que les logs applicatifs courants.

---

# 12. Journalisation des performances

Mesurer :

- durée des Server Actions ;
- durée des appels API ;
- durée des requêtes Prisma ;
- temps de génération des rapports ;
- temps de génération des emplois du temps.

Les dépassements des seuils définis dans les SLO sont signalés.

---

# 13. Journalisation des traitements planifiés

Pour chaque tâche planifiée, enregistrer :

- identifiant ;
- nom ;
- heure de début ;
- heure de fin ;
- durée ;
- résultat ;
- nombre d'éléments traités ;
- erreurs éventuelles.

Exemples :

- sauvegarde ;
- export ;
- synchronisation ;
- génération automatique.

---

# 14. Protection des données

Ne jamais journaliser :

- mots de passe ;
- secrets ;
- jetons d'accès ;
- clés API ;
- informations bancaires ;
- données médicales ;
- données biométriques.

Les informations personnelles sont masquées lorsque cela est nécessaire.

---

# 15. Centralisation

Tous les journaux sont centralisés.

Objectifs :

- recherche rapide ;
- corrélation ;
- statistiques ;
- alertes ;
- conservation.

Les journaux locaux ne constituent pas la source de vérité.

---

# 16. Politique de rétention

Les durées de conservation sont définies selon la nature des logs.

Exemple :

| Type | Durée indicative |
|-------|-----------------:|
| Logs applicatifs | 90 jours |
| Logs techniques | 180 jours |
| Logs de sécurité | 1 an |
| Logs d'audit | Selon les exigences réglementaires |

Ces durées peuvent être adaptées aux obligations légales du pays de déploiement.

---

# 17. Rotation et archivage

Les journaux sont :

- compressés ;
- archivés ;
- supprimés selon la politique de rétention.

La rotation est automatisée.

---

# 18. Audit

Les journaux doivent permettre de répondre aux questions suivantes :

- Qui ?
- Quoi ?
- Quand ?
- Où ?
- Comment ?

Les opérations critiques sont toujours auditables.

---

# 19. Analyse des journaux

Les équipes doivent pouvoir :

- rechercher ;
- filtrer ;
- agréger ;
- corréler ;
- produire des tableaux de bord.

Les tendances anormales sont détectées automatiquement lorsque possible.

---

# 20. Anti-patterns

Interdits :

❌ Logs en texte libre uniquement.

❌ Absence d'horodatage.

❌ Absence de Request ID.

❌ Journalisation des mots de passe.

❌ Logs différents selon les modules.

❌ Utilisation excessive du niveau ERROR pour des événements normaux.

❌ Suppression manuelle des journaux.

❌ Écriture de logs directement depuis les composants React.

---

# 21. Checklist

Avant chaque mise en production :

- [ ] Format JSON structuré.
- [ ] Request ID propagé.
- [ ] Trace ID disponible.
- [ ] Données sensibles masquées.
- [ ] Logs métier présents.
- [ ] Logs de sécurité activés.
- [ ] Rotation configurée.
- [ ] Politique de rétention documentée.
- [ ] Centralisation opérationnelle.
- [ ] Dashboards mis à jour.

---

# Documents associés

- OBSERVABILITY-STANDARDS.md
- PERFORMANCE-STANDARDS.md
- SECURITY-STANDARDS.md
- ERROR-HANDLING-STANDARDS.md
- BACKEND-STANDARDS.md
- API-STANDARDS.md

---

# Fin du document
