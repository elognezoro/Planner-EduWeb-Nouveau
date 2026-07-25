# Gestion des Notifications et des Événements
## Module Finance – EduWeb Planner

Version : 1.0

---

# Objectif

Le sous-module **Notifications** assure la diffusion automatique des événements générés par l'ensemble des modules d'EduWeb Planner.

Il garantit que chaque acteur reçoive la bonne information :

- au bon moment ;
- par le bon canal ;
- avec le bon niveau de priorité.

---

# Vision

Toute action importante du système devient un événement.

Chaque événement peut générer une ou plusieurs notifications.

Le moteur de notifications fonctionne indépendamment des modules métiers.

---

# Architecture

Le système repose sur une architecture orientée événements.

Transaction

↓

Événement

↓

Bus d'événements

↓

Moteur de règles

↓

Notifications

↓

Historisation

---

# Sources d'événements

Le moteur reçoit des événements provenant de :

- Scolarité
- Facturation
- Encaissements
- Comptabilité
- Caisse
- Banque
- Achats
- Fournisseurs
- Stocks
- Immobilisations
- Budgets
- Dépenses
- Ressources Humaines
- Gouvernance
- Administration

---

# Types de notifications

Le système distingue :

## Information

Simple information.

---

## Alerte

Situation nécessitant une attention.

---

## Rappel

Action attendue.

---

## Validation

Demande d'approbation.

---

## Confirmation

Succès d'une opération.

---

## Incident

Erreur ou anomalie.

---

## Urgence

Notification prioritaire.

---

# Canaux

Le moteur peut utiliser :

- notification dans l'application ;
- e-mail ;
- SMS ;
- WhatsApp ;
- notification Push ;
- Microsoft Teams ;
- Slack ;
- Webhook.

Chaque établissement choisit les canaux autorisés.

---

# Priorités

- Faible
- Normale
- Haute
- Critique

Les priorités déterminent :

- le délai d'envoi ;
- les relances ;
- les escalades.

---

# Destinataires

Les notifications peuvent être envoyées :

- à un utilisateur ;
- à un rôle ;
- à un service ;
- à plusieurs établissements ;
- à toute une région ;
- au Ministère.

---

# Déclencheurs

Exemples :

## Finance

- facture créée ;
- paiement reçu ;
- paiement rejeté ;
- budget dépassé ;
- caisse clôturée.

---

## Achats

- demande validée ;
- commande créée ;
- réception effectuée.

---

## Stocks

- rupture de stock ;
- seuil minimum atteint ;
- inventaire à réaliser.

---

## Immobilisations

- maintenance à effectuer ;
- garantie expirant bientôt.

---

## Comptabilité

- clôture mensuelle ;
- écriture rejetée ;
- balance déséquilibrée.

---

# Modèles de messages

Chaque modèle comprend :

- UUID
- Code
- Langue
- Objet
- Corps
- Variables
- Canal
- Version

---

# Variables dynamiques

Exemples :

{{Nom}}

{{Prénom}}

{{Établissement}}

{{Montant}}

{{Facture}}

{{Date}}

{{Lien}}

{{CodeValidation}}

---

# Personnalisation

Chaque utilisateur peut choisir :

- les événements souhaités ;
- les canaux ;
- les horaires ;
- la langue.

---

# Regroupement

Le système peut :

- envoyer immédiatement ;
- regrouper plusieurs notifications ;
- envoyer un résumé quotidien ;
- envoyer un résumé hebdomadaire.

---

# Escalade

Si aucune action n'est réalisée :

Notification

↓

Relance

↓

Responsable

↓

Direction

↓

Administrateur

Les délais sont paramétrables.

---

# Accusé de réception

Le système peut suivre :

- envoyé ;
- distribué ;
- ouvert ;
- lu ;
- traité.

---

# Historique

Toutes les notifications sont historisées.

Le journal contient :

- date ;
- heure ;
- destinataire ;
- canal ;
- statut ;
- contenu ;
- événement d'origine.

---

# Centre de notifications

Chaque utilisateur dispose d'un espace personnel regroupant :

- notifications non lues ;
- notifications lues ;
- archives ;
- favoris.

---

# Préférences utilisateur

Chaque utilisateur peut définir :

- heures silencieuses ;
- jours de réception ;
- langue ;
- fréquence.

---

# Règles métier

## RM-1700

Chaque notification est liée à un événement métier.

---

## RM-1701

Une notification critique ne peut être supprimée avant traitement.

---

## RM-1702

Les notifications sont historisées pendant la durée définie par la politique de conservation.

---

## RM-1703

Les préférences utilisateur sont respectées, sauf pour les notifications critiques.

---

## RM-1704

Les relances automatiques cessent dès que l'action attendue est réalisée.

---

## RM-1705

Les notifications sont signées numériquement lorsqu'elles portent sur des décisions officielles.

---

# Tableau de bord

Le Responsable visualise :

- notifications envoyées ;
- notifications en attente ;
- taux d'ouverture ;
- délais moyens ;
- notifications critiques ;
- erreurs d'envoi.

---

# Alertes système

Le moteur détecte :

- serveur SMS indisponible ;
- quota dépassé ;
- webhook en erreur ;
- boîte mail inaccessible ;
- échec répété d'envoi.

---

# API principales

- Envoyer une notification
- Programmer une notification
- Annuler une notification
- Lire les notifications
- Marquer comme lue
- Archiver
- Supprimer
- Modifier les préférences
- Créer un modèle

---

# Cas d'erreur

## Destinataire introuvable

HTTP 404

---

## Canal indisponible

HTTP 503

---

## Modèle inexistant

HTTP 404

---

## Quota dépassé

HTTP 429

---

## Permission insuffisante

HTTP 403

---

# Tests fonctionnels

Le système devra vérifier :

✓ envoi multi-canal ;

✓ personnalisation ;

✓ accusés de réception ;

✓ escalade automatique ;

✓ regroupement ;

✓ historique complet ;

✓ respect des préférences.

---

# Indicateurs (KPI)

- Nombre de notifications envoyées
- Taux de livraison
- Taux d'ouverture
- Taux de lecture
- Temps moyen de traitement
- Nombre de relances
- Nombre d'incidents
- Satisfaction utilisateur
- Répartition par canal
- Volume quotidien

---

# Intelligence artificielle

Le moteur IA peut :

- choisir automatiquement le meilleur canal selon les habitudes du destinataire ;
- déterminer l'heure optimale d'envoi ;
- résumer plusieurs notifications en une seule ;
- détecter les notifications ignorées ;
- ajuster automatiquement les priorités selon le contexte ;
- proposer des formulations plus claires et plus adaptées au profil du destinataire.

Les recommandations de l'IA restent configurables et ne modifient jamais une notification réglementaire sans validation.

---

# Évolutions prévues

Le module devra intégrer :

- chatbot conversationnel ;
- assistants vocaux ;
- notifications géolocalisées ;
- traduction automatique multilingue ;
- diffusion sur écrans d'information ;
- intégration avec les réseaux sociaux institutionnels ;
- orchestration d'événements complexes via un moteur BPM.

---

# Conclusion

Le sous-module **Notifications** constitue le moteur de communication événementielle d'EduWeb Planner. Grâce à une architecture orientée événements, des canaux multiples, une personnalisation avancée et une intégration native avec l'ensemble des modules de la plateforme, il garantit une circulation fiable, sécurisée et traçable de l'information entre tous les acteurs de l'écosystème éducatif.
