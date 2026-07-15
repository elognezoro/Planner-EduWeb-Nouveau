import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CalendarX2, Trash2, Users } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { peutAdministrerEtablissement } from "@/lib/rbac/scope";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/app/ui";
import { HeatmapTable } from "@/components/app/heatmap";
import { heatmapAbsencesEnseignants } from "@/lib/reseau-catholique/agregats";
import { AjoutAbsenceForm } from "./forms";
import { supprimerAbsence } from "./actions";

export const metadata: Metadata = { title: "Absences des enseignants" };
export const dynamic = "force-dynamic";

const nomComplet = (p: { prenoms: string | null; nom: string | null; email: string }) =>
  [p.prenoms, p.nom].filter(Boolean).join(" ") || p.email;

const dateCourte = (d: Date) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(d);

const LIBELLE_DEMI: Record<string, string> = { journee: "Journée", matin: "Matinée", apres_midi: "Après-midi" };
const LIBELLE_STATUT: Record<string, string> = { autorisee: "Autorisée", justifiee: "Justifiée", non_autorisee: "Non autorisée" };
const TON_STATUT: Record<string, string> = {
  autorisee: "bg-forest-100 text-forest-800",
  justifiee: "bg-gold-100 text-gold-800",
  non_autorisee: "bg-red-100 text-red-700",
};

export default async function AbsencesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireRole([
    "admin", "super_admin_etablissements", "etablissements_admin", "chef_etablissement", "adjoint_chef_etablissement",
  ]);
  const paysEtab = (await prisma.etablissement.findUnique({ where: { id }, select: { pays: true } }))?.pays;
  if (!peutAdministrerEtablissement(u.portee, id, paysEtab)) {
    redirect("/app/systeme/etablissements");
  }

  let etab: { nom: string } | null = null;
  let enseignants: { id: string; prenoms: string | null; nom: string | null; email: string }[] = [];
  let absences: {
    id: string; date: Date; demiJournee: string; statut: string; motif: string | null;
    enseignant: { prenoms: string | null; nom: string | null; email: string };
  }[] = [];
  let heatmap = null;
  let erreur = false;
  try {
    [etab, enseignants, absences, heatmap] = await Promise.all([
      prisma.etablissement.findUnique({ where: { id }, select: { nom: true } }),
      prisma.utilisateur.findMany({
        where: { etablissementId: id, roleActif: { nomTechnique: "enseignant" } },
        orderBy: [{ nom: "asc" }, { prenoms: "asc" }],
        select: { id: true, prenoms: true, nom: true, email: true },
      }),
      prisma.absenceEnseignant.findMany({
        where: { etablissementId: id },
        orderBy: { date: "desc" },
        take: 100,
        select: {
          id: true, date: true, demiJournee: true, statut: true, motif: true,
          enseignant: { select: { prenoms: true, nom: true, email: true } },
        },
      }),
      heatmapAbsencesEnseignants(id),
    ]);
  } catch (e) {
    console.error("[absences] DB indisponible :", e);
    erreur = true;
  }
  if (!erreur && !etab) redirect("/app/systeme/etablissements");

  const optionsEnseignants = enseignants.map((e) => ({ id: e.id, nom: nomComplet(e) }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href={`/app/systeme/etablissements/${id}`} className="inline-flex items-center gap-2 text-sm font-medium text-forest-700 hover:text-forest-900">
        <ArrowLeft size={16} /> Configuration de l&apos;établissement
      </Link>

      <PageHeader
        titre={`Absences des enseignants — ${etab?.nom ?? ""}`}
        description="Enregistrez les autorisations d'absence des enseignants (journée ou demi-journée). Ces saisies alimentent la heatmap consultée par le réseau catholique (SEDEC/SENEC)."
      />

      {erreur ? (
        <Card><p className="text-sm text-ink-700/70">Impossible de charger les données.</p></Card>
      ) : enseignants.length === 0 ? (
        <Card className="flex flex-col items-center py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-forest-50 text-forest-500"><Users size={24} /></span>
          <p className="mt-3 text-sm text-ink-700/65">Aucun enseignant rattaché. Ajoutez-en depuis la configuration (bloc « Utilisateurs »).</p>
        </Card>
      ) : (
        <>
          <Card>
            <h2 className="mb-3 inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
              <CalendarX2 size={18} className="text-forest-600" /> Nouvelle absence
            </h2>
            <AjoutAbsenceForm etablissementId={id} enseignants={optionsEnseignants} />
          </Card>

          {heatmap && (
            <Card>
              <h2 className="mb-1 font-display text-base font-bold text-forest-900">Heatmap des absences</h2>
              <p className="mb-3 text-xs text-ink-700/60">
                Demi-journées d&apos;absence par enseignant et par mois (une journée = 2 demi-journées).
              </p>
              <HeatmapTable data={heatmap} mode="compte" libelleColonne="Enseignant" />
            </Card>
          )}

          <Card>
            <h2 className="mb-3 font-display text-base font-bold text-forest-900">
              Absences enregistrées <span className="text-xs font-normal text-ink-700/55">({absences.length})</span>
            </h2>
            {absences.length === 0 ? (
              <p className="text-sm text-ink-700/60">Aucune absence enregistrée pour l&apos;instant.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-sm">
                  <thead>
                    <tr className="border-b border-cream-200 text-left text-xs uppercase tracking-wide text-ink-700/50">
                      <th className="py-1.5 pr-2">Date</th>
                      <th className="py-1.5 pr-2">Enseignant</th>
                      <th className="py-1.5 pr-2">Durée</th>
                      <th className="py-1.5 pr-2">Statut</th>
                      <th className="py-1.5 pr-2">Motif</th>
                      <th className="py-1.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream-100">
                    {absences.map((a) => (
                      <tr key={a.id}>
                        <td className="py-1.5 pr-2 whitespace-nowrap">{dateCourte(a.date)}</td>
                        <td className="py-1.5 pr-2 font-medium text-forest-900">{nomComplet(a.enseignant)}</td>
                        <td className="py-1.5 pr-2">{LIBELLE_DEMI[a.demiJournee] ?? a.demiJournee}</td>
                        <td className="py-1.5 pr-2">
                          <span className={`rounded-full px-2 py-0.5 text-[0.68rem] font-semibold ${TON_STATUT[a.statut] ?? "bg-cream-100 text-ink-700/70"}`}>
                            {LIBELLE_STATUT[a.statut] ?? a.statut}
                          </span>
                        </td>
                        <td className="py-1.5 pr-2 text-ink-700/70">{a.motif || "—"}</td>
                        <td className="py-1.5 text-right">
                          <form action={supprimerAbsence}>
                            <input type="hidden" name="id" value={a.id} />
                            <input type="hidden" name="etablissementId" value={id} />
                            <button type="submit" className="inline-flex items-center gap-1 rounded-full border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
                              <Trash2 size={13} /> Retirer
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
