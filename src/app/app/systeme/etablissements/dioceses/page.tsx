import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Church } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/app/ui";
import { FILTRE_CATHOLIQUE } from "@/lib/rbac/scope";
import { diocesesDuPays } from "@/lib/referentiels/dioceses";
import { AffectationDioceses, type EtabCatholique, type GroupePays } from "./affectation-client";

export const metadata: Metadata = { title: "Diocèses des établissements" };
export const dynamic = "force-dynamic";

/**
 * Affectation groupée des diocèses aux établissements catholiques (réseau SEDEC).
 * Réservé à l'admin système (tous pays), au superviseur international (tous pays) et au
 * Super Admin Établissements (son pays). C'est ce rattachement qui alimente les vues par
 * diocèse des rôles SENEC/SEDEC.
 */
export default async function DiocesesPage() {
  const u = await requireRole(["admin", "superviseur_international", "super_admin_etablissements"]);
  const cloisonPays = u.roleReel === "super_admin_etablissements" ? u.portee.pays : null;

  let groupes: GroupePays[] = [];
  let ok = true;
  try {
    const etabs = await prisma.etablissement.findMany({
      where: { ...FILTRE_CATHOLIQUE, ...(cloisonPays ? { pays: cloisonPays } : {}) },
      orderBy: [{ pays: "asc" }, { nom: "asc" }],
      select: {
        id: true,
        nom: true,
        ville: true,
        code: true,
        pays: true,
        diocese: true,
        region: { select: { nom: true } },
      },
    });
    const parPays = new Map<string, EtabCatholique[]>();
    etabs.forEach((e) => {
      const pays = e.pays ?? "Pays non renseigné";
      const liste = parPays.get(pays) ?? [];
      liste.push({
        id: e.id,
        nom: e.nom,
        ville: e.ville,
        code: e.code,
        regionNom: e.region?.nom ?? null,
        diocese: e.diocese,
      });
      parPays.set(pays, liste);
    });
    groupes = [...parPays.entries()].map(([pays, etablissements]) => ({
      pays,
      dioceses: diocesesDuPays(pays),
      etablissements,
    }));
  } catch (e) {
    console.error("[dioceses] DB indisponible :", e);
    ok = false;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titre="Diocèses — réseau catholique (SEDEC)"
        description="Rattachez en masse les établissements catholiques à leur diocèse. Ce rattachement alimente les vues par diocèse des rôles SENEC et SEDEC."
      />
      <Link
        href="/app/systeme/etablissements"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900"
      >
        <ArrowLeft size={15} /> Retour aux établissements
      </Link>

      {!ok ? (
        <Card>
          <p className="text-sm text-ink-700/70">Impossible de charger les établissements. Vérifiez la connexion à la base de données.</p>
        </Card>
      ) : groupes.length === 0 ? (
        <Card className="flex flex-col items-center py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-50 text-forest-500">
            <Church size={26} />
          </span>
          <h2 className="mt-4 font-display text-lg font-bold text-forest-900">Aucun établissement catholique</h2>
          <p className="mt-1 max-w-md text-sm text-ink-700/65">
            Aucun établissement avec le statut « confessionnel » et le réseau « SEDEC » dans votre périmètre. Le réseau se
            renseigne dans la configuration de chaque établissement.
          </p>
        </Card>
      ) : (
        <AffectationDioceses groupes={groupes} />
      )}
    </div>
  );
}
