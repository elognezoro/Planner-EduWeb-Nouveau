---
title: EduWeb File Storage Standards
version: 1.0
status: Official
category: Engineering Standards
code: STD-010
authors:
  - EduWeb Architecture Team
---

# FILE-STORAGE-STANDARDS.md

> Référentiel officiel de gestion des fichiers de l'écosystème EduWeb.

---

# Sommaire

1. Objectifs
2. Philosophie
3. Architecture
4. Types de fichiers
5. Organisation des répertoires
6. Convention de nommage
7. Téléversement (Upload)
8. Téléchargement
9. Sécurité
10. Validation
11. Images
12. Documents PDF
13. Sauvegarde
14. Archivage
15. Suppression
16. Performances
17. Monitoring
18. Anti-patterns
19. Checklist

---

# 1. Objectifs

Le système de stockage doit garantir :

- sécurité ;
- disponibilité ;
- évolutivité ;
- performances ;
- traçabilité ;
- faible coût d'exploitation.

---

# 2. Philosophie

La base de données ne stocke jamais les fichiers.

Elle stocke uniquement :

- l'identifiant ;
- le chemin ;
- le type ;
- les métadonnées.

Les fichiers sont stockés dans un service de stockage objet compatible S3.

---

# 3. Architecture

Architecture recommandée :

```
Utilisateur

↓

Next.js

↓

Server Action

↓

Validation

↓

Storage (S3/R2)

↓

Prisma

↓

Neon PostgreSQL
```

Les fichiers ne transitent jamais directement entre le navigateur et la base de données.

---

# 4. Types de fichiers

Les catégories sont normalisées.

Exemples :

```
avatars/

students/

teachers/

schools/

documents/

reports/

certificates/

exports/

imports/

logos/

signatures/

stamps/

timetables/

assignments/

archives/
```

Chaque catégorie possède sa politique de conservation.

---

# 5. Organisation des répertoires

Structure recommandée :

```
schools/

schoolId/

students/

studentId/

photo.jpg

report.pdf

attendance/

2026/

march.pdf
```

Les répertoires reflètent le domaine métier.

---

# 6. Convention de nommage

Les noms de fichiers ne sont jamais utilisés comme identifiants.

Utiliser :

```
UUID.extension
```

Exemple :

```
7cb88d73-fd7f.pdf
```

Les noms d'origine peuvent être conservés comme métadonnées.

---

# 7. Téléversement (Upload)

Toutes les opérations d'upload passent par le serveur.

Étapes :

```
Utilisateur

↓

Validation

↓

Antivirus (si activé)

↓

Optimisation

↓

Stockage

↓

Enregistrement Prisma
```

Aucun upload direct vers la base de données.

---

# 8. Téléchargement

Les téléchargements utilisent :

- URL signées ;
- contrôle des autorisations ;
- journalisation.

Les liens expirent automatiquement après une durée configurable.

---

# 9. Sécurité

Contrôles obligatoires :

- authentification ;
- autorisation (RBAC) ;
- vérification du type MIME ;
- limitation de taille ;
- protection contre les extensions dangereuses.

Les fichiers exécutables sont interdits.

---

# 10. Validation

Chaque fichier est contrôlé :

- extension ;
- type MIME ;
- taille ;
- intégrité.

Exemples :

| Type | Taille maximale |
|------|----------------:|
| Image | 10 Mo |
| PDF | 25 Mo |
| Document bureautique | 20 Mo |
| Archive ZIP | 100 Mo |

Les limites peuvent varier selon le module.

---

# 11. Images

Les images sont automatiquement optimisées.

Formats recommandés :

- WebP
- JPEG
- PNG

Miniatures générées lorsque nécessaire.

Les originaux peuvent être conservés.

---

# 12. Documents PDF

Les PDF générés par EduWeb comprennent :

- métadonnées ;
- pagination ;
- date de génération ;
- auteur ;
- identifiant unique.

Les documents officiels peuvent intégrer :

- QR Code ;
- signature électronique ;
- cachet numérique.

---

# 13. Sauvegarde

Les fichiers sont sauvegardés indépendamment de la base de données.

Les sauvegardes sont :

- automatisées ;
- testées ;
- documentées.

---

# 14. Archivage

Les documents anciens peuvent être déplacés vers un espace d'archives.

L'archivage conserve :

- les métadonnées ;
- les droits d'accès ;
- la traçabilité.

---

# 15. Suppression

Les suppressions sont journalisées.

Selon le contexte :

- suppression logique ;
- suppression différée ;
- suppression définitive après expiration de la politique de conservation.

Les fichiers orphelins sont détectés automatiquement.

---

# 16. Performances

Optimisations recommandées :

- CDN ;
- compression ;
- chargement progressif ;
- miniatures ;
- cache HTTP ;
- téléchargement par flux (streaming) pour les gros fichiers.

---

# 17. Monitoring

Surveiller :

- espace utilisé ;
- nombre de fichiers ;
- taille moyenne ;
- erreurs d'upload ;
- erreurs de téléchargement ;
- temps de réponse ;
- fichiers orphelins.

Des alertes sont configurées sur les seuils critiques.

---

# 18. Anti-patterns

Interdits :

❌ Stocker des fichiers dans Neon.

❌ Utiliser le nom d'origine comme identifiant.

❌ Upload sans validation.

❌ Stocker des secrets dans les métadonnées.

❌ Autoriser des extensions exécutables.

❌ Générer des URL permanentes publiques pour des documents sensibles.

❌ Supprimer un fichier sans journalisation.

---

# 19. Checklist

Avant chaque mise en production :

- [ ] Validation des types MIME.
- [ ] Contrôle des tailles.
- [ ] Organisation des répertoires conforme.
- [ ] UUID utilisés.
- [ ] RBAC vérifié.
- [ ] Sauvegarde configurée.
- [ ] Monitoring activé.
- [ ] Documentation mise à jour.

---

# Documents associés

- PRISMA-STANDARDS.md
- DATABASE-STANDARDS.md
- SECURITY-STANDARDS.md
- API-STANDARDS.md
- DEPLOYMENT-STANDARDS.md

---

# Fin du document
