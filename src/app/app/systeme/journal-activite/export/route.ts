import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Échappe une valeur pour le format CSV (RFC 4180) : guillemets doublés, champ entre guillemets.
 * Neutralise aussi l'INJECTION DE FORMULE (tableurs) : une valeur commençant par = + - @ (ou une
 * tabulation) est préfixée d'une apostrophe. Utile car des champs sont contrôlés par le client
 * (ex. le user-agent journalisé dans « navigateur »).
 */
function champ(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * Export CSV du journal d'activité (admin uniquement), bornant les mêmes filtres que la page.
 * Plafonné à 5000 lignes (les plus récentes) — au-delà, affiner par période/entité.
 */
export async function GET(req: NextRequest) {
  await requireRole(["admin"]);

  const sp = req.nextUrl.searchParams;
  const source = ["securite", "metier", "auto"].includes(sp.get("source") ?? "") ? sp.get("source")! : "";
  const entite = (sp.get("entite") ?? "").trim();
  const acteur = (sp.get("acteur") ?? "").trim();
  const jours = sp.get("jours") ?? "7";
  const nbJours = /^\d+$/.test(jours) ? Number(jours) : null;
  const depuis = nbJours ? new Date(Date.now() - nbJours * 86_400_000) : null;

  const where: Prisma.JournalActiviteWhereInput = {
    ...(source ? { source } : {}),
    ...(entite ? { entite } : {}),
    ...(acteur ? { acteurEmail: { contains: acteur, mode: "insensitive" } } : {}),
    ...(depuis ? { creeLe: { gte: depuis } } : {}),
  };

  const lignes = await prisma.journalActivite.findMany({
    where,
    orderBy: { creeLe: "desc" },
    take: 5000,
    select: {
      creeLe: true, acteurEmail: true, acteurRole: true, action: true, operation: true,
      entite: true, entiteId: true, cible: true, etablissementId: true, source: true,
      ip: true, navigateur: true,
    },
  });

  const enTete = [
    "Date", "Acteur", "Rôle", "Action", "Opération", "Entité", "Identifiant",
    "Cible", "Établissement", "Nature", "IP", "Navigateur",
  ];
  const corps = lignes.map((l) =>
    [
      l.creeLe.toISOString(),
      l.acteurEmail, l.acteurRole, l.action, l.operation, l.entite, l.entiteId,
      l.cible, l.etablissementId, l.source, l.ip, l.navigateur,
    ].map(champ).join(","),
  );
  // BOM UTF-8 pour qu'Excel affiche correctement les accents.
  const csv = "﻿" + [enTete.map(champ).join(","), ...corps].join("\r\n");

  const horodatage = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="journal-activite-${horodatage}.csv"`,
    },
  });
}
