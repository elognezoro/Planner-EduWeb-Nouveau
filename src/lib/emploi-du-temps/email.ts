import "server-only";
import type { CreneauHoraire, BandePause } from "./horaires";

/**
 * Construction de l'e-mail « emploi du temps » envoyé aux concernés d'une classe
 * (élèves, parents, enseignants) : tableau HTML autonome (styles en ligne, compatible
 * clients mail) avec les bandes RÉCRÉATION / PAUSE DÉJEUNER, dans la coque EduWeb.
 */

export interface CreneauEmail {
  disciplineNom: string;
  enseignantNom: string;
  salleNom: string;
  jour: number;
  periode: number;
  duree: number;
}

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];

function echapper(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Échappement pour un attribut HTML (href, etc.) : ajoute les guillemets à `echapper`. */
function echapperAttribut(s: string): string {
  return echapper(s).replace(/"/g, "&quot;");
}

export function tableauEdtHtml(
  creneaux: CreneauEmail[],
  horaires: CreneauHoraire[] | null,
  bandes: BandePause[] | null,
): string {
  if (creneaux.length === 0) return "<p>Aucun créneau.</p>";
  const maxPeriode = Math.max(...creneaux.map((c) => c.periode + c.duree - 1));
  const parCle = new Map(creneaux.map((c) => [`${c.jour}:${c.periode}`, c]));
  const couvert = new Set<string>();
  for (const c of creneaux) for (let d = 1; d < c.duree; d++) couvert.add(`${c.jour}:${c.periode + d}`);

  const td = "border:1px solid #e8e0cd;padding:4px 6px;font-size:11px;vertical-align:top;";
  const lignes: string[] = [];
  for (let per = 0; per <= maxPeriode; per++) {
    const horaire = horaires?.[per] ? `${horaires[per].debut}<br>${horaires[per].fin}` : `P${per + 1}`;
    const cellules: string[] = [
      `<td style="${td}background:#faf6ec;text-align:center;font-weight:bold;color:#6b7d73;white-space:nowrap;">${horaire}</td>`,
    ];
    for (let jour = 0; jour < JOURS.length; jour++) {
      const cle = `${jour}:${per}`;
      if (couvert.has(cle)) continue;
      const c = parCle.get(cle);
      if (!c) {
        cellules.push(`<td style="${td}"></td>`);
        continue;
      }
      cellules.push(
        `<td style="${td}" rowspan="${c.duree}"><strong style="color:#0f3527;">${echapper(c.disciplineNom)}</strong><br><span style="color:#2b3a33;">${echapper(c.enseignantNom)}</span><br><span style="color:#6b7d73;">${echapper(c.salleNom)}</span></td>`,
      );
    }
    lignes.push(`<tr>${cellules.join("")}</tr>`);
    for (const b of bandes ?? []) {
      if (b.apresPeriode === per) {
        lignes.push(
          `<tr><td colspan="${JOURS.length + 1}" style="border:1px solid #e8e0cd;background:#f6e8c3;padding:4px;text-align:center;font-size:10px;font-weight:bold;letter-spacing:4px;color:#8a6914;">${echapper(b.libelle)}</td></tr>`,
        );
      }
    }
  }

  const entetes = [`<th style="${td}background:#faf6ec;color:#6b7d73;">Horaire</th>`]
    .concat(JOURS.map((j) => `<th style="${td}background:#faf6ec;color:#154231;">${j}</th>`))
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:16px 0;">
    <thead><tr>${entetes}</tr></thead>
    <tbody>${lignes.join("")}</tbody>
  </table>`;
}

export function gabaritEdtClasse({
  classeNom,
  etablissementNom,
  anneeScolaire,
  tableau,
  lienApp,
}: {
  classeNom: string;
  etablissementNom: string;
  anneeScolaire: string | null;
  tableau: string;
  lienApp: string;
}): { subject: string; html: string } {
  const annee = anneeScolaire ? ` — Année scolaire ${anneeScolaire}` : "";
  // Coque alignée sur les gabarits transactionnels (src/lib/email/templates.ts), élargie
  // pour loger la grille hebdomadaire.
  const html = `
  <div style="margin:0;padding:32px 0;background:#fbfaf6;font-family:Arial,Helvetica,sans-serif;color:#1e2a25;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <table role="presentation" width="680" cellpadding="0" cellspacing="0" style="max-width:680px;width:100%;background:#ffffff;border:1px solid #f3ebd7;border-radius:16px;overflow:hidden;">
          <tr><td style="background:linear-gradient(135deg,#154231,#0f3527);padding:28px 36px;">
            <span style="font-size:20px;font-weight:bold;color:#fdfcf8;">EduWeb&nbsp;<span style="color:#e3b536;">Planner</span></span>
          </td></tr>
          <tr><td style="padding:36px;">
            <h1 style="margin:0 0 8px;font-size:22px;color:#0f3527;">Emploi du temps — ${echapper(classeNom)}</h1>
            <p style="margin:0 0 4px;font-size:15px;line-height:1.6;color:#2b3a33;"><strong>${echapper(etablissementNom)}</strong>${echapper(annee)}</p>
            <p style="margin:0;font-size:14px;line-height:1.6;color:#2b3a33;">Voici l'emploi du temps de la classe, transmis par la direction de l'établissement.</p>
            ${tableau}
            <div style="margin:24px 0 8px;">
              <a href="${echapperAttribut(lienApp)}" style="display:inline-block;background:#154231;color:#fdfcf8;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:9999px;">Consulter sur EduWeb Planner</a>
            </div>
          </td></tr>
          <tr><td style="padding:20px 36px;background:#faf6ec;font-size:12px;color:#6b7d73;">
            Plateforme nationale de gestion et de planification scolaire — système éducatif ivoirien.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </div>`;
  // Le sujet est un en-tête texte (jamais interprété comme HTML) mais on neutralise
  // par prudence les caractères de contrôle éventuels du nom d'établissement/classe.
  const sujetPropre = (s: string) => s.replace(/[\r\n]+/g, " ").trim();
  return {
    subject: `Emploi du temps — ${sujetPropre(classeNom)} (${sujetPropre(etablissementNom)})`,
    html,
  };
}
