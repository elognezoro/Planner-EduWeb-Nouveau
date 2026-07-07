// Formatage des noms/prénoms et séparation d'une colonne combinée, pour le Convertisseur CSV
// (liste Word/Excel → format Moodle). Fonctions pures et testables.

/** NOM en MAJUSCULES (accents conservés), espaces normalisés. */
export function nomEnMajuscules(s: string): string {
  return (s ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

/**
 * Prénoms en casse « titre » : première lettre de CHAQUE composante en majuscule, le reste en
 * minuscules. Gère espaces, traits d'union et apostrophes : « jean-baptiste n'guessan koffi »
 * → « Jean-Baptiste N'Guessan Koffi ».
 */
export function prenomsEnTitre(s: string): string {
  return (s ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/(^|[\s\-'’])([a-zà-ÿ])/g, (_m, sep: string, c: string) => sep + c.toUpperCase());
}

export type RegleSeparation = "premier" | "dernier" | "majuscules";

const estEnMajuscules = (m: string): boolean =>
  m.length >= 2 && m === m.toUpperCase() && m !== m.toLowerCase();

/**
 * Sépare une chaîne combinée « NOM + Prénoms » en { nom, prenoms } selon une règle :
 *  - "premier"    : le premier mot est le NOM ;
 *  - "dernier"    : le dernier mot est le NOM ;
 *  - "majuscules" : les mots ÉCRITS EN MAJUSCULES forment le NOM (convention ivoirienne), le reste
 *                   les prénoms ; repli sur « premier » si aucun mot n'est en majuscules.
 */
export function separerNomPrenoms(brut: string, regle: RegleSeparation): { nom: string; prenoms: string } {
  const mots = (brut ?? "").trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  if (mots.length === 0) return { nom: "", prenoms: "" };
  if (mots.length === 1) return { nom: mots[0], prenoms: "" };

  if (regle === "majuscules") {
    const nomMots = mots.filter(estEnMajuscules);
    if (nomMots.length > 0) {
      return { nom: nomMots.join(" "), prenoms: mots.filter((m) => !estEnMajuscules(m)).join(" ") };
    }
    return { nom: mots[0], prenoms: mots.slice(1).join(" ") }; // repli « premier »
  }
  if (regle === "dernier") {
    return { nom: mots[mots.length - 1], prenoms: mots.slice(0, -1).join(" ") };
  }
  return { nom: mots[0], prenoms: mots.slice(1).join(" ") };
}

/** Réduction en identifiant : sans accents, minuscules, uniquement [a-z0-9]. */
export function slug(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/** Nom d'utilisateur « prenom.nom » (premier prénom + nom), réduit en identifiant. */
export function identifiant(prenoms: string, nom: string): string {
  const p = slug((prenoms ?? "").trim().split(/\s+/)[0] ?? "");
  const n = slug(nom);
  return [p, n].filter(Boolean).join(".") || "utilisateur";
}
