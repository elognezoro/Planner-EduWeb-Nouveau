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

// ─────────────── Nom d'utilisateur au format établissement (voir Convertisseur CSV) ───────────────

/** Initiales du prénom : 1re lettre de CHAQUE composante ; si une seule composante, 3 premières lettres. */
export function initialesPrenom(prenoms: string): string {
  const comps = (prenoms ?? "").trim().split(/[\s\-'’]+/).map(slug).filter(Boolean);
  if (comps.length === 0) return "";
  if (comps.length === 1) return comps[0].slice(0, 3);
  return comps.map((c) => c.charAt(0)).join("");
}

/** Code de l'année scolaire : « 2026-2027 » → « 2627 » (2 derniers chiffres de chaque année). */
export function codeAnnee(annee: string): string {
  const a = (annee ?? "").match(/\d{4}/g);
  return a && a.length > 0 ? a.map((x) => x.slice(-2)).join("") : (annee ?? "").replace(/\D/g, "");
}

const MOTS_VIDES = new Set(["de", "des", "du", "d", "la", "le", "les", "l", "et", "a", "au", "aux", "en", "sur", "the", "of"]);
/** Initiales de l'établissement : 1re lettre de chaque mot SIGNIFICATIF (hors « de, la, le… »). */
export function initialesEcole(nom: string): string {
  return (nom ?? "")
    .trim()
    .split(/[\s\-'’]+/)
    .map(slug)
    .filter((m) => m && !MOTS_VIDES.has(m))
    .map((m) => m.charAt(0))
    .join("");
}

/** Code d'une classe pédagogique : minuscules, alphanumérique (« CM2 A 1 » → « cm2a1 »). */
export function codeClasse(classe: string): string {
  return slug(classe);
}

/**
 * Nom d'utilisateur au format « {initiales prénom}.{année}{initiales école}-{classe} », en minuscules.
 * Ex. : « Ama Marie Flore », « Notre Dame de la Paix de la Palmeraie », « 2026-2027 », « CM2A1 »
 *       → « amf.2627ndpp-cm2a1 ».
 */
export function nomUtilisateur(prenoms: string, ecole: string, annee: string, classe: string, nom = ""): string {
  // Repli sur le NOM quand il n'y a pas de prénom (entrée à un seul mot) — évite un « . » en tête.
  const p = initialesPrenom(prenoms) || initialesPrenom(nom);
  const bloc = `${codeAnnee(annee)}${initialesEcole(ecole)}`; // ex. « 2627ndpp »
  const c = codeClasse(classe);
  let u = p;
  if (bloc) u += `${p ? "." : ""}${bloc}`;
  if (c) u += `-${c}`;
  return u || "utilisateur";
}

/** Insère un chiffre AVANT le point (différenciation des doublons) : « amf.… » → « amf2.… ». */
export function differencier(username: string, n: number): string {
  const i = username.indexOf(".");
  return i >= 0 ? username.slice(0, i) + n + username.slice(i) : username + n;
}
