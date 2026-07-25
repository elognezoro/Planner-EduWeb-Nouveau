# Architecture des API
## EduWeb Planner

Version : 1.0

---

# Objectif

Le présent document définit les standards de développement des API d'EduWeb Planner.

Il garantit :

- l'interopérabilité ;
- la stabilité ;
- la sécurité ;
- la maintenabilité ;
- la compatibilité entre les versions.

Toutes les API du système doivent respecter ces règles.

---

# Architecture générale

Les API sont organisées selon une architecture RESTful.

Les communications utilisent HTTPS exclusivement.

Les échanges sont réalisés au format JSON.

Architecture :

Applications

↓

API Gateway

↓

Services Métier

↓

Base de données

↓

Bus d'événements

↓

Notifications

---

# Principes

Toutes les API sont :

- Stateless
- Sécurisées
- Versionnées
- Documentées
- Testables
- Observables

---

# URL de base

Production

/api/v1/

Préproduction

/api/staging/v1/

Développement

/api/dev/v1/

---

# Versionnement

Chaque évolution incompatible crée une nouvelle version.

Exemple

/api/v1/

/api/v2/

Les anciennes versions restent disponibles pendant une période de transition définie par la politique de compatibilité.

---

# Format des URL

Les ressources utilisent toujours le pluriel.

Exemples

GET /students

GET /teachers

GET /budgets

GET /payments

GET /suppliers

GET /assets

POST /invoices

PATCH /budgets/{id}

DELETE /documents/{id}

---

# Verbes HTTP

GET

Lecture

---

POST

Création

---

PUT

Remplacement complet

---

PATCH

Modification partielle

---

DELETE

Suppression logique (Soft Delete par défaut)

---

# Format JSON

Toutes les réponses utilisent UTF-8.

Exemple

{
  "success": true,
  "data": {},
  "metadata": {},
  "links": {}
}

---

# Structure des réponses

Réussite

{
  "success": true,
  "message": "Opération réalisée.",
  "data": { },
  "metadata": {
      "timestamp": "...",
      "requestId": "...",
      "version": "v1"
  }
}

---

Erreur

{
  "success": false,
  "error": {
      "code": "BUDGET_NOT_FOUND",
      "message": "Budget introuvable.",
      "details": {}
  }
}

---

# Codes HTTP

200 OK

201 Created

202 Accepted

204 No Content

400 Bad Request

401 Unauthorized

403 Forbidden

404 Not Found

409 Conflict

422 Unprocessable Entity

429 Too Many Requests

500 Internal Server Error

503 Service Unavailable

---

# Pagination

Toutes les listes utilisent une pagination uniforme.

Paramètres

page

pageSize

Réponse

total

page

pageSize

totalPages

---

# Recherche

Paramètre

search=

Recherche plein texte.

---

# Tri

sort=name

sort=-createdAt

Le signe "-" indique un ordre décroissant.

---

# Filtrage

Exemples

status=ACTIVE

schoolId=UUID

createdAfter=

createdBefore=

budgetYear=2027

Les filtres sont cumulables.

---

# Champs

Le paramètre fields permet de limiter les données retournées.

Exemple

fields=id,name,total

---

# Relations

Le paramètre include permet d'inclure des objets liés.

Exemple

include=payments,supplier

---

# Authentification

Le système supporte :

OAuth2

JWT

Refresh Token

API Keys

Service Accounts

---

# Autorisation

Toutes les API appliquent :

RBAC

ABAC

Multi-Tenant

Permissions granulaires

---

# JWT

Chaque token contient notamment :

Utilisateur

Rôle

Établissement

Permissions

Date d'expiration

Tenant

---

# Sécurité

HTTPS obligatoire

CORS contrôlé

CSRF

Protection XSS

Protection Injection SQL

Protection Prompt Injection (IA)

Rate Limiting

IP Whitelisting (optionnel)

Journalisation complète

---

# Validation

Toutes les entrées sont validées :

types

tailles

formats

unicité

cohérence métier

---

# Upload

Formats autorisés :

PDF

PNG

JPEG

DOCX

XLSX

CSV

ZIP

La taille maximale est configurable.

---

# Téléchargements

Chaque fichier possède :

UUID

Nom

Type MIME

Hash

Signature

Version

---

# API asynchrones

Les traitements longs utilisent :

Queue

↓

Worker

↓

Notification

↓

Résultat

Exemples :

exports

génération PDF

OCR

IA

---

# Webhooks

Les partenaires peuvent recevoir :

InvoiceCreated

PaymentReceived

BudgetValidated

AssetCreated

StudentRegistered

NotificationSent

---

# Idempotence

Les opérations critiques utilisent :

Idempotency-Key

afin d'éviter les doublons.

---

# Documentation

Toutes les API sont documentées via :

OpenAPI 3

Swagger UI

JSON Schema

Exemples de requêtes

Exemples de réponses

---

# Journalisation

Chaque appel enregistre :

Request ID

Utilisateur

IP

Endpoint

Durée

Statut

Tenant

---

# Monitoring

Le système mesure :

Temps moyen

Temps maximal

Volume

Erreurs

Disponibilité

---

# Limitation

Rate Limiting configurable :

par utilisateur

par IP

par clé API

par établissement

---

# Cache

GET

↓

Redis

↓

TTL configurable

---

# API internes

Communication entre microservices :

gRPC

ou REST

selon le contexte.

---

# API publiques

Les API publiques utilisent :

OAuth2

Scopes

Quota

Versionnement

Documentation dédiée

---

# API IA

Endpoints spécialisés :

/ai/chat

/ai/predict

/ai/explain

/ai/generate

/ai/search

---

# Règles métier

## RM-1900

Toutes les API utilisent HTTPS.

---

## RM-1901

Chaque réponse contient un Request ID.

---

## RM-1902

Les erreurs suivent un format uniforme.

---

## RM-1903

Les API sont rétrocompatibles pendant toute la période de support de leur version.

---

## RM-1904

Les permissions sont vérifiées avant toute opération.

---

## RM-1905

Toutes les opérations sensibles sont journalisées.

---

# Tests

Le système devra vérifier :

✓ conformité OpenAPI

✓ sécurité JWT

✓ permissions

✓ pagination

✓ validation

✓ uploads

✓ webhooks

✓ idempotence

✓ performances

---

# KPI

Temps moyen de réponse

Disponibilité

Nombre d'appels

Erreurs

Latence

Taux de cache

Temps des requêtes SQL

Consommation mémoire

Débit

---

# Évolutions prévues

Le système devra intégrer :

GraphQL

gRPC complet

WebSocket

Server-Sent Events

API Gateway intelligente

Service Mesh

OpenTelemetry

AsyncAPI

---

# Conclusion

Les API constituent le socle d'interopérabilité d'EduWeb Planner. Elles assurent des échanges sécurisés, performants et standardisés entre les différents modules de la plateforme, les applications clientes, les partenaires externes et les futurs services d'intelligence artificielle.
