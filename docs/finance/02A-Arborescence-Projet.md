# Arborescence officielle du projet
## Module Finance – EduWeb Planner

Version : 1.0

---

# Objectif

Définir l'organisation physique du code source du module Finance.

Cette structure est obligatoire.

Claude Code ne doit jamais créer une autre organisation sans justification explicite.

---

# Architecture générale

Le projet est organisé selon les principes :

- Clean Architecture
- Domain Driven Design
- Feature First
- Modular Monolith

Chaque fonctionnalité possède son propre module.

---

# Arborescence racine

finance/

├── apps/
│
├── packages/
│
├── docs/
│
├── scripts/
│
├── prisma/
│
├── docker/
│
├── tests/
│
├── .github/
│
├── package.json
│
├── tsconfig.json
│
└── README.md

---

# Backend

apps/api/

src/

modules/

shared/

config/

main.ts

---

# Modules métier

modules/

authentication/

finance/

notifications/

audit/

dashboard/

reports/

ai/

---

# Sous-modules Finance

finance/

config/

school-fees/

student-accounts/

invoices/

payments/

cash-register/

banks/

expenses/

suppliers/

purchases/

inventory/

products/

sales/

budgets/

assets/

accounting/

reports/

dashboard/

audit/

analytics/

---

# Exemple d'un module

school-fees/

controller/

service/

repository/

entities/

dto/

validators/

events/

usecases/

interfaces/

tests/

README.md

---

# Détail

## controller/

Expose les API REST.

Aucune règle métier.

---

## service/

Coordonne les traitements.

Appelle les UseCases.

---

## usecases/

Chaque action métier possède son Use Case.

Exemples :

CreateSchoolFee

UpdateSchoolFee

DeleteSchoolFee

SearchSchoolFee

GenerateInvoices

---

## entities/

Contient les entités du domaine.

Exemple

SchoolFee

SchoolFeeCategory

SchoolFeeSchedule

---

## dto/

Objets d'échange.

Exemple

CreateSchoolFeeDto

UpdateSchoolFeeDto

SearchSchoolFeeDto

---

## validators/

Validation métier.

Jamais dans le contrôleur.

---

## repository/

Accès aux données.

Aucun SQL dans les services.

---

## events/

Tous les événements métier.

Exemple

SchoolFeeCreated

SchoolFeeUpdated

InvoiceGenerated

PaymentReceived

---

## interfaces/

Interfaces publiques.

Jamais d'implémentation.

---

## tests/

Tests unitaires.

Tests d'intégration.

---

# Shared

shared/

constants/

enums/

exceptions/

guards/

middlewares/

pipes/

decorators/

helpers/

utils/

types/

interfaces/

---

# Configuration

config/

database/

redis/

jwt/

mail/

sms/

storage/

payment/

---

# Prisma

prisma/

schema.prisma

migrations/

seed/

---

# Documentation

docs/

architecture/

api/

database/

finance/

deployment/

---

# Frontend

apps/web/

src/

components/

pages/

hooks/

layouts/

services/

contexts/

store/

assets/

---

# Pages

/pages/finance/

dashboard/

school-fees/

payments/

cash-register/

accounting/

expenses/

suppliers/

inventory/

sales/

budgets/

reports/

settings/

---

# Composants

/components/finance/

cards/

tables/

forms/

dialogs/

charts/

filters/

widgets/

---

# Hooks

/hooks/

useInvoices

usePayments

useDashboard

useCashRegister

useBudgets

---

# Services Frontend

/services/

invoice.service.ts

payment.service.ts

cash.service.ts

budget.service.ts

report.service.ts

---

# Tests

/tests/

unit/

integration/

e2e/

performance/

security/

---

# Scripts

/scripts/

backup/

restore/

seed/

migration/

generate/

---

# Docker

/docker/

development/

production/

nginx/

postgres/

redis/

---

# CI/CD

.github/

workflows/

lint.yml

build.yml

test.yml

deploy.yml

---

# Convention de nommage

Dossiers

kebab-case

Exemple

school-fees

cash-register

student-accounts

---

Classes

PascalCase

Exemple

CreateInvoiceUseCase

PaymentRepository

---

Interfaces

Préfixe I

Exemple

IInvoiceRepository

IPaymentGateway

---

DTO

Suffixe Dto

Exemple

CreateInvoiceDto

---

UseCases

Suffixe UseCase

Exemple

RegisterPaymentUseCase

---

Repositories

Suffixe Repository

---

Events

Suffixe Event

---

Controllers

Suffixe Controller

---

Services

Suffixe Service

---

# Convention Git

main

develop

release

feature/*

bugfix/*

hotfix/*

---

# Convention Commit

feat:

fix:

docs:

style:

test:

refactor:

perf:

build:

ci:

---

# Qualité du code

ESLint

Prettier

Husky

Lint Staged

CommitLint

---

# Conclusion

Aucun développeur ni aucun agent IA ne doit modifier cette arborescence sans validation préalable.

Toute nouvelle fonctionnalité doit s'intégrer dans cette structure afin de préserver la cohérence, la maintenabilité et l'évolutivité du module Finance d'EduWeb Planner.
