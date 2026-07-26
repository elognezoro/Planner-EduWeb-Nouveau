---
title: EduWeb Caching Standards
version: 1.0
status: Official
category: Engineering Standards
code: STD-009
authors:
  - EduWeb Architecture Team
---

# CACHING-STANDARDS.md

> Référentiel officiel de gestion du cache de l'écosystème EduWeb.

---

# Sommaire

1. Objectifs
2. Philosophie
3. Architecture du cache
4. Types de cache
5. Cache Next.js
6. Cache React
7. Cache Prisma
8. Cache des fichiers
9. Cache des API
10. Invalidation
11. Durée de vie (TTL)
12. Cohérence des données
13. Performance
14. Sécurité
15. Monitoring
16. Anti-patterns
17. Checklist

---

# 1. Objectifs

Le cache doit permettre :

- d'accélérer les temps de réponse ;
- de réduire la charge sur Neon ;
- de limiter les requêtes réseau ;
- d'améliorer l'expérience utilisateur ;
- de réduire les coûts d'infrastructure.

---

# 2. Philosophie

Le cache est une optimisation.

La base de données reste toujours la source de vérité.

Aucune donnée critique ne doit dépendre exclusivement du cache.

---

# 3. Architecture du cache

```
Navigateur

↓

Cache HTTP

↓

Next.js Cache

↓

React Cache

↓

Prisma

↓

Neon PostgreSQL
```

Chaque niveau possède une responsabilité spécifique.

---

# 4. Types de cache

EduWeb distingue :

- Cache navigateur
- Cache Next.js
- Cache React
- Cache API
- Cache CDN
- Cache fichiers
- Cache applicatif

Chaque type est configuré indépendamment.

---

# 5. Cache Next.js

Utiliser les mécanismes natifs :

```typescript
fetch()

revalidatePath()

revalidateTag()
```

Les pages peu volatiles sont mises en cache.

Les pages critiques utilisent un rafraîchissement contrôlé.

---

# 6. Cache React

Utiliser :

- Server Components ;
- Suspense ;
- Streaming.

Éviter les rechargements inutiles.

Les données serveur sont partagées entre composants lorsque cela est possible.

---

# 7. Cache Prisma

Prisma ne constitue pas un cache.

Les optimisations doivent porter sur :

- la qualité des requêtes ;
- les index ;
- la réduction des appels.

Éviter les requêtes identiques répétées dans un même cycle de rendu.

---

# 8. Cache des fichiers

Les ressources statiques utilisent :

- CDN ;
- cache navigateur ;
- optimisation d'images.

Les fichiers fréquemment consultés sont servis depuis le réseau de diffusion.

---

# 9. Cache des API

Les API publiques peuvent être mises en cache selon leur fréquence de mise à jour.

Exemples :

- listes de pays ;
- régions ;
- disciplines ;
- années académiques.

Les API contenant des données personnelles ne sont jamais mises en cache publiquement.

---

# 10. Invalidation

Toute modification métier déclenche une invalidation ciblée.

Utiliser :

```typescript
revalidatePath("/students")
```

ou

```typescript
revalidateTag("students")
```

Éviter les invalidations globales.

---

# 11. Durée de vie (TTL)

Définir un TTL adapté au type de données.

Exemples :

| Donnée | TTL recommandé |
|---------|----------------|
| Pays | Long |
| Régions | Long |
| Paramètres système | Moyen |
| Tableau de bord | Court |
| Emploi du temps | Court |
| Présences | Très court |

Les TTL doivent être documentés.

---

# 12. Cohérence des données

Le cache ne doit jamais provoquer :

- de doublons ;
- de données obsolètes critiques ;
- d'incohérences métier.

Les opérations sensibles relisent toujours les données depuis la base.

---

# 13. Performance

Objectifs :

- réduire le nombre de requêtes ;
- limiter la consommation CPU ;
- diminuer la latence ;
- améliorer les Core Web Vitals.

Le cache ne doit jamais masquer une mauvaise conception de la base de données.

---

# 14. Sécurité

Ne jamais mettre en cache :

- mots de passe ;
- jetons d'accès ;
- informations bancaires ;
- données médicales ;
- données personnelles sensibles.

Le cache respecte les règles de confidentialité.

---

# 15. Monitoring

Surveiller :

- taux de succès du cache ;
- taux d'invalidation ;
- temps de réponse ;
- volume des requêtes ;
- consommation mémoire.

Les indicateurs sont analysés régulièrement.

---

# 16. Anti-patterns

Interdits :

❌ Tout mettre en cache.

❌ Cache permanent.

❌ Invalidation globale systématique.

❌ Données sensibles en cache partagé.

❌ TTL arbitraires.

❌ Requêtes dupliquées.

❌ Cache sans stratégie d'expiration.

---

# 17. Checklist

Avant chaque mise en production :

- [ ] TTL définis.
- [ ] Invalidation documentée.
- [ ] Données sensibles exclues.
- [ ] Performances mesurées.
- [ ] Monitoring activé.
- [ ] Documentation mise à jour.

---

# Documents associés

- NEXTJS-STANDARDS.md
- REACT-STANDARDS.md
- PERFORMANCE-STANDARDS.md
- API-STANDARDS.md
- DEPLOYMENT-STANDARDS.md

---

# Fin du document
