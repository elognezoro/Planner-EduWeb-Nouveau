---
title: EduWeb Neon Standards
version: 1.0
status: Official
category: Engineering Standards
code: STD-006
authors:
  - EduWeb Architecture Team
---

# NEON-STANDARDS.md

> Référentiel officiel d'utilisation de Neon PostgreSQL dans l'écosystème EduWeb.

---

# Sommaire

1. Philosophie
2. Architecture cible
3. Organisation des environnements
4. Branching
5. Connection Pooling
6. Sécurité
7. Sauvegardes
8. Point-in-Time Recovery
9. Performances
10. Optimisation des coûts
11. Observabilité
12. Intégration Prisma
13. Intégration Vercel
14. Gestion des migrations
15. Gestion des incidents
16. Bonnes pratiques
17. Anti-patterns
18. Checklist

---

# 1. Philosophie

Neon est la base de données officielle de tous les produits EduWeb.

Objectifs :

- haute disponibilité ;
- élasticité ;
- simplicité d'exploitation ;
- sécurité ;
- faible coût ;
- évolutivité.

Toutes les applications EduWeb utilisent une architecture **serverless PostgreSQL**.

---

# 2. Architecture cible

```
Utilisateur

↓

Next.js 15

↓

Server Actions

↓

Prisma ORM

↓

Neon PostgreSQL

↓

Storage
```

Aucun accès direct à Neon depuis le navigateur.

---

# 3. Organisation des environnements

Chaque environnement possède son propre projet Neon.

```
Development

↓

Preview

↓

Staging

↓

Production
```

Les bases de données ne sont jamais partagées.

Chaque environnement possède :

- son URL ;
- ses secrets ;
- ses sauvegardes.

---

# 4. Branching

Le Branching Neon est utilisé pour :

- développement de fonctionnalités ;
- validation QA ;
- tests de migration ;
- démonstrations.

Exemple :

```
Production

├── release-2026.09

├── feature-import

├── feature-reporting

└── hotfix-auth
```

Une branche est supprimée après fusion.

---

# 5. Connection Pooling

Toutes les connexions utilisent le pool Neon.

Éviter :

- ouverture répétée de connexions ;
- connexions persistantes inutiles.

Toujours réutiliser le client Prisma.

---

# 6. Sécurité

Les identifiants de connexion sont stockés uniquement dans les variables d'environnement.

Exemple :

```
DATABASE_URL

DIRECT_URL
```

Interdictions :

- mot de passe dans le code ;
- URL de connexion dans Git ;
- partage de secrets.

Toutes les connexions utilisent TLS.

---

# 7. Sauvegardes

La restauration doit pouvoir être réalisée sans perte majeure.

Politique recommandée :

- sauvegarde continue ;
- vérification régulière ;
- test de restauration trimestriel.

Les procédures de restauration sont documentées.

---

# 8. Point-in-Time Recovery (PITR)

Le PITR est activé sur tous les environnements critiques.

Objectifs :

- restauration après erreur humaine ;
- récupération après incident ;
- limitation de la perte de données.

Le temps maximal de perte de données (RPO) est défini par les exigences métier.

---

# 9. Performances

Toujours :

- indexer les colonnes critiques ;
- limiter les scans complets ;
- surveiller les requêtes lentes ;
- analyser les plans d'exécution.

Les requêtes doivent rester prévisibles.

---

# 10. Optimisation des coûts

Bonnes pratiques :

- supprimer les branches inutilisées ;
- limiter les environnements temporaires ;
- optimiser les requêtes coûteuses ;
- archiver les données anciennes.

Les ressources sont adaptées à la charge réelle.

---

# 11. Observabilité

Surveiller :

- nombre de connexions ;
- temps de réponse ;
- consommation CPU ;
- stockage ;
- erreurs SQL ;
- temps des requêtes.

Les alertes sont configurées sur les indicateurs critiques.

---

# 12. Intégration Prisma

Prisma est le seul client autorisé.

Toutes les migrations passent par :

```
prisma migrate
```

Toutes les requêtes utilisent :

```
Prisma Client
```

Le SQL brut est exceptionnel.

---

# 13. Intégration Vercel

Chaque environnement Vercel pointe vers l'environnement Neon correspondant.

```
Preview → Preview Database

Production → Production Database
```

Les variables d'environnement sont gérées dans Vercel.

---

# 14. Gestion des migrations

Avant toute migration :

- sauvegarde vérifiée ;
- tests automatisés exécutés ;
- validation sur environnement Preview.

Les migrations sont appliquées en production uniquement après validation.

---

# 15. Gestion des incidents

En cas d'incident :

1. identifier l'origine ;
2. isoler le problème ;
3. restaurer si nécessaire ;
4. vérifier l'intégrité des données ;
5. documenter l'incident.

Chaque incident majeur fait l'objet d'un retour d'expérience.

---

# 16. Bonnes pratiques

✓ Utiliser le Branching pour les développements.

✓ Activer le PITR.

✓ Utiliser le Connection Pooling.

✓ Séparer les environnements.

✓ Surveiller les performances.

✓ Tester régulièrement les restaurations.

✓ Utiliser Prisma exclusivement.

---

# 17. Anti-patterns

Interdits :

❌ Base unique pour tous les environnements.

❌ Secrets dans Git.

❌ SQL brut systématique.

❌ Branche de développement conservée indéfiniment.

❌ Migrations non testées.

❌ Accès direct depuis le navigateur.

❌ Requêtes sans index sur les grandes tables.

---

# 18. Checklist

Avant chaque mise en production :

- [ ] Sauvegarde vérifiée.
- [ ] Migration testée.
- [ ] Branche Neon validée.
- [ ] Variables d'environnement contrôlées.
- [ ] Performances mesurées.
- [ ] Alertes opérationnelles.
- [ ] Documentation mise à jour.
- [ ] Rollback documenté.

---

# Documents associés

- CLAUDE.md
- PRISMA-STANDARDS.md
- DATABASE-STANDARDS.md
- MIGRATION-STANDARDS.md
- DEPLOYMENT-STANDARDS.md

---

# Fin du document
