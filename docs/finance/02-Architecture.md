# Architecture du Module Finance
## EduWeb Planner

Version : 1.0

---

# Objectif

Définir l'architecture fonctionnelle, logique et technique du module Finance afin de garantir :

- une forte évolutivité ;
- une faible dépendance entre les composants ;
- une maintenance simplifiée ;
- une haute disponibilité ;
- une intégration native avec les autres modules d'EduWeb Planner.

Le présent document constitue la référence architecturale officielle du module Finance.

---

# Principes d'architecture

Le module repose sur les principes suivants :

- Domain Driven Design (DDD)
- Clean Architecture
- SOLID
- CQRS (Command Query Responsibility Segregation)
- Event Driven Architecture
- API First
- Stateless Backend
- Modular Monolith (évolutif vers Microservices)

---

# Architecture générale

Le module Finance est constitué de quatre couches.

```
                Utilisateur

                      │

                Interface React

                      │

                API REST / GraphQL

                      │

            Couche Applicative

                      │

               Domaine Métier

                      │

          Infrastructure Technique

                      │

             PostgreSQL / Redis
```

---

# Couche Présentation

Responsabilités :

- Interface Web
- Interface Mobile
- Tableaux de bord
- Saisie
- Validation

Technologies :

- React
- NextJS
- TypeScript
- Tailwind CSS

---

# Couche API

Responsabilités :

- Authentification
- Validation
- Exposition REST
- GraphQL
- Documentation OpenAPI

Technologies :

- NestJS
- Swagger

---

# Couche Application

Cette couche orchestre les traitements.

Elle ne contient aucune règle métier.

Elle appelle les services du domaine.

Exemples :

CreateInvoiceUseCase

RegisterPaymentUseCase

CloseCashRegisterUseCase

ApproveExpenseUseCase

GenerateBudgetUseCase

---

# Couche Domaine

Cette couche contient toute l'intelligence métier.

Elle ne dépend d'aucun framework.

Elle contient :

- Entities
- Aggregates
- Value Objects
- Domain Events
- Domain Services
- Repositories (Interfaces)

---

# Couche Infrastructure

Cette couche implémente :

- PostgreSQL
- Prisma
- Redis
- RabbitMQ
- S3
- SMTP
- SMS
- Mobile Money

---

# Découpage fonctionnel

Le module est divisé en sous-domaines.

Finance

├── Paramétrage

├── Scolarité

├── Facturation

├── Encaissements

├── Comptabilité

├── Caisse

├── Banque

├── Budget

├── Dépenses

├── Achats

├── Fournisseurs

├── Stocks

├── Ventes

├── Immobilisations

├── Rapports

├── Dashboard

├── Audit

└── IA

Chaque sous-module possède son propre domaine métier.

---

# Architecture des packages

finance/

config/

domain/

application/

infrastructure/

presentation/

shared/

tests/

Chaque package reste indépendant.

---

# Architecture DDD

Chaque domaine possède :

```
Scolarite/

entities/

value-objects/

repositories/

events/

services/

usecases/

controllers/

dto/

validators/

tests/
```

Même organisation pour tous les domaines.

---

# Communication entre domaines

Les domaines ne s'appellent jamais directement.

Ils communiquent uniquement :

- via des interfaces ;
- via des événements.

---

# Domain Events

Exemple :

InvoiceCreated

↓

PaymentReceived

↓

ReceiptGenerated

↓

AccountingEntryCreated

↓

DashboardUpdated

↓

NotificationSent

Chaque étape est indépendante.

---

# Exemple de flux

Paiement d'un élève.

Le système déclenche :

PaymentReceived

↓

UpdateStudentAccount

↓

UpdateCashRegister

↓

CreateAccountingEntries

↓

UpdateDashboard

↓

GenerateReceipt

↓

SendNotification

Chaque traitement est autonome.

---

# Services transversaux

Le module utilise des services communs.

NotificationService

AuditService

StorageService

AuthenticationService

AuthorizationService

CurrencyService

TaxService

DocumentService

QRCodeService

PDFService

AIService

---

# Intégration avec EduWeb Planner

Le module Finance échange avec :

Admissions

Vie scolaire

Bulletins

Examens

Bibliothèque

Transport

Cantine

RH

Statistiques

Tous les échanges passent par des événements métier.

---

# Gestion des transactions

Toute opération financière est transactionnelle.

Exemple :

Créer un paiement.

Le système réalise :

Créer le paiement

↓

Créer le reçu

↓

Créer les écritures

↓

Mettre à jour la caisse

↓

Mettre à jour le compte élève

↓

Mettre à jour les statistiques

Si une étape échoue,

toute la transaction est annulée.

---

# Cache

Les données fréquemment consultées sont mises en cache.

Exemples :

Plan comptable

Catégories

Produits

Budgets

Paramètres

Redis est utilisé.

---

# Sécurité

Toutes les API passent par :

JWT

↓

Permissions

↓

Validation

↓

Journalisation

↓

Audit

↓

Exécution

---

# Scalabilité

Le module doit fonctionner :

- avec une école de 100 élèves ;
- avec une université de 80 000 étudiants ;
- avec un ministère gérant plusieurs millions d'apprenants.

Aucune hypothèse ne doit limiter la montée en charge.

---

# Architecture multi-établissements

Chaque donnée appartient obligatoirement à :

Tenant

↓

Établissement

↓

Exercice

↓

Utilisateur

Toutes les requêtes sont filtrées automatiquement.

---

# Stockage documentaire

Tous les documents produits sont archivés.

Exemples :

Factures

Reçus

Bons de commande

États financiers

Pièces justificatives

Le stockage est externalisé (S3 compatible).

---

# Intelligence artificielle

Le moteur IA est indépendant.

Il ne modifie jamais directement les données.

Il fournit uniquement :

- des analyses ;
- des prévisions ;
- des recommandations.

Toutes les décisions restent humaines.

---

# Journalisation

Toutes les opérations sont historisées.

Chaque événement contient :

- identifiant
- auteur
- date
- heure
- établissement
- adresse IP
- navigateur
- ancienne valeur
- nouvelle valeur

---

# Architecture cible

À terme, le module devra pouvoir être extrait sous forme de microservice autonome sans modification du code métier.

Cette exigence garantit l'évolutivité de la plateforme EduWeb Planner.

---

# Conclusion

Toute nouvelle fonctionnalité devra respecter cette architecture.

Aucune implémentation ne devra contourner les couches définies dans ce document.

Le respect de cette architecture est obligatoire pour garantir la maintenabilité, la sécurité, les performances et l'évolutivité du module Finance.
