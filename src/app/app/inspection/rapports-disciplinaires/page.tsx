import type { Metadata } from "next";
import Image from "next/image";
import { BookOpenCheck, Stamp, ListChecks, Download } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, StatCard } from "@/components/app/ui";
import { trouverPays, armoiriesUrl } from "@/lib/referentiels/pays";
import { paysEffectifApfc, termeApfcCourant } from "@/lib/apfc-terme-serveur";
import { appliquerTermeApfc } from "@/lib/apfc-terme";
import { completerEntete, type EnteteRapport } from "@/lib/inspection/rapport-disciplinaire";
import { FiltresRapportCrd, RapportCrdForm } from "./components";
import {
  apfcsAccessibles,
  chargerRapport,
  disciplinesPourApfc,
  enteteParDefaut,
  estRoleAntenne,
  nettoyerDiscipline,
  peutModifierRapportDisciplinaire,
  type ApfcRapport,
  type RapportCharge,
} from "./rapport-serveur";

export const metadata: Metadata = { title: "Rapports Pédagogiques Disciplinaires" };
export const dynamic = "force-dynamic";

const DISCIPLINE_NON_RENSEIGNEE = "Discipline non renseignée";

const dateLongue = (d: Date) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(d);

/** Ligne pointillée séparant les mentions de la colonne gauche de l'en-tête officiel. */
function Pointille() {
  return (
    <p
      aria-hidden
      className="my-0.5 overflow-hidden whitespace-nowrap text-[0.6rem] font-normal normal-case text-ink-700/45"
    >
      --------------------------------
    </p>
  );
}

export default async function RapportsDisciplinairesPage({
  searchParams,
}: {
  searchParams: Promise<{ apfc?: string; discipline?: string }>;
}) {
  const u = await requireRole(["admin", "inspecteur", "drena"]);
  const { apfc: apfcParam, discipline: disciplineParam } = await searchParams;

  const where =
    u.roleReel === "inspecteur"
      ? { inspecteurId: u.id }
      : u.roleReel === "drena"
        ? { etablissement: { regionId: u.portee.regionId ?? "__aucune__" } }
        : {};

  let lignes: { discipline: string; visites: number; recosOuvertes: number; moyenne: number | null }[] = [];
  let erreur = false;

  try {
    const visites = await prisma.visite.findMany({
      where: { ...where, enseignantId: { not: null } },
      select: {
        enseignantId: true,
        noteGlobale: true,
        recommandations: { select: { statut: true } },
      },
    });

    const enseignantIds = [...new Set(visites.map((v) => v.enseignantId).filter((id): id is string => id != null))];

    const affectations =
      enseignantIds.length > 0
        ? await prisma.affectationEnseignant.findMany({
            where: { enseignantId: { in: enseignantIds } },
            select: { enseignantId: true, discipline: { select: { nom: true } } },
          })
        : [];

    // Un enseignant peut être affecté à plusieurs disciplines : on retient la première déclarée.
    const disciplineParEnseignant = new Map<string, string>();
    for (const a of affectations) {
      if (!disciplineParEnseignant.has(a.enseignantId)) disciplineParEnseignant.set(a.enseignantId, a.discipline.nom);
    }

    const parDiscipline = new Map<string, { visites: number; recosOuvertes: number; sommeNote: number; nNote: number }>();
    for (const v of visites) {
      const discipline = disciplineParEnseignant.get(v.enseignantId as string) ?? DISCIPLINE_NON_RENSEIGNEE;
      const o = parDiscipline.get(discipline) ?? { visites: 0, recosOuvertes: 0, sommeNote: 0, nNote: 0 };
      o.visites += 1;
      o.recosOuvertes += v.recommandations.filter((r) => r.statut !== "traitee").length;
      if (v.noteGlobale != null) {
        o.sommeNote += v.noteGlobale;
        o.nNote += 1;
      }
      parDiscipline.set(discipline, o);
    }

    lignes = [...parDiscipline.entries()]
      .map(([discipline, o]) => ({
        discipline,
        visites: o.visites,
        recosOuvertes: o.recosOuvertes,
        moyenne: o.nNote > 0 ? Math.round((o.sommeNote / o.nNote) * 10) / 10 : null,
      }))
      .sort((a, b) => b.visites - a.visites);
  } catch (e) {
    console.error("[rapports-disciplinaires] chargement :", e);
    erreur = true;
  }

  const kpis = {
    disciplines: lignes.length,
    visites: lignes.reduce((s, l) => s + l.visites, 0),
    recosOuvertes: lignes.reduce((s, l) => s + l.recosOuvertes, 0),
  };

  // ── Rapport bilan (CRD) : sélection antenne + discipline (?apfc=&discipline=, revalidés
  //    fail-closed côté serveur), rapport enregistré sinon pré-rempli, en-tête officiel, Word. ──
  const terme = await termeApfcCourant();
  const T = (s: string) => appliquerTermeApfc(s, terme);
  const roleAntenne = estRoleAntenne(u);
  const discipline = nettoyerDiscipline(disciplineParam);

  let crdErreur = false;
  let apfcs: ApfcRapport[] | null = null;
  let apfcChoisie: ApfcRapport | null = null;
  let disciplines: string[] = [];
  let rapport: RapportCharge | null = null;
  let modifiable = false;
  let paysEntete = "";
  // En-tête configurable : défauts calculés (pays + antenne) et mentions EFFECTIVES affichées
  // (mentions enregistrées complétées par les défauts — une mention vide retombe sur le défaut).
  let enteteDefauts: EnteteRapport | null = null;
  let enteteEffectif: EnteteRapport | null = null;

  try {
    apfcs = await apfcsAccessibles(u);
    if (apfcs && apfcs.length > 0) {
      // Rôles d'antenne : leur APFC automatiquement (seule antenne du périmètre) ; sinon le
      // ?apfc= demandé n'est retenu QUE s'il figure dans la liste DÉJÀ cloisonnée (fail-closed).
      apfcChoisie = roleAntenne ? apfcs[0] : (apfcs.find((a) => a.id === apfcParam) ?? null);
    }
    if (apfcChoisie) {
      disciplines = await disciplinesPourApfc(apfcChoisie.id);
      paysEntete = await paysEffectifApfc(apfcChoisie.region?.pays ?? null);
      if (discipline) {
        rapport = await chargerRapport(apfcChoisie, discipline);
        enteteDefauts = await enteteParDefaut(apfcChoisie, discipline);
        enteteEffectif = completerEntete(rapport.contenu.entete, enteteDefauts);
        modifiable = peutModifierRapportDisciplinaire(u, {
          id: apfcChoisie.id,
          pays: apfcChoisie.region?.pays ?? null,
        });
      }
    }
  } catch (e) {
    console.error("[rapports-disciplinaires] rapport CRD :", e);
    crdErreur = true;
  }

  const infoPays = paysEntete ? trouverPays(paysEntete) : null;
  const armoiries = infoPays ? armoiriesUrl(infoPays.code) : null;
  const antenneLocalite = apfcChoisie?.localite?.trim() || apfcChoisie?.region?.nom || "";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        titre="Rapports Pédagogiques Disciplinaires"
        description="Résultats d'inspection agrégés par discipline enseignée."
      />

      {erreur ? (
        <Card>
          <p className="text-sm text-ink-700/70">Impossible de charger les rapports par discipline.</p>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard libelle="Disciplines couvertes" valeur={kpis.disciplines} icone={<BookOpenCheck size={22} />} />
            <StatCard libelle="Visites concernées" valeur={kpis.visites} icone={<Stamp size={22} />} ton="gold" />
            <StatCard libelle="Recommandations à suivre" valeur={kpis.recosOuvertes} icone={<ListChecks size={22} />} />
          </div>

          <Card>
            <h2 className="mb-3 font-display text-base font-bold text-forest-900">Par discipline</h2>
            {lignes.length === 0 ? (
              <p className="text-sm text-ink-700/60">
                Aucune visite avec enseignant identifié n&apos;est enregistrée pour le moment.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-cream-200 text-left text-xs text-ink-700/65">
                      <th className="py-2.5 pr-3 font-semibold">Discipline</th>
                      <th className="px-2 py-2.5 text-right font-semibold">Visites</th>
                      <th className="px-2 py-2.5 text-right font-semibold">Reco. à suivre</th>
                      <th className="px-2 py-2.5 text-right font-semibold">Moy. /20</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.map((l) => (
                      <tr key={l.discipline} className="border-b border-cream-100 last:border-0">
                        <td className="py-2.5 pr-3 font-medium text-forest-900">{l.discipline}</td>
                        <td className="px-2 py-2.5 text-right text-ink-700/80">{l.visites}</td>
                        <td className="px-2 py-2.5 text-right text-gold-700">{l.recosOuvertes}</td>
                        <td className="px-2 py-2.5 text-right font-semibold text-forest-800">{l.moyenne ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* ── Rapport bilan (CRD) — modèle officiel narratif, AJOUTÉ sous les agrégats existants.
             Section masquée pour les rôles sans accès au rapport (fail-closed). ── */}
      {apfcs !== null && (
        <section id="rapport-crd" className="scroll-mt-24 space-y-4">
          <Card>
            <h2 className="mb-1 font-display text-base font-bold text-forest-900">Rapport bilan (CRD)</h2>
            <p className="mb-4 text-sm text-ink-700/70">
              {T(
                "Rapport narratif de la Coordination Régionale Disciplinaire (modèle officiel « Rapport bilan CRD ») : alimenté par les données des établissements et CAFOP sous la responsabilité de l'APFC, éditable, enregistré et téléchargeable au format Word.",
              )}
            </p>
            {crdErreur ? (
              <p className="text-sm text-ink-700/70">Impossible de charger le rapport bilan (CRD).</p>
            ) : apfcs.length === 0 ? (
              <p className="text-sm text-ink-700/60">{T("Aucune APFC dans votre périmètre.")}</p>
            ) : (
              <FiltresRapportCrd
                montrerApfc={!roleAntenne}
                apfcOptions={apfcs.map((a) => ({ id: a.id, nom: a.region ? `${a.nom} — ${a.region.nom}` : a.nom }))}
                apfcDefaut={apfcChoisie ? { id: apfcChoisie.id, nom: apfcChoisie.nom } : null}
                disciplineOptions={disciplines.map((d) => ({ id: d, nom: d }))}
                disciplineDefaut={discipline ? { id: discipline, nom: discipline } : null}
                termeAntenne={terme}
              />
            )}
          </Card>

          {!crdErreur && apfcs.length > 0 && (!apfcChoisie || !discipline) && (
            <Card>
              <p className="text-sm text-ink-700/60">
                {!apfcChoisie
                  ? "Choisissez une antenne puis une discipline pour ouvrir le rapport bilan."
                  : "Choisissez une discipline (ou saisissez-la librement) pour ouvrir le rapport bilan."}
              </p>
            </Card>
          )}

          {!crdErreur && apfcChoisie && discipline && rapport && enteteEffectif && enteteDefauts && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-ink-700/55">
                  {rapport.enregistre
                    ? `Dernier enregistrement le ${dateLongue(rapport.majLe ?? new Date())}${
                        rapport.rempliParNom ? ` par ${rapport.rempliParNom}` : ""
                      }.`
                    : "Rapport pré-rempli à partir des données de l'antenne — pas encore enregistré."}
                </p>
                {/* Le Word est régénéré CÔTÉ SERVEUR depuis la base (mêmes gardes de lecture). */}
                <a
                  href={`/app/inspection/rapports-disciplinaires/rapport-word?apfc=${encodeURIComponent(
                    apfcChoisie.id,
                  )}&discipline=${encodeURIComponent(discipline)}`}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-forest-200 bg-white px-4 text-sm font-semibold text-forest-800 transition-colors hover:bg-forest-50"
                >
                  <Download size={15} /> Télécharger (Word)
                </a>
              </div>

              {/* En-tête officiel du modèle (2 colonnes, mentions séparées par des pointillés) —
                  mentions CONFIGURABLES (panneau « En-tête du document » du formulaire) : les
                  valeurs enregistrées priment, une mention vide retombe sur le défaut calculé. */}
              <Card>
                <div className="grid grid-cols-2 items-start gap-4">
                  <div className="text-[0.7rem] font-semibold uppercase leading-snug text-forest-900">
                    <p>{enteteEffectif.ministere}</p>
                    <Pointille />
                    {enteteEffectif.directionRegionale && (
                      <>
                        <p>{enteteEffectif.directionRegionale}</p>
                        <Pointille />
                      </>
                    )}
                    <p>{enteteEffectif.antenne}</p>
                    <Pointille />
                    <p>{enteteEffectif.coordination}</p>
                  </div>
                  <div className="text-center text-[0.7rem] leading-tight text-ink-700/80">
                    <p className="font-semibold uppercase text-forest-900">{enteteEffectif.republique}</p>
                    {armoiries && (
                      <Image
                        src={armoiries}
                        alt={`Armoiries — ${paysEntete}`}
                        width={72}
                        height={48}
                        unoptimized
                        className="mx-auto mt-1 h-12 w-[4.5rem] object-contain"
                      />
                    )}
                    {enteteEffectif.devise && <p className="mt-1 italic">« {enteteEffectif.devise} »</p>}
                  </div>
                </div>
              </Card>

              {/* Formulaire re-monté à chaque changement d'antenne/discipline (état réinitialisé). */}
              <RapportCrdForm
                key={`${apfcChoisie.id}::${discipline.toLowerCase()}`}
                apfcId={apfcChoisie.id}
                discipline={discipline}
                initiale={{ titre: rapport.titre, contenu: rapport.contenu }}
                enteteInitiale={enteteEffectif}
                enteteDefaut={enteteDefauts}
                lectureSeule={!modifiable}
                faitA={antenneLocalite}
                dateDuJour={dateLongue(new Date())}
              />
            </>
          )}
        </section>
      )}
    </div>
  );
}
