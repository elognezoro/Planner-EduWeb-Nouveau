/**
 * Couche RBAC centralisée d'EduWeb Planner.
 * Point d'entrée unique — tous les modules importent depuis "@/lib/rbac".
 * (CLAUDE.md §3, §4 : RBAC centralisé, jamais dupliqué.)
 */
export * from "./roles";
export * from "./habilitation";
export * from "./scope";
export * from "./navigation";
export * from "./apercu";
export * from "./acces";
