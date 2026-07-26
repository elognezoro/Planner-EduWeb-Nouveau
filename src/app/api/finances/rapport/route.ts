import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { exigerPermissionFinance } from "@/lib/finances/commun/rbac";
import { journaliserFinance } from "@/lib/finances/commun/audit";
import { CATALOGUE_RAPPORTS, type RapportGenere } from "@/lib/finances/rapports/catalogue";
import { genererRapport } from "@/lib/finances/rapports/serveur";

export const dynamic = "force-dynamic";

/**
 * EXPORT d'un rapport du catalogue (18) — CSV (« ; », UTF-8 + BOM) ou JSON. RBAC STRICT
 * (RM-1502) : périmètre de l'utilisateur + permission de LECTURE de la définition + permission
 * d'export. Chaque export est HISTORISÉ au journal d'audit (RM-1501). Paramètres :
 * ?code=<code du rapport>&format=csv|json&exercice=<AAAA-AAAA>.
 */

const champ = (v: string | number | null | undefined) => String(v ?? "").replace(/[;\r\n]/g, " ").trim();
const aaaammjj = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

function versCsv(rapport: RapportGenere): string {
  const entete = rapport.colonnes.map((c) => champ(c.libelle)).join(";");
  const ligne = (row: Record<string, string | number | null>) =>
    rapport.colonnes.map((c) => champ(row[c.cle])).join(";");
  const corps = rapport.lignes.map(ligne);
  if (rapport.totaux) corps.push(ligne(rapport.totaux));
  return "﻿" + [`${champ(rapport.titre)} — ${champ(rapport.sousTitre)}`, entete, ...corps].join("\r\n");
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code") ?? "";
  const format = req.nextUrl.searchParams.get("format") === "json" ? "json" : "csv";
  const def = CATALOGUE_RAPPORTS.find((r) => r.code === code);
  if (!def) return NextResponse.json({ erreur: "Rapport inexistant." }, { status: 404 });

  const u = await getUtilisateurCourant();
  const etablissementId = u?.portee.etablissementId;
  // RM-1502 : permission de lecture du rapport ET permission d'export, sur le périmètre courant.
  if (
    !u || !etablissementId ||
    !(await exigerPermissionFinance(etablissementId, def.permission)) ||
    !(await exigerPermissionFinance(etablissementId, "finance.exports.exporter"))
  ) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const etab = await prisma.etablissement.findUnique({ where: { id: etablissementId }, select: { nom: true, anneeScolaire: true } });
  const exercice = etab?.anneeScolaire ?? String(new Date().getFullYear());
  const rapport = await genererRapport(etablissementId, code, exercice);
  if (!rapport) return NextResponse.json({ erreur: "Données indisponibles." }, { status: 409 });

  // RM-1501 : historisation de l'export au journal d'audit.
  try {
    await prisma.$transaction(async (tx) => {
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "rapport.export",
        entite: "Rapport", entiteId: code, nouvelleValeur: { code, format, lignes: rapport.lignes.length },
      });
    });
  } catch (e) {
    console.error("[rapports] audit export :", e);
  }

  const slug = champ(etab?.nom ?? "etablissement").replace(/\s+/g, "-").toLowerCase();
  const nomFichier = `rapport-${code}-${slug}-${aaaammjj(new Date())}.${format}`;
  if (format === "json") {
    return new NextResponse(JSON.stringify(rapport, null, 2), {
      headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${nomFichier}"` },
    });
  }
  return new NextResponse(versCsv(rapport), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${nomFichier}"` },
  });
}
