# Module Finance
## EduWeb Planner

**Version :** 1.0.0

**Projet :** EduWeb Planner

**Auteur :** EdTech EduWeb

**Statut :** Spécifications fonctionnelles de référence

---

# Présentation

Le module **Finance** d'EduWeb Planner constitue le système d'information financier des établissements scolaires.

Il permet d'assurer une gestion complète des opérations financières, depuis la création des frais de scolarité jusqu'à la production des états financiers, en passant par les encaissements, la comptabilité générale, les achats, les stocks, les ventes, les budgets, les immobilisations et les tableaux de bord décisionnels.

Le module est conçu pour fonctionner aussi bien dans un établissement unique que dans un réseau d'établissements, une direction régionale, un diocèse, une congrégation ou un ministère.

---

# Vision

Construire le système financier scolaire le plus complet d'Afrique francophone.

Le module doit permettre à tout établissement scolaire de gérer intégralement ses finances sans avoir recours à un logiciel comptable externe.

Toutes les opérations doivent être :

- sécurisées ;
- traçables ;
- auditables ;
- automatisées ;
- conformes aux normes comptables nationales et OHADA ;
- adaptées aux établissements publics, privés, confessionnels et techniques.

---

# Objectifs

Le module doit permettre :

- la gestion de la scolarité ;
- la gestion des créances élèves ;
- la gestion des paiements ;
- la gestion des caisses ;
- la gestion bancaire ;
- la comptabilité générale ;
- la comptabilité analytique ;
- la gestion des achats ;
- la gestion des fournisseurs ;
- la gestion des ventes annexes ;
- la gestion des stocks ;
- la gestion des immobilisations ;
- la préparation budgétaire ;
- le suivi de trésorerie ;
- les prévisions financières ;
- les statistiques décisionnelles.

---

# Public cible

Le module est destiné notamment à :

- Écoles maternelles
- Écoles primaires
- Collèges
- Lycées
- Lycées techniques
- Centres de formation professionnelle
- Universités
- Grandes écoles
- CAFOP
- Écoles confessionnelles
- Réseaux d'établissements

---

# Utilisateurs

Le module est utilisé par :

- Directeur
- Promoteur
- Gestionnaire
- Comptable
- Caissier
- Économe
- Éducateur
- Secrétaire
- Parent d'élève
- Élève (consultation)
- Auditeur
- Commissaire aux comptes
- Inspecteur
- Administrateur EduWeb

---

# Fonctionnalités couvertes

Le module comprend les sous-modules suivants :

- Paramétrage financier
- Gestion des frais
- Facturation
- Encaissements
- Comptabilité
- Gestion des caisses
- Gestion bancaire
- Budgets
- Dépenses
- Fournisseurs
- Achats
- Stocks
- Articles à vendre
- Immobilisations
- Rapports
- Tableaux de bord
- Audit
- Intelligence artificielle

---

# Fonctionnalités exclues

Les fonctionnalités suivantes sont prises en charge par d'autres modules EduWeb Planner :

- Gestion pédagogique
- Emplois du temps
- Vie scolaire
- Bulletins
- Examens
- Bibliothèque
- Ressources humaines

Le module Finance s'y connecte mais ne les remplace pas.

---

# Principes directeurs

## Une seule source de vérité

Chaque information financière est enregistrée une seule fois.

Toutes les autres informations sont calculées automatiquement.

---

## Zéro ressaisie

Une opération ne doit jamais être saisie plusieurs fois.

Exemple :

Un paiement élève met automatiquement à jour :

- son compte client ;
- la caisse ;
- les écritures comptables ;
- les statistiques ;
- la trésorerie ;
- le tableau de bord.

---

## Traçabilité totale

Toutes les opérations doivent conserver :

- auteur
- date
- heure
- adresse IP
- appareil utilisé
- ancienne valeur
- nouvelle valeur

Aucune suppression physique n'est autorisée.

---

## Automatisation maximale

Le système doit automatiser :

- les écritures comptables ;
- les reçus ;
- les factures ;
- les relances ;
- les pénalités ;
- les statistiques ;
- les tableaux de bord ;
- les rapports.

---

## Multi-établissements

Le système doit permettre à un même utilisateur de gérer plusieurs établissements.

Chaque établissement possède :

- ses caisses ;
- ses comptes bancaires ;
- son plan comptable ;
- ses exercices ;
- ses budgets.

---

## Multi-pays

Le système doit fonctionner dans tous les pays africains.

Les paramètres suivants doivent être configurables :

- devise ;
- fiscalité ;
- plan comptable ;
- calendrier scolaire ;
- banque centrale ;
- moyens de paiement.

---

## Multi-devises

Le système doit supporter :

- FCFA BCEAO
- FCFA BEAC
- Euro
- Dollar
- Livre sterling

Les taux sont historisés.

---

# Architecture documentaire

La documentation du module est organisée comme suit :

00-README.md

01-Vision.md

02-Architecture.md

03-Regles-Metier.md

04-Profils.md

05-Base-de-donnees.md

06-Scolarite.md

07-Facturation.md

08-Encaissements.md

09-Caisse.md

10-Banque.md

11-Comptabilite.md

12-Achats.md

13-Fournisseurs.md

14-Budget.md

15-Stocks.md

16-Articles.md

17-Immobilisations.md

18-Rapports.md

19-Tableaux-de-bord.md

20-IA.md

21-Notifications.md

22-API.md

23-UseCases.md

24-UML.md

25-BPMN.md

26-ERD.md

27-Ecrans.md

28-Tests.md

29-CLAUDE.md

---

# Technologies cibles

Backend

- Node.js
- NestJS

Frontend

- React
- Next.js
- TypeScript

Base de données

- PostgreSQL

ORM

- Prisma

Cache

- Redis

Recherche

- PostgreSQL Full Text Search

Stockage

- S3 compatible

Authentification

- JWT
- OAuth2
- MFA

Déploiement

- Docker
- Kubernetes

---

# Convention documentaire

Chaque fichier Markdown devra contenir les sections suivantes :

- Objectifs
- Périmètre
- Définitions
- Acteurs
- Cas d'utilisation
- Règles métier
- Écrans
- Données
- API
- Sécurité
- Contraintes techniques
- Tests
- Critères d'acceptation

Cette structure garantit une documentation homogène, exploitable directement par Claude Code.

---

# Conclusion

Le présent référentiel constitue la documentation officielle du module Finance d'EduWeb Planner.

Tout développement devra être conforme aux exigences décrites dans cette documentation.

En cas de divergence entre le code et la documentation, la documentation fait foi jusqu'à sa mise à jour officielle.

---

> **Note d'implémentation EduWeb Planner** (hors spécification, ajoutée par l'équipe technique) :
> les exigences FONCTIONNELLES de ce référentiel sont implémentées dans la stack actuelle et
> NON NÉGOCIABLE du projet (cf. CLAUDE.md à la racine) : monolithe Next.js App Router + Server
> Actions (pas de backend NestJS séparé), Auth.js/NextAuth v5 (pas de JWT/OAuth2 dédiés),
> PostgreSQL Neon + Prisma, stockage Vercel Blob (équivalent S3), déploiement Vercel (pas de
> Docker/Kubernetes). La section « Technologies cibles » ci-dessus est lue comme une liste
> d'ÉQUIVALENCES, pas comme une exigence de migration.
