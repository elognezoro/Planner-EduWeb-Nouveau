/**
 * Décodage d'un fichier TEXTE fourni par l'utilisateur (CSV d'import…), respectueux de la
 * typographie française — utilisable côté client comme côté serveur.
 *
 * `File.text()` décode toujours en UTF-8 : un fichier enregistré par Excel en « ANSI »
 * (Windows-1252, cas très courant) y perd tous ses accents — é, è, ï, ç… deviennent « � »
 * (U+FFFD), une perte IRRÉVERSIBLE qui se retrouvait gravée en base à l'import.
 *
 * Stratégie : BOM UTF-16 honoré s'il est présent, puis UTF-8 STRICT (fatal) ; si le contenu
 * n'est pas de l'UTF-8 valide, bascule en Windows-1252 — les caractères français sont alors
 * restitués fidèlement. À utiliser PARTOUT à la place de `fichier.text()`.
 */
export async function lireFichierTexte(fichier: Blob): Promise<string> {
  const octets = await fichier.arrayBuffer();
  const vue = new Uint8Array(octets);
  // Excel « Texte Unicode » : UTF-16 avec BOM.
  if (vue.length >= 2 && vue[0] === 0xff && vue[1] === 0xfe) return new TextDecoder("utf-16le").decode(octets);
  if (vue.length >= 2 && vue[0] === 0xfe && vue[1] === 0xff) return new TextDecoder("utf-16be").decode(octets);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(octets);
  } catch {
    return new TextDecoder("windows-1252").decode(octets);
  }
}
