import type { Metadata } from "next";
import { Inbox, Clock4 } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Badge } from "@/components/app/ui";
import { estRoleValide, ROLES, type TypePortee } from "@/lib/rbac";
import { RowActions } from "./row-actions";

export const metadata: Metadata = { title: "Approbations" };
export const dynamic = "force-dynamic";

async function charger() {
  try {
    // L'établissement se choisit via une recherche à la volée (répertoire de 41 000+
    // entrées) ; seuls les référentiels courts sont chargés en liste.
    const [demandes, regions, cafops, apfcs] = await Promise.all([
      prisma.demandeRole.findMany({
        where: { statut: "en_attente" },
        orderBy: { creeLe: "asc" },
        include: { roleDemande: true, utilisateur: true },
      }),
      prisma.region.findMany({ orderBy: [{ pays: "asc" }, { nom: "asc" }] }),
      prisma.cafop.findMany({ orderBy: { nom: "asc" } }),
      prisma.apfc.findMany({ orderBy: { nom: "asc" } }),
    ]);
    return { demandes, regions, cafops, apfcs, ok: true as const };
  } catch (e) {
    console.error("[approbations] DB indisponible :", e);
    return { ok: false as const };
  }
}

function dateFr(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(d);
}

const libellePortee: Partial<Record<TypePortee, string>> = {
  etablissement: "Établissement",
  region: "Région",
  cafop: "CAFOP",
  apfc: "APFC",
};

export default async function ApprobationsPage() {
  await requireRole(["admin"]);
  const data = await charger();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        titre="Approbations des demandes de rôle"
        description="Validez ou refusez les demandes de rôle (inscriptions et changements). À l'approbation, rattachez l'utilisateur à son périmètre réel. En version 1, ces décisions relèvent de l'administrateur système."
      />

      {!data.ok ? (
        <Card>
          <p className="text-sm text-ink-700/70">
            Impossible de charger les demandes. Vérifiez la connexion à la base de données
            (DATABASE_URL).
          </p>
        </Card>
      ) : data.demandes.length === 0 ? (
        <Card className="flex flex-col items-center py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-50 text-forest-500">
            <Inbox size={26} />
          </span>
          <h2 className="mt-4 font-display text-lg font-bold text-forest-900">
            Aucune demande en attente
          </h2>
          <p className="mt-1 text-sm text-ink-700/65">
            Les nouvelles demandes de rôle apparaîtront ici.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {data.demandes.map((d) => {
            const portee: TypePortee = estRoleValide(d.roleDemande.nomTechnique)
              ? ROLES[d.roleDemande.nomTechnique].portee
              : "personnel";
            const options =
              portee === "region"
                ? data.regions.map((r) => ({ id: r.id, nom: r.nom }))
                : portee === "cafop"
                  ? data.cafops.map((c) => ({ id: c.id, nom: c.nom }))
                  : portee === "apfc"
                    ? data.apfcs.map((a) => ({ id: a.id, nom: a.nom }))
                    : [];
            return (
              <Card key={d.id} className="flex flex-col gap-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-forest-900">
                        {[d.utilisateur.prenoms, d.utilisateur.nom].filter(Boolean).join(" ") ||
                          d.utilisateur.email}
                      </p>
                      <Badge ton="attente">{d.roleDemande.libelle}</Badge>
                    </div>
                    <p className="mt-1 truncate text-sm text-ink-700/65">{d.utilisateur.email}</p>
                    {d.structureDeclaree && (
                      <p className="mt-1 text-sm text-ink-700/65">
                        Structure déclarée :{" "}
                        <span className="font-medium">{d.structureDeclaree}</span>
                      </p>
                    )}
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-700/50">
                      <Clock4 size={13} /> Demande du {dateFr(d.creeLe)}
                    </p>
                  </div>
                  <RowActions
                    demandeId={d.id}
                    libellePortee={libellePortee[portee]}
                    rechercheEtablissement={portee === "etablissement"}
                    options={options}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
