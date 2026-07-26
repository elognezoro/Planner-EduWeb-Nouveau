---
title: EduWeb Feature Template
version: 1.0
status: Official
category: Engineering Templates
code: STD-032
authors:
  - EduWeb Architecture Team
---

# FEATURE-TEMPLATE.md

> Modèle officiel de spécification d'une fonctionnalité de l'écosystème EduWeb.

---

# Sommaire

1. Identification
2. Résumé
3. Contexte
4. Objectifs
5. Parties prenantes
6. Règles métier
7. Cas d'utilisation
8. Exigences fonctionnelles
9. Exigences non fonctionnelles
10. Modèle de données
11. Architecture technique
12. Interfaces utilisateur
13. API concernées
14. Sécurité
15. Performance
16. Journalisation
17. Observabilité
18. Accessibilité
19. Internationalisation
20. Gestion des erreurs
21. Tests
22. Déploiement
23. Documentation
24. Critères d'acceptation
25. Checklist

---

# 1. Identification

| Champ | Valeur |
|--------|---------|
| Nom de la fonctionnalité | |
| Code | FEAT-XXX |
| Module | |
| Version | |
| Priorité | Critique / Haute / Moyenne / Faible |
| Statut | Draft / Review / Approved / Implemented |
| Responsable | |
| Date | |

---

# 2. Résumé

Décrire en quelques paragraphes :

- le besoin ;
- la fonctionnalité ;
- la valeur apportée.

---

# 3. Contexte

Décrire :

- le contexte métier ;
- les difficultés actuelles ;
- les limites existantes ;
- les motivations du projet.

---

# 4. Objectifs

## Objectif principal

...

---

## Objectifs secondaires

- ...
- ...
- ...

---

# 5. Parties prenantes

| Acteur | Rôle |
|---------|------|
| Élève | |
| Enseignant | |
| Chef d'établissement | |
| Administrateur | |
| Parent | |
| Direction | |

Ajouter les acteurs spécifiques si nécessaire.

---

# 6. Règles métier

Décrire toutes les règles.

Exemple :

```
Un enseignant ne peut être affecté simultanément à deux cours sur le même créneau horaire.
```

Chaque règle reçoit un identifiant.

```
BR-001

BR-002

BR-003
```

---

# 7. Cas d'utilisation

## UC-001

Nom :

Objectif :

Acteur :

Préconditions :

Déroulement principal :

Scénarios alternatifs :

Résultat attendu :

---

## UC-002

...

---

# 8. Exigences fonctionnelles

Chaque exigence reçoit un identifiant.

```
FR-001

FR-002

FR-003
```

Exemple :

```
FR-001

Le système doit permettre la génération automatique d'un emploi du temps.
```

---

# 9. Exigences non fonctionnelles

Lister notamment :

- disponibilité ;
- sécurité ;
- performances ;
- accessibilité ;
- compatibilité ;
- maintenabilité.

Exemple :

```
NFR-001

Temps de génération inférieur à 5 secondes.
```

---

# 10. Modèle de données

Identifier :

- nouvelles tables ;
- nouvelles colonnes ;
- relations ;
- index ;
- contraintes.

Exemple :

```
Timetable

Lesson

TimeSlot

Conflict
```

Indiquer les impacts Prisma.

---

# 11. Architecture technique

Décrire les composants impliqués.

Exemple :

```
UI

↓

Server Component

↓

Server Action

↓

Application Service

↓

Domain Service

↓

Repository

↓

Prisma

↓

Neon PostgreSQL
```

Identifier les responsabilités de chaque couche.

---

# 12. Interfaces utilisateur

Lister les écrans concernés.

Exemple :

| Écran | Action |
|--------|--------|
| Dashboard | |
| Liste | |
| Création | |
| Modification | |
| Consultation | |

Ajouter les maquettes si disponibles.

---

# 13. API concernées

Lister :

| Méthode | Endpoint | Description |
|----------|----------|-------------|
| GET | | |
| POST | | |
| PUT | | |
| DELETE | | |

Documenter :

- paramètres ;
- réponses ;
- erreurs.

---

# 14. Sécurité

Identifier :

- rôles autorisés ;
- permissions ;
- validation ;
- protection CSRF ;
- authentification ;
- autorisations RBAC.

Référencer :

```
AUTH-STANDARDS.md

RBAC-STANDARDS.md

SECURITY-STANDARDS.md
```

---

# 15. Performance

Préciser :

- temps de réponse attendu ;
- volume de données ;
- pagination ;
- cache ;
- optimisation SQL.

Exemple :

```
Temps maximal :

300 ms
```

---

# 16. Journalisation

Décrire :

- événements journalisés ;
- niveau des logs ;
- informations enregistrées.

Exemple :

```
INFO

Nouvel emploi du temps créé.
```

---

# 17. Observabilité

Identifier :

Métriques :

- ...

Logs :

- ...

Traces :

- ...

Alertes :

- ...

---

# 18. Accessibilité

Vérifier :

- navigation clavier ;
- contraste ;
- labels ;
- lecteurs d'écran ;
- WCAG.

---

# 19. Internationalisation

Lister les textes.

Exemple :

```
fr

en
```

Prévoir les clés de traduction.

---

# 20. Gestion des erreurs

Identifier :

- erreurs métier ;
- erreurs techniques ;
- validations.

Exemple :

```
TIMETABLE_CONFLICT
```

Décrire :

- message utilisateur ;
- journalisation ;
- récupération.

---

# 21. Tests

## Tests unitaires

...

---

## Tests d'intégration

...

---

## Tests E2E

...

---

## Tests de performance

...

---

## Tests de sécurité

...

---

# 22. Déploiement

Préciser :

- migration Prisma ;
- Feature Flag ;
- impact production ;
- rollback ;
- dépendances.

---

# 23. Documentation

Documents à mettre à jour :

- README
- API
- ADR
- Guides utilisateur
- Changelog
- Documentation technique

---

# 24. Critères d'acceptation

Chaque critère reçoit un identifiant.

```
AC-001

AC-002

AC-003
```

Exemple :

```
AC-001

Un utilisateur autorisé peut créer un emploi du temps sans erreur.
```

Tous les critères doivent être testables.

---

# 25. Checklist

## Fonctionnel

- [ ] Cas d'utilisation documentés
- [ ] Règles métier validées
- [ ] Exigences fonctionnelles complètes

## Technique

- [ ] Architecture définie
- [ ] Base de données documentée
- [ ] API documentées

## Qualité

- [ ] Tests définis
- [ ] Performance validée
- [ ] Sécurité validée
- [ ] Accessibilité vérifiée

## Documentation

- [ ] README mis à jour
- [ ] ADR créés
- [ ] Changelog mis à jour

## Déploiement

- [ ] Migration prête
- [ ] Rollback documenté
- [ ] Feature Flag configuré

---

# Documents associés

- MODULE-TEMPLATE.md
- API-TEMPLATE.md
- PAGE-TEMPLATE.md
- ARCHITECTURE-STANDARDS.md
- DDD-STANDARDS.md
- SECURITY-STANDARDS.md
- TESTING-STANDARDS.md
- DOCUMENTATION-STANDARDS.md

---

# Fin du document
