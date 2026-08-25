import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageNumber,
  Footer, Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun, ShadingType,
} from "docx";
import { estHtmlRiche, descriptionSolution, TYPES_CHOIX, TYPES_QUESTION, TYPES_MODULE } from "@/lib/lms";

/**
 * Génération d'un vrai fichier Word (.docx) PAGINÉ du livret d'un cours — Word gère nativement la
 * pagination et les NUMÉROS DE PAGE (pied de page « Page X / Y »). Deux versions : apprenant
 * (sans réponses) et formateur (?corrige=1, corrigés inclus). Voir la page HTML pour le rendu écran.
 */

const VERT = "1B5E20";
const VERT_CLAIR = "E8F0EA";
const OR = "B8860B";
const GRIS = "6B7A70";
const CREME = "F3EFE6";

type ChoixDoc = { id: string; texte: string; correct: boolean; apparie: string | null; ordre: number };
type QuestionDoc = { id: string; enonce: string; type: string; points: number; explication: string | null; choix: ChoixDoc[] };
export type ModuleDoc = {
  id: string; titre: string; type: string; contenu: string | null; fichierNom: string | null; fichierUrl: string | null; dureeMinutes: number | null;
  quiz: { consigne: string | null; mode: string; seuilReussite: number; questions: QuestionDoc[] } | null;
  devoir: { consigne: string | null; noteSur: number; dateLimite: Date | null; accepteTexte: boolean; accepteFichier: boolean } | null;
};
export type CoursDoc = {
  titre: string; description: string | null; dureeMinutes: number | null; niveau: string | null; estSeminaire: boolean; modulesGroupes: boolean;
  attestationSignataire: string | null; attestationFonction: string | null; categorie: { nom: string } | null; modules: ModuleDoc[];
};

const NIVEAUX: Record<string, string> = { debutant: "Débutant", intermediaire: "Intermédiaire", avance: "Avancé" };
const libelleTypeModule = (v: string) => TYPES_MODULE.find((t) => t.v === v)?.libelle ?? v;
const libelleTypeQuestion = (v: string) => TYPES_QUESTION.find((t) => t.v === v)?.libelle ?? v;
const dateJour = (d: Date) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
const estFinaleTitre = (t: string) => /évaluation sommative|production finale|questionnaire de satisfaction|évaluation finale/i.test(t);

/** Convertit un texte riche (HTML éditeur) en Markdown simplifié pour un rendu docx homogène. */
function normaliser(texte: string): string {
  if (!estHtmlRiche(texte)) return texte;
  return texte
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<h[12][^>]*>/gi, "## ")
    .replace(/<h[3-6][^>]*>/gi, "### ")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<(strong|b)\b[^>]*>/gi, "**").replace(/<\/(strong|b)>/gi, "**")
    .replace(/<(em|i)\b[^>]*>/gi, "*").replace(/<\/(em|i)>/gi, "*")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n");
}

/** Découpe une ligne inline (**gras**, *italique*, [lien](url)) en TextRun docx. */
function runsInline(s: string, base: { color?: string; size?: number } = {}): TextRun[] {
  const t = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1");
  const runs: TextRun[] = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    if (m.index > last) runs.push(new TextRun({ text: t.slice(last, m.index), ...base }));
    if (m[2] !== undefined) runs.push(new TextRun({ text: m[2], bold: true, ...base }));
    else if (m[3] !== undefined) runs.push(new TextRun({ text: m[3], italics: true, ...base }));
    last = re.lastIndex;
  }
  if (last < t.length) runs.push(new TextRun({ text: t.slice(last), ...base }));
  return runs.length ? runs : [new TextRun({ text: t, ...base })];
}

const estRangTableau = (l: string) => { const x = l.trim(); return x.startsWith("|") && x.endsWith("|") && x.length > 1; };
const estSeparateurTableau = (l: string) => { const x = l.trim(); return x.includes("|") && x.includes("-") && /^[\s|:-]+$/.test(x); };
const cellules = (l: string) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

function celluleBord() {
  return { style: BorderStyle.SINGLE, size: 4, color: "D9CFC0" };
}
function tableauDocx(entetes: string[], rangs: string[][]): Table {
  const b = celluleBord();
  const bords = { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b };
  const enTete = new TableRow({
    tableHeader: true,
    children: entetes.map((c) => new TableCell({
      shading: { type: ShadingType.CLEAR, color: "auto", fill: CREME },
      margins: { top: 60, bottom: 60, left: 90, right: 90 },
      children: [new Paragraph({ children: runsInline(c, { color: VERT }) })],
    })),
  });
  const corps = rangs.map((r) => new TableRow({
    children: r.map((c) => new TableCell({
      margins: { top: 60, bottom: 60, left: 90, right: 90 },
      children: [new Paragraph({ children: runsInline(c) })],
    })),
  }));
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: bords, rows: [enTete, ...corps] });
}

/** Convertit le contenu (Markdown ou HTML) en blocs docx (paragraphes, listes, tableaux). */
function contenuDocx(texte: string): (Paragraph | Table)[] {
  const src = normaliser(texte);
  const lignes = src.split(/\r?\n/);
  const blocs: (Paragraph | Table)[] = [];
  for (let i = 0; i < lignes.length; i++) {
    const l = lignes[i];
    const t = l.trim();
    if (!t) continue;
    if (estRangTableau(l) && !estSeparateurTableau(l) && i + 1 < lignes.length && estSeparateurTableau(lignes[i + 1])) {
      const entetes = cellules(l);
      const rangs: string[][] = [];
      let j = i + 2;
      while (j < lignes.length && estRangTableau(lignes[j]) && !estSeparateurTableau(lignes[j])) { rangs.push(cellules(lignes[j])); j++; }
      blocs.push(tableauDocx(entetes, rangs));
      blocs.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
      i = j - 1;
      continue;
    }
    if (/^###\s+/.test(t)) {
      blocs.push(new Paragraph({ heading: HeadingLevel.HEADING_4, spacing: { before: 160, after: 60 }, children: runsInline(t.replace(/^###\s+/, ""), { color: VERT }) }));
    } else if (/^##\s+/.test(t)) {
      blocs.push(new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 220, after: 80 }, children: runsInline(t.replace(/^##\s+/, ""), { color: VERT }) }));
    } else if (/^[-*]\s+/.test(t)) {
      blocs.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: runsInline(t.replace(/^[-*]\s+/, "")) }));
    } else {
      blocs.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 120 }, children: runsInline(t) }));
    }
  }
  return blocs;
}

function etiquette(texte: string): Paragraph {
  return new Paragraph({ spacing: { before: 80, after: 40 }, children: [new TextRun({ text: texte.toUpperCase(), bold: true, color: VERT, size: 16 })] });
}

function quizDocx(quiz: NonNullable<ModuleDoc["quiz"]>, corrige: boolean): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  out.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: `Évaluation ${quiz.mode === "sommatif" ? "sommative (notée)" : "formative"} — seuil ${quiz.seuilReussite} %`, italics: true, color: GRIS, size: 18 })] }));
  if (quiz.consigne) out.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: quiz.consigne, italics: true })] }));
  quiz.questions.forEach((q, qi) => {
    const qcm = TYPES_CHOIX.includes(q.type);
    out.push(new Paragraph({
      spacing: { before: 120, after: 20 },
      children: [
        new TextRun({ text: `Q${qi + 1}. `, bold: true, color: VERT }),
        ...runsInline(q.enonce),
        new TextRun({ text: `  (${libelleTypeQuestion(q.type)} · ${q.points} pt)`, color: GRIS, size: 16 }),
      ],
    }));
    if (qcm) {
      q.choix.forEach((c) => {
        const bon = corrige && c.correct;
        out.push(new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 20 },
          children: [new TextRun({ text: (bon ? "☑ " : "☐ ") + c.texte, bold: bon, color: bon ? VERT : undefined })],
        }));
      });
    } else if (corrige) {
      out.push(new Paragraph({ spacing: { after: 20 }, shading: { type: ShadingType.CLEAR, color: "auto", fill: VERT_CLAIR }, children: [new TextRun({ text: "Réponse attendue : ", bold: true, color: VERT }), new TextRun(descriptionSolution(q.type, q.choix))] }));
    } else if (q.type === "association") {
      const droites = q.choix.map((c) => c.apparie ?? "").filter(Boolean).sort((a, b) => a.localeCompare(b, "fr"));
      out.push(new Paragraph({ spacing: { after: 10 }, children: [new TextRun({ text: "À relier : ", bold: true }), new TextRun(q.choix.map((c) => c.texte).join(" · "))] }));
      out.push(new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: "avec (désordre) : ", bold: true }), new TextRun(droites.join(" · "))] }));
    } else if (q.type === "remise_en_ordre") {
      const items = q.choix.map((c) => c.texte).sort((a, b) => a.localeCompare(b, "fr"));
      out.push(new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: "À remettre dans l'ordre : ", bold: true }), new TextRun(items.join(" · "))] }));
    } else {
      out.push(new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: "Complétez les espaces indiqués dans l'énoncé.", italics: true, color: GRIS })] }));
    }
    if (corrige && q.explication) {
      out.push(new Paragraph({ spacing: { after: 60 }, shading: { type: ShadingType.CLEAR, color: "auto", fill: "FBF3DC" }, children: [new TextRun({ text: "Corrigé — ", bold: true, color: OR }), new TextRun(q.explication)] }));
    }
  });
  return out;
}

function devoirDocx(devoir: NonNullable<ModuleDoc["devoir"]>): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  out.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: `Production évaluée — notée sur ${devoir.noteSur}`, bold: true, color: OR, size: 18 })] }));
  if (devoir.consigne) out.push(...contenuDocx(devoir.consigne));
  const rendu = [devoir.accepteTexte && "texte en ligne", devoir.accepteFichier && "dépôt de fichier"].filter(Boolean).join(" ou ") || "—";
  out.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: `Rendu attendu : ${rendu}${devoir.dateLimite ? ` · échéance le ${dateJour(devoir.dateLimite)}` : ""}`, color: GRIS, size: 18 })] }));
  return out;
}

export async function genererLivretDocx({ cours, corrige, logo }: { cours: CoursDoc; corrige: boolean; logo: Uint8Array | null }): Promise<Buffer> {
  // Chapitrage (identique à l'affichage) : une leçon « texte » ouvre un module ; clôture à part.
  const chapitres: { titre: string; finale: boolean; activites: ModuleDoc[] }[] = [];
  if (cours.modulesGroupes) {
    let courant: (typeof chapitres)[number] | null = null;
    let finale: (typeof chapitres)[number] | null = null;
    for (const m of cours.modules) {
      if (estFinaleTitre(m.titre)) { if (!finale) finale = { titre: "Évaluation finale et clôture", finale: true, activites: [] }; finale.activites.push(m); continue; }
      if (m.type === "texte" || courant === null) { courant = { titre: m.titre, finale: false, activites: [] }; chapitres.push(courant); }
      courant.activites.push(m);
    }
    if (finale) chapitres.push(finale);
  } else {
    for (const m of cours.modules) chapitres.push({ titre: m.titre, finale: false, activites: [m] });
  }
  const nbModules = cours.modulesGroupes ? chapitres.filter((c) => !c.finale).length : cours.modules.length;
  const nbEval = cours.modules.filter((m) => m.type === "quiz" || m.type === "devoir").length;
  const rubrique = cours.estSeminaire ? "Séminaire" : "Formation";

  const children: (Paragraph | Table)[] = [];

  // ── Couverture ──
  if (logo) {
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 600, after: 120 }, children: [new ImageRun({ type: "png", data: logo, transformation: { width: 130, height: 130 } })] }));
  }
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: "EDUWEB PLANNER · ACADÉMIE", bold: true, color: VERT, size: 22 })] }));
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: `${rubrique.toUpperCase()} · LIVRET ${corrige ? "DU FORMATEUR" : "DE L'APPRENANT"}`, bold: true, color: OR, size: 18 })] }));
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [new TextRun({ text: cours.titre, bold: true, color: VERT, size: 44 })] }));
  if (cours.description) children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 200 }, children: runsInline(cours.description) }));
  const stats = [`${nbModules} module(s)`, `${nbEval} évaluation(s)`, cours.dureeMinutes ? `Durée estimée ${cours.dureeMinutes} min` : null, cours.niveau ? `Niveau ${NIVEAUX[cours.niveau] ?? cours.niveau}` : null].filter(Boolean).join("   ·   ");
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: stats, color: GRIS })] }));
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: `${cours.categorie?.nom ? cours.categorie.nom + " · " : ""}${corrige ? "Document du formateur (corrigés inclus)" : "Livret de l'apprenant (sans les réponses)"}`, italics: true, color: OR, size: 18 })] }));
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Édité le ${dateJour(new Date())}`, color: GRIS, size: 16 })] }));

  // ── Sommaire ──
  children.push(new Paragraph({ pageBreakBefore: true, heading: HeadingLevel.HEADING_1, spacing: { after: 120 }, children: [new TextRun({ text: "Sommaire", color: VERT })] }));
  chapitres.forEach((ch, i) => children.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: `${i + 1}.  `, bold: true, color: VERT }), new TextRun(ch.titre), new TextRun({ text: `   — ${ch.activites.length} activité(s)`, color: GRIS, size: 18 })] })));

  // ── Chapitres (modules) ──
  chapitres.forEach((ch, ci) => {
    if (cours.modulesGroupes) {
      // Page intercalaire : titre du module isolé, contenu à la page suivante.
      children.push(new Paragraph({ pageBreakBefore: true, alignment: AlignmentType.CENTER, spacing: { before: 2600, after: 120 }, children: [new TextRun({ text: String(ci + 1).padStart(2, "0"), bold: true, color: VERT, size: 96 })] }));
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: ch.finale ? "CLÔTURE" : `MODULE ${ci + 1}`, bold: true, color: OR, size: 20 })] }));
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: ch.titre, bold: true, color: VERT, size: 40 })] }));
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${ch.activites.length} activité(s)`, color: GRIS })] }));
      children.push(new Paragraph({ pageBreakBefore: true, children: [] }));
    } else {
      children.push(new Paragraph({ pageBreakBefore: ci > 0, heading: HeadingLevel.HEADING_1, spacing: { before: 120, after: 80 }, children: [new TextRun({ text: `${ci + 1}. ${ch.titre}`, color: VERT })] }));
    }
    ch.activites.forEach((m, ai) => {
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 20 }, children: [new TextRun({ text: `${ci + 1}.${ai + 1}  ${m.titre}`, color: VERT })] }));
      children.push(etiquette(libelleTypeModule(m.type)));
      if (m.type === "texte" && m.contenu) children.push(...contenuDocx(m.contenu));
      else if (m.type === "video" && m.contenu) children.push(new Paragraph({ children: [new TextRun({ text: "Ressource vidéo : ", bold: true }), new TextRun(m.contenu)] }));
      else if (m.type === "fichier") children.push(new Paragraph({ children: [new TextRun({ text: "Document joint : ", bold: true }), new TextRun(`${m.fichierNom ?? "fichier"}${m.fichierUrl ? ` — ${m.fichierUrl}` : ""}`)] }));
      else if (m.type === "lien" && m.contenu) children.push(new Paragraph({ children: [new TextRun({ text: "Ressource externe : ", bold: true }), new TextRun(m.contenu)] }));
      else if (m.type === "quiz" && m.quiz) children.push(...quizDocx(m.quiz, corrige));
      else if (m.type === "devoir" && m.devoir) children.push(...devoirDocx(m.devoir));
    });
  });

  // ── Pied de marque ──
  if (cours.attestationSignataire) children.push(new Paragraph({ pageBreakBefore: false, spacing: { before: 400 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${cours.attestationSignataire}${cours.attestationFonction ? " · " + cours.attestationFonction : ""}`, color: GRIS })] }));

  const doc = new Document({
    creator: "EduWeb Planner",
    title: `Livret — ${cours.titre}`,
    sections: [{
      properties: { page: { margin: { top: 900, bottom: 1100, left: 1000, right: 1000 } } },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "EduWeb Planner — Livret de formation    ", color: GRIS, size: 16 }),
              new TextRun({ text: "Page ", color: GRIS, size: 16 }),
              new TextRun({ children: [PageNumber.CURRENT], color: GRIS, size: 16 }),
              new TextRun({ text: " / ", color: GRIS, size: 16 }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], color: GRIS, size: 16 }),
            ],
          })],
        }),
      },
      children,
    }],
  });

  return await Packer.toBuffer(doc);
}
