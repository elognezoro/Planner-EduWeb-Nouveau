---
title: EduWeb Authentication Standards
version: 1.0
status: Official
category: Engineering Standards
code: STD-017
authors:
  - EduWeb Architecture Team
---

# AUTH-STANDARDS.md

> Référentiel officiel de l'authentification des utilisateurs de l'écosystème EduWeb.

---

# Sommaire

1. Objectifs
2. Principes
3. Architecture d'authentification
4. Gestion des identités
5. Types d'authentification
6. Sessions
7. Gestion des mots de passe
8. Authentification multifacteur (MFA)
9. Single Sign-On (SSO)
10. OAuth2 / OpenID Connect
11. Gestion des appareils
12. Gestion des comptes
13. Cycle de vie d'une session
14. Déconnexion
15. Protection contre les attaques
16. Journalisation
17. Conformité
18. Anti-patterns
19. Checklist

---

# 1. Objectifs

L'authentification doit garantir :

- l'identification fiable des utilisateurs ;
- la confidentialité des comptes ;
- la protection contre les accès non autorisés ;
- une expérience utilisateur fluide ;
- la traçabilité des connexions.

---

# 2. Principes

L'authentification repose sur les principes suivants :

- Zero Trust ;
- Least Privilege ;
- Security by Design ;
- Privacy by Design ;
- Secure by Default.

L'authentification répond à la question :

> **Qui est l'utilisateur ?**

L'autorisation (RBAC) répond à la question :

> **Que peut-il faire ?**

Ces deux mécanismes sont indépendants.

---

# 3. Architecture d'authentification

Architecture de référence :

```
Utilisateur

↓

Login

↓

Validation

↓

Authentification

↓

Création de session

↓

RBAC

↓

Accès aux ressources
```

Aucune ressource protégée n'est accessible avant authentification.

---

# 4. Gestion des identités

Chaque utilisateur possède un identifiant unique.

Exemples :

- Administrateur système
- Directeur général
- Directeur régional
- Chef d'établissement
- Censeur
- Éducateur
- Enseignant
- Personnel administratif
- Élève
- Parent
- Inspecteur
- Super Administrateur

Un compte est personnel.

Le partage de compte est interdit.

---

# 5. Types d'authentification

EduWeb peut supporter plusieurs méthodes :

### Authentification classique

- identifiant
- mot de passe

### Authentification institutionnelle

Exemples :

- Ministère
- Université
- Google Workspace
- Microsoft Entra ID

### OAuth2

Pour les partenaires.

### OpenID Connect

Pour les fournisseurs d'identité.

---

# 6. Sessions

Les sessions sont :

- sécurisées ;
- limitées dans le temps ;
- invalidables.

Les cookies sont :

- HttpOnly ;
- Secure ;
- SameSite=Lax ou Strict selon le contexte.

Les informations sensibles ne sont jamais stockées côté navigateur.

---

# 7. Gestion des mots de passe

Les mots de passe sont :

- hachés ;
- salés ;
- jamais réversibles.

Politique recommandée :

- longueur minimale : 12 caractères ;
- combinaison de plusieurs catégories de caractères ;
- interdiction des mots de passe compromis ;
- interdiction de réutiliser les derniers mots de passe.

Les mots de passe ne transitent jamais en clair dans les journaux.

---

# 8. Authentification multifacteur (MFA)

Le MFA est obligatoire pour les profils sensibles.

Exemples :

- Super Administrateur ;
- Administrateur ;
- Direction générale ;
- Gestion financière.

Facteurs possibles :

- application d'authentification (TOTP) ;
- clé matérielle compatible FIDO2/WebAuthn ;
- notification push.

L'utilisation du SMS comme second facteur est déconseillée lorsque des alternatives plus robustes sont disponibles.

---

# 9. Single Sign-On (SSO)

Le SSO permet un accès unique à plusieurs applications EduWeb.

Exemple :

```
Connexion

↓

Identity Provider

↓

Planner

↓

Governance

↓

Booking

↓

Family

↓

E-School
```

L'utilisateur s'authentifie une seule fois.

---

# 10. OAuth2 / OpenID Connect

Utiliser les flux adaptés au contexte.

Exemples :

- Authorization Code + PKCE pour les applications web ;
- Client Credentials pour les intégrations serveur à serveur.

Les jetons :

- sont signés ;
- ont une durée de vie limitée ;
- sont renouvelables via Refresh Token lorsque nécessaire.

---

# 11. Gestion des appareils

Chaque appareil peut être enregistré.

Informations possibles :

- navigateur ;
- système ;
- localisation approximative ;
- dernière activité.

L'utilisateur peut consulter et révoquer les appareils autorisés.

---

# 12. Gestion des comptes

Fonctionnalités minimales :

- création ;
- activation ;
- désactivation ;
- verrouillage ;
- réinitialisation du mot de passe ;
- changement de mot de passe ;
- récupération sécurisée.

Les comptes inactifs peuvent être désactivés selon la politique de sécurité.

---

# 13. Cycle de vie d'une session

Une session suit les étapes suivantes :

```
Connexion

↓

Validation

↓

Création

↓

Utilisation

↓

Renouvellement éventuel

↓

Expiration

↓

Suppression
```

Les sessions expirées ne sont jamais réactivées.

---

# 14. Déconnexion

La déconnexion :

- détruit la session ;
- invalide les jetons si applicable ;
- efface les informations sensibles côté client.

Une déconnexion globale de tous les appareils doit être disponible pour les utilisateurs.

---

# 15. Protection contre les attaques

Les mécanismes suivants sont obligatoires :

- limitation des tentatives de connexion ;
- temporisation progressive après plusieurs échecs ;
- protection CSRF lorsque nécessaire ;
- protection XSS ;
- protection contre les attaques par force brute ;
- surveillance des connexions inhabituelles.

Les connexions suspectes peuvent déclencher une authentification renforcée.

---

# 16. Journalisation

Journaliser notamment :

- connexion réussie ;
- échec de connexion ;
- changement de mot de passe ;
- activation du MFA ;
- désactivation du MFA ;
- verrouillage du compte ;
- récupération de compte ;
- déconnexion.

Les journaux ne doivent jamais contenir :

- mots de passe ;
- secrets ;
- jetons d'accès.

---

# 17. Conformité

L'authentification doit respecter :

- les politiques internes d'EduWeb ;
- les exigences légales applicables ;
- les bonnes pratiques de sécurité reconnues.

Les données personnelles sont traitées conformément aux réglementations en vigueur.

---

# 18. Anti-patterns

Interdits :

❌ Mot de passe stocké en clair.

❌ Jeton JWT sans expiration.

❌ Cookies non sécurisés.

❌ Session infinie.

❌ Secrets dans le code source.

❌ Authentification sans HTTPS.

❌ Réponses révélant si un identifiant existe ou non.

❌ Réinitialisation de mot de passe sans vérification d'identité.

---

# 19. Checklist

Avant la mise en production :

- [ ] Authentification HTTPS uniquement.
- [ ] Cookies sécurisés configurés.
- [ ] Sessions expirables.
- [ ] Hachage robuste des mots de passe.
- [ ] MFA activé pour les comptes sensibles.
- [ ] Limitation des tentatives de connexion.
- [ ] Journalisation conforme.
- [ ] Déconnexion complète fonctionnelle.
- [ ] Tests d'intrusion réalisés.
- [ ] Documentation mise à jour.

---

# Documents associés

- SECURITY-STANDARDS.md
- RBAC-STANDARDS.md
- API-STANDARDS.md
- BACKEND-STANDARDS.md
- LOGGING-STANDARDS.md
- OBSERVABILITY-STANDARDS.md

---

# Fin du document
