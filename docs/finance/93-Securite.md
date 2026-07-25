# Architecture de Sécurité
## EduWeb Planner

Version : 1.0

---

# Objectif

Le présent document définit la politique de sécurité de la plateforme EduWeb Planner.

Il couvre :

- l'authentification ;
- l'autorisation ;
- la protection des données ;
- la sécurité des API ;
- la sécurité des applications ;
- la sécurité des infrastructures ;
- la cybersurveillance ;
- l'audit ;
- la continuité d'activité.

La sécurité est appliquée selon le principe **Security by Design**.

---

# Principes

La sécurité repose sur les principes suivants :

- Zero Trust
- Least Privilege
- Defense in Depth
- Privacy by Design
- Secure by Default
- Fail Secure
- Principle of Least Knowledge

---

# Architecture

Utilisateur

↓

Authentification

↓

Autorisation

↓

API Gateway

↓

Services

↓

Base de données

↓

Journalisation

↓

Audit

↓

Supervision

---

# Authentification

Le système supporte :

- Email + mot de passe
- OAuth2
- OpenID Connect
- LDAP
- Active Directory
- SAML 2.0
- Single Sign-On (SSO)
- Authentification biométrique (mobile)

---

# Authentification multifacteur (MFA)

Le MFA peut utiliser :

- TOTP
- SMS
- Email
- Clé matérielle FIDO2/WebAuthn
- Application d'authentification

Le MFA est obligatoire pour les profils sensibles.

---

# Gestion des mots de passe

Les mots de passe doivent :

- contenir au moins 12 caractères ;
- comporter majuscules, minuscules, chiffres et caractères spéciaux ;
- être stockés sous forme de hachage sécurisé (Argon2id recommandé, bcrypt en compatibilité) ;
- ne jamais être réutilisés selon la politique définie ;
- pouvoir être réinitialisés via un processus sécurisé.

---

# Sessions

Chaque session possède :

- identifiant unique ;
- date de création ;
- date d'expiration ;
- adresse IP ;
- appareil ;
- navigateur ;
- géolocalisation approximative (si autorisée).

---

# Gestion des appareils

Le système peut mémoriser les appareils de confiance.

Toute nouvelle connexion peut déclencher :

- une vérification MFA ;
- une notification ;
- une validation supplémentaire.

---

# Autorisation

Le système applique :

- RBAC (Role-Based Access Control) ;
- ABAC (Attribute-Based Access Control) ;
- Multi-Tenant.

Les permissions sont vérifiées sur chaque requête.

---

# Cloisonnement des données

Chaque établissement constitue un tenant logique.

Un utilisateur ne peut accéder qu'aux données autorisées de son tenant, sauf autorisation explicite (par exemple pour des fonctions de supervision nationale).

---

# Chiffrement

Les communications utilisent TLS 1.3 ou version ultérieure compatible.

Les données sensibles sont chiffrées au repos avec AES-256 (ou équivalent reconnu).

Les clés sont gérées dans un gestionnaire de secrets (Vault, KMS, HSM selon le contexte de déploiement).

---

# Données sensibles

Sont considérées sensibles :

- informations personnelles ;
- données financières ;
- données médicales éventuelles ;
- documents administratifs ;
- identifiants ;
- clés API ;
- jetons d'accès.

Leur accès est limité et tracé.

---

# Sécurité des API

Toutes les API utilisent :

- HTTPS ;
- JWT ou OAuth2 ;
- contrôle des permissions ;
- limitation du débit (Rate Limiting) ;
- validation des entrées ;
- journalisation.

---

# Protection OWASP

Le système protège notamment contre :

- Injection SQL
- XSS
- CSRF
- SSRF
- Broken Authentication
- Broken Access Control
- Security Misconfiguration
- Insecure Deserialization
- Command Injection
- Prompt Injection (IA)

---

# Validation des données

Toutes les données entrantes sont :

- validées ;
- nettoyées ;
- normalisées.

Les fichiers téléchargés sont analysés selon la politique de sécurité (type, taille, antivirus selon l'infrastructure).

---

# Gestion des secrets

Les secrets ne sont jamais stockés :

- dans le code ;
- dans Git ;
- dans les fichiers publics.

Ils sont gérés via un coffre-fort de secrets.

---

# Journalisation

Toutes les opérations sensibles sont journalisées :

- connexion ;
- déconnexion ;
- modification de droits ;
- suppression ;
- export ;
- génération de documents ;
- opérations financières.

Les journaux sont horodatés et protégés contre les modifications non autorisées.

---

# Audit

Chaque action conserve :

- utilisateur ;
- date ;
- heure ;
- adresse IP (si applicable) ;
- appareil ;
- opération ;
- résultat.

---

# Surveillance

Le système détecte notamment :

- tentatives répétées de connexion ;
- élévation de privilèges ;
- accès inhabituels ;
- anomalies de comportement ;
- activités suspectes.

---

# Sauvegardes

Les sauvegardes sont :

- automatiques ;
- chiffrées ;
- testées régulièrement ;
- géographiquement redondantes lorsque l'infrastructure le permet.

---

# Continuité d'activité

Le système prévoit :

- PRA (Plan de Reprise d'Activité) ;
- PCA (Plan de Continuité d'Activité) ;
- restauration automatisée ;
- supervision permanente.

Les objectifs RPO/RTO sont définis par l'organisation selon ses exigences de service.

---

# Sécurité IA

Le moteur IA applique :

- filtrage des prompts ;
- protection contre le Prompt Injection ;
- contrôle des accès ;
- journalisation ;
- limitation des données transmises aux modèles ;
- validation humaine pour les actions critiques.

---

# Conformité

Le système est conçu pour faciliter la conformité avec :

- ISO/IEC 27001 ;
- ISO/IEC 27701 ;
- NIST Cybersecurity Framework ;
- OWASP ASVS ;
- réglementations nationales applicables en matière de protection des données.

La mise en conformité dépend également des procédures organisationnelles de l'entité exploitante.

---

# Gestion des incidents

En cas d'incident :

Détection

↓

Qualification

↓

Confinement

↓

Correction

↓

Restauration

↓

Analyse post-incident

↓

Amélioration continue

---

# Politique de conservation

Les journaux, sauvegardes et données sont conservés selon les politiques de rétention définies par l'organisation et les obligations légales applicables.

---

# Règles métier

## RM-2200

Toutes les connexions utilisent HTTPS.

---

## RM-2201

Chaque utilisateur est authentifié avant tout accès.

---

## RM-2202

Les permissions sont vérifiées avant chaque opération.

---

## RM-2203

Toute opération sensible est journalisée.

---

## RM-2204

Les données sensibles sont chiffrées.

---

## RM-2205

Les tentatives d'intrusion déclenchent des alertes.

---

# Tests de sécurité

Le système devra vérifier :

✓ authentification ;

✓ MFA ;

✓ permissions ;

✓ chiffrement ;

✓ injections ;

✓ XSS ;

✓ CSRF ;

✓ Rate Limiting ;

✓ audit ;

✓ restauration des sauvegardes.

---

# Indicateurs (KPI)

- Nombre de connexions
- Tentatives de connexion échouées
- Temps moyen de détection d'incident
- Temps moyen de résolution
- Nombre d'alertes critiques
- Taux de disponibilité
- Nombre de vulnérabilités corrigées
- Couverture MFA
- Taux de réussite des sauvegardes
- Résultats des tests de sécurité

---

# Évolutions prévues

Le module devra intégrer :

- authentification sans mot de passe (Passkeys/WebAuthn) ;
- détection comportementale avancée ;
- SIEM ;
- SOAR ;
- DLP (Data Loss Prevention) ;
- classification automatique des données ;
- chiffrement post-quantique lorsque les standards seront matures.

---

# Conclusion

L'architecture de sécurité d'EduWeb Planner constitue le socle de confiance de la plateforme. En combinant authentification forte, contrôle d'accès granulaire, chiffrement, audit, supervision continue et gouvernance des risques, elle protège les données, les utilisateurs et les processus critiques tout en soutenant un déploiement évolutif et conforme aux bonnes pratiques internationales.
