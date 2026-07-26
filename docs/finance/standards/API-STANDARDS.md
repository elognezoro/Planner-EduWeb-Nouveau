---
title: EduWeb API Standards
version: 1.0
status: Official
category: Engineering Standards
code: STD-011
authors:
  - EduWeb Architecture Team
---

# API-STANDARDS.md

> Référentiel officiel de conception des API de l'écosystème EduWeb.

---

# Sommaire

1. Objectifs
2. Philosophie
3. Architecture API
4. Types d'API
5. Convention REST
6. Versionnement
7. Authentification
8. Autorisation
9. Structure des requêtes
10. Structure des réponses
11. Pagination
12. Filtrage
13. Tri
14. Recherche
15. Gestion des erreurs
16. Validation
17. Idempotence
18. Transactions
19. Performance
20. Sécurité
21. Documentation
22. Dépréciation
23. Monitoring
24. Anti-patterns
25. Checklist

---

# 1. Objectifs

Les API EduWeb doivent être :

- cohérentes ;
- sécurisées ;
- rapides ;
- documentées ;
- versionnées ;
- faciles à maintenir.

Les consommateurs des API ne doivent jamais dépendre d'implémentations internes.

---

# 2. Philosophie

Dans EduWeb :

- les **Server Actions** sont privilégiées pour les échanges internes à l'application Next.js ;
- les **Route Handlers** sont réservés aux API publiques ou aux intégrations externes.

Les API sont conçues selon le principe **API First**.

---

# 3. Architecture API

Architecture cible :

```
Client

↓

Server Action

ou

Route Handler

↓

Service

↓

Repository

↓

Prisma

↓

Neon PostgreSQL
```

Les composants React n'accèdent jamais directement à Prisma.

---

# 4. Types d'API

EduWeb distingue :

- API internes
- API publiques
- Webhooks
- API partenaires
- API administratives

Chaque catégorie possède ses propres règles de sécurité.

---

# 5. Convention REST

Utiliser des ressources au pluriel.

Exemples :

```
/students

/teachers

/classes

/timetables

/schools
```

Éviter :

```
/getStudents

/createTeacher

/deleteSchool
```

Les verbes HTTP portent l'action.

---

# 6. Versionnement

Toutes les API publiques sont versionnées.

Exemple :

```
/api/v1/students

/api/v2/students
```

Les API internes utilisant les Server Actions ne nécessitent pas de versionnement explicite.

---

# 7. Authentification

Les API protégées utilisent une authentification forte.

Exemples :

- session sécurisée ;
- JWT ;
- OAuth2 ;
- API Key (intégrations techniques).

Les identifiants ne transitent jamais dans l'URL.

---

# 8. Autorisation

Toute opération vérifie les permissions.

Exemple :

```
Utilisateur

↓

Authentification

↓

RBAC

↓

Service

↓

Repository
```

Une authentification valide ne suffit jamais à autoriser une action.

---

# 9. Structure des requêtes

Les paramètres utilisent une nomenclature cohérente.

Exemple :

```
GET /students?page=1&pageSize=20

GET /students?schoolId=123

GET /students?status=ACTIVE
```

Les paramètres sont validés avec Zod.

---

# 10. Structure des réponses

Structure recommandée :

```json
{
  "success": true,
  "data": {},
  "meta": {},
  "error": null
}
```

En cas d'erreur :

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Le champ 'email' est invalide."
  }
}
```

La structure reste identique sur toutes les API.

---

# 11. Pagination

Toutes les listes importantes sont paginées.

Structure recommandée :

```json
{
  "data": [],
  "meta": {
    "page": 2,
    "pageSize": 20,
    "totalItems": 132,
    "totalPages": 7
  }
}
```

Les grandes collections privilégient la pagination par curseur.

---

# 12. Filtrage

Les filtres sont explicites.

Exemple :

```
?schoolId=

?teacherId=

?academicYear=

?status=
```

Les filtres sont combinables.

---

# 13. Tri

Convention :

```
?sort=lastName

?order=asc
```

Plusieurs critères de tri peuvent être supportés.

---

# 14. Recherche

Les recherches textuelles utilisent :

```
?q=mathématiques
```

Les recherches avancées sont implémentées dans des endpoints dédiés lorsque nécessaire.

---

# 15. Gestion des erreurs

Codes HTTP recommandés :

| Code | Utilisation |
|------:|-------------|
| 200 | Succès |
| 201 | Création |
| 204 | Suppression sans contenu |
| 400 | Requête invalide |
| 401 | Non authentifié |
| 403 | Accès refusé |
| 404 | Ressource introuvable |
| 409 | Conflit |
| 422 | Validation |
| 429 | Trop de requêtes |
| 500 | Erreur interne |

Les messages techniques ne sont jamais exposés aux utilisateurs.

---

# 16. Validation

Toutes les entrées sont validées avec Zod.

La validation intervient avant toute logique métier.

Les erreurs de validation sont uniformisées.

---

# 17. Idempotence

Les opérations sensibles (paiement, import, synchronisation…) utilisent une clé d'idempotence lorsque nécessaire.

Les requêtes répétées ne doivent pas produire plusieurs traitements identiques.

---

# 18. Transactions

Les opérations multi-étapes utilisent :

```
Prisma Transaction
```

L'API garantit la cohérence des données.

---

# 19. Performance

Objectifs :

- limiter le volume des réponses ;
- sélectionner uniquement les champs nécessaires ;
- utiliser la pagination ;
- éviter les requêtes N+1 ;
- activer le cache lorsque pertinent.

---

# 20. Sécurité

Mesures obligatoires :

- HTTPS uniquement ;
- limitation du débit (Rate Limiting) ;
- validation des entrées ;
- journalisation ;
- protection CSRF lorsque nécessaire ;
- contrôle RBAC.

Les données sensibles sont masquées dans les journaux.

---

# 21. Documentation

Toutes les API publiques sont documentées avec OpenAPI.

Chaque endpoint décrit :

- objectif ;
- paramètres ;
- réponses ;
- exemples ;
- codes d'erreur ;
- permissions requises.

---

# 22. Dépréciation

Toute API obsolète suit un cycle :

```
Annonce

↓

Dépréciation

↓

Migration

↓

Suppression
```

La date de retrait est communiquée à l'avance.

---

# 23. Monitoring

Surveiller :

- temps de réponse ;
- taux d'erreur ;
- volume des requêtes ;
- consommation des ressources ;
- erreurs 5xx ;
- erreurs 4xx.

Les API critiques disposent d'alertes.

---

# 24. Anti-patterns

Interdits :

❌ Routes contenant des verbes.

❌ Réponses incohérentes.

❌ Validation absente.

❌ Données sensibles dans les réponses.

❌ Pagination absente sur de grandes listes.

❌ SQL brut dans les Route Handlers.

❌ Logique métier dans les contrôleurs.

❌ Messages d'erreur techniques exposés.

---

# 25. Checklist

Avant chaque mise en production :

- [ ] Endpoint documenté.
- [ ] Validation Zod.
- [ ] Authentification vérifiée.
- [ ] Autorisation RBAC.
- [ ] Pagination si nécessaire.
- [ ] Gestion des erreurs conforme.
- [ ] Tests automatisés.
- [ ] Monitoring configuré.
- [ ] Documentation OpenAPI mise à jour.
- [ ] Revue de sécurité réalisée.

---

# Documents associés

- CLAUDE.md
- NEXTJS-STANDARDS.md
- BACKEND-STANDARDS.md
- SECURITY-STANDARDS.md
- AUTH-STANDARDS.md
- RBAC-STANDARDS.md
- TESTING-STANDARDS.md

---

# Fin du document
