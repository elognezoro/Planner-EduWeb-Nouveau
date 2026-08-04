// Génération SERVEUR pure (aucun secret) — pas de marqueur « server-only » pour rester
// exécutable par les scripts de maintenance/vérification (npx tsx).
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import type { CreneauHoraire, BandePause } from "./horaires";
import type { CelluleEdt } from "./email";

/**
 * Génération PDF d'un emploi du temps — même contenu que le PDF individuel de la page
 * Emploi du temps (impression) : EN-TÊTE OFFICIEL (ministère, établissement, intitulé
 * officiel du pays, armoiries, devise, année scolaire), grille hebdomadaire A4 PORTRAIT
 * à hauteurs de période uniformes (une séance de 2 périodes occupe le double), bandes
 * récréation / pause déjeuner, VOLUMES HORAIRES hebdomadaires par discipline et
 * demi-journées libres. Utilisé par l'export ZIP (un PDF par classe / par enseignant).
 */

export interface EnTetePdf {
  ministere: string;
  etablissementNom: string;
  paysIntitule: string;
  slogan: string;
  anneeScolaire: string | null;
  /** Armoiries / emblème (PNG ou JPEG déjà téléchargé) — null : en-tête sans image. */
  armoiries: { octets: Uint8Array; type: "png" | "jpg" } | null;
}

export interface DonneesPdfEdt {
  entete: EnTetePdf;
  /** Ex. « Classe 6ème 1 » ou « KOUAMÉ Jean — Spécialité : Mathématiques ». */
  sousTitre: string;
  cellules: CelluleEdt[];
  horaires: CreneauHoraire[] | null;
  bandes: BandePause[] | null;
  nbPeriodes: number;
  /** Volumes hebdomadaires par discipline (minutes). */
  volumes: { libelle: string; minutes: number }[];
  demiJourneesLibres: string[];
}

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];

// Palette du design system (globals.css / gabarits e-mail).
const FORET_FONCE = rgb(15 / 255, 53 / 255, 39 / 255); // #0f3527
const FORET = rgb(21 / 255, 66 / 255, 49 / 255); // #154231
const ENCRE = rgb(43 / 255, 58 / 255, 51 / 255); // #2b3a33
const GRIS_VERT = rgb(107 / 255, 125 / 255, 115 / 255); // #6b7d73
const BORD = rgb(232 / 255, 224 / 255, 205 / 255); // #e8e0cd
const CREME = rgb(250 / 255, 246 / 255, 236 / 255); // #faf6ec
const BANDE_FOND = rgb(246 / 255, 232 / 255, 195 / 255); // #f6e8c3
const BANDE_TEXTE = rgb(138 / 255, 105 / 255, 20 / 255); // #8a6914

const PAGE_L = 595.28; // A4 portrait
const PAGE_H = 841.89;
const MARGE = 26;
const LARGEUR = PAGE_L - 2 * MARGE;
const COL_HORAIRE = 46;
const COL_JOUR = (LARGEUR - COL_HORAIRE) / JOURS.length;

/** WinAnsi (CP1252) couvre le français (é, ï, ç, œ, ’…) ; les caractères hors champ sont
 *  remplacés par leur forme sans diacritique pour ne jamais faire échouer l'encodage. */
function assainir(police: PDFFont, texte: string): string {
  try {
    police.widthOfTextAtSize(texte, 8);
    return texte;
  } catch {
    return texte
      .normalize("NFKD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^\x20-\x7E]/g, "?");
  }
}

function tronquer(police: PDFFont, taille: number, largeurMax: number, texte: string): string {
  const t = assainir(police, texte);
  if (police.widthOfTextAtSize(t, taille) <= largeurMax) return t;
  let coupe = t;
  while (coupe.length > 1 && police.widthOfTextAtSize(`${coupe}…`, taille) > largeurMax) {
    coupe = coupe.slice(0, -1);
  }
  return `${coupe}…`;
}

/** Découpe en lignes tenant dans `largeurMax` (au plus `maxLignes`, dernière tronquée). */
function enLignes(police: PDFFont, taille: number, largeurMax: number, texte: string, maxLignes: number): string[] {
  const mots = assainir(police, texte).split(/\s+/).filter(Boolean);
  const lignes: string[] = [];
  let courante = "";
  for (const mot of mots) {
    const essai = courante ? `${courante} ${mot}` : mot;
    if (police.widthOfTextAtSize(essai, taille) <= largeurMax) {
      courante = essai;
    } else {
      if (courante) lignes.push(courante);
      courante = mot;
      if (lignes.length === maxLignes - 1) break;
    }
  }
  if (courante && lignes.length < maxLignes) lignes.push(courante);
  if (lignes.length === maxLignes) lignes[maxLignes - 1] = tronquer(police, taille, largeurMax, lignes[maxLignes - 1]);
  return lignes;
}

function texteCentre(page: PDFPage, texte: string, police: PDFFont, taille: number, centreX: number, y: number, couleur: RGB) {
  const t = assainir(police, texte);
  page.drawText(t, { x: centreX - police.widthOfTextAtSize(t, taille) / 2, y, size: taille, font: police, color: couleur });
}

/** Couleur de discipline « #rrggbb » → RGB pdf-lib (repli : vert forêt #154231, comme la grille). */
function couleurDiscipline(hex: string | null | undefined): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex ?? "");
  const n = parseInt(m ? m[1] : "154231", 16);
  return { r: ((n >> 16) & 0xff) / 255, g: ((n >> 8) & 0xff) / 255, b: (n & 0xff) / 255 };
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

export async function genererPdfEdt(d: DonneesPdfEdt): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_L, PAGE_H]);
  const police = await doc.embedFont(StandardFonts.Helvetica);
  const gras = await doc.embedFont(StandardFonts.HelveticaBold);
  const italique = await doc.embedFont(StandardFonts.HelveticaOblique);

  // ── EN-TÊTE OFFICIEL : trois colonnes (ministère / titre / pile officielle du pays) ──
  const colLarg = LARGEUR / 3 - 8;
  const hautPage = PAGE_H - MARGE;
  let basEnTete = hautPage;

  // Colonne gauche : ministère (majuscules) + nom de l'établissement.
  {
    let y = hautPage - 8;
    for (const l of enLignes(gras, 7, colLarg, d.entete.ministere.toUpperCase(), 4)) {
      page.drawText(l, { x: MARGE, y, size: 7, font: gras, color: FORET_FONCE });
      y -= 9;
    }
    y -= 4;
    for (const l of enLignes(gras, 7.5, colLarg, d.entete.etablissementNom.toUpperCase(), 3)) {
      page.drawText(l, { x: MARGE, y, size: 7.5, font: gras, color: FORET_FONCE });
      y -= 9.5;
    }
    basEnTete = Math.min(basEnTete, y);
  }

  // Colonne centrale : titre + sous-titre.
  {
    const centreX = PAGE_L / 2;
    texteCentre(page, "EMPLOI DU TEMPS", gras, 14, centreX, hautPage - 22, FORET_FONCE);
    let y = hautPage - 38;
    for (const l of enLignes(gras, 9.5, colLarg + 20, d.sousTitre, 2)) {
      texteCentre(page, l, gras, 9.5, centreX, y, ENCRE);
      y -= 12;
    }
    basEnTete = Math.min(basEnTete, y);
  }

  // Colonne droite : intitulé officiel du pays, armoiries, devise, année scolaire.
  {
    const centreX = PAGE_L - MARGE - colLarg / 2;
    let y = hautPage - 8;
    for (const l of enLignes(gras, 7, colLarg, d.entete.paysIntitule, 2)) {
      texteCentre(page, l, gras, 7, centreX, y, FORET_FONCE);
      y -= 9;
    }
    if (d.entete.armoiries) {
      try {
        const image =
          d.entete.armoiries.type === "png"
            ? await doc.embedPng(d.entete.armoiries.octets)
            : await doc.embedJpg(d.entete.armoiries.octets);
        const echelle = Math.min(34 / image.height, 54 / image.width);
        const larg = image.width * echelle;
        const haut = image.height * echelle;
        y -= haut + 2;
        page.drawImage(image, { x: centreX - larg / 2, y, width: larg, height: haut });
        y -= 4;
      } catch {
        // Image illisible : en-tête sans armoiries.
      }
    }
    for (const l of enLignes(italique, 7, colLarg, d.entete.slogan, 2)) {
      texteCentre(page, l, italique, 7, centreX, y, ENCRE);
      y -= 9;
    }
    if (d.entete.anneeScolaire) {
      texteCentre(page, `Année Scolaire ${d.entete.anneeScolaire}`, police, 7, centreX, y, ENCRE);
      y -= 9;
    }
    basEnTete = Math.min(basEnTete, y);
  }

  // Filet séparateur.
  const ySeparateur = basEnTete - 6;
  page.drawLine({ start: { x: MARGE, y: ySeparateur }, end: { x: PAGE_L - MARGE, y: ySeparateur }, thickness: 0.8, color: BORD });

  // ── GRILLE : hauteurs de période UNIFORMES (16 mm à l'impression), compressées si besoin ──
  const bandes = d.bandes ?? [];
  const hauteurBande = 19;
  const enTeteGrille = 16;
  // Réserve basse : volumes (2 colonnes) + demi-journées + pied de page.
  const lignesVolumes = Math.ceil(d.volumes.length / 2);
  const reserveBasse = 16 + lignesVolumes * 11 + 14 + 14 + 16;
  const hautGrille = ySeparateur - 8;
  const disponible = hautGrille - MARGE - reserveBasse - enTeteGrille - bandes.length * hauteurBande;
  const hauteurPeriode = Math.max(24, Math.min(45.35, disponible / Math.max(1, d.nbPeriodes)));

  // Positions de chaque ligne de période (le haut de la ligne p) — les bandes s'intercalent.
  const hautLigne: number[] = [];
  let curseur = hautGrille - enTeteGrille;
  for (let p = 0; p < d.nbPeriodes; p++) {
    hautLigne.push(curseur);
    curseur -= hauteurPeriode;
    for (const b of bandes) if (b.apresPeriode === p) curseur -= hauteurBande;
  }
  const basGrille = curseur;

  // Ligne d'en-tête (Horaire + jours).
  page.drawRectangle({ x: MARGE, y: hautGrille - enTeteGrille, width: LARGEUR, height: enTeteGrille, color: CREME, borderColor: BORD, borderWidth: 0.6 });
  texteCentre(page, "Horaire", gras, 7, MARGE + COL_HORAIRE / 2, hautGrille - 11, GRIS_VERT);
  JOURS.forEach((j, i) => {
    texteCentre(page, j, gras, 8, MARGE + COL_HORAIRE + i * COL_JOUR + COL_JOUR / 2, hautGrille - 11, FORET);
  });

  // Colonne horaire + cases vides (fond de grille), puis bandes de pause.
  for (let p = 0; p < d.nbPeriodes; p++) {
    const yHaut = hautLigne[p];
    page.drawRectangle({ x: MARGE, y: yHaut - hauteurPeriode, width: COL_HORAIRE, height: hauteurPeriode, color: CREME, borderColor: BORD, borderWidth: 0.6 });
    const h = d.horaires?.[p];
    if (h) {
      texteCentre(page, h.debut, gras, 6.5, MARGE + COL_HORAIRE / 2, yHaut - hauteurPeriode / 2 + 2, GRIS_VERT);
      texteCentre(page, h.fin, police, 6.5, MARGE + COL_HORAIRE / 2, yHaut - hauteurPeriode / 2 - 7, GRIS_VERT);
    } else {
      texteCentre(page, `P${p + 1}`, gras, 6.5, MARGE + COL_HORAIRE / 2, yHaut - hauteurPeriode / 2 - 2, GRIS_VERT);
    }
    for (let j = 0; j < JOURS.length; j++) {
      page.drawRectangle({ x: MARGE + COL_HORAIRE + j * COL_JOUR, y: yHaut - hauteurPeriode, width: COL_JOUR, height: hauteurPeriode, borderColor: BORD, borderWidth: 0.5 });
    }
    for (const b of bandes) {
      if (b.apresPeriode === p) {
        const yBande = yHaut - hauteurPeriode - hauteurBande;
        page.drawRectangle({ x: MARGE, y: yBande, width: LARGEUR, height: hauteurBande, color: BANDE_FOND, borderColor: BORD, borderWidth: 0.6 });
        texteCentre(page, assainir(gras, b.libelle.toUpperCase()).split("").join(" "), gras, 7, PAGE_L / 2, yBande + hauteurBande / 2 - 2.5, BANDE_TEXTE);
      }
    }
  }

  // Cases des cours (par-dessus le fond) — hauteur = de la ligne p au bas de la ligne p+duree-1.
  // CODE COULEUR de la grille à l'écran : fond = couleur de la DISCIPLINE à ~10 % sur blanc
  // (équivalent du « ${couleur}1a » CSS), barre d'accent gauche de 3 pt pleine couleur.
  for (const c of d.cellules) {
    if (c.jour < 0 || c.jour >= JOURS.length || c.periode < 0 || c.periode >= d.nbPeriodes) continue;
    const derniere = Math.min(c.periode + c.duree - 1, d.nbPeriodes - 1);
    const yHaut = hautLigne[c.periode];
    const yBas = hautLigne[derniere] - hauteurPeriode;
    const x = MARGE + COL_HORAIRE + c.jour * COL_JOUR;
    const teinteBase = couleurDiscipline(c.couleur);
    const alpha = 26 / 255; // « 1a » hexadécimal
    const fond = rgb(
      teinteBase.r * alpha + (1 - alpha),
      teinteBase.g * alpha + (1 - alpha),
      teinteBase.b * alpha + (1 - alpha),
    );
    const accent = rgb(teinteBase.r, teinteBase.g, teinteBase.b);
    page.drawRectangle({ x, y: yBas, width: COL_JOUR, height: yHaut - yBas, color: fond, borderColor: BORD, borderWidth: 0.7 });
    page.drawRectangle({ x: x + 0.7, y: yBas + 1.2, width: 3, height: yHaut - yBas - 2.4, color: accent });
    const largTexte = COL_JOUR - 10;
    let yTexte = yHaut - 10;
    for (const l of enLignes(gras, 7.5, largTexte, c.l1, 2)) {
      page.drawText(l, { x: x + 7, y: yTexte, size: 7.5, font: gras, color: FORET_FONCE });
      yTexte -= 9;
    }
    page.drawText(tronquer(police, 7, largTexte, c.l2), { x: x + 7, y: yTexte, size: 7, font: police, color: ENCRE });
    yTexte -= 8.5;
    page.drawText(tronquer(police, 6.5, largTexte, c.l3), { x: x + 7, y: yTexte, size: 6.5, font: police, color: GRIS_VERT });
  }

  // ── VOLUMES HORAIRES HEBDOMADAIRES + DEMI-JOURNÉES LIBRES ──
  let ySection = basGrille - 16;
  page.drawText("Volumes horaires hebdomadaires", { x: MARGE, y: ySection, size: 9, font: gras, color: FORET_FONCE });
  ySection -= 12;
  const demiLarg = LARGEUR / 2;
  d.volumes.forEach((v, i) => {
    const x = MARGE + (i % 2) * demiLarg;
    const y = ySection - Math.floor(i / 2) * 11;
    page.drawText(tronquer(police, 7.5, demiLarg - 60, v.libelle), { x, y, size: 7.5, font: police, color: ENCRE });
    page.drawText(formatMinutes(v.minutes), { x: x + demiLarg - 52, y, size: 7.5, font: gras, color: FORET });
  });
  ySection -= lignesVolumes * 11 + 3;
  const totalMinutes = d.volumes.reduce((s, v) => s + v.minutes, 0);
  page.drawText(`Total hebdomadaire : ${formatMinutes(totalMinutes)}`, { x: MARGE, y: ySection, size: 8, font: gras, color: FORET_FONCE });
  ySection -= 13;
  const libres = d.demiJourneesLibres.length > 0 ? d.demiJourneesLibres.join(" · ") : "aucune";
  page.drawText(tronquer(police, 7.5, LARGEUR, `Demi-journées libres : ${libres}`), { x: MARGE, y: ySection, size: 7.5, font: police, color: ENCRE });

  // Pied de page.
  page.drawText("Généré par EduWeb Planner — plateforme de gestion et de planification scolaire.", {
    x: MARGE, y: MARGE - 10, size: 6.5, font: police, color: GRIS_VERT,
  });

  return doc.save();
}
