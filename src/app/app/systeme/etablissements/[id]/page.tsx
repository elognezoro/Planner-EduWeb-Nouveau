import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, School, DoorOpen, Users2, MapPin, Table2 } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Badge } from "@/components/app/ui";
import { SalleForm, ClasseForm } from "./forms";

export const metadata: Metadata = { title: "Établissement" };
export const dynamic = "force-dynamic";

const libelleType: Record<string, string> = {
  prescolaire: "Préscolaire",
  primaire: "Primaire",
  college: "Collège",
  lycee: "Lycée",
  groupe_scolaire: "Groupe scolaire",
  autre: "Autre",
};
const libelleTypeSalle: Record<string, string> = {
  ordinaire: "Ordinaire",
  laboratoire: "Laboratoire",
  salle_informatique: "Salle informatique",
  atelier: "Atelier",
  salle_eps: "EPS",
  autre: "Autre",
};

async function charger(id: string) {
  try {
    const etablissement = await prisma.etablissement.findUnique({
      where: { id },
      include: { region: true },
    });
    if (!etablissement) return { statut: "introuvable" as const };
    const [salles, classes, niveaux] = await Promise.all([
      prisma.salle.findMany({ where: { etablissementId: id }, orderBy: { nom: "asc" } }),
      prisma.classe.findMany({
        where: { etablissementId: id },
        orderBy: { nom: "asc" },
        include: { niveau: true },
      }),
      prisma.niveau.findMany({ orderBy: { ordre: "asc" } }),
    ]);
    return { statut: "ok" as const, etablissement, salles, classes, niveaux };
  } catch (e) {
    console.error("[etablissement detail] DB indisponible :", e);
    return { statut: "erreur" as const };
  }
}

export default async function EtablissementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const u = await requireRole(["admin", "etablissements_admin"]);

  // Périmètre : un admin d'établissement ne voit que le sien.
  if (u.roleReel === "etablissements_admin" && u.portee.etablissementId !== id) {
    redirect("/app/systeme/etablissements");
  }

  const data = await charger(id);

  if (data.statut === "introuvable") {
    redirect("/app/systeme/etablissements");
  }
  if (data.statut !== "ok") {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader titre="Établissement" />
        <Card>
          <p className="text-sm text-ink-700/70">
            Impossible de charger cet établissement. Vérifiez la connexion à la base de données.
          </p>
        </Card>
      </div>
    );
  }

  const { etablissement: e, salles, classes, niveaux } = data;
  const peutGerer = !u.apercuActif && (u.roleReel === "admin" || u.portee.etablissementId === id);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Link
        href="/app/systeme/etablissements"
        className="inline-flex items-center gap-2 text-sm font-medium text-forest-700 hover:text-forest-900"
      >
        <ArrowLeft size={16} /> Tous les établissements
      </Link>

      <PageHeader
        titre={e.nom}
        action={
          <Link
            href={`/app/systeme/etablissements/${id}/grille`}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-forest-200 bg-white px-4 text-sm font-semibold text-forest-800 transition-colors hover:bg-forest-50"
          >
            <Table2 size={16} /> Grille horaire
          </Link>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-forest-800 text-gold-300">
            <School size={22} />
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{libelleType[e.type] ?? e.type}</Badge>
            <Badge ton="neutre">{e.statut}</Badge>
            {e.region && (
              <span className="inline-flex items-center gap-1 text-sm text-ink-700/70">
                <MapPin size={14} /> {e.region.nom}
              </span>
            )}
            {e.ville && <span className="text-sm text-ink-700/70">· {e.ville}</span>}
          </div>
        </div>
      </Card>

      {/* Salles */}
      <Card>
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-forest-900">
          <DoorOpen size={18} /> Salles ({salles.length})
        </h2>
        {salles.length > 0 ? (
          <div className="mb-5 flex flex-wrap gap-2">
            {salles.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center gap-2 rounded-xl border border-cream-200 bg-cream-50 px-3 py-1.5 text-sm"
              >
                <span className="font-medium text-forest-900">{s.nom}</span>
                <span className="text-xs text-ink-700/60">
                  {libelleTypeSalle[s.type] ?? s.type} · {s.capacite} pl.
                </span>
              </span>
            ))}
          </div>
        ) : (
          <p className="mb-5 text-sm text-ink-700/60">Aucune salle enregistrée.</p>
        )}
        {peutGerer && <SalleForm etablissementId={id} />}
      </Card>

      {/* Classes */}
      <Card>
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-forest-900">
          <Users2 size={18} /> Classes ({classes.length})
        </h2>
        {classes.length > 0 ? (
          <div className="mb-5 overflow-x-auto">
            <table className="w-full min-w-[460px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-cream-200 text-left">
                  <th className="py-2 pr-4 font-semibold text-ink-700/70">Classe</th>
                  <th className="py-2 pr-4 font-semibold text-ink-700/70">Niveau</th>
                  <th className="py-2 pr-4 font-semibold text-ink-700/70">Effectif</th>
                  <th className="py-2 font-semibold text-ink-700/70">Vacation</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => (
                  <tr key={c.id} className="border-b border-cream-100 last:border-0">
                    <td className="py-2 pr-4 font-medium text-forest-900">{c.nom}</td>
                    <td className="py-2 pr-4 text-ink-800">{c.niveau.nom}</td>
                    <td className="py-2 pr-4 text-ink-800">{c.effectif}</td>
                    <td className="py-2 text-ink-800">
                      {c.regimeVacation === "double" ? "Double" : "Simple"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mb-5 text-sm text-ink-700/60">Aucune classe enregistrée.</p>
        )}
        {peutGerer && <ClasseForm etablissementId={id} niveaux={niveaux} />}
      </Card>
    </div>
  );
}
