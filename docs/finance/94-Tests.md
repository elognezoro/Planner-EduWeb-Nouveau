# Stratégie de Tests
## Assurance Qualité – EduWeb Planner

Version : 1.0

---

# Objectif

Le présent document définit la stratégie de tests de l'ensemble de la plateforme EduWeb Planner.

Les objectifs sont :

- garantir la qualité logicielle ;
- prévenir les régressions ;
- sécuriser les mises en production ;
- assurer la conformité fonctionnelle ;
- améliorer la maintenabilité.

Les tests sont intégrés dès la conception (Shift Left Testing).

---

# Principes

La stratégie repose sur :

- Test First lorsque pertinent ;
- Intégration Continue (CI) ;
- Livraison Continue (CD) ;
- Automatisation maximale ;
- Traçabilité des exigences ;
- Amélioration continue.

---

# Pyramide des tests

```
                Tests Exploratoires
             -------------------------
             Tests d'Acceptation (UAT)
          -------------------------------
          Tests End-to-End (E2E)
      ---------------------------------------
          Tests d'Intégration
-----------------------------------------------
            Tests Unitaires
```

Objectif de répartition :

- Tests unitaires : 70 %
- Tests d'intégration : 20 %
- Tests E2E : 10 %

---

# Types de tests

## Tests unitaires

Objectif :

Tester une unité de code indépendamment.

Exemples :

- Service
- Helper
- Validator
- Mapper
- Calcul métier

Outils recommandés :

- Jest
- Vitest (frontend)

---

## Tests d'intégration

Objectif :

Vérifier les interactions entre composants.

Exemples :

- API ↔ Base de données
- API ↔ Cache
- API ↔ Files de messages
- API ↔ IA

---

## Tests End-to-End

Objectif :

Tester un scénario complet.

Exemples :

- Inscription d'un élève
- Paiement de frais
- Validation d'un budget
- Génération d'un rapport

Outils recommandés :

- Playwright
- Cypress

---

## Tests API

Objectif :

Valider :

- endpoints ;
- statuts HTTP ;
- sécurité ;
- pagination ;
- validation ;
- performances.

---

## Tests de sécurité

Vérifier :

- authentification ;
- autorisation ;
- MFA ;
- injections ;
- XSS ;
- CSRF ;
- SSRF ;
- Prompt Injection ;
- Rate Limiting.

---

## Tests de performance

Mesurer :

- temps de réponse ;
- débit ;
- montée en charge ;
- stabilité.

Outils :

- k6
- JMeter

---

## Tests de charge

Simuler :

- 100 utilisateurs
- 1 000 utilisateurs
- 10 000 utilisateurs
- pics de connexion

---

## Tests de résilience

Vérifier :

- redémarrage des services ;
- indisponibilité de la base ;
- perte réseau ;
- reprise automatique.

---

## Tests de reprise

Valider :

- restauration des sauvegardes ;
- PRA ;
- PCA.

---

## Tests IA

Contrôler :

- qualité des réponses ;
- citations RAG ;
- respect des permissions ;
- reproductibilité ;
- hallucinations critiques ;
- temps de réponse.

---

## Tests mobiles

Tester :

- Android
- iOS
- mode hors ligne
- synchronisation

---

## Tests d'accessibilité

Conformité WCAG 2.1 AA :

- navigation clavier ;
- lecteurs d'écran ;
- contraste ;
- focus ;
- alternatives textuelles.

---

# Jeux de données

Les environnements utilisent :

- données fictives ;
- jeux anonymisés ;
- données volumineuses ;
- cas limites.

Aucune donnée personnelle réelle n'est utilisée hors des environnements autorisés.

---

# Environnements

- Développement
- Intégration
- Recette
- Préproduction
- Production

Les environnements sont isolés.

---

# Critères d'acceptation

Une fonctionnalité est livrable lorsque :

- exigences couvertes ;
- tests unitaires validés ;
- tests d'intégration validés ;
- E2E validés ;
- revue de code approuvée ;
- documentation mise à jour ;
- vulnérabilités critiques corrigées.

---

# Couverture de code

Objectifs minimaux :

- Lignes : ≥ 85 %
- Fonctions : ≥ 90 %
- Branches : ≥ 80 %

Les modules critiques visent une couverture supérieure.

---

# CI/CD

À chaque livraison :

1. Analyse statique
2. Compilation
3. Tests unitaires
4. Tests d'intégration
5. Analyse sécurité
6. Build
7. Déploiement en préproduction
8. Tests E2E
9. Validation
10. Déploiement en production

---

# Analyse statique

Outils recommandés :

- ESLint
- SonarQube
- Prisma Validate
- Dependabot

---

# Revue de code

Chaque Merge Request comprend :

- revue technique ;
- revue sécurité ;
- revue métier si nécessaire.

---

# Gestion des anomalies

Cycle :

Détection

↓

Qualification

↓

Correction

↓

Validation

↓

Clôture

Chaque anomalie reçoit :

- priorité ;
- gravité ;
- responsable ;
- échéance.

---

# Matrice de traçabilité

Chaque exigence est reliée à :

- User Story
- Cas de test
- Résultat
- Version

---

# Automatisation

Objectif :

Automatiser au minimum :

- 90 % des tests unitaires ;
- 80 % des tests API ;
- 70 % des scénarios E2E critiques.

---

# Tests de non-régression

Exécutés :

- avant chaque livraison ;
- après correction d'un incident majeur ;
- avant les montées de version.

---

# Journal des tests

Chaque exécution enregistre :

- date ;
- version ;
- environnement ;
- durée ;
- résultats ;
- anomalies.

---

# Règles métier

## RM-2300

Aucun déploiement en production sans validation des tests critiques.

---

## RM-2301

Toute anomalie critique bloque la mise en production.

---

## RM-2302

Les scénarios métier prioritaires sont couverts par des tests automatisés.

---

## RM-2303

Les données de test respectent les politiques de confidentialité.

---

## RM-2304

Chaque incident corrigé donne lieu à un test de non-régression.

---

# KPI

- Couverture de code
- Taux de réussite des tests
- Nombre d'anomalies critiques
- Temps moyen de correction (MTTR)
- Temps moyen entre deux incidents (MTBF)
- Taux d'automatisation
- Durée moyenne d'une campagne de tests
- Nombre de régressions détectées
- Disponibilité des environnements de test

---

# Évolutions prévues

Le dispositif devra intégrer :

- génération automatique de cas de tests par IA ;
- auto-réparation des tests fragiles ;
- tests visuels automatisés ;
- chaos engineering ;
- mutation testing ;
- analyse prédictive des risques de régression.

---

# Conclusion

La stratégie de tests d'EduWeb Planner garantit une qualité logicielle durable en combinant automatisation, contrôle continu et validation métier. Elle constitue un pilier essentiel de la fiabilité, de la sécurité et de l'évolutivité de la plateforme.
