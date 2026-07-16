import { estHtmlRiche, rendreTexteRiche, estUrlHttp } from "@/lib/lms";
import { sanitiserHtmlRiche } from "@/lib/html-riche";
import type { ManuelData, LeconManuel, QuizManuel, QuestionManuel } from "./donnees";

export type CtxManuel = {
  intitulePays: string;
  devise: string;
  ministere: string;
  emblemeUrl?: string;
  logoUrl: string;
  dateGeneration: string;
};

const eh = (v: string): string =>
  (v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const TYPE_QUESTION_LIB: Record<string, string> = {
  choix_unique: "Choix unique",
  choix_multiple: "Choix multiples",
  vrai_faux: "Vrai / Faux",
  association: "Association",
  texte_a_trous: "Texte à trous",
  remise_en_ordre: "Remise en ordre",
};

/** Corrigé du formateur d'une question (bonnes réponses mises en évidence). */
function corrigeQuestion(q: QuestionManuel, n: number): string {
  let corps = "";
  if (q.type === "association") {
    corps = `<ul class="corr">${q.choix.map((c) => `<li>${eh(c.texte)} <b>→ ${eh(c.apparie ?? "")}</b></li>`).join("")}</ul>`;
  } else if (q.type === "texte_a_trous") {
    corps = `<ul class="corr">${q.choix
      .map((c, i) => `<li>Trou ${i + 1} : <b>${eh(c.texte)}</b>${c.apparie ? ` <span class="note">(accepté aussi : ${eh(c.apparie.split("|").join(", "))})</span>` : ""}</li>`)
      .join("")}</ul>`;
  } else if (q.type === "remise_en_ordre") {
    corps = `<ol class="corr">${q.choix.map((c) => `<li>${eh(c.texte)}</li>`).join("")}</ol>`;
  } else {
    corps = `<ul class="corr">${q.choix
      .map((c) => (c.correct ? `<li class="ok">✔ <b>${eh(c.texte)}</b></li>` : `<li>○ ${eh(c.texte)}</li>`))
      .join("")}</ul>`;
  }
  return `<div class="q"><p class="q-en"><b>Q${n}.</b> ${eh(q.enonce)} <span class="q-type">${eh(TYPE_QUESTION_LIB[q.type] ?? q.type)}</span></p>${corps}${
    q.explication ? `<p class="q-exp">💡 ${eh(q.explication)}</p>` : ""
  }</div>`;
}

/** Corrigé complet d'un quiz (réservé au document du formateur). */
function corrigeQuiz(quiz: QuizManuel): string {
  const entete = `<p class="eval">✔ Quiz interactif — à réaliser en ligne par les apprenants (seuil de réussite : ${quiz.seuilReussite} %). Ci-dessous, le <b>corrigé du formateur</b>.</p>`;
  const consigne = quiz.consigne ? `<p class="note">Consigne : ${eh(quiz.consigne)}</p>` : "";
  return entete + consigne + quiz.questions.map((q, i) => corrigeQuestion(q, i + 1)).join("");
}

/** Rendu du corps d'une leçon selon son type (texte riche / lien / évaluation). */
function corpsLecon(l: LeconManuel): string {
  const c = l.contenu ?? "";
  switch (l.type) {
    case "video":
      return estUrlHttp(c) ? `<p class="ress">▶ Vidéo : <a href="${eh(c)}">${eh(c)}</a></p>` : "";
    case "lien":
      return estUrlHttp(c) ? `<p class="ress">🔗 Ressource : <a href="${eh(c)}">${eh(c)}</a></p>` : "";
    case "fichier":
      return `<p class="ress">📎 Document joint à consulter en ligne.</p>`;
    case "quiz":
      return l.quiz && l.quiz.questions.length > 0
        ? corrigeQuiz(l.quiz)
        : `<p class="eval">✔ Évaluation (quiz) — à réaliser en ligne sur la plateforme.</p>`;
    case "devoir":
      return `<p class="eval">✎ Devoir à déposer en ligne (corrigé par un tuteur).</p>`;
    default:
      if (!c.trim()) return "";
      // Le manuel est un document HTML autonome (non inerte comme React) : re-sanitise le HTML
      // des leçons avant injection (défense en profondeur, en plus de la sanitisation à l'écriture).
      return estHtmlRiche(c) ? sanitiserHtmlRiche(c) : rendreTexteRiche(c);
  }
}

const SYLLABUS: { t: string; h: string }[] = [
  { t: "1. Identification", h: `<p>Le présent manuel constitue le <b>support de formation officiel</b> des utilisateurs d'EduWeb Planner. Il est structuré en <b>un module par rôle</b> réellement disponible sur la plateforme et se met à jour automatiquement au fil de l'évolution des fonctionnalités.</p>` },
  { t: "2. Présentation générale", h: `<p>EduWeb Planner est une plateforme de gestion et de planification scolaire à interface unique, adaptée dynamiquement au rôle de chaque utilisateur (contrôle d'accès par rôle et par périmètre). Ce manuel accompagne la prise en main de chaque profil, des tâches quotidiennes aux fonctions de pilotage.</p>` },
  { t: "3. Public et prérequis", h: `<p>Ce support s'adresse à l'ensemble des acteurs de la communauté éducative : administrateurs, personnels de direction et d'encadrement, enseignants, éducateurs, parents et élèves. Aucun prérequis technique n'est exigé ; une connexion Internet et un compte actif suffisent.</p>` },
  { t: "4. Objectifs généraux", h: `<ul><li>Maîtriser les fonctions correspondant à son rôle et à son périmètre.</li><li>Adopter les bonnes pratiques de saisie, de suivi et de communication.</li><li>Garantir la fiabilité et la confidentialité des données scolaires.</li><li>Gagner en autonomie et en efficacité au quotidien.</li></ul>` },
  { t: "5. Compétences visées (référentiel à 4 dimensions)", h: `<ul><li><b>Savoir :</b> comprendre l'architecture des rôles, des périmètres et des habilitations.</li><li><b>Savoir-faire :</b> exécuter les tâches propres à son profil (saisies, suivis, éditions).</li><li><b>Savoir-être :</b> respecter la déontologie, la confidentialité et la coopération.</li><li><b>Savoir-agir :</b> résoudre des situations concrètes et accompagner ses pairs.</li></ul>` },
  { t: "6. Méthodologie pédagogique", h: `<p>Formation en autonomie guidée : lecture des modules, mises en situation, quiz d'auto-évaluation et devoirs corrigés. Chaque module combine repères théoriques, procédures pas-à-pas et cas pratiques.</p>` },
  { t: "7. Volume horaire et progression", h: `<p>Le volume horaire est indicatif et cumulé par module. La progression est libre, un rôle pouvant être approfondi indépendamment des autres.</p>` },
  { t: "8. Modalités d'évaluation", h: `<p>L'évaluation s'appuie sur des quiz (formatifs et sommatifs) et, le cas échéant, des devoirs à dépôt corrigés par un tuteur. La réussite des quiz sommatifs conditionne la validation.</p>` },
  { t: "9. Critères de validation", h: `<p>Un module est validé lorsque le seuil de complétion défini (par défaut 100 % des leçons) est atteint et que les évaluations obligatoires sont réussies. Une attestation peut alors être délivrée.</p>` },
  { t: "10. Ressources et bibliographie", h: `<p>Guides par rôle intégrés, aide contextuelle, centre de formation, séminaires thématiques et présent manuel. Les ressources sont accessibles en continu depuis l'espace « Aide et Formation ».</p>` },
  { t: "11. Charte de l'apprenant", h: `<p>L'apprenant s'engage à un usage responsable de la plateforme : exactitude des saisies, respect de la vie privée, confidentialité des identifiants et coopération bienveillante avec les autres acteurs.</p>` },
];

const GLOSSAIRE: [string, string][] = [
  ["RBAC", "Contrôle d'accès basé sur les rôles (Role-Based Access Control) : chaque utilisateur a un rôle ET un périmètre."],
  ["Périmètre (scope)", "Étendue des données accessibles à un utilisateur (établissement, CAFOP, APFC, région, pays…)."],
  ["LMS", "Espace d'apprentissage en ligne (Learning Management System) : cours, leçons, quiz, devoirs, attestations."],
  ["EDT", "Emploi du temps généré par le solveur de contraintes."],
  ["CAFOP", "Centre d'Animation et de Formation Pédagogique."],
  ["APFC", "Antenne Pédagogique de Formation Continue."],
  ["DRENA / DRENAET", "Direction Régionale de l'Éducation Nationale (et de l'Enseignement Technique)."],
  ["ACE", "Adjoint au Chef d'Établissement."],
  ["ADC", "Adjoint au Directeur de CAFOP."],
  ["DELC", "Directeur Central en charge des établissements."],
  ["Mode aperçu", "Visualisation, par un administrateur, de l'interface d'un autre rôle (lecture seule par défaut)."],
  ["Attestation", "Document délivré à la validation d'un cours ou d'un parcours."],
];

const CSS = `
  *{box-sizing:border-box}
  body{font-family:'Segoe UI',system-ui,Arial,sans-serif;color:#1a2b22;margin:0;background:#f2f4f2;font-size:13px;line-height:1.55}
  .feuille{max-width:820px;margin:0 auto;background:#fff;padding:26px 40px 48px}
  a{color:#14663a}
  h1,h2,h3,h4{font-family:Georgia,'Times New Roman',serif}
  .cover{text-align:center;padding:26px 10px 34px;border-bottom:3px double #14663a;margin-bottom:22px;break-after:page}
  .cover .pays{font-size:14px;font-weight:700;letter-spacing:.04em;color:#14532d;text-transform:uppercase}
  .cover .devise{font-size:12px;font-style:italic;color:#555;margin-top:2px}
  .cover .min{font-size:12px;font-weight:600;color:#333;margin-top:6px}
  .cover .logos{display:flex;align-items:center;justify-content:center;gap:26px;margin:18px 0}
  .cover .logos img{height:76px;width:auto;object-fit:contain}
  .cover h1{font-size:28px;color:#14532d;margin:14px 0 6px}
  .cover .st{font-size:15px;color:#444;margin:0 0 14px}
  .cover .ref{display:inline-block;font-size:12px;color:#14663a;border:1px solid #cbe0d2;border-radius:20px;padding:4px 14px;background:#f2faf5}
  .cover .gen{font-size:11px;color:#889;margin-top:10px}
  h2.sec{font-size:19px;color:#14532d;border-left:5px solid #d4b24c;padding-left:10px;margin:28px 0 10px}
  h3.mod{font-size:16px;color:#14532d;margin:22px 0 2px}
  .mod-meta{font-size:11px;color:#7a8a80;margin:0 0 8px;text-transform:uppercase;letter-spacing:.03em}
  .mod-desc{background:#f4f9f5;border:1px solid #e0ece3;border-radius:8px;padding:9px 12px;margin:0 0 12px;color:#33463c}
  .lecon{margin:0 0 14px}
  .lecon h4{font-size:14px;color:#1f4d36;margin:12px 0 3px}
  .lecon .ress,.lecon .eval{background:#faf6ea;border:1px solid #ecdfc0;border-radius:6px;padding:6px 10px;font-size:12px;color:#6b5a2a}
  .restreint{background:#fdf1f1;border:1px solid #e7b9b9;border-radius:8px;padding:8px 12px;margin:10px 0 0;font-size:12px;color:#8a3030;font-weight:600}
  h4.form-t{font-size:14.5px;color:#7a5a10;background:#fdf8ea;border-left:5px solid #d4b24c;padding:6px 10px;margin:18px 0 8px}
  .q{border:1px solid #e0e8e2;border-left:4px solid #14663a;border-radius:6px;padding:8px 12px;margin:0 0 8px;background:#fbfdfb}
  .q .q-en{margin:0 0 4px}
  .q .q-type{font-size:10px;color:#7a8a80;text-transform:uppercase;letter-spacing:.04em;border:1px solid #dfe8e2;border-radius:10px;padding:1px 7px;margin-left:6px;white-space:nowrap}
  .q ul.corr,.q ol.corr{margin:4px 0;padding-left:20px}
  .q ul.corr{list-style:none;padding-left:6px}
  .q li.ok b{color:#14663a}
  .q .q-exp{margin:5px 0 0;font-size:12px;font-style:italic;color:#5a6b60;background:#f4f9f5;border-radius:6px;padding:5px 9px}
  .syll{margin:6px 0 4px}
  .syll h3{font-size:14px;color:#14532d;margin:14px 0 3px}
  .toc{columns:2;column-gap:26px;font-size:12.5px}
  .toc .row{break-inside:avoid;margin:0 0 3px;color:#33463c}
  .toc .c{color:#14663a;font-weight:700;font-family:Georgia,serif}
  table.gloss{width:100%;border-collapse:collapse;font-size:12.5px}
  table.gloss td{border:1px solid #e0e8e2;padding:6px 9px;vertical-align:top}
  table.gloss td.k{font-weight:700;color:#14532d;white-space:nowrap;background:#f4f9f5;width:150px}
  ul,ol{margin:6px 0;padding-left:22px}
  li{margin:3px 0}
  .note{font-size:11px;color:#889;font-style:italic}
  @media print{
    body{background:#fff;font-size:11.5px}
    .feuille{max-width:none;padding:0}
    a{color:#14532d;text-decoration:none}
    h3.mod{break-after:avoid}
    .lecon,.toc .row,table.gloss tr{break-inside:avoid}
    @page{size:A4;margin:15mm 16mm}
  }
`;

const PORTEE_LIB: Record<string, string> = {
  global: "Périmètre global (tous pays)", etablissement: "Périmètre : établissement", cafop: "Périmètre : CAFOP",
  apfc: "Périmètre : APFC", antenne: "Périmètre : antenne", region: "Périmètre : région",
  pays: "Périmètre : pays", personnel: "Périmètre : personnel",
};

/** Document HTML autonome du manuel académique. `pourWord` ajuste l'entête Office. */
export function construireManuelHtml(data: ManuelData, ctx: CtxManuel, opts: { autoImpression?: boolean; pourWord?: boolean } = {}): string {
  const cover = `
    <div class="cover">
      <div class="pays">${eh(ctx.intitulePays)}</div>
      ${ctx.devise ? `<div class="devise">${eh(ctx.devise)}</div>` : ""}
      <div class="min">${eh(ctx.ministere)}</div>
      <div class="logos">
        ${ctx.emblemeUrl ? `<img src="${eh(ctx.emblemeUrl)}" alt="Armoiries" onerror="this.style.display='none'">` : ""}
        <img src="${eh(ctx.logoUrl)}" alt="EduWeb Planner" onerror="this.style.display='none'">
      </div>
      <h1>Manuel du formateur — Formation générale</h1>
      <p class="st">Maîtrise de la plateforme EduWeb Planner, rôle par rôle : guides détaillés, formations interactives et corrigés</p>
      <span class="ref">Réf. ${eh(data.reference)} · Version ${eh(data.version)}</span>
      <div class="gen">Document généré automatiquement le ${eh(ctx.dateGeneration)} — ${data.nbModules} modules · ${data.totalLecons} leçons · ${data.totalQuestions} questions corrigées · ${data.dureeTotale} min</div>
      <div class="restreint">⚠ Document réservé aux FORMATEURS DÉSIGNÉS — contient les corrigés des évaluations. Ne pas diffuser aux apprenants.</div>
    </div>`;

  const avant = `
    <h2 class="sec">Avant-propos</h2>
    <p>Ce manuel réunit, en un seul document, l'ensemble des guides d'utilisation par rôle de la plateforme EduWeb Planner. Il est <b>généré automatiquement</b> à partir des rôles réellement disponibles et de leurs contenus de formation : son sommaire et ses modules reflètent donc l'état courant de la plateforme et s'enrichissent au fil de ses évolutions.</p>
    <p class="note">Reproduction réservée à un usage interne de formation. © EduWeb Planner.</p>`;

  const syllabus = `
    <h2 class="sec">Syllabus académique de la formation</h2>
    <div class="syll">${SYLLABUS.map((s) => `<h3>${eh(s.t)}</h3>${s.h}`).join("")}</div>`;

  const toc = `
    <h2 class="sec">Table des matières — modules par rôle</h2>
    <div class="toc">${data.modules.map((m) => `<div class="row"><span class="c">${eh(m.code)}</span> — ${eh(m.titre)} <span class="note">(${m.lecons.length} leçon${m.lecons.length > 1 ? "s" : ""}${m.formation ? ` + formation interactive (${m.formation.lecons.length})` : ""}${m.dureeMinutes ? ` · ${m.dureeMinutes} min` : ""})</span></div>`).join("")}</div>`;

  const rendreLecons = (lecons: (typeof data.modules)[number]["lecons"]): string =>
    lecons.map((l) => `<div class="lecon"><h4>${eh(l.titre)}${l.dureeMinutes ? ` <span class="note">(${l.dureeMinutes} min)</span>` : ""}</h4>${corpsLecon(l)}</div>`).join("");

  const modules = data.modules.map((m) => {
    const meta = [PORTEE_LIB[m.portee ?? ""] ?? null, `${m.lecons.length} leçon${m.lecons.length > 1 ? "s" : ""}`, m.dureeMinutes ? `${m.dureeMinutes} min` : null].filter(Boolean).join(" · ");
    const lecons = m.lecons.length ? rendreLecons(m.lecons) : `<p class="note">Contenu détaillé à venir pour ce module.</p>`;
    // Volet FORMATION INTERACTIVE du rôle : leçons d'entraînement + quiz avec corrigés formateur.
    const formation = m.formation
      ? `<h4 class="form-t">Formation interactive — « ${eh(m.formation.titre)} » (corrigés du formateur)</h4>${
          m.formation.description ? `<p class="note">${eh(m.formation.description)}</p>` : ""
        }${rendreLecons(m.formation.lecons)}`
      : "";
    return `<section class="module"><h3 class="mod">${eh(m.code)} — ${eh(m.titre)}</h3><p class="mod-meta">${eh(meta)}</p>${m.description ? `<div class="mod-desc"><b>Objectif du rôle :</b> ${eh(m.description)}</div>` : ""}${lecons}${formation}</section>`;
  }).join("");

  const gloss = `
    <h2 class="sec">Abréviations et glossaire</h2>
    <table class="gloss"><tbody>${GLOSSAIRE.map(([k, v]) => `<tr><td class="k">${eh(k)}</td><td>${eh(v)}</td></tr>`).join("")}</tbody></table>`;

  const officeHead = opts.pourWord
    ? `xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"`
    : `lang="fr"`;
  const script = opts.autoImpression
    ? `<script>window.addEventListener('load',function(){setTimeout(function(){try{window.focus();window.print()}catch(e){}},400)});<\/script>`
    : "";

  return `<!DOCTYPE html><html ${officeHead}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Manuel académique de formation — ${eh(data.reference)}</title>
<style>${CSS}</style></head>
<body><div class="feuille">${cover}${avant}${syllabus}${toc}<h2 class="sec">Modules de formation par rôle</h2>${modules}${gloss}</div>${script}</body></html>`;
}
