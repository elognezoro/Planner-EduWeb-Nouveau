---
title: EduWeb Testing Standards
version: 1.0
status: Official
category: Engineering Standards
code: STD-019
authors:
  - EduWeb Architecture Team
---

# TESTING-STANDARDS.md

> Référentiel officiel de la stratégie de tests de l'écosystème EduWeb.

---

# Sommaire

1. Objectifs
2. Principes
3. Stratégie globale
4. Pyramide des tests
5. Tests unitaires
6. Tests d'intégration
7. Tests End-to-End (E2E)
8. Tests de performance
9. Tests de sécurité
10. Tests d'accessibilité
11. Tests de régression
12. Jeux de données
13. Couverture de code
14. Automatisation
15. Environnements de test
16. Mocking et Stubs
17. Gestion des anomalies
18. Critères de validation
19. Anti-patterns
20. Checklist

---

# 1. Objectifs

Les tests garantissent :

- la qualité du logiciel ;
- la stabilité des fonctionnalités ;
- la sécurité des évolutions ;
- la réduction des régressions ;
- la confiance dans les déploiements.

Aucune fonctionnalité critique ne doit être livrée sans tests.

---

# 2. Principes

La stratégie de tests repose sur :

- Test Early ;
- Test Often ;
- Automatisation maximale ;
- Reproductibilité ;
- Indépendance des tests ;
- Documentation des scénarios.

Les tests sont considérés comme une partie intégrante du code.

---

# 3. Stratégie globale

Chaque fonctionnalité suit la chaîne suivante :

```
Développement

↓

Tests unitaires

↓

Tests d'intégration

↓

Tests End-to-End

↓

Tests de sécurité

↓

Tests de performance

↓

Validation

↓

Déploiement
```

---

# 4. Pyramide des tests

Répartition recommandée :

```
        E2E
         ▲
      Intégration
         ▲
      Unitaires
```

Objectif :

- 70 % de tests unitaires ;
- 20 % de tests d'intégration ;
- 10 % de tests E2E.

---

# 5. Tests unitaires

Les tests unitaires vérifient une unité de code isolée.

Exemples :

- Domain Services ;
- Value Objects ;
- fonctions utilitaires ;
- règles métier ;
- calculateurs.

Ils doivent être :

- rapides ;
- indépendants ;
- déterministes.

---

# 6. Tests d'intégration

Ils vérifient les interactions entre composants.

Exemples :

- Services ↔ Repositories ;
- Prisma ↔ Base de données ;
- API ↔ Services ;
- Authentification ↔ RBAC.

Les dépendances réelles sont privilégiées lorsque cela est pertinent.

---

# 7. Tests End-to-End (E2E)

Ils reproduisent le parcours réel d'un utilisateur.

Exemples :

### Élève

- connexion ;
- consultation de l'emploi du temps ;
- consultation des notes.

### Enseignant

- connexion ;
- saisie des notes ;
- validation.

### Chef d'établissement

- génération de l'emploi du temps ;
- publication ;
- export PDF.

Les scénarios critiques doivent être couverts.

---

# 8. Tests de performance

Mesurer notamment :

- temps de réponse ;
- nombre de requêtes ;
- consommation mémoire ;
- consommation CPU ;
- montée en charge.

Des objectifs (SLO) doivent être définis pour les fonctionnalités critiques.

---

# 9. Tests de sécurité

Les campagnes de tests incluent :

- contrôle RBAC ;
- authentification ;
- validation des entrées ;
- tests d'injection ;
- contrôle des permissions ;
- protection CSRF ;
- protection XSS.

Les vulnérabilités critiques bloquent la mise en production.

---

# 10. Tests d'accessibilité

Les interfaces doivent respecter les bonnes pratiques WCAG.

Contrôler notamment :

- navigation clavier ;
- contraste ;
- libellés ;
- focus ;
- lecteurs d'écran.

L'accessibilité est vérifiée automatiquement et manuellement.

---

# 11. Tests de régression

À chaque évolution :

- les anciens scénarios critiques sont rejoués ;
- les corrections de bugs disposent d'un test dédié.

Un bug corrigé ne doit jamais réapparaître.

---

# 12. Jeux de données

Les jeux de données de test sont :

- réalistes ;
- anonymisés ;
- reproductibles ;
- versionnés.

Ils couvrent notamment :

- écoles ;
- classes ;
- enseignants ;
- élèves ;
- emplois du temps ;
- évaluations.

---

# 13. Couverture de code

Objectifs minimaux :

| Élément | Couverture |
|---------|-----------:|
| Domaine | ≥ 95 % |
| Services | ≥ 90 % |
| Repositories | ≥ 80 % |
| API | ≥ 80 % |
| Global | ≥ 85 % |

La couverture n'est pas une fin en soi : la pertinence des tests prime.

---

# 14. Automatisation

Les tests sont exécutés automatiquement :

- à chaque Pull Request ;
- avant chaque fusion ;
- avant chaque déploiement.

Un échec bloque le pipeline CI/CD.

---

# 15. Environnements de test

Environnements distincts :

- développement ;
- intégration ;
- recette ;
- préproduction ;
- production.

Les données de production ne sont jamais utilisées directement pour les tests.

---

# 16. Mocking et Stubs

Utiliser des mocks uniquement lorsque nécessaire.

Exemples :

- services externes ;
- passerelles de paiement ;
- services d'e-mail ;
- notifications.

Les règles métier ne doivent pas être testées exclusivement avec des mocks.

---

# 17. Gestion des anomalies

Toute anomalie documente :

- le contexte ;
- les étapes de reproduction ;
- le résultat attendu ;
- le résultat observé ;
- le niveau de criticité.

Chaque correction est accompagnée d'un nouveau test.

---

# 18. Critères de validation

Une fonctionnalité est considérée comme validée lorsque :

- les tests unitaires passent ;
- les tests d'intégration passent ;
- les tests E2E passent ;
- les tests de sécurité sont satisfaisants ;
- les performances respectent les objectifs ;
- la revue de code est approuvée.

---

# 19. Anti-patterns

Interdits :

❌ Tester uniquement l'interface utilisateur.

❌ Dépendre de l'ordre d'exécution des tests.

❌ Utiliser des données non déterministes.

❌ Ignorer les tests intermittents.

❌ Désactiver un test sans justification.

❌ Corriger un bug sans créer un test associé.

❌ Considérer la couverture de code comme unique indicateur de qualité.

---

# 20. Checklist

Avant toute mise en production :

- [ ] Tests unitaires exécutés.
- [ ] Tests d'intégration validés.
- [ ] Tests E2E validés.
- [ ] Tests de sécurité réussis.
- [ ] Tests de performance conformes.
- [ ] Tests d'accessibilité réalisés.
- [ ] Couverture minimale atteinte.
- [ ] Régression vérifiée.
- [ ] Jeux de données mis à jour.
- [ ] Documentation de test actualisée.

---

# Documents associés

- BACKEND-STANDARDS.md
- API-STANDARDS.md
- SECURITY-STANDARDS.md
- RBAC-STANDARDS.md
- PERFORMANCE-STANDARDS.md
- CICD-STANDARDS.md
- GITHUB-STANDARDS.md

---

# Fin du document
