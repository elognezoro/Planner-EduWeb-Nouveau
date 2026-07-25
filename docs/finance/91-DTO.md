# Data Transfer Objects (DTO)
## Architecture Backend – EduWeb Planner

Version : 1.0

---

# Objectif

Le présent document définit les standards de conception des **Data Transfer Objects (DTO)** utilisés dans l'ensemble d'EduWeb Planner.

Les DTO assurent :

- la validation des données entrantes ;
- la transformation des données ;
- la documentation des API ;
- la cohérence des échanges ;
- la sécurité des traitements.

Tous les modules doivent respecter ces conventions.

---

# Architecture

Client

↓

Request DTO

↓

Validation

↓

Controller

↓

Service

↓

Repository

↓

Entity

↓

Response DTO

↓

Client

---

# Convention de nommage

Les DTO utilisent les suffixes suivants :

CreateStudentDto

UpdateStudentDto

DeleteStudentDto

StudentResponseDto

StudentSummaryDto

StudentFilterDto

StudentSearchDto

StudentImportDto

StudentExportDto

PagedStudentResponseDto

---

# Organisation

src/

modules/

students/

dto/

create-student.dto.ts

update-student.dto.ts

student-response.dto.ts

student-filter.dto.ts

student-search.dto.ts

student-summary.dto.ts

index.ts

---

# DTO de création

Convention

Create<Entity>Dto

Exemples :

CreateInvoiceDto

CreateSupplierDto

CreateBudgetDto

CreateAssetDto

---

# DTO de mise à jour

Convention

Update<Entity>Dto

Basé sur PartialType.

Exemple

UpdateStudentDto

UpdateTeacherDto

UpdateBudgetDto

---

# DTO de suppression

Lorsque nécessaire

Delete<Entity>Dto

Contient :

UUID

motif

validation

---

# DTO de réponse

Convention

<Entity>ResponseDto

Exemple

StudentResponseDto

BudgetResponseDto

InvoiceResponseDto

Ils ne contiennent jamais :

- mot de passe ;
- token ;
- clé privée ;
- données sensibles non autorisées.

---

# DTO résumé

Convention

<Entity>SummaryDto

Utilisé dans :

listes

autocomplete

widgets

tableaux

---

# DTO de recherche

Convention

<Entity>SearchDto

Exemple

nom

prénom

email

statut

établissement

---

# DTO de filtre

Convention

<Entity>FilterDto

Utilisé pour :

date

statut

région

tenant

service

---

# DTO de pagination

PaginationDto

Contient :

page

pageSize

sort

search

fields

include

---

# DTO paginé

PagedResponseDto<T>

Contient :

items

page

pageSize

total

totalPages

metadata

---

# DTO d'import

ImportStudentDto

ImportTeacherDto

ImportBudgetDto

ImportAssetDto

---

# DTO d'export

ExportStudentDto

ExportInvoiceDto

ExportBudgetDto

Formats :

Excel

CSV

PDF

JSON

---

# Validation

Tous les DTO utilisent :

class-validator

class-transformer

---

# Règles de validation

Texte

@IsString()

---

UUID

@IsUUID()

---

Date

@IsDateString()

---

Email

@IsEmail()

---

Montant

@IsNumber()

---

Entier

@IsInt()

---

Booléen

@IsBoolean()

---

Enum

@IsEnum()

---

Liste

@IsArray()

---

Objet

@ValidateNested()

---

Optionnel

@IsOptional()

---

Transformation

Utiliser :

@Type()

@Transform()

pour :

dates

objets

collections

---

Documentation

Tous les champs utilisent :

@ApiProperty()

@ApiPropertyOptional()

afin d'alimenter automatiquement Swagger/OpenAPI.

---

Exemple

Chaque propriété documentée précise :

- description ;
- exemple ;
- caractère obligatoire ;
- format ;
- valeur par défaut (le cas échéant).

---

DTO génériques

Le framework fournit :

BaseDto

BaseResponseDto

PaginationDto

PagedResponseDto

AuditDto

AttachmentDto

GeoLocationDto

MoneyDto

AddressDto

ContactDto

---

AuditDto

Contient :

createdAt

updatedAt

createdBy

updatedBy

deletedAt

deletedBy

version

---

MoneyDto

Contient :

montant

devise

tauxChange

montantConverti

---

AddressDto

Contient :

pays

ville

commune

quartier

adresse

codePostal

coordonnéesGPS

---

ContactDto

Contient :

nom

fonction

email

téléphone

mobile

---

Relations

Les DTO utilisent :

UUID

plutôt que des objets complets

afin de limiter le volume des échanges.

---

Mapping

Le mapping entre Entity et DTO est réalisé par :

Mapper

Assembler

ou AutoMapper

selon les choix techniques du projet.

---

Versionnement

Chaque évolution incompatible crée une nouvelle version du DTO.

Exemple :

CreateInvoiceDtoV2

InvoiceResponseDtoV2

---

Sécurité

Les DTO :

interdisent les champs inconnus ;

refusent les données malformées ;

limitent les tailles maximales ;

empêchent les injections.

---

Règles métier

## RM-2000

Toutes les données entrantes transitent par un DTO.

---

## RM-2001

Aucun Controller ne reçoit directement une Entity.

---

## RM-2002

Les DTO sont immuables pendant le traitement.

---

## RM-2003

Les champs sensibles ne sont jamais exposés dans les DTO de réponse.

---

## RM-2004

Toutes les validations sont exécutées avant l'appel au Service.

---

## RM-2005

Les DTO sont documentés automatiquement dans OpenAPI.

---

Tests

Le système devra vérifier :

✓ validation ;

✓ transformation ;

✓ sérialisation ;

✓ désérialisation ;

✓ documentation Swagger ;

✓ pagination ;

✓ filtres ;

✓ sécurité.

---

Indicateurs (KPI)

- Temps moyen de validation
- Nombre d'erreurs de validation
- Taux de conformité des requêtes
- Taille moyenne des DTO
- Nombre de DTO documentés
- Couverture des tests

---

Évolutions prévues

Le système devra intégrer :

- validation conditionnelle avancée ;
- DTO générés automatiquement à partir du schéma Prisma lorsque cela est pertinent ;
- validation JSON Schema ;
- compatibilité GraphQL Input Types ;
- compatibilité gRPC Protobuf ;
- génération de SDK TypeScript, Kotlin et Swift à partir des spécifications OpenAPI.

---

# Conclusion

Les **Data Transfer Objects (DTO)** constituent le contrat officiel d'échange des données d'EduWeb Planner. Ils garantissent des API cohérentes, sécurisées, documentées et évolutives, tout en assurant une séparation claire entre les modèles de persistance et les données exposées aux applications clientes.
