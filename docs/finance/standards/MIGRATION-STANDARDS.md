---
title: EduWeb Migration Standards
version: 1.0
status: Official
category: Engineering Standards
code: STD-008
authors:
  - EduWeb Architecture Team
---

# MIGRATION-STANDARDS.md

> Référentiel officiel de gestion des migrations de base de données de l'écosystème EduWeb.

---

# Sommaire

1. Objectifs
2. Principes
3. Cycle de vie d'une migration
4. Convention de nommage
5. Gestion des versions
6. Environnements
7. Développement
8. Tests
9. Déploiement
10. Rollback
11. Zero Downtime
12. Migration des données
13. Seed
14. Contrôle qualité
15. Surveillance
16. Documentation
17. Anti-patterns
18. Checklist

---

# 1. Objectifs

Les migrations doivent permettre :

- l'évolution progressive du schéma ;
- la conservation des données ;
- un déploiement sécurisé ;
- un retour arrière maîtrisé ;
- une traçabilité complète.

Aucune migration ne doit compromettre la disponibilité du service.

---

# 2. Principes

Toutes les migrations sont :

- versionnées ;
- reproductibles ;
- idempotentes lorsque possible ;
- exécutées automatiquement par Prisma.

Les migrations sont considérées comme du code et suivent les mêmes exigences de qualité.

---

# 3. Cycle de vie d'une migration

Le cycle standard est le suivant :

```
Modification du modèle Prisma

↓

Validation locale

↓

Création de la migration

↓

Tests automatisés

↓

Validation en Preview

↓

Validation en Staging

↓

Déploiement Production

↓

Surveillance

↓

Archivage
```

Chaque étape est obligatoire.

---

# 4. Convention de nommage

Les migrations utilisent un nom explicite.

Exemples :

```
20260815_add_student_status

20260822_create_attendance_table

20260901_add_school_indexes
```

Éviter les noms génériques :

```
update

migration2

fix
```

---

# 5. Gestion des versions

Toutes les migrations sont conservées dans :

```
prisma/migrations/
```

Chaque migration possède :

- un identifiant ;
- une date ;
- une description.

Les migrations sont versionnées dans Git.

---

# 6. Environnements

Les migrations suivent toujours cet ordre :

```
Development

↓

Preview

↓

Staging

↓

Production
```

Une migration ne passe jamais directement en production.

---

# 7. Développement

Créer une migration avec :

```bash
npx prisma migrate dev --name add_student_status
```

Ne jamais modifier manuellement une migration déjà générée, sauf justification exceptionnelle validée en revue technique.

---

# 8. Tests

Avant toute mise en production :

- exécuter les tests unitaires ;
- exécuter les tests d'intégration ;
- vérifier les performances ;
- tester les données existantes.

Les migrations sont testées sur une copie représentative de la base de production.

---

# 9. Déploiement

En production :

```bash
npx prisma migrate deploy
```

Le déploiement est automatisé par la chaîne CI/CD.

Les migrations sont exécutées avant le déploiement de la nouvelle version applicative lorsque cela est compatible avec la stratégie retenue.

---

# 10. Rollback

Chaque migration critique possède une stratégie de retour arrière documentée.

Avant toute migration importante :

- vérifier les sauvegardes ;
- vérifier le Point-in-Time Recovery (PITR) ;
- documenter les impacts.

Le rollback ne doit jamais être improvisé.

---

# 11. Zero Downtime

Les migrations doivent limiter les interruptions de service.

Stratégies recommandées :

- ajouter avant de supprimer ;
- rendre les nouveaux champs optionnels dans un premier temps ;
- migrer les données progressivement ;
- supprimer les anciens champs uniquement après validation.

Exemple :

```
Étape 1

Ajouter la colonne

↓

Étape 2

Remplir les données

↓

Étape 3

Adapter l'application

↓

Étape 4

Supprimer l'ancienne colonne
```

---

# 12. Migration des données

Les transformations importantes utilisent des scripts dédiés.

Exemples :

- changement de structure ;
- fusion de colonnes ;
- recalcul d'informations ;
- migration de référentiels.

Ces scripts sont :

- testés ;
- versionnés ;
- documentés.

---

# 13. Seed

Les données d'initialisation sont gérées séparément.

```
prisma/seed.ts
```

Les seeds :

- sont idempotents ;
- ne modifient pas les données métier ;
- créent uniquement les références nécessaires.

---

# 14. Contrôle qualité

Chaque migration est vérifiée sur les points suivants :

- intégrité des données ;
- cohérence du schéma ;
- temps d'exécution ;
- impact sur les performances ;
- compatibilité applicative.

---

# 15. Surveillance

Après déploiement :

Surveiller :

- erreurs Prisma ;
- erreurs PostgreSQL ;
- temps des requêtes ;
- consommation CPU ;
- utilisation mémoire ;
- nombre de connexions ;
- taux d'échec des transactions.

Tout comportement anormal déclenche une analyse.

---

# 16. Documentation

Chaque migration importante est documentée.

La documentation comprend :

- objectif ;
- description ;
- impacts ;
- dépendances ;
- procédure de rollback ;
- validation effectuée.

---

# 17. Anti-patterns

Interdits :

❌ Modifier une migration déjà appliquée.

❌ Déployer sans sauvegarde.

❌ Exécuter une migration directement en production sans validation.

❌ Mélanger migration de schéma et logique métier.

❌ Supprimer immédiatement une colonne utilisée.

❌ Ignorer les performances.

❌ Renommer une table sans stratégie de transition.

❌ Effectuer une migration pendant un pic d'activité sans justification.

---

# 18. Checklist

Avant toute mise en production :

- [ ] Modèle Prisma validé.
- [ ] Migration générée.
- [ ] Tests réussis.
- [ ] Sauvegarde disponible.
- [ ] PITR vérifié.
- [ ] Validation Preview.
- [ ] Validation Staging.
- [ ] Documentation rédigée.
- [ ] Rollback documenté.
- [ ] Surveillance activée.

---

# Documents associés

- CLAUDE.md
- PRISMA-STANDARDS.md
- NEON-STANDARDS.md
- DATABASE-STANDARDS.md
- DEPLOYMENT-STANDARDS.md
- CICD-STANDARDS.md

---

# Fin du document
