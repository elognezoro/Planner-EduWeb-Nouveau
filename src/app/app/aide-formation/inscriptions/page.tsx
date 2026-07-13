import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Users, GraduationCap, UserCheck } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, StatCard } from "@/components/app/ui";
import { InscriptionsClient } from "./inscriptions-client";

export const metadata: Metadata = { title: "Inscriptions aux cours" };
export const dynamic = "force-dynamic";

const BASE = "/app/aide-formation";

const dateCourte = (d: Date) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
const nomComplet = (nom: string | null, prenoms: string | null, email: string) =>
  [nom, prenoms].filter(Boolean).join(" ").trim() || email;

export default async function InscriptionsPage({ searchParams }: { searchParams: Promise<{ cours?: string; q?: string }> }) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();

  const cours = await prisma.cours.findMany({
    orderBy: [{ estGuide: "asc" }, { ordre: "asc" }, { titre: "asc" }],
    select: {
      id: true, titre: true, slug: true, estGuide: true, statut: true,
      _count: { select: { inscriptions: true } },
    },
  });

  if (cours.length === 0) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader titre="Inscriptions aux cours" description="Inscrivez ou désinscrivez un utilisateur d'un cours de formation." />
        <Card><p className="text-sm text-ink-700/70">Aucun cours n&apos;existe encore. Créez d&apos;abord un cours dans la console de gestion.</p></Card>
      </div>
    );
  }

  const actif = cours.find((c) => c.slug === sp.cours) ?? cours[0];

  const inscritsBruts = await prisma.inscriptionCours.findMany({
    where: { coursId: actif.id },
    orderBy: [{ dateInscription: "desc" }],
    select: {
      id: true, source: true, dateInscription: true, progressionPct: true, statut: true,
      utilisateur: { select: { id: true, nom: true, prenoms: true, email: true, roleActif: { select: { libelle: true, nomTechnique: true } } } },
    },
  });

  const inscrits = inscritsBruts.map((i) => ({
    inscriptionId: i.id,
    userId: i.utilisateur.id,
    nom: nomComplet(i.utilisateur.nom, i.utilisateur.prenoms, i.utilisateur.email),
    email: i.utilisateur.email,
    role: i.utilisateur.roleActif?.libelle ?? i.utilisateur.roleActif?.nomTechnique ?? "—",
    source: i.source,
    date: dateCourte(i.dateInscription),
    progression: i.progressionPct,
    statut: i.statut,
  }));
  const inscritIds = inscrits.map((i) => i.userId);

  // Candidats à inscrire — recherche filtrée EN BASE (exhaustive quel que soit le nombre de comptes).
  const LIMITE = 40;
  const candidatsBruts = await prisma.utilisateur.findMany({
    where: {
      ...(inscritIds.length ? { id: { notIn: inscritIds } } : {}),
      ...(q
        ? {
            OR: [
              { nom: { contains: q, mode: "insensitive" as const } },
              { prenoms: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: [{ nom: "asc" }, { prenoms: "asc" }, { email: "asc" }],
    take: LIMITE + 1,
    select: { id: true, nom: true, prenoms: true, email: true, roleActif: { select: { libelle: true, nomTechnique: true } } },
  });
  const tronque = candidatsBruts.length > LIMITE;
  const candidats = candidatsBruts.slice(0, LIMITE).map((u) => ({
    id: u.id,
    nom: nomComplet(u.nom, u.prenoms, u.email),
    email: u.email,
    role: u.roleActif?.libelle ?? u.roleActif?.nomTechnique ?? "—",
  }));

  const coursListe = cours.map((c) => ({
    id: c.id, titre: c.titre, slug: c.slug, estGuide: c.estGuide, statut: c.statut, nbInscrits: c._count.inscriptions,
  }));
  const totalInscriptions = cours.reduce((s, c) => s + c._count.inscriptions, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titre="Inscriptions aux cours"
        description="Inscrivez ou désinscrivez un utilisateur d'un cours de formation. Réservé à l'administrateur système."
        action={
          <Link href={`${BASE}/formations`} className="inline-flex items-center gap-2 rounded-full border border-cream-200 bg-white px-4 py-2 text-sm font-semibold text-forest-800 hover:border-forest-300">
            <ArrowLeft className="h-4 w-4" /> Formations
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard libelle="Cours et formations" valeur={coursListe.length} icone={<GraduationCap className="h-5 w-5" />} />
        <StatCard libelle="Inscriptions (total)" valeur={totalInscriptions} icone={<Users className="h-5 w-5" />} ton="gold" />
        <StatCard libelle="Inscrits — ce cours" valeur={inscrits.length} icone={<UserCheck className="h-5 w-5" />} />
      </div>

      <InscriptionsClient
        coursListe={coursListe}
        actif={{ id: actif.id, titre: actif.titre, slug: actif.slug }}
        inscrits={inscrits}
        candidats={candidats}
        q={q}
        tronque={tronque}
      />
    </div>
  );
}
