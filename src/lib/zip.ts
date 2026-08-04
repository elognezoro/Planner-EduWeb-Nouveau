// Utilitaire SERVEUR pur (node:zlib le rend inimportable côté client) — pas de marqueur
// « server-only » pour rester exécutable par les scripts de maintenance (npx tsx).
import { deflateRawSync } from "node:zlib";

/**
 * Construction d'une archive ZIP en mémoire — SANS dépendance externe : compression DEFLATE
 * via `node:zlib`, en-têtes ZIP écrits à la main (format PKWARE, largement documenté).
 * Suffisant pour les archives de documents de la plateforme (EDT par classe/enseignant…) :
 * quelques centaines de fichiers de quelques dizaines de Ko, bien en deçà des limites ZIP32.
 * Les noms de fichiers sont encodés en UTF-8 (bit 11) — accents français respectés.
 */

export interface EntreeZip {
  /** Chemin DANS l'archive (séparateur « / », ex. « classes/6eme-A.html »). */
  chemin: string;
  contenu: string | Uint8Array;
}

// Table CRC-32 (polynôme réfléchi 0xEDB88320) précalculée une fois.
const TABLE_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(donnees: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < donnees.length; i++) c = TABLE_CRC[(c ^ donnees[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function construireZip(entrees: EntreeZip[], quand: Date = new Date()): Buffer {
  // Horodatage au format DOS (résolution 2 s) appliqué à toutes les entrées.
  const dosTemps = ((quand.getHours() << 11) | (quand.getMinutes() << 5) | (quand.getSeconds() >> 1)) & 0xffff;
  const dosDate = ((Math.max(0, quand.getFullYear() - 1980) << 9) | ((quand.getMonth() + 1) << 5) | quand.getDate()) & 0xffff;

  const locaux: Buffer[] = [];
  const centraux: Buffer[] = [];
  let decalage = 0;

  for (const e of entrees) {
    const nom = Buffer.from(e.chemin, "utf8");
    const brut = typeof e.contenu === "string" ? Buffer.from(e.contenu, "utf8") : Buffer.from(e.contenu);
    const compresse = deflateRawSync(brut);
    // Compression sans gain (fichier minuscule ou déjà compressé) : stockage brut (méthode 0).
    const stocker = compresse.length >= brut.length;
    const donnees = stocker ? brut : compresse;
    const methode = stocker ? 0 : 8;
    const crc = crc32(brut);

    const enTete = Buffer.alloc(30);
    enTete.writeUInt32LE(0x04034b50, 0); // signature « PK\x03\x04 »
    enTete.writeUInt16LE(20, 4); // version requise (2.0 : DEFLATE)
    enTete.writeUInt16LE(0x0800, 6); // bit 11 : noms en UTF-8
    enTete.writeUInt16LE(methode, 8);
    enTete.writeUInt16LE(dosTemps, 10);
    enTete.writeUInt16LE(dosDate, 12);
    enTete.writeUInt32LE(crc, 14);
    enTete.writeUInt32LE(donnees.length, 18);
    enTete.writeUInt32LE(brut.length, 22);
    enTete.writeUInt16LE(nom.length, 26);
    enTete.writeUInt16LE(0, 28); // pas de champ extra
    locaux.push(enTete, nom, donnees);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // signature « PK\x01\x02 »
    central.writeUInt16LE(20, 4); // créé par (2.0)
    central.writeUInt16LE(20, 6); // version requise
    central.writeUInt16LE(0x0800, 8); // bit 11 : noms en UTF-8
    central.writeUInt16LE(methode, 10);
    central.writeUInt16LE(dosTemps, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(donnees.length, 20);
    central.writeUInt32LE(brut.length, 24);
    central.writeUInt16LE(nom.length, 28);
    // extra (30), commentaire (32), disque (34), attributs internes (36) : zéro ;
    // attributs externes (38) : zéro ; décalage de l'en-tête local (42).
    central.writeUInt32LE(decalage, 42);
    centraux.push(central, nom);

    decalage += 30 + nom.length + donnees.length;
  }

  const tailleCentral = centraux.reduce((somme, b) => somme + b.length, 0);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0); // signature « PK\x05\x06 » (fin de répertoire central)
  fin.writeUInt16LE(entrees.length, 8);
  fin.writeUInt16LE(entrees.length, 10);
  fin.writeUInt32LE(tailleCentral, 12);
  fin.writeUInt32LE(decalage, 16);
  return Buffer.concat([...locaux, ...centraux, fin]);
}
