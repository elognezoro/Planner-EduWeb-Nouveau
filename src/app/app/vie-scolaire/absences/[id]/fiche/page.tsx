import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAccesComplet } from "@/lib/auth/session";
import { filtreEtablissements } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { EnTeteOfficielDoc } from "@/components/app/en-tete-officiel-doc";
import { BoutonImprimerEdt } from "@/components/app/emplois-du-temps/bouton-imprimer";
import { LIBELLE_JOUR } from "@/lib/absences/edt";

export const metadata: Metadata = { title: "Fiche d'autorisation d'absence" };
export const dynamic = "force-dynamic";

interface ClasseJson { classeNom: string; disciplineNom: string; jours: number[]; nbSeances: number }
interface SuppleantJson { id: string; nom: string }

const dateLongue = (d: Date) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
const nomComplet = (p: { prenoms: string | null; nom: string | null; email?: string }) =>
  [p.prenoms, p.nom].filter(Boolean).join(" ").trim() || p.email || "—";

export default async function FicheAbsencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireAccesComplet();

  const d = await prisma.demandeAbsence.findUnique({
    where: { id },
    include: {
      demandeur: { select: { nom: true, prenoms: true, email: true, telephone: true, roleActif: { select: { libelle: true } } } },
      decisionPar: { select: { nom: true, prenoms: true, email: true } },
      etablissement: {
        select: {
          nom: true, pays: true, ministere: true, sloganBulletin: true, anneeScolaire: true, emblemeUrl: true,
          fonctionChef: true, nomChef: true, prenomsChef: true,
        },
      },
    },
  });
  if (!d) redirect("/app/vie-scolaire/absences");

  // Cloisonnement : demandeur, décideur, Chef/ACE de l'établissement, admin — ou réseau
  // catholique (SENEC/SEDEC) en LECTURE SEULE si l'établissement est dans son périmètre.
  const estDirectionDuMême =
    (u.roleReel === "chef_etablissement" || u.roleReel === "adjoint_chef_etablissement") &&
    u.portee.etablissementId === d.etablissementId;
  let autorise = u.roleReel === "admin" || u.id === d.demandeurId || u.id === d.decisionParId || estDirectionDuMême;
  if (!autorise && (u.roleActif === "senec" || u.roleActif === "sedec")) {
    const dansReseau = await prisma.etablissement.findFirst({
      where: { id: d.etablissementId, AND: [filtreEtablissements(u.portee)] },
      select: { id: true },
    });
    autorise = Boolean(dansReseau);
  }
  if (!autorise) redirect("/app/vie-scolaire/absences");

  const classes = (Array.isArray(d.classesAffectees) ? d.classesAffectees : []) as unknown as ClasseJson[];
  const suppleants = (Array.isArray(d.suppleants) ? d.suppleants : []) as unknown as SuppleantJson[];
  const datesRattrapage = (Array.isArray(d.datesRattrapage) ? d.datesRattrapage : []) as unknown as string[];

  const periode = d.dateDebut.getTime() === d.dateFin.getTime()
    ? `le ${dateLongue(d.dateDebut)}`
    : `du ${dateLongue(d.dateDebut)} au ${dateLongue(d.dateFin)}`;

  const statutInfo =
    d.statut === "approuvee" ? { libelle: "Avis favorable", classe: "bg-forest-100 text-forest-800 border-forest-200" } :
    d.statut === "refusee" ? { libelle: "Avis défavorable", classe: "bg-red-100 text-red-700 border-red-200" } :
    { libelle: "En attente de décision", classe: "bg-gold-100 text-gold-800 border-gold-200" };

  const chef = [d.etablissement.prenomsChef, d.etablissement.nomChef].filter(Boolean).join(" ").trim();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/app/vie-scolaire/absences" className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900">
          <ArrowLeft size={15} /> Retour aux autorisations d&apos;absence
        </Link>
        <BoutonImprimerEdt />
      </div>

      <div className="edt-feuille rounded-2xl border border-cream-200 bg-white p-6 shadow-soft sm:p-8">
        <style
          dangerouslySetInnerHTML={{
            __html: `@media print { @page { size: A4 portrait; margin: 12mm; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } .edt-feuille { border: 0 !important; box-shadow: none !important; padding: 0 !important; } }`,
          }}
        />
        <EnTeteOfficielDoc
          etab={d.etablissement}
          titre="Autorisation d'absence"
          sousTitre={d.statut === "approuvee" ? "Fiche officielle de synthèse" : undefined}
        />

        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-ink-700/70">
            Demande n° <span className="font-mono text-ink-900">{d.id.slice(0, 8).toUpperCase()}</span>
          </p>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statutInfo.classe}`}>{statutInfo.libelle}</span>
        </div>

        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Champ terme="Demandeur" valeur={nomComplet(d.demandeur)} />
          <Champ terme="Fonction" valeur={d.demandeur.roleActif.libelle} />
          <Champ terme="Période d'absence" valeur={periode} />
          <Champ terme="Nombre de séances affectées" valeur={d.estEnseignant ? String(d.nbSeancesAffectees) : "—"} />
          {d.motif && <div className="sm:col-span-2"><Champ terme="Motif" valeur={d.motif} /></div>}
        </dl>

        {d.estEnseignant && (
          <section className="mt-6">
            <h2 className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-forest-900">Classes pédagogiques affectées</h2>
            {classes.length === 0 ? (
              <p className="text-sm text-ink-700/60">Aucune séance de l&apos;emploi du temps ne tombe sur la période demandée.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-cream-300 text-left text-xs uppercase tracking-wide text-ink-700/55">
                      <th className="py-1.5 pr-2">Classe</th><th className="py-1.5 pr-2">Discipline</th>
                      <th className="py-1.5 pr-2">Jour(s)</th><th className="py-1.5 text-right">Séances</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream-100">
                    {classes.map((c, i) => (
                      <tr key={i}>
                        <td className="py-1.5 pr-2 font-medium text-forest-900">{c.classeNom}</td>
                        <td className="py-1.5 pr-2">{c.disciplineNom}</td>
                        <td className="py-1.5 pr-2 text-ink-700/70">{c.jours.map((j) => LIBELLE_JOUR[j]).join(", ")}</td>
                        <td className="py-1.5 text-right">{c.nbSeances}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {d.estEnseignant && (
          <section className="mt-6">
            <h2 className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-forest-900">
              {d.avecSuppleance ? "Suppléance prévue" : "Rattrapage prévu"}
            </h2>
            {d.avecSuppleance ? (
              suppleants.length > 0 ? (
                <ul className="list-inside list-disc text-sm text-ink-800">
                  {suppleants.map((s) => <li key={s.id}>{s.nom}</li>)}
                </ul>
              ) : (
                <p className="text-sm text-ink-700/60">Aucun suppléant renseigné.</p>
              )
            ) : datesRattrapage.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {datesRattrapage.map((iso) => (
                  <li key={iso} className="rounded-full bg-cream-100 px-3 py-1 text-xs font-medium text-forest-800">
                    {dateLongue(new Date(`${iso}T00:00:00.000Z`))}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-700/60">Aucune date de rattrapage renseignée.</p>
            )}
          </section>
        )}

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/55">Le demandeur</p>
            <p className="mt-8 border-t border-cream-300 pt-1 text-sm font-medium text-forest-900">{nomComplet(d.demandeur)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/55">
              {d.etablissement.fonctionChef || "Le Chef d'établissement"}
            </p>
            <p className="mt-1 text-xs text-ink-700/60">
              {d.statut === "approuvee" && d.decisionPar
                ? `Validé par ${nomComplet(d.decisionPar)}${d.decisionLe ? ` le ${dateLongue(d.decisionLe)}` : ""}`
                : d.statut === "refusee" && d.decisionPar
                  ? `Refusé par ${nomComplet(d.decisionPar)}${d.decisionLe ? ` le ${dateLongue(d.decisionLe)}` : ""}`
                  : "En attente de décision"}
            </p>
            <p className="mt-6 border-t border-cream-300 pt-1 text-sm font-medium text-forest-900">{chef || " "}</p>
            {d.motifDecision && <p className="mt-1 text-xs italic text-ink-700/70">« {d.motifDecision} »</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Champ({ terme, valeur }: { terme: string; valeur: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-700/55">{terme}</dt>
      <dd className="mt-0.5 text-sm font-medium text-forest-900">{valeur}</dd>
    </div>
  );
}
