import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/app/ui";
import { DepartementsManager } from "./departements-manager";

export const metadata: Metadata = { title: "Départements — Système" };
export const dynamic = "force-dynamic";

export default async function DepartementsPage() {
  await requireRole(["admin"]);
  const departements = await prisma.departement.findMany({
    orderBy: [{ ordre: "asc" }, { creeLe: "asc" }],
    select: { id: true, nom: true, description: true, categorie: true, icone: true, couleur: true, ordre: true, actif: true },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        titre="Départements"
        description="Les départements présentés dans « Nos départements » sur la page d'accueil. Ajoutez-en, éditez-les, réordonnez-les (champ Ordre) ou masquez-les sans les supprimer."
      />
      <DepartementsManager departements={departements} />
    </div>
  );
}
