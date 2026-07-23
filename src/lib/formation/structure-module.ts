/**
 * STRUCTURE PÉDAGOGIQUE DES MODULES DE FORMATION (CAFOP) — module PUR (aucune directive
 * "use server"/"use client") : importable indifféremment depuis les pages serveur, les actions
 * et les composants client.
 *
 * Un module est structuré en COMPOSANTES portant chacune des THÈMES (cascade
 * Module → Composante → Thème). Certains modules — ex. « Technologies de l'information et de
 * la communication à l'école » — ajoutent un niveau FACULTATIF au-dessus : la COMPÉTENCE.
 * Plutôt qu'un changement de format du Json `composantes` (qui casserait les données
 * existantes), chaque composante porte simplement le nom de sa compétence (champ `competence`)
 * et les composantes partageant la même valeur sont REGROUPÉES à l'affichage
 * (Module → Compétence → Composante → Thème). Les modules sans compétence (champ absent ou
 * null) restent en 2 niveaux et s'affichent exactement comme avant.
 */

/** Composante d'un module de formation (élément du champ Json `composantes` de ModuleCafop). */
export interface ComposanteModule {
  nom: string;
  themes: string[];
  /** Compétence de rattachement (niveau FACULTATIF au-dessus) — null/absent = sans compétence. */
  competence?: string | null;
}

/** Groupe de composantes partageant la même compétence (null = « sans compétence »). */
export interface GroupeCompetence<T extends { competence?: string | null }> {
  competence: string | null;
  composantes: T[];
}

/**
 * Regroupe des composantes par compétence, dans l'ORDRE D'APPARITION (le groupe null —
 * composantes sans compétence — reste à sa position naturelle). À utiliser PARTOUT où la
 * structure d'un module est affichée : jamais de regroupement dupliqué à la main.
 * Générique : accepte tout objet portant un champ `competence` facultatif (vues client incluses).
 */
export function grouperParCompetence<T extends { competence?: string | null }>(
  composantes: readonly T[],
): GroupeCompetence<T>[] {
  const groupes: GroupeCompetence<T>[] = [];
  const index = new Map<string | null, GroupeCompetence<T>>();
  for (const c of composantes) {
    const competence = (c.competence ?? "").trim() || null;
    let g = index.get(competence);
    if (!g) {
      g = { competence, composantes: [] };
      index.set(competence, g);
      groupes.push(g);
    }
    g.composantes.push(c);
  }
  return groupes;
}

/** Nombre de compétences DISTINCTES (non vides) déclarées par une liste de composantes. */
export function nbCompetences(composantes: readonly { competence?: string | null }[]): number {
  return new Set(composantes.map((c) => (c.competence ?? "").trim()).filter(Boolean)).size;
}

/**
 * Parse DÉFENSIF du champ Json `composantes` d'un ModuleCafop : `[{ nom, themes, competence? }]`.
 * Remplace les parseurs locaux dupliqués des pages serveur — conserve la compétence quand elle
 * existe, et reste tolérant aux données historiques (sans `competence`) comme aux Json invalides.
 */
export function composantesDepuisJson(v: unknown): ComposanteModule[] {
  if (!Array.isArray(v)) return [];
  const out: ComposanteModule[] = [];
  for (const x of v) {
    const nom = String((x as { nom?: unknown })?.nom ?? "");
    if (!nom) continue;
    const themesBruts = (x as { themes?: unknown })?.themes;
    const themes = Array.isArray(themesBruts) ? themesBruts.map((t) => String(t ?? "")).filter(Boolean) : [];
    const competenceBrute = (x as { competence?: unknown })?.competence;
    const competence = typeof competenceBrute === "string" && competenceBrute.trim() ? competenceBrute.trim() : null;
    out.push({ nom, themes, competence });
  }
  return out;
}
