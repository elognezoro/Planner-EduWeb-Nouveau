import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/app/ui";
import { FormulaireInscriptions, type Formation, type Lien } from "./client";

export const metadata: Metadata = { title: "Inscriptions par rôle — Aide et Formation" };
export const dynamic = "force-dynamic";

const BASE = "/app/aide-formation";

export default async function InscriptionsRolePage() {
  await requireRole(["admin"]);

  // TOUTES les formations (cours + séminaires, hors guides), publiées ou non, + leurs liens.
  const cours = await prisma.cours.findMany({
    where: { estGuide: false },
    orderBy: [{ estSeminaire: "asc" }, { titre: "asc" }],
    select: {
      id: true, titre: true, estSeminaire: true, statut: true, dateFormation: true, dureeMinutes: true,
      invitations: { orderBy: { creeLe: "desc" }, select: { id: true, token: true, actif: true, expiration: true, placesMax: true, roleCible: true } },
    },
  });

  const formations: Formation[] = cours.map((c) => ({
    id: c.id,
    titre: c.titre,
    estSeminaire: c.estSeminaire,
    publie: c.statut === "publie",
    dateFormation: c.dateFormation ? c.dateFormation.toISOString() : null,
    dureeMinutes: c.dureeMinutes,
  }));
  const liens: Lien[] = cours.flatMap((c) =>
    c.invitations.map((inv) => ({
      id: inv.id,
      coursId: c.id,
      coursTitre: c.titre,
      token: inv.token,
      actif: inv.actif,
      expiration: inv.expiration ? inv.expiration.toISOString() : null,
      placesMax: inv.placesMax,
      roleCible: inv.roleCible,
      coursDate: c.dateFormation ? c.dateFormation.toISOString() : null,
      coursDuree: c.dureeMinutes,
    })),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Link href={`${BASE}/gestion`} className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900"><ArrowLeft size={15} /> Retour à la gestion</Link>
      <PageHeader
        titre="Inscriptions par rôle"
        description="Sélectionnez une ou plusieurs formations, un statut (Élève / Apprenant ou Formateur / Tuteur), puis saisissez les participants (e-mails ou noms). Vous pouvez aussi générer des liens d'inscription directe scoppés au statut."
      />
      <FormulaireInscriptions formations={formations} liens={liens} />
    </div>
  );
}
