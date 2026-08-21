// Génération de mots de passe pour le Convertisseur CSV (bloc « comptes EduWeb ») :
// respecte TOUS les critères du formulaire de création de compte (source unique
// CRITERES_MOT_DE_PASSE : 8 caractères minimum, majuscule, minuscule, chiffre, spécial)
// avec un MAXIMUM de 10 caractères.

import { motDePasseConforme } from "@/lib/validation/mot-de-passe";

/** Longueur des mots de passe générés : le maximum autorisé (10 caractères). */
export const LONGUEUR_MDP_GENERE = 10;

// Alphabets SANS caractères ambigus (I/l/1, O/0…) : ces mots de passe sont recopiés à la main.
const MAJUSCULES = "ABCDEFGHJKMNPQRSTUVWXYZ";
const MINUSCULES = "abcdefghjkmnpqrstuvwxyz";
const CHIFFRES = "23456789";
const SPECIAUX = "!@#$%*+=?";
const TOUS = MAJUSCULES + MINUSCULES + CHIFFRES + SPECIAUX;

function tirage(): string {
  const n = LONGUEUR_MDP_GENERE;
  const alea = new Uint32Array(n * 2);
  crypto.getRandomValues(alea);
  // Un caractère imposé par famille (garantit chaque critère), le reste tiré sur tout l'alphabet.
  const car = [MAJUSCULES, MINUSCULES, CHIFFRES, SPECIAUX].map((a, i) => a[alea[i] % a.length]);
  for (let i = car.length; i < n; i++) car.push(TOUS[alea[i] % TOUS.length]);
  // Mélange de Fisher-Yates : les caractères imposés ne restent pas en tête.
  for (let i = car.length - 1; i > 0; i--) {
    const j = alea[n + i] % (i + 1);
    [car[i], car[j]] = [car[j], car[i]];
  }
  return car.join("");
}

/**
 * Mot de passe aléatoire de 10 caractères conforme à la politique de création de compte.
 * La conformité est REVÉRIFIÉE contre la source unique des critères : si la politique évoluait
 * au-delà de ce que 10 caractères et cet alphabet permettent, l'écart serait signalé en console
 * (à traiter en ajustant LONGUEUR_MDP_GENERE / les alphabets) plutôt que d'échouer en silence.
 */
export function genererMotDePasse(): string {
  for (let essai = 0; essai < 20; essai++) {
    const mdp = tirage();
    if (motDePasseConforme(mdp)) return mdp;
  }
  console.error("[generer-mot-de-passe] la politique de mot de passe dépasse ce que la construction garantit — ajuster LONGUEUR_MDP_GENERE / les alphabets.");
  return tirage();
}
