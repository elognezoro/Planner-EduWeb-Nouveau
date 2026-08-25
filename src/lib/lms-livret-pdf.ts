import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { estHtmlRiche, descriptionSolution, TYPES_CHOIX, TYPES_QUESTION, TYPES_MODULE } from "@/lib/lms";
import type { CoursDoc, ModuleDoc } from "@/lib/lms-livret-docx";

/**
 * Génération d'un vrai PDF PAGINÉ du livret d'un cours (moteur de mise en page maison sur pdf-lib :
 * texte justifié avec retour à la ligne, titres, listes, tableaux, pages intercalaires de module,
 * et pied de page « Page X / Y » sur CHAQUE page). Deux versions : apprenant (sans réponses) /
 * formateur (?corrige=1, corrigés). Fiable en serverless (aucun Chromium).
 */

const FOREST = rgb(0.106, 0.369, 0.125);
const GOLD = rgb(0.722, 0.525, 0.043);
const GRAY = rgb(0.42, 0.48, 0.44);
const INK = rgb(0.13, 0.15, 0.14);
const CREME = rgb(0.953, 0.937, 0.902);
const BORDER = rgb(0.85, 0.81, 0.75);

const NIVEAUX: Record<string, string> = { debutant: "Débutant", intermediaire: "Intermédiaire", avance: "Avancé" };
const libelleTypeModule = (v: string) => TYPES_MODULE.find((t) => t.v === v)?.libelle ?? v;
const libelleTypeQuestion = (v: string) => TYPES_QUESTION.find((t) => t.v === v)?.libelle ?? v;
const dateJour = (d: Date) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
const estFinaleTitre = (t: string) => /évaluation sommative|production finale|questionnaire de satisfaction|évaluation finale/i.test(t);

function normaliser(texte: string): string {
  if (!estHtmlRiche(texte)) return texte;
  return texte
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n")
    .replace(/<h[12][^>]*>/gi, "## ").replace(/<h[3-6][^>]*>/gi, "### ").replace(/<li[^>]*>/gi, "- ")
    .replace(/<(strong|b)\b[^>]*>/gi, "**").replace(/<\/(strong|b)>/gi, "**")
    .replace(/<(em|i)\b[^>]*>/gi, "*").replace(/<\/(em|i)>/gi, "*")
    .replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n");
}
const stripMarques = (s: string) => s.replace(/\*\*/g, "").replace(/\*/g, "");

// Les polices standard pdf-lib encodent en WinAnsi (CP1252). On remplace d'abord quelques symboles
// hors jeu (flèches), puis on retire tout caractère non encodable pour éviter une exception à
// l'écriture. Les caractères CP1252 (guillemets fins, tirets, points de suspension, €, œ) restent.
const CP1252_SUP = new Set([0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178]);
const safe = (s: string): string => {
  const pre = s.replace(/→/g, "->").replace(/←/g, "<-").replace(/↔/g, "<->").replace(/⇒/g, "=>");
  let out = "";
  for (const ch of pre) {
    const c = ch.codePointAt(0)!;
    if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || CP1252_SUP.has(c)) out += ch;
  }
  return out;
};

const estRangTableau = (l: string) => { const x = l.trim(); return x.startsWith("|") && x.endsWith("|") && x.length > 1; };
const estSepTableau = (l: string) => { const x = l.trim(); return x.includes("|") && x.includes("-") && /^[\s|:-]+$/.test(x); };
const cellules = (l: string) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

type Seg = { text: string; bold: boolean; italic: boolean };
function tokenize(s: string): Seg[] {
  const t = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1");
  const out: Seg[] = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let last = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    if (m.index > last) out.push({ text: t.slice(last, m.index), bold: false, italic: false });
    if (m[2] !== undefined) out.push({ text: m[2], bold: true, italic: false });
    else if (m[3] !== undefined) out.push({ text: m[3], bold: false, italic: true });
    last = re.lastIndex;
  }
  if (last < t.length) out.push({ text: t.slice(last), bold: false, italic: false });
  return out.length ? out : [{ text: t, bold: false, italic: false }];
}

export async function genererLivretPdf({ cours, corrige, logo }: { cours: CoursDoc; corrige: boolean; logo: Uint8Array | null }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fReg = await doc.embedFont(StandardFonts.Helvetica);
  const fBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fItal = await doc.embedFont(StandardFonts.HelveticaOblique);
  const fBoldItal = await doc.embedFont(StandardFonts.HelveticaBoldOblique);
  const png = logo ? await doc.embedPng(logo).catch(() => null) : null;

  const W = 595.28, H = 841.89, M = 54, CW = W - 2 * M;
  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let y = 0;
  const newPage = () => { page = doc.addPage([W, H]); pages.push(page); y = H - M; };
  const ensure = (h: number) => { if (y - h < M) newPage(); };
  const pickFont = (b: boolean, i: boolean) => (b && i ? fBoldItal : b ? fBold : i ? fItal : fReg);

  // Bloc simple : une seule police, alignement gauche/centre, retour à la ligne.
  function simple(text: string, o: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; align?: "left" | "center"; x?: number; maxWidth?: number; gapAfter?: number; lineGap?: number } = {}) {
    const font = o.font ?? fReg, size = o.size ?? 11, color = o.color ?? INK, align = o.align ?? "left";
    const x = o.x ?? M, maxWidth = o.maxWidth ?? CW, gapAfter = o.gapAfter ?? 4, lineGap = o.lineGap ?? 1.35;
    const spaceW = font.widthOfTextAtSize(" ", size);
    const mots = stripMarques(safe(text)).split(/\s+/).filter(Boolean);
    const lignes: { wd: string; ww: number }[][] = [];
    let cur: { wd: string; ww: number }[] = [], curW = 0;
    for (const wd of mots) {
      const ww = font.widthOfTextAtSize(wd, size);
      if (cur.length && curW + spaceW + ww > maxWidth) { lignes.push(cur); cur = []; curW = 0; }
      curW = cur.length ? curW + spaceW + ww : ww;
      cur.push({ wd, ww });
    }
    if (cur.length) lignes.push(cur);
    const lh = size * lineGap;
    for (const ligne of lignes) {
      ensure(lh);
      const lw = ligne.reduce((s, o2) => s + o2.ww, 0) + spaceW * (ligne.length - 1);
      let cx = align === "center" ? x + (maxWidth - lw) / 2 : x;
      for (const o2 of ligne) { page.drawText(o2.wd, { x: cx, y: y - size, size, font, color }); cx += o2.ww + spaceW; }
      y -= lh;
    }
    y -= gapAfter;
  }

  // Paragraphe avec styles inline (**gras**, *italique*) et justification optionnelle.
  function para(text: string, o: { size?: number; color?: ReturnType<typeof rgb>; justify?: boolean; x?: number; maxWidth?: number; gapAfter?: number; lineGap?: number } = {}) {
    const size = o.size ?? 10.5, color = o.color ?? INK, justify = o.justify ?? true;
    const x = o.x ?? M, maxWidth = o.maxWidth ?? CW, gapAfter = o.gapAfter ?? 6, lineGap = o.lineGap ?? 1.45;
    const spaceW = fReg.widthOfTextAtSize(" ", size);
    const mots: { t: string; f: PDFFont; w: number }[] = [];
    for (const seg of tokenize(safe(text))) {
      const f = pickFont(seg.bold, seg.italic);
      for (const w of seg.text.split(/\s+/)) { if (!w) continue; mots.push({ t: w, f, w: f.widthOfTextAtSize(w, size) }); }
    }
    if (!mots.length) return;
    const lignes: { t: string; f: PDFFont; w: number }[][] = [];
    let cur: typeof mots = [], curW = 0;
    for (const mot of mots) {
      if (cur.length && curW + spaceW + mot.w > maxWidth) { lignes.push(cur); cur = []; curW = 0; }
      curW = cur.length ? curW + spaceW + mot.w : mot.w;
      cur.push(mot);
    }
    if (cur.length) lignes.push(cur);
    const lh = size * lineGap;
    lignes.forEach((ligne, idx) => {
      ensure(lh);
      const isLast = idx === lignes.length - 1;
      let gap = spaceW;
      if (justify && !isLast && ligne.length > 1) {
        const lw = ligne.reduce((s, w) => s + w.w, 0) + spaceW * (ligne.length - 1);
        gap = spaceW + (maxWidth - lw) / (ligne.length - 1);
      }
      let cx = x;
      for (const w of ligne) { page.drawText(w.t, { x: cx, y: y - size, size, font: w.f, color }); cx += w.w + gap; }
      y -= lh;
    });
    y -= gapAfter;
  }

  function puce(text: string) {
    const size = 10.5;
    ensure(size * 1.45);
    page.drawText("-", { x: M + 4, y: y - size, size, font: fBold, color: FOREST });
    para(text, { x: M + 16, maxWidth: CW - 16, justify: false, gapAfter: 2 });
  }

  function wrapPlain(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
    const spaceW = font.widthOfTextAtSize(" ", size);
    const out: string[] = []; let cur = "", curW = 0;
    for (const wd of stripMarques(safe(text)).split(/\s+/).filter(Boolean)) {
      const ww = font.widthOfTextAtSize(wd, size);
      if (cur && curW + spaceW + ww > maxWidth) { out.push(cur); cur = ""; curW = 0; }
      cur = cur ? cur + " " + wd : wd; curW = cur === wd ? ww : curW + spaceW + ww;
    }
    if (cur) out.push(cur);
    return out.length ? out : [""];
  }

  function tableau(entetes: string[], rangs: string[][]) {
    const n = entetes.length; if (!n) return;
    const colW = CW / n, pad = 5, size = 9.5, lh = size * 1.3;
    for (const [ri, row] of [entetes, ...rangs].entries()) {
      const f = ri === 0 ? fBold : fReg, col = ri === 0 ? FOREST : INK;
      const cellLines = row.map((c) => wrapPlain(c, f, size, colW - 2 * pad));
      const rowH = Math.max(1, ...cellLines.map((l) => l.length)) * lh + 2 * pad;
      ensure(rowH);
      const top = y;
      if (ri === 0) page.drawRectangle({ x: M, y: top - rowH, width: CW, height: rowH, color: CREME });
      row.forEach((_, ci) => {
        let ty = top - pad;
        for (const ln of cellLines[ci]) { page.drawText(ln, { x: M + ci * colW + pad, y: ty - size, size, font: f, color: col }); ty -= lh; }
      });
      page.drawLine({ start: { x: M, y: top }, end: { x: M + CW, y: top }, thickness: 0.5, color: BORDER });
      page.drawLine({ start: { x: M, y: top - rowH }, end: { x: M + CW, y: top - rowH }, thickness: 0.5, color: BORDER });
      for (let ci = 0; ci <= n; ci++) page.drawLine({ start: { x: M + ci * colW, y: top }, end: { x: M + ci * colW, y: top - rowH }, thickness: 0.5, color: BORDER });
      y = top - rowH;
    }
    y -= 8;
  }

  function contenu(texte: string) {
    const lignes = normaliser(texte).split(/\r?\n/);
    for (let i = 0; i < lignes.length; i++) {
      const l = lignes[i], t = l.trim();
      if (!t) continue;
      if (estRangTableau(l) && !estSepTableau(l) && i + 1 < lignes.length && estSepTableau(lignes[i + 1])) {
        const entetes = cellules(l); const rangs: string[][] = []; let j = i + 2;
        while (j < lignes.length && estRangTableau(lignes[j]) && !estSepTableau(lignes[j])) { rangs.push(cellules(lignes[j])); j++; }
        tableau(entetes, rangs); i = j - 1; continue;
      }
      if (/^###\s+/.test(t)) simple(t.replace(/^###\s+/, ""), { font: fBold, size: 11, color: FOREST, gapAfter: 3 });
      else if (/^##\s+/.test(t)) simple(t.replace(/^##\s+/, ""), { font: fBold, size: 12.5, color: FOREST, gapAfter: 4 });
      else if (/^[-*]\s+/.test(t)) puce(t.replace(/^[-*]\s+/, ""));
      else para(t, { justify: true });
    }
  }

  function quiz(q: NonNullable<ModuleDoc["quiz"]>) {
    simple(`Évaluation ${q.mode === "sommatif" ? "sommative (notée)" : "formative"} - seuil ${q.seuilReussite} %`, { font: fItal, size: 9, color: GRAY, gapAfter: 4 });
    if (q.consigne) simple(q.consigne, { font: fItal, size: 10, color: GRAY, gapAfter: 6 });
    q.questions.forEach((qu, qi) => {
      ensure(30);
      para(`**Q${qi + 1}.** ${qu.enonce}  (${libelleTypeQuestion(qu.type)} · ${qu.points} pt)`, { justify: false, gapAfter: 3 });
      const qcm = TYPES_CHOIX.includes(qu.type);
      if (qcm) {
        for (const c of qu.choix) {
          const bon = corrige && c.correct;
          para(`${bon ? "**[x] " : "[ ] "}${c.texte}${bon ? "**" : ""}`, { x: M + 14, maxWidth: CW - 14, justify: false, color: bon ? FOREST : INK, gapAfter: 2 });
        }
      } else if (corrige) {
        para(`**Réponse attendue :** ${descriptionSolution(qu.type, qu.choix)}`, { x: M + 14, maxWidth: CW - 14, justify: false, color: FOREST, gapAfter: 2 });
      } else if (qu.type === "association") {
        const droites = qu.choix.map((c) => c.apparie ?? "").filter(Boolean).sort((a, b) => a.localeCompare(b, "fr"));
        para(`**À relier :** ${qu.choix.map((c) => c.texte).join(" · ")}`, { x: M + 14, maxWidth: CW - 14, justify: false, gapAfter: 1 });
        para(`**avec (désordre) :** ${droites.join(" · ")}`, { x: M + 14, maxWidth: CW - 14, justify: false, gapAfter: 2 });
      } else if (qu.type === "remise_en_ordre") {
        para(`**À remettre dans l'ordre :** ${qu.choix.map((c) => c.texte).sort((a, b) => a.localeCompare(b, "fr")).join(" · ")}`, { x: M + 14, maxWidth: CW - 14, justify: false, gapAfter: 2 });
      } else {
        para("*Complétez les espaces indiqués dans l'énoncé.*", { x: M + 14, maxWidth: CW - 14, justify: false, color: GRAY, gapAfter: 2 });
      }
      if (corrige && qu.explication) para(`**Corrigé -** ${qu.explication}`, { x: M + 14, maxWidth: CW - 14, justify: false, color: INK, gapAfter: 6 });
    });
  }

  function devoir(d: NonNullable<ModuleDoc["devoir"]>) {
    simple(`Production évaluée - notée sur ${d.noteSur}`, { font: fBold, size: 9.5, color: GOLD, gapAfter: 4 });
    if (d.consigne) contenu(d.consigne);
    const rendu = [d.accepteTexte && "texte en ligne", d.accepteFichier && "dépôt de fichier"].filter(Boolean).join(" ou ") || "-";
    simple(`Rendu attendu : ${rendu}${d.dateLimite ? ` · échéance le ${dateJour(d.dateLimite)}` : ""}`, { size: 9, color: GRAY, gapAfter: 4 });
  }

  // ── Chapitrage (identique à l'affichage) ──
  const chapitres: { titre: string; finale: boolean; activites: ModuleDoc[] }[] = [];
  if (cours.modulesGroupes) {
    let courant: (typeof chapitres)[number] | null = null; let finale: (typeof chapitres)[number] | null = null;
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

  // ── Couverture ──
  newPage();
  y = H - 130;
  if (png) { const s = 120; page.drawImage(png, { x: (W - s) / 2, y: y - s, width: s, height: s }); y -= s + 16; }
  simple("EDUWEB PLANNER · ACADÉMIE", { font: fBold, size: 11, color: FOREST, align: "center", gapAfter: 6 });
  simple(`${rubrique.toUpperCase()} · LIVRET ${corrige ? "DU FORMATEUR" : "DE L'APPRENANT"}`, { font: fBold, size: 9, color: GOLD, align: "center", gapAfter: 16 });
  simple(cours.titre, { font: fBold, size: 22, color: FOREST, align: "center", gapAfter: 12, lineGap: 1.2 });
  if (cours.description) para(cours.description, { size: 10.5, gapAfter: 14 });
  const stats = [`${nbModules} module(s)`, `${nbEval} évaluation(s)`, cours.dureeMinutes ? `Durée estimée ${cours.dureeMinutes} min` : null, cours.niveau ? `Niveau ${NIVEAUX[cours.niveau] ?? cours.niveau}` : null].filter(Boolean).join("   ·   ");
  simple(stats, { size: 10, color: GRAY, align: "center", gapAfter: 8 });
  simple(`${cours.categorie?.nom ? cours.categorie.nom + " · " : ""}${corrige ? "Document du formateur (corrigés inclus)" : "Livret de l'apprenant (sans les réponses)"}`, { font: fItal, size: 9.5, color: GOLD, align: "center", gapAfter: 4 });
  simple(`Édité le ${dateJour(new Date())}`, { size: 8.5, color: GRAY, align: "center" });

  // ── Sommaire ──
  newPage();
  simple("Sommaire", { font: fBold, size: 16, color: FOREST, gapAfter: 10 });
  chapitres.forEach((ch, i) => para(`**${i + 1}.**  ${ch.titre}  (${ch.activites.length} activité(s))`, { justify: false, gapAfter: 3 }));

  // ── Chapitres ──
  chapitres.forEach((ch, ci) => {
    if (cours.modulesGroupes) {
      newPage();
      y = H / 2 + 90;
      simple(String(ci + 1).padStart(2, "0"), { font: fBold, size: 64, color: FOREST, align: "center", gapAfter: 10 });
      simple(ch.finale ? "CLÔTURE" : `MODULE ${ci + 1}`, { font: fBold, size: 13, color: GOLD, align: "center", gapAfter: 8 });
      simple(ch.titre, { font: fBold, size: 22, color: FOREST, align: "center", gapAfter: 8, lineGap: 1.2 });
      simple(`${ch.activites.length} activité(s)`, { size: 11, color: GRAY, align: "center" });
      newPage();
    } else {
      if (ci > 0) newPage();
      simple(`${ci + 1}. ${ch.titre}`, { font: fBold, size: 15, color: FOREST, gapAfter: 8 });
    }
    ch.activites.forEach((m, ai) => {
      ensure(40);
      simple(`${ci + 1}.${ai + 1}  ${m.titre}`, { font: fBold, size: 13, color: FOREST, gapAfter: 2 });
      simple(libelleTypeModule(m.type).toUpperCase(), { font: fBold, size: 8, color: GOLD, gapAfter: 6 });
      if (m.type === "texte" && m.contenu) contenu(m.contenu);
      else if (m.type === "video" && m.contenu) para(`**Ressource vidéo :** ${m.contenu}`, { justify: false });
      else if (m.type === "fichier") para(`**Document joint :** ${m.fichierNom ?? "fichier"}${m.fichierUrl ? ` - ${m.fichierUrl}` : ""}`, { justify: false });
      else if (m.type === "lien" && m.contenu) para(`**Ressource externe :** ${m.contenu}`, { justify: false });
      else if (m.type === "quiz" && m.quiz) quiz(m.quiz);
      else if (m.type === "devoir" && m.devoir) devoir(m.devoir);
      y -= 6;
    });
  });

  // ── Pieds de page (numéros) : passe finale, une fois le total connu ──
  const N = pages.length;
  pages.forEach((pg, i) => {
    const label = `Page ${i + 1} / ${N}`;
    const lw = fReg.widthOfTextAtSize(label, 8);
    pg.drawText(safe("EduWeb Planner — Livret de formation"), { x: M, y: 30, size: 7.5, font: fReg, color: GRAY });
    pg.drawText(label, { x: (W - lw) / 2, y: 30, size: 8, font: fReg, color: GRAY });
  });

  return await doc.save();
}
