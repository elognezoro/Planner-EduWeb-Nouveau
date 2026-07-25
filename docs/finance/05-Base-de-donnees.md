# Architecture de la Base de Données
## Module Finance – EduWeb Planner

Version : 1.0

---

# Objectif

Définir le modèle de données officiel du module Finance.

Toutes les bases de données générées par Claude Code devront respecter cette architecture.

Le modèle est conçu pour :

- PostgreSQL
- Prisma ORM
- Multi-tenant
- Multi-exercice
- Multi-établissements
- Multi-devises
- Conforme OHADA

---

# Principes de conception

La base de données repose sur les principes suivants :

- Normalisation jusqu'à la 3NF (minimum)
- UUID comme clé primaire
- Suppression logique (Soft Delete)
- Historisation
- Auditabilité
- Performance
- Évolutivité

---

# Convention de nommage

## Tables

snake_case

Exemple :

student_accounts

school_fees

bank_accounts

accounting_entries

---

## Colonnes

snake_case

Exemple

created_at

updated_at

deleted_at

school_id

user_id

---

## Clés primaires

Toutes les tables utilisent :

id UUID PRIMARY KEY

---

## Colonnes obligatoires

Chaque table contient au minimum :

id

created_at

updated_at

deleted_at

created_by

updated_by

tenant_id

school_id

academic_year_id

---

# Découpage des domaines

La base est organisée en domaines fonctionnels.

Configuration

Scolarité

Facturation

Paiements

Comptabilité

Banques

Caisses

Achats

Stocks

Ventes

Budgets

Immobilisations

Rapports

Audit

Notifications

IA

---

# Domaine Configuration

Tables :

currencies

countries

banks

payment_methods

school_settings

financial_years

chart_of_accounts

taxes

cost_centers

departments

approval_workflows

numbering_sequences

---

# Domaine Élèves

Tables :

students

student_accounts

student_balances

student_discounts

student_scholarships

student_payment_plans

student_guardians

student_enrollments

---

# Domaine Frais

Tables :

fee_categories

fee_types

school_fees

fee_items

fee_deadlines

fee_penalties

fee_exemptions

fee_templates

---

# Domaine Facturation

Tables :

invoices

invoice_items

invoice_adjustments

invoice_discounts

invoice_histories

credit_notes

debit_notes

refund_requests

---

# Domaine Encaissements

Tables :

payments

payment_items

payment_allocations

payment_attempts

payment_receipts

payment_cancellations

payment_refunds

payment_sessions

---

# Domaine Caisses

Tables :

cash_registers

cash_sessions

cash_transactions

cash_closings

cash_variances

cash_transfers

---

# Domaine Banques

Tables :

bank_accounts

bank_transactions

bank_reconciliations

bank_statements

bank_transfers

bank_fees

---

# Domaine Comptabilité

Tables :

accounts

journal_entries

journal_lines

ledgers

balances

trial_balances

general_ledger

closing_entries

opening_entries

fiscal_periods

---

# Domaine Fournisseurs

Tables :

suppliers

supplier_contacts

supplier_categories

supplier_contracts

supplier_balances

---

# Domaine Achats

Tables :

purchase_requests

purchase_orders

purchase_order_items

purchase_receipts

purchase_invoices

purchase_returns

purchase_payments

---

# Domaine Stocks

Tables :

warehouses

stock_locations

stock_items

stock_entries

stock_outputs

stock_adjustments

stock_movements

stock_inventories

stock_alerts

---

# Domaine Articles

Tables :

products

product_categories

product_prices

product_images

product_variants

product_barcodes

sales

sales_items

sales_returns

---

# Domaine Budgets

Tables :

budgets

budget_lines

budget_versions

budget_revisions

budget_allocations

budget_consumptions

budget_alerts

---

# Domaine Immobilisations

Tables :

assets

asset_categories

asset_locations

asset_movements

asset_depreciations

asset_disposals

asset_maintenance

---

# Domaine Rapports

Tables :

report_templates

scheduled_reports

report_exports

dashboard_snapshots

---

# Domaine Audit

Tables :

audit_logs

user_sessions

login_history

security_events

change_history

---

# Domaine Notifications

Tables :

notifications

notification_templates

notification_queue

notification_logs

sms_logs

email_logs

---

# Domaine IA

Tables :

ai_predictions

ai_recommendations

ai_alerts

ai_models

---

# Relations principales

Student

↓

StudentAccount

↓

Invoice

↓

InvoiceItem

↓

PaymentAllocation

↓

Payment

↓

Receipt

↓

AccountingEntry

↓

Dashboard

---

# Cardinalités

Un étudiant

↓

Plusieurs factures

Une facture

↓

Plusieurs lignes

Une facture

↓

Plusieurs paiements

Un paiement

↓

Plusieurs écritures comptables

Un fournisseur

↓

Plusieurs commandes

Une commande

↓

Plusieurs articles

---

# Contraintes

Toutes les clés étrangères utilisent

ON UPDATE CASCADE

La suppression physique est interdite.

Les suppressions logiques utilisent :

deleted_at

deleted_by

---

# Index obligatoires

Toutes les colonnes suivantes doivent être indexées :

school_id

tenant_id

academic_year_id

student_id

invoice_id

payment_id

supplier_id

created_at

status

reference

---

# Index composites

Exemples

(school_id, academic_year_id)

(student_id, status)

(invoice_id, status)

(created_at, school_id)

---

# Vues SQL

Le système doit créer automatiquement plusieurs vues.

Exemples :

vw_student_balance

vw_cash_balance

vw_bank_balance

vw_budget_execution

vw_stock_value

vw_dashboard

vw_receivables

vw_payables

---

# Matérialisation

Certaines vues doivent être matérialisées.

Exemple :

Dashboard

Statistiques

KPI

Prévisions IA

---

# Archivage

Les données anciennes ne sont jamais supprimées.

Après clôture d'un exercice :

↓

Archivage logique

↓

Lecture seule

---

# Sauvegardes

Sauvegarde quotidienne

Sauvegarde hebdomadaire

Sauvegarde mensuelle

Sauvegarde annuelle

Les restaurations doivent être possibles par :

- établissement
- exercice
- table
- enregistrement

---

# Partitionnement

Les tables volumineuses utilisent un partitionnement par :

année

ou

exercice comptable

Exemple :

payments_2026

payments_2027

---

# Performances

Objectifs :

Recherche d'un élève

< 300 ms

Paiement

< 1 seconde

Tableau de bord

< 2 secondes

Rapport annuel

< 10 secondes

---

# Sécurité

Toutes les données sont filtrées automatiquement par :

tenant_id

school_id

academic_year_id

Aucune requête ne peut retourner des données appartenant à un autre établissement.

---

# Évolutivité

Le modèle doit permettre l'ajout futur de nouveaux modules sans modifier les tables existantes.

Les nouvelles fonctionnalités doivent privilégier :

- de nouvelles tables ;
- de nouvelles relations ;
- de nouveaux événements.

---

# Conclusion

Le présent document constitue la référence officielle du modèle de données du module Finance.

Toutes les migrations Prisma, les schémas PostgreSQL et les APIs devront respecter strictement cette architecture.

Toute évolution future devra préserver la compatibilité avec ce modèle afin de garantir la stabilité et la pérennité de la plateforme EduWeb Planner.
