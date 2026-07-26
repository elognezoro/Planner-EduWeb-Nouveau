---
title: Button Components
code: UX-102-02
version: 1.0
status: Reference
author: EduWeb Enterprise Architecture
parent: UX-102
category: UI Components
---

# UX-102-02 — Button Components

> Référentiel officiel des boutons d'EduWeb Planner.

---

# Sommaire

1. Objectifs
2. Principes UX
3. Anatomie
4. États
5. Variantes
6. Tailles
7. Icônes
8. Boutons IA
9. Boutons critiques
10. Boutons flottants
11. Groupes de boutons
12. Responsive
13. Accessibilité
14. Animations
15. API
16. Bonnes pratiques
17. Anti-patterns
18. KPI
19. Règles métier

---

# 1. Objectifs

Le bouton constitue le principal composant d'action de l'interface.

Chaque bouton doit permettre à l'utilisateur de comprendre immédiatement :

- ce qu'il va faire ;
- si l'action est importante ;
- si elle est irréversible ;
- si elle nécessite une confirmation.

---

# 2. Principes UX

Les boutons doivent respecter les principes suivants :

- une seule action principale par écran ;
- libellé explicite ;
- retour visuel immédiat ;
- taille adaptée aux écrans tactiles ;
- cohérence graphique.

---

# 3. Anatomie

```
┌────────────────────────────┐

Icone

Libellé

Indicateur de chargement

└────────────────────────────┘
```

Un bouton comprend :

- conteneur ;
- texte ;
- icône (optionnelle) ;
- indicateur de chargement ;
- zone tactile.

---

# 4. États

Tous les boutons implémentent :

```
Default

Hover

Focus

Pressed

Loading

Disabled

Success

Error
```

---

## Default

État normal.

---

## Hover

Le fond est légèrement accentué.

---

## Focus

Contour visible.

Navigation clavier.

---

## Pressed

Effet visuel court.

---

## Loading

Le texte est remplacé par un indicateur.

Exemple :

```
Enregistrement...

○○○
```

---

## Disabled

Aucune interaction possible.

---

## Success

Confirmation immédiate.

---

## Error

Affichage si l'action échoue.

---

# 5. Variantes

## Primary

Action principale.

Exemples :

- Enregistrer
- Valider
- Publier

---

## Secondary

Action complémentaire.

Exemples :

- Retour
- Modifier
- Prévisualiser

---

## Outline

Action peu prioritaire.

---

## Ghost

Très discrète.

Utilisée dans les tableaux.

---

## Link

Apparence d'un lien.

---

## Success

Validation.

---

## Warning

Action sensible.

---

## Danger

Suppression.

Couleur rouge.

Confirmation obligatoire.

---

## AI

Interaction avec le Copilot.

Couleur officielle IA.

---

# 6. Tailles

| Taille | Hauteur |
|----------|---------:|
| XS | 24 px |
| SM | 32 px |
| MD | 40 px |
| LG | 48 px |
| XL | 56 px |

Largeur :

- automatique ;
- pleine largeur ;
- personnalisée.

---

# 7. Icônes

Les icônes renforcent la compréhension.

Exemples :

💾 Enregistrer

➕ Ajouter

🗑 Supprimer

✏ Modifier

📄 Exporter

🤖 Demander au Copilot

Une icône seule n'est autorisée que si sa signification est universelle.

---

# 8. Boutons IA

Les boutons IA possèdent une identité visuelle spécifique.

Exemples :

- Générer avec l'IA
- Optimiser
- Résumer
- Traduire
- Vérifier
- Expliquer
- Comparer

Chaque bouton IA affiche :

- le niveau de confiance (si pertinent) ;
- une explication accessible ;
- un indicateur de traitement.

---

# 9. Boutons critiques

Les actions suivantes nécessitent une confirmation :

- supprimer définitivement ;
- clôturer un exercice ;
- publier des résultats ;
- valider une décision administrative ;
- lancer une paie.

Flux recommandé :

```
Bouton

↓

Confirmation

↓

Validation

↓

Exécution

↓

Historique
```

---

# 10. Boutons flottants (FAB)

Utilisation limitée.

Exemples :

- Ajouter
- Nouveau document
- Nouveau message

Un seul bouton flottant est autorisé par écran.

---

# 11. Groupes de boutons

Ordre recommandé :

```
Secondaire

↓

Annuler

↓

Enregistrer

↓

Valider
```

Le bouton principal est toujours placé à droite (ou en bas sur mobile, selon les conventions retenues).

---

# 12. Responsive

Sur smartphone :

- largeur minimale tactile de 44 px ;
- espacement suffisant ;
- possibilité de pleine largeur.

Les boutons secondaires peuvent être regroupés dans un menu.

---

# 13. Accessibilité

Tous les boutons doivent :

- être atteignables au clavier ;
- posséder un libellé lisible ;
- disposer d'un focus visible ;
- respecter les contrastes WCAG AA ;
- avoir une zone tactile suffisante.

---

# 14. Animations

Durée maximale :

300 ms.

Animations autorisées :

- fondu ;
- légère élévation ;
- progression ;
- changement d'état.

Aucune animation décorative ne doit gêner l'utilisateur.

---

# 15. API (exemple conceptuel)

```typescript
UiButton {
    variant:
        primary
        secondary
        outline
        danger
        ai

    size:
        xs
        sm
        md
        lg
        xl

    disabled
    loading
    icon
    fullWidth
    onClick
}
```

---

# 16. Bonnes pratiques

✔ Utiliser un verbe d'action.

✔ Une seule action principale.

✔ Désactiver pendant le traitement.

✔ Afficher une confirmation après succès.

✔ Respecter les variantes officielles.

---

# 17. Anti-patterns

✘ Plusieurs boutons primaires sur un même écran.

✘ Texte ambigu :

```
OK

Continuer

Faire
```

Préférer :

```
Enregistrer

Publier

Envoyer

Valider
```

✘ Boutons trop petits.

✘ Couleurs non officielles.

✘ Absence d'état "Loading".

---

# Diagramme Mermaid

```mermaid
stateDiagram-v2

[*] --> Default

Default --> Hover

Hover --> Pressed

Pressed --> Loading

Loading --> Success

Loading --> Error

Success --> Default

Error --> Default
```

---

# KPI

| KPI | Objectif |
|------|----------|
|Temps moyen d'identification de l'action principale|< 2 s|
|Temps de réponse visuelle|< 100 ms|
|Compatibilité clavier|100 %|
|Compatibilité tactile|100 %|
|Respect du Design System|100 %|

---

# Règles métier

## RM-UX10202-001

Un écran ne comporte qu'un seul bouton principal.

---

## RM-UX10202-002

Toute action destructive utilise la variante **Danger**.

---

## RM-UX10202-003

Toute action longue affiche un état **Loading**.

---

## RM-UX10202-004

Les boutons IA utilisent exclusivement la variante **AI**.

---

## RM-UX10202-005

Les boutons critiques nécessitent une confirmation explicite avant exécution.

---

# Documents liés

- UX-101 — Design System
- UX-102-01 — Input Components
- UX-102-03 — Selection Components
- UX-104 — Accessibility
- UX-108 — Ergonomic Guide

---

# Fin du document
