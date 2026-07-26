---
title: Internationalization Standards
version: 1.0
status: Official
category: Enterprise Architecture
code: STD-050
authors:
  - EduWeb Architecture Team
---

# INTERNATIONALIZATION-STANDARDS.md

> Standard officiel de conception, de développement et de gouvernance du multilinguisme (i18n) et de la localisation (l10n) des plateformes EduWeb.

---

# Sommaire

1. Objectif
2. Champ d'application
3. Définitions
4. Principes
5. Architecture
6. Langues supportées
7. Organisation des traductions
8. Formats régionaux
9. Localisation
10. Interface utilisateur
11. Contenus métiers
12. API
13. Base de données
14. Intelligence Artificielle
15. Performance
16. Sécurité
17. Qualité
18. Anti-patterns
19. Checklist
20. Documents associés

---

# 1. Objectif

L'internationalisation permet à l'ensemble des plateformes EduWeb d'être utilisées dans plusieurs langues sans modifier le code métier.

Les objectifs sont :

- faciliter le déploiement international ;
- améliorer l'expérience utilisateur ;
- réduire les coûts de maintenance ;
- garantir une architecture évolutive ;
- favoriser l'inclusion linguistique.

---

# 2. Champ d'application

Le présent standard s'applique à :

- EduWeb Planner ;
- EduWeb Governance ;
- EduWeb Family ;
- EduWeb Booking ;
- E-School EduWeb ;
- applications mobiles ;
- Progressive Web Apps ;
- API publiques ;
- documentation.

---

# 3. Définitions

## Internationalization (i18n)

Conception permettant d'ajouter de nouvelles langues sans modifier l'application.

---

## Localization (l10n)

Adaptation des contenus à une langue ou à une culture donnée.

---

## Locale

Ensemble composé de :

- langue ;
- région ;
- conventions locales.

Exemples :

```
fr-CI

fr-FR

en-US

en-GB

pt-BR

ar-SA
```

---

## Resource Bundle

Ensemble des fichiers de traduction.

---

# 4. Principes

Le système respecte les principes suivants :

- séparation des textes et du code ;
- extensibilité ;
- cohérence terminologique ;
- prise en charge Unicode ;
- adaptation culturelle ;
- performance.

---

# 5. Architecture

```text
Application

↓

Locale Resolver

↓

Translation Service

↓

Resource Bundles

↓

UI Components
```

Le changement de langue ne nécessite aucune recompilation.

---

# 6. Langues supportées

### Langues prioritaires

- Français
- Anglais

---

### Langues secondaires

- Portugais
- Espagnol
- Arabe

---

### Extensions futures

- Swahili
- Bambara
- Baoulé
- Dioula
- Lingala
- Ewé

Les nouvelles langues doivent être ajoutées sans modifier l'architecture.

---

# 7. Organisation des traductions

Les traductions sont regroupées par domaine fonctionnel.

Exemple :

```text
/locales

    /fr

        common.json

        auth.json

        planner.json

        governance.json

    /en

        common.json

        auth.json

        planner.json

        governance.json
```

Les clés sont stables et indépendantes de leur traduction.

---

# 8. Formats régionaux

Les formats sont adaptés automatiquement selon la locale.

### Dates

```
25/07/2026

July 25, 2026

2026-07-25
```

---

### Heures

```
08:30

8:30 AM
```

---

### Nombres

```
1 234 567,89

1,234,567.89
```

---

### Devises

Les montants sont affichés selon la devise et la convention locale.

Exemples :

- Franc CFA (XOF)
- Euro (EUR)
- Dollar américain (USD)

---

# 9. Localisation

La localisation concerne également :

- fuseaux horaires ;
- calendrier scolaire ;
- jours fériés ;
- unités de mesure ;
- formats d'adresse ;
- formats téléphoniques.

Les paramètres sont configurables par pays.

---

# 10. Interface utilisateur

Les composants doivent :

- accepter des textes de longueur variable ;
- supporter les écritures de droite à gauche (RTL) lorsque nécessaire ;
- éviter les dimensions fixes dépendantes de la langue.

Les icônes doivent rester compréhensibles quelle que soit la langue.

---

# 11. Contenus métiers

Les données métiers peuvent être :

### Traduites

Exemple :

- intitulés de menus ;
- messages système ;
- documentation.

---

### Non traduites

Exemple :

- noms d'établissements ;
- noms de personnes ;
- références administratives.

La stratégie est définie pour chaque type de contenu.

---

# 12. API

Les API prennent en charge :

```http
Accept-Language: fr-CI
```

ou

```http
Accept-Language: en-US
```

Les messages retournés sont localisés lorsque cela est pertinent.

---

# 13. Base de données

Les textes multilingues sont stockés selon une stratégie adaptée.

Exemple :

```text
Resource

↓

Translation

↓

Locale

↓

Value
```

Les identifiants métiers restent indépendants de la langue.

---

# 14. Intelligence Artificielle

L'IA peut assister :

- la traduction ;
- la reformulation ;
- l'adaptation culturelle ;
- la détection d'incohérences terminologiques.

Les traductions critiques sont validées avant publication.

---

# 15. Performance

Objectifs :

| Élément | Cible |
|----------|------:|
| Chargement des traductions | < 100 ms |
| Changement de langue | < 500 ms |
| Cache des ressources | Actif |
| Compression | Activée |

Les fichiers de traduction sont mis en cache.

---

# 16. Sécurité

Les traductions sont considérées comme du contenu applicatif.

Les protections suivantes sont appliquées :

- validation des fichiers ;
- contrôle des droits ;
- signature des versions officielles ;
- audit des modifications.

Les utilisateurs ne peuvent modifier que les langues autorisées.

---

# 17. Qualité

Chaque version linguistique fait l'objet de contrôles :

- cohérence terminologique ;
- absence de clés manquantes ;
- conformité fonctionnelle ;
- affichage sur tous les terminaux.

Les revues impliquent des locuteurs compétents.

---

# 18. Anti-patterns

Les pratiques suivantes sont interdites :

- textes codés en dur dans les composants ;
- concaténation de chaînes traduites ;
- duplication inutile des traductions ;
- mélange de plusieurs langues dans une même interface ;
- utilisation d'images contenant du texte traduisible.

---

# 19. Checklist

## Architecture

- [ ] Translation Service
- [ ] Locale Resolver
- [ ] Resource Bundles

### Interface

- [ ] Textes externalisés
- [ ] Support RTL
- [ ] Responsive

### Fonctionnel

- [ ] Formats régionaux
- [ ] API localisées
- [ ] Documentation traduite

### Qualité

- [ ] Validation linguistique
- [ ] Tests automatisés
- [ ] Audit

---

# 20. Documents associés

## Standards fondamentaux

- STD-013 — ARCHITECTURE-STANDARDS
- STD-019 — FRONTEND-STANDARDS
- STD-034 — UI-STANDARDS
- STD-040 — ENGINEERING-HANDBOOK

## Standards Enterprise

- STD-041 — MULTI-TENANCY-STANDARDS
- STD-042 — AUDIT-STANDARDS
- STD-045 — SEARCH-STANDARDS
- STD-046 — NOTIFICATION-STANDARDS
- STD-048 — AI-STANDARDS
- STD-049 — ACCESSIBILITY-STANDARDS

---

# Historique des versions

| Version | Date | Auteur | Description |
|---------:|------|--------|-------------|
| 1.0 | 2026 | EduWeb Architecture Team | Première version officielle |

---

# Fin du document
