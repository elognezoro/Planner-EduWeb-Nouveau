import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { CATEGORIES_OHADA } from "@/lib/finances/categories";

export const dynamic = "force-dynamic";

/** Compte de trésorerie OHADA selon le mode d'encaissement/décaissement. */
const TRESORERIE: Record<string, { compte: string; libelle: string }> = {
  especes: { compte: "571", libelle: "Caisse" },
  mobile_money: { compte: "551", libelle: "Monnaie électronique" },
  cheque: { compte: "521", libelle: "Banque" },
  virement: { compte: "521", libelle: "Banque" },
};
const treso = (mode: string | null) => TRESORERIE[mode ?? "especes"] ?? TRESORERIE.especes;
const aaaammjj = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
const champ = (s: string | number | null | undefined) => String(s ?? "").replace(/[;\r\n]/g, " ").trim();

/**
 * EXPORT COMPTABLE NORMALISÉ (inspiré du Fichier des Écritures Comptables) : toutes les
 * écritures VALIDÉES de l'établissement de l'utilisateur, en PARTIE DOUBLE (deux lignes
 * par écriture), CSV « ; » encodé UTF-8 avec BOM. Paramètres facultatifs ?du=AAAA-MM-JJ&au=….
 */
export async function GET(req: NextRequest) {
  const u = await getUtilisateurCourant();
  const ROLES = new Set(["admin", "chef_etablissement", "adjoint_chef_etablissement", "econome", "etablissements_admin"]);
  const etablissementId = u?.portee.etablissementId;
  if (!u || !ROLES.has(u.roleActif) || !etablissementId) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const du = req.nextUrl.searchParams.get("du");
  const au = req.nextUrl.searchParams.get("au");
  const dDu = du ? new Date(du) : null;
  const dAu = au ? new Date(`${au}T23:59:59.999Z`) : null;
  const date = {
    ...(dDu && !Number.isNaN(dDu.getTime()) ? { gte: dDu } : {}),
    ...(dAu && !Number.isNaN(dAu.getTime()) ? { lte: dAu } : {}),
  };
  const filtreDate = Object.keys(date).length ? { date } : {};

  const [paiements, ventes, operations, etab] = await Promise.all([
    prisma.paiementScolarite.findMany({
      where: { etablissementId, annule: false, ...filtreDate },
      orderBy: { date: "asc" },
      select: { numeroRecu: true, libelle: true, montant: true, mode: true, reference: true, date: true, eleve: { select: { nom: true, prenoms: true } } },
    }),
    prisma.mouvementStock.findMany({
      where: { etablissementId, type: "vente", ...filtreDate },
      orderBy: { date: "asc" },
      select: { id: true, quantite: true, montant: true, mode: true, date: true, article: { select: { nom: true } } },
    }),
    prisma.operationFinanciere.findMany({
      where: { etablissementId, annule: false, ...filtreDate },
      orderBy: { date: "asc" },
      select: { id: true, sens: true, categorie: true, libelle: true, montant: true, mode: true, reference: true, date: true },
    }),
    prisma.etablissement.findUnique({ where: { id: etablissementId }, select: { nom: true } }),
  ]);

  const libCategorie = (code: string) => CATEGORIES_OHADA.find((c) => c.code === code)?.libelle ?? code;
  const lignes: string[] = ["JournalCode;JournalLib;EcritureNum;EcritureDate;CompteNum;CompteLib;EcritureLib;Debit;Credit;PieceRef;ModePaiement"];
  let num = 0;
  const pousser = (
    journal: [string, string], d: Date, libelle: string, montant: number,
    debit: { compte: string; libelle: string }, credit: { compte: string; libelle: string },
    piece: string, mode: string | null,
  ) => {
    num++;
    const base = `${journal[0]};${journal[1]};${num};${aaaammjj(d)}`;
    const fin = `${champ(piece)};${champ(mode)}`;
    lignes.push(`${base};${debit.compte};${champ(debit.libelle)};${champ(libelle)};${montant};0;${fin}`);
    lignes.push(`${base};${credit.compte};${champ(credit.libelle)};${champ(libelle)};0;${montant};${fin}`);
  };

  for (const p of paiements) {
    const nomEleve = [p.eleve.prenoms, p.eleve.nom].filter(Boolean).join(" ");
    pousser(["SCO", "Scolarité"], p.date, `${p.libelle} — ${nomEleve}`, p.montant, treso(p.mode),
      { compte: "7061", libelle: "Scolarité" }, `RECU-${String(p.numeroRecu).padStart(6, "0")}`, p.mode);
  }
  for (const v of ventes) {
    pousser(["ECO", "Économat"], v.date, `Vente ${v.quantite} × ${v.article.nom}`, v.montant ?? 0, treso(v.mode),
      { compte: "707", libelle: "Ventes de marchandises" }, v.id.slice(0, 8).toUpperCase(), v.mode);
  }
  for (const o of operations) {
    const cat = { compte: o.categorie, libelle: libCategorie(o.categorie) };
    if (o.sens === "recette") pousser(["OD", "Opérations diverses"], o.date, o.libelle, o.montant, treso(o.mode), cat, o.reference ?? "", o.mode);
    else pousser(["OD", "Opérations diverses"], o.date, o.libelle, o.montant, cat, treso(o.mode), o.reference ?? "", o.mode);
  }

  const csv = "﻿" + lignes.join("\r\n");
  const nomFichier = `export-comptable-${champ(etab?.nom ?? "etablissement").replace(/\s+/g, "-").toLowerCase()}-${aaaammjj(new Date())}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomFichier}"`,
    },
  });
}
