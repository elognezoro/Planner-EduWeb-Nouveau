import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, Card } from "@/components/app/ui";
import { ROLES_ORDONNES } from "@/lib/rbac";
import { grilleDroits } from "@/lib/rbac/permissions-dynamiques";
import { termeCafopCourant } from "@/lib/cafop-terme-serveur";
import { appliquerTerme } from "@/lib/cafop-terme";
import { MatriceDroits } from "./matrice-droits";

export const metadata: Metadata = { title: "Niveaux d'accès" };
export const dynamic = "force-dynamic";

const libellePortee: Record<string, string> = {
  global: "National (global)",
  etablissement: "Établissement",
  cafop: "CAFOP",
  apfc: "APFC",
  antenne: "Antenne",
  region: "Région / zone",
  personnel: "Personnel",
};

export default async function NiveauxAccesPage() {
  const u = await requireRole(["admin", "etablissements_admin", "cafop_admin", "apfc_admin"]);
  const sections = await grilleDroits();
  const editable = u.roleReel === "admin" && !u.apercuActif;
  const terme = await termeCafopCourant();
  const T = (s: string) => appliquerTerme(s, terme);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        titre="Niveaux d'accès"
        description="Matrice des droits par rôle (modifiable en un clic) et définition des 13 rôles de la plateforme."
      />

      <Card className="mb-8">
        <MatriceDroits sections={sections} editable={editable} terme={terme} />
      </Card>

      <h2 className="mb-4 font-display text-lg font-bold text-forest-900">Les 13 rôles</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {ROLES_ORDONNES.map((role) => (
          <Card key={role.id} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-forest-900">{T(role.libelle)}</h3>
              <code className="rounded bg-cream-100 px-2 py-0.5 text-xs text-forest-700">
                {role.id}
              </code>
            </div>
            <p className="text-xs font-medium uppercase tracking-wide text-gold-700">
              {T(libellePortee[role.portee])}
            </p>
            <p className="text-sm leading-relaxed text-ink-700/75">{T(role.description)}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
