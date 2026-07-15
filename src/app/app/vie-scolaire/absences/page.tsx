import type { Metadata } from "next";
import Link from "next/link";
import { CalendarX2, ClipboardCheck, FileText, Building2, Users } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { filtreEtablissements } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/app/ui";
import { statsAbsences, statsAbsencesParEtablissement, type StatsAbsences } from "@/lib/absences/stats";
import { DemandeAbsenceForm } from "./forms";
import { DecisionButtons } from "./decision-buttons";

export const metadata: Metadata = { title: "Autorisations d'absence" };
export const dynamic = "force-dynamic";

const dateCourte = (d: Date) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" }).format(d);
const nomComplet = (p: { prenoms: string | null; nom: string | null; email?: string }) =>
  [p.prenoms, p.nom].filter(Boolean).join(" ").trim() || p.email || "—";
const periode = (a: Date, b: Date) =>
  a.getTime() === b.getTime() ? `le ${dateCourte(a)}` : `du ${dateCourte(a)} au ${dateCourte(b)}`;

const BADGE: Record<string, { libelle: string; classe: string }> = {
  en_attente: { libelle: "En attente", classe: "bg-gold-100 text-gold-800" },
  approuvee: { libelle: "Approuvée", classe: "bg-forest-100 text-forest-800" },
  refusee: { libelle: "Refusée", classe: "bg-red-100 text-red-700" },
};

function BlocStats({ stats }: { stats: StatsAbsences }) {
  const items = [
    { libelle: "Demandes", valeur: stats.total },
    { libelle: "Approuvées", valeur: stats.approuvees },
    { libelle: "En attente", valeur: stats.enAttente },
    { libelle: "Jours d'absence", valeur: stats.joursAbsence },
    { libelle: "Séances affectées", valeur: stats.seancesAffectees },
    { libelle: "Avec suppléance", valeur: stats.avecSuppleance },
    { libelle: "Séances à rattraper", valeur: stats.seancesARattraper },
    { libelle: "Rattrapages prévus", valeur: stats.datesRattrapagePrevues },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((it) => (
        <div key={it.libelle} className="rounded-xl border border-cream-200 bg-white p-3 text-center">
          <span className="block font-display text-xl font-bold text-forest-900">{it.valeur.toLocaleString("fr-FR")}</span>
          <span className="text-xs text-ink-700/60">{it.libelle}</span>
        </div>
      ))}
    </div>
  );
}

export default async function AbsencesPage() {
  const u = await requireRole([
    "admin", "chef_etablissement", "adjoint_chef_etablissement", "enseignant", "educateur", "inspecteur_orientation", "drena",
  ]);

  const estDemandeur = !!u.portee.etablissementId;
  const estDirection = u.roleReel === "chef_etablissement" || u.roleReel === "adjoint_chef_etablissement";
  const estDecideur = u.roleReel === "admin" || (estDirection && !!u.portee.etablissementId);
  const estRegion = u.roleReel === "drena" || u.roleReel === "admin";

  const [mesDemandes, mesStats, aValider, statsEtab, statsRegion] = await Promise.all([
    estDemandeur
      ? prisma.demandeAbsence.findMany({
          where: { demandeurId: u.id },
          orderBy: { creeLe: "desc" },
          take: 20,
          select: { id: true, dateDebut: true, dateFin: true, statut: true, estEnseignant: true, nbSeancesAffectees: true, avecSuppleance: true },
        })
      : Promise.resolve([]),
    estDemandeur ? statsAbsences({ demandeurId: u.id }) : Promise.resolve(null),
    estDecideur
      ? prisma.demandeAbsence.findMany({
          where: u.roleReel === "admin"
            ? { statut: "en_attente" }
            : { statut: "en_attente", etablissementId: u.portee.etablissementId ?? "", demandeurId: { not: u.id } },
          orderBy: { creeLe: "asc" },
          take: 50,
          select: {
            id: true, dateDebut: true, dateFin: true, motif: true, estEnseignant: true, nbSeancesAffectees: true,
            avecSuppleance: true, demandeur: { select: { nom: true, prenoms: true, email: true, roleActif: { select: { libelle: true } } } },
          },
        })
      : Promise.resolve([]),
    estDirection && u.portee.etablissementId ? statsAbsences({ etablissementId: u.portee.etablissementId }) : Promise.resolve(null),
    estRegion ? statsAbsencesParEtablissement(filtreEtablissements(u.portee)) : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        titre="Autorisations d'absence"
        description="Demandez une autorisation d'absence, faites-la valider par votre supérieur et suivez les statistiques d'absences et de rattrapages."
      />

      {estDemandeur && (
        <Card>
          <h2 className="mb-3 inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
            <CalendarX2 size={18} className="text-forest-600" /> Nouvelle demande
          </h2>
          <DemandeAbsenceForm />
        </Card>
      )}

      {estDecideur && (
        <Card>
          <h2 className="mb-3 inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
            <ClipboardCheck size={18} className="text-forest-600" /> Demandes à valider
            <span className="text-xs font-normal text-ink-700/55">({aValider.length})</span>
          </h2>
          {aValider.length === 0 ? (
            <p className="text-sm text-ink-700/60">Aucune demande en attente de votre décision.</p>
          ) : (
            <ul className="space-y-3">
              {aValider.map((d) => (
                <li key={d.id} className="rounded-2xl border border-cream-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-forest-900">{nomComplet(d.demandeur)}</p>
                      <p className="text-xs text-ink-700/60">{d.demandeur.roleActif.libelle} · {periode(d.dateDebut, d.dateFin)}</p>
                      {d.estEnseignant && (
                        <p className="mt-0.5 text-xs text-ink-700/60">
                          {d.nbSeancesAffectees} séance(s) affectée(s) · {d.avecSuppleance ? "suppléance prévue" : "rattrapage prévu"}
                        </p>
                      )}
                      {d.motif && <p className="mt-1 text-sm text-ink-800">« {d.motif} »</p>}
                    </div>
                    <Link href={`/app/vie-scolaire/absences/${d.id}/fiche`} className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 px-3 py-1 text-xs font-medium text-forest-800 hover:bg-forest-50">
                      <FileText size={13} /> Fiche
                    </Link>
                  </div>
                  <div className="mt-3">
                    <DecisionButtons demandeId={d.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {estDemandeur && (
        <Card>
          <h2 className="mb-3 inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
            <FileText size={18} className="text-forest-600" /> Mes demandes
          </h2>
          {mesDemandes.length === 0 ? (
            <p className="text-sm text-ink-700/60">Vous n&apos;avez pas encore déposé de demande.</p>
          ) : (
            <ul className="divide-y divide-cream-100">
              {mesDemandes.map((d) => {
                const b = BADGE[d.statut] ?? BADGE.en_attente;
                return (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <span className="font-medium text-forest-900">{periode(d.dateDebut, d.dateFin)}</span>
                      {d.estEnseignant && <span className="ml-2 text-xs text-ink-700/55">{d.nbSeancesAffectees} séance(s)</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${b.classe}`}>{b.libelle}</span>
                      <Link href={`/app/vie-scolaire/absences/${d.id}/fiche`} className="rounded-full border border-cream-300 px-3 py-1 text-xs font-medium text-forest-800 hover:bg-forest-50">
                        Fiche
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {mesStats && (
            <div className="mt-4 border-t border-cream-100 pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-700/55">Mes statistiques</p>
              <BlocStats stats={mesStats} />
            </div>
          )}
        </Card>
      )}

      {statsEtab && (
        <Card>
          <h2 className="mb-3 inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
            <Building2 size={18} className="text-forest-600" /> Statistiques de l&apos;établissement
          </h2>
          <BlocStats stats={statsEtab} />
        </Card>
      )}

      {statsRegion && (
        <Card>
          <h2 className="mb-3 inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
            <Users size={18} className="text-forest-600" />
            {u.roleReel === "admin" ? "Statistiques nationales des absences" : "Statistiques régionales des absences"}
          </h2>
          <BlocStats stats={statsRegion.global} />
          {statsRegion.parEtablissement.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-cream-200 text-left text-xs uppercase tracking-wide text-ink-700/50">
                    <th className="py-1.5 pr-2">Établissement</th>
                    <th className="py-1.5 pr-2 text-right">Demandes</th>
                    <th className="py-1.5 pr-2 text-right">Approuvées</th>
                    <th className="py-1.5 pr-2 text-right">Jours</th>
                    <th className="py-1.5 pr-2 text-right">Séances</th>
                    <th className="py-1.5 text-right">À rattraper</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-100">
                  {statsRegion.parEtablissement.map((e) => (
                    <tr key={e.etablissementId}>
                      <td className="py-1.5 pr-2 font-medium text-forest-900">{e.nom}</td>
                      <td className="py-1.5 pr-2 text-right">{e.stats.total}</td>
                      <td className="py-1.5 pr-2 text-right text-forest-700">{e.stats.approuvees}</td>
                      <td className="py-1.5 pr-2 text-right">{e.stats.joursAbsence}</td>
                      <td className="py-1.5 pr-2 text-right">{e.stats.seancesAffectees}</td>
                      <td className="py-1.5 text-right text-red-600">{e.stats.seancesARattraper}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
