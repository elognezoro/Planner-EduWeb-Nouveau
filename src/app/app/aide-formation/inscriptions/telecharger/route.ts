import { getUtilisateurCourant } from "@/lib/auth/session";
import { chargerListes, dateDuJour, type ListeCours } from "../data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ETAB = "EdTeCh EduWeb — Centre de formation";

function slugFichier(s: string) {
  return s.normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

/** Échappe une valeur pour CSV (RFC 4180). */
function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function construireCsv(listes: ListeCours[]): string {
  const lignes: string[] = ["﻿Cours;Nom et prénoms;E-mail;Rôle;Source;Inscrit le;Progression (%);Statut"];
  for (const c of listes) {
    if (c.inscrits.length === 0) {
      lignes.push([csvCell(c.titre), csvCell("(aucun inscrit)"), "", "", "", "", "", ""].join(";"));
      continue;
    }
    for (const i of c.inscrits) {
      lignes.push([csvCell(c.titre), csvCell(i.nom), csvCell(i.email), csvCell(i.role), csvCell(i.source), csvCell(i.date), csvCell(i.progression), csvCell(i.statut)].join(";"));
    }
  }
  return lignes.join("\r\n");
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function construireWord(listes: ListeCours[]): string {
  const total = listes.reduce((s, c) => s + c.inscrits.length, 0);
  const sections = listes.map((c) => {
    const rows = c.inscrits.length
      ? c.inscrits.map((i, n) => `<tr><td>${n + 1}</td><td>${esc(i.nom)}</td><td>${esc(i.email)}</td><td>${esc(i.role)}</td><td>${esc(i.source)}</td><td>${esc(i.date)}</td><td style="text-align:center">${i.progression}%</td><td>${esc(i.statut)}</td></tr>`).join("")
      : `<tr><td colspan="8" style="color:#777;font-style:italic">Aucun inscrit</td></tr>`;
    return `<h2 style="color:#14532d;font-size:14pt;margin:18pt 0 4pt">${esc(c.titre)} <span style="font-weight:normal;color:#666">(${c.inscrits.length} inscrit${c.inscrits.length > 1 ? "s" : ""})</span></h2>
      <table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;width:100%;font-size:10pt">
      <thead><tr style="background:#eaf3ec"><th>#</th><th>Nom et prénoms</th><th>E-mail</th><th>Rôle</th><th>Source</th><th>Inscrit le</th><th>Prog.</th><th>Statut</th></tr></thead>
      <tbody>${rows}</tbody></table>`;
  }).join("");
  return `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Liste des inscrits</title></head>
    <body style="font-family:Calibri,Arial,sans-serif;color:#1a1a1a">
      <div style="text-align:center;border-bottom:2px solid #14532d;padding-bottom:8pt;margin-bottom:12pt">
        <div style="font-size:15pt;font-weight:bold;color:#14532d">${ETAB}</div>
        <div style="font-size:11pt;color:#555">Liste des inscrits aux formations</div>
        <div style="font-size:10pt;color:#777">Édité le ${dateDuJour()} — ${total} inscription${total > 1 ? "s" : ""} au total</div>
      </div>
      ${sections}
    </body></html>`;
}

export async function GET(req: Request) {
  const u = await getUtilisateurCourant();
  if (!u || u.roleReel !== "admin") {
    return new Response("Accès réservé à l'administrateur.", { status: 403 });
  }
  const url = new URL(req.url);
  const format = (url.searchParams.get("format") ?? "csv").toLowerCase();
  const slugs = (url.searchParams.get("cours") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (slugs.length === 0) return new Response("Aucun cours sélectionné.", { status: 400 });

  const listes = await chargerListes(slugs);
  if (listes.length === 0) return new Response("Cours introuvable.", { status: 404 });

  const base = listes.length === 1 ? slugFichier(listes[0].titre) : "inscrits-formations";

  if (format === "word") {
    return new Response(construireWord(listes), {
      headers: {
        "Content-Type": "application/msword; charset=utf-8",
        "Content-Disposition": `attachment; filename="${base}.doc"`,
      },
    });
  }
  // CSV par défaut
  return new Response(construireCsv(listes), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${base}.csv"`,
    },
  });
}
