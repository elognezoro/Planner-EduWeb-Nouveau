import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { ROLES_PAGES_VISITES, peutVoirVisite } from "@/lib/inspection/droits-visite";
import {
  COMPETENCES,
  ECHELLE,
  SYNTHESE,
  cleIndicateur,
  lireReponsesGrille,
  lireSeanceObservee,
} from "@/lib/inspection/grille-supervision";
import { libelleApfc, paysEffectifApfc } from "@/lib/apfc-terme-serveur";
import { EnTeteOfficielApfc, type ApfcEnTeteInfo } from "@/components/app/en-tete-officiel-apfc";
import { EnTeteOfficielDoc } from "@/components/app/en-tete-officiel-doc";
import { BoutonImprimerEdt } from "@/components/app/emplois-du-temps/bouton-imprimer";

export const metadata: Metadata = { title: "Grille de supervision — fiche imprimable" };
export const dynamic = "force-dynamic";

const TITRE_OFFICIEL = "Grille de supervision des professeurs du secondaire";

const dateLongueUTC = (d: Date) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
const dateDuJour = () =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date());
const nomComplet = (p: { prenoms: string | null; nom: string | null; email: string }) =>
  [p.prenoms, p.nom].filter(Boolean).join(" ") || p.email;

/** Année scolaire de la date de visite (septembre → août) : « 2025 - 2026 ». */
function anneeScolaireDe(date: Date): string {
  const annee = date.getUTCFullYear();
  return date.getUTCMonth() >= 8 ? `${annee} - ${annee + 1}` : `${annee - 1} - ${annee}`;
}

/** Valeur saisie, ou pointillés (champ à compléter à la main sur la fiche imprimée). */
function Pointille({ valeur }: { valeur: string | null | undefined }) {
  return valeur ? (
    <span className="font-medium text-ink-900">{valeur}</span>
  ) : (
    <span aria-hidden className="tracking-widest text-ink-700/45">
      ………………………………
    </span>
  );
}

export default async function GrilleImprimablePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireRole(ROLES_PAGES_VISITES);

  const visite = await prisma.visite.findUnique({
    where: { id },
    include: {
      etablissement: {
        select: {
          id: true,
          nom: true,
          ville: true,
          pays: true,
          ministere: true,
          sloganBulletin: true,
          emblemeUrl: true,
          regionId: true,
          region: { select: { nom: true } },
        },
      },
      inspecteur: { select: { prenoms: true, nom: true, email: true } },
      enseignant: { select: { prenoms: true, nom: true, email: true } },
      grille: true,
    },
  });
  // Même périmètre de LECTURE que la liste « Mes visites » (fail-closed, cf. droits-visite).
  if (!visite || !peutVoirVisite(u, visite)) notFound();

  // Discipline de l'enseignant visité DANS cet établissement (si connue).
  const disciplines = visite.enseignantId
    ? (
        await prisma.competenceEnseignant.findMany({
          where: { enseignantId: visite.enseignantId, etablissementId: visite.etablissementId },
          select: { discipline: { select: { nom: true } } },
        })
      ).map((c) => c.discipline.nom)
    : [];
  const discipline = [...new Set(disciplines)].join(" / ") || null;

  // En-tête officiel : APFC couvrant l'établissement (CouvertureApfc) si elle existe, sinon
  // en-tête ministériel simple adapté au pays de l'établissement.
  const couverture = await prisma.couvertureApfc.findUnique({
    where: { etablissementId: visite.etablissementId },
    select: {
      apfc: { select: { nom: true, logoUrl: true, region: { select: { nom: true, pays: true } } } },
    },
  });
  let apfcEntete: ApfcEnTeteInfo | null = null;
  let termeApfc: string | null = null;
  if (couverture) {
    const paysApfc = await paysEffectifApfc(couverture.apfc.region?.pays ?? null);
    apfcEntete = {
      nom: couverture.apfc.nom,
      regionNom: couverture.apfc.region?.nom ?? null,
      pays: paysApfc,
      logoUrl: couverture.apfc.logoUrl,
    };
    termeApfc = await libelleApfc(paysApfc);
  }

  const anneeScolaire = anneeScolaireDe(visite.date);
  const reponses = lireReponsesGrille(visite.grille?.reponses);
  const seance = lireSeanceObservee(visite.grille?.seance);
  const syntheses: { titre: string; texte: string | null }[] = [
    { titre: SYNTHESE[0].titre, texte: visite.grille?.pointsForts ?? null },
    { titre: SYNTHESE[1].titre, texte: visite.grille?.pointsAmeliorer ?? null },
    { titre: SYNTHESE[2].titre, texte: visite.grille?.propositions ?? null },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/app/inspection/visites/${visite.id}/grille`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900"
        >
          <ArrowLeft size={15} /> Retour à la grille
        </Link>
        <BoutonImprimerEdt />
      </div>

      <div className="grille-feuille rounded-2xl border border-cream-200 bg-white p-6 shadow-soft sm:p-8">
        <style
          dangerouslySetInnerHTML={{
            __html: `@media print { @page { size: A4 portrait; margin: 10mm; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } .grille-feuille { border: 0 !important; box-shadow: none !important; padding: 0 !important; } }`,
          }}
        />

        {apfcEntete ? (
          <EnTeteOfficielApfc
            apfc={apfcEntete}
            titre={TITRE_OFFICIEL}
            sousTitre={`Année scolaire : ${anneeScolaire}`}
            terme={termeApfc}
          />
        ) : (
          <EnTeteOfficielDoc
            etab={{
              nom: visite.etablissement.nom,
              pays: visite.etablissement.pays,
              ministere: visite.etablissement.ministere,
              sloganBulletin: visite.etablissement.sloganBulletin,
              anneeScolaire: null,
              emblemeUrl: visite.etablissement.emblemeUrl,
            }}
            titre={TITRE_OFFICIEL}
            sousTitre={`Année scolaire : ${anneeScolaire}`}
          />
        )}

        {/* I — Identification (renseignée depuis la visite ; pointillés pour les champs vides). */}
        <section className="mt-2">
          <h2 className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-forest-900">
            I — Identification de l&apos;enseignant.e
          </h2>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <IdLigne terme="DRENA / DDENA" valeur={visite.etablissement.region?.nom ?? null} />
            <IdLigne
              terme="Nom et prénom.s"
              valeur={visite.enseignant ? nomComplet(visite.enseignant) : null}
            />
            <IdLigne terme="Établissement" valeur={visite.etablissement.nom} />
            <IdLigne terme="Discipline enseignée" valeur={discipline} />
            <IdLigne terme="Classe" valeur={visite.classeNom} />
            <IdLigne
              terme="Date de la visite"
              valeur={`${dateLongueUTC(visite.date)}${visite.heureSeance ? ` (${visite.heureSeance})` : ""}`}
            />
          </dl>
        </section>

        {/* Séance observée (volet de la grille, saisi avec la grille en ligne). */}
        <section className="mt-4">
          <h2 className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-forest-900">
            Séance observée
          </h2>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <IdLigne terme="Nature de la séance" valeur={seance.nature || null} />
            <IdLigne terme="Titre" valeur={seance.titre || null} />
            <IdLigne terme="Durée" valeur={seance.duree || null} />
            <div className="sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-700/55">
                Effectif —{" "}
              </span>
              <span className="text-sm">
                Filles : <Pointille valeur={seance.effectifFilles || null} /> (présentes :{" "}
                <Pointille valeur={seance.effectifFillesPresentes || null} />) · Garçons :{" "}
                <Pointille valeur={seance.effectifGarcons || null} /> (présents :{" "}
                <Pointille valeur={seance.effectifGarconsPresents || null} />)
              </span>
            </div>
          </dl>
        </section>

        {/* Échelle (rappel de la consigne officielle). */}
        <p className="mt-4 text-xs text-ink-700/65">
          Échelle d&apos;appréciation : {ECHELLE.map((e) => `${e.code} = ${e.libelle}`).join(" · ")}.
        </p>

        {/* Les 4 compétences : la case de l'appréciation retenue est cochée (✓), les autres vides. */}
        {COMPETENCES.map((comp) => (
          <section key={comp.numero} className="mt-4 break-inside-avoid-page">
            <h2 className="mb-2 font-display text-sm font-bold text-forest-900">
              {comp.numero} — {comp.titre}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-[0.75rem] leading-snug">
                <thead>
                  <tr className="bg-cream-50 text-left text-[0.65rem] uppercase tracking-wide text-forest-800">
                    <th className="border border-cream-300 p-1.5 font-semibold">Élément d&apos;appréciation</th>
                    <th className="border border-cream-300 p-1.5 font-semibold">Critère</th>
                    <th className="border border-cream-300 p-1.5 font-semibold">Indicateurs</th>
                    {ECHELLE.map((e) => (
                      <th
                        key={e.code}
                        title={e.libelle}
                        className="w-8 border border-cream-300 p-1.5 text-center font-semibold"
                      >
                        {e.code}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comp.items.map((item) =>
                    item.indicateurs.map((indicateur, i) => {
                      const cle = cleIndicateur(item.numero, i);
                      return (
                        <tr key={cle} className="align-top">
                          {i === 0 && (
                            <td rowSpan={item.indicateurs.length} className="border border-cream-300 p-1.5 text-ink-900">
                              <span className="font-semibold text-forest-900">{item.numero}</span> {item.enonce}
                            </td>
                          )}
                          {i === 0 && (
                            <td rowSpan={item.indicateurs.length} className="border border-cream-300 p-1.5 text-ink-700/80">
                              {item.critere}
                            </td>
                          )}
                          <td className="border border-cream-300 p-1.5 text-ink-900">{indicateur}</td>
                          {ECHELLE.map((e) => (
                            <td key={e.code} className="border border-cream-300 p-1 text-center align-middle">
                              <span
                                aria-label={reponses[cle] === e.code ? `${e.libelle} (coché)` : undefined}
                                className="inline-flex h-4 w-4 items-center justify-center rounded-[3px] border border-ink-700/45 bg-white align-middle text-[0.7rem] font-bold text-ink-900"
                              >
                                {reponses[cle] === e.code ? "✓" : ""}
                              </span>
                            </td>
                          ))}
                        </tr>
                      );
                    }),
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        {/* Synthèse de la supervision. */}
        <section className="mt-5 break-inside-avoid-page">
          <h2 className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-forest-900">
            Synthèse de la supervision
          </h2>
          <div className="space-y-3">
            {syntheses.map((s) => (
              <div key={s.titre} className="rounded-lg border border-cream-300 p-2.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/60">{s.titre}</p>
                {s.texte ? (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-ink-900">{s.texte}</p>
                ) : (
                  <p aria-hidden className="mt-1 tracking-widest text-ink-700/45">
                    …………………………………………………………………………………………………………………………
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Lieu, date et signatures (fin de la grille officielle). */}
        <div className="mt-6 break-inside-avoid-page">
          <p className="text-right text-sm text-ink-900">
            Fait à <Pointille valeur={visite.etablissement.ville} />, le{" "}
            <span className="font-medium">{dateDuJour()}</span>
          </p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/55">L&apos;enseignant.e</p>
              <p className="mt-10 border-t border-cream-300 pt-1 text-sm font-medium text-forest-900">
                {visite.enseignant ? nomComplet(visite.enseignant) : " "}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/55">
                Le (La) superviseur.e
              </p>
              <p className="mt-10 border-t border-cream-300 pt-1 text-sm font-medium text-forest-900">
                {nomComplet(visite.inspecteur)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function IdLigne({ terme, valeur }: { terme: string; valeur: string | null }) {
  return (
    <div>
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-700/55">{terme} : </span>
      <Pointille valeur={valeur} />
    </div>
  );
}
