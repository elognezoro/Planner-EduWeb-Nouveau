import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Radar, Network, Users, Layers, Building2, BarChart3, X } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { paysConsulte } from "@/lib/pays-consulte";
import { libelleApfc, termeApfcCourant, paysEffectifApfc } from "@/lib/apfc-terme-serveur";
import { appliquerTermeApfc } from "@/lib/apfc-terme";
import { StatCard, Badge } from "@/components/app/ui";
import { EnTeteOfficielDoc } from "@/components/app/en-tete-officiel-doc";
import { EnTeteOfficielApfc, PiedSignatureApfc, type ApfcEnTeteInfo, type ApfcSignatureInfo } from "@/components/app/en-tete-officiel-apfc";
import { BoutonImprimerApfc } from "@/components/app/bouton-imprimer-apfc";
import {
  statsReseauApfc,
  dernieresSessionsApfc,
  topLocalitesApfc,
  type StatsReseauApfc,
  type StatsInspectionApfc,
  type RepartitionApfc,
  type SessionRecenteApfc,
} from "@/lib/apfc-stats";
import { ChartTopAntennes } from "./chart-antennes";

export async function generateMetadata(): Promise<Metadata> {
  return { title: appliquerTermeApfc("Supervision APFC", await termeApfcCourant()) };
}
export const dynamic = "force-dynamic";

/** Note /20 au format français (« 14,5 / 20 »), tiret cadratin si aucune visite notée. */
function noteFr(note: number | null): string {
  if (note == null) return "—";
  return `${note.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} / 20`;
}

/** Petite tuile chiffrée des sections statistiques (plus discrète que StatCard). */
function Tuile({ libelle, valeur }: { libelle: string; valeur: ReactNode }) {
  return (
    <div className="rounded-xl border border-cream-200 bg-white px-3 py-2.5">
      <p className="font-display text-lg font-bold leading-tight text-forest-900">{valeur}</p>
      <p className="text-[11px] text-ink-700/65">{libelle}</p>
    </div>
  );
}

/** Sous-carte d'une section statistique (titre + contenu), lisible à l'impression. */
function BlocStat({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-cream-200 bg-cream-50/40 p-3.5">
      <h3 className="mb-2 text-[13px] font-semibold text-forest-900">{titre}</h3>
      {children}
    </div>
  );
}

/** Mini-table à deux colonnes libellé / effectif (répartitions). */
function TableRepartition({
  data,
  enteteLibelle,
  enteteNombre,
}: {
  data: RepartitionApfc[];
  enteteLibelle: string;
  enteteNombre: string;
}) {
  if (data.length === 0) return <p className="text-xs text-ink-700/55">Aucune donnée disponible.</p>;
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="border-b border-cream-200 text-left text-[11px] text-ink-700/60">
          <th className="py-1.5 pr-2 font-semibold">{enteteLibelle}</th>
          <th className="py-1.5 text-right font-semibold">{enteteNombre}</th>
        </tr>
      </thead>
      <tbody>
        {data.map((r) => (
          <tr key={r.libelle} className="border-b border-cream-100 last:border-0">
            <td className="py-1.5 pr-2 text-ink-700/80">{r.libelle}</td>
            <td className="py-1.5 text-right font-semibold text-forest-800">{r.nombre}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Tuiles d'inspection (visites des encadreurs) — `compacte` pour les blocs en demi-largeur. */
function TuilesInspection({ stats, compacte = false }: { stats: StatsInspectionApfc; compacte?: boolean }) {
  return (
    <div className={compacte ? "grid grid-cols-2 gap-2" : "grid grid-cols-2 gap-2 sm:grid-cols-5"}>
      <Tuile libelle="Visites (total)" valeur={stats.visitesTotal} />
      <Tuile libelle="Réalisées" valeur={stats.visitesRealisees} />
      <Tuile libelle="Planifiées" valeur={stats.visitesPlanifiees} />
      <Tuile libelle="Note globale moyenne" valeur={noteFr(stats.noteMoyenne)} />
      <Tuile libelle="Grilles de supervision remplies" valeur={stats.grillesRemplies} />
    </div>
  );
}

/** Puce « libellé × n » (disciplines du personnel, localités couvertes). */
function Puce({ libelle, nombre }: { libelle: string; nombre: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-cream-200 px-2.5 py-0.5 text-xs font-semibold text-forest-800">
      {libelle} <span className="font-normal text-forest-700/70">× {nombre}</span>
    </span>
  );
}

/** Bloc « Statistiques détaillées » d'une antenne (id déjà revalidé dans le périmètre). */
type DetailApfc = {
  id: string;
  nom: string;
  region: string;
  pays: string;
  chef: string | null;
  cohortesActives: number;
  cohortesCloturees: number;
  apprenants: number;
  sessions: SessionRecenteApfc[];
  stats: StatsReseauApfc;
  topLocalites: RepartitionApfc[];
};

export default async function SupervisionApfcPage({
  searchParams,
}: {
  searchParams: Promise<{ apfc?: string }>;
}) {
  const u = await requireRole([
    "admin",
    "superviseur_international",
    "super_admin_apfc",
    "representant_pays",
    "apfc_admin",
    "drena",
    "chef_antenne",
    "conseiller_pedagogique",
  ]);
  const { apfc: apfcParam } = await searchParams;
  const pays = await paysConsulte();
  const terme = await libelleApfc(pays);
  const T = (s: string) => appliquerTermeApfc(s, terme);

  // Portée « antenne » (chef_antenne / conseiller_pedagogique) et « apfc » (apfc_admin)
  // partagent le même champ Utilisateur.apfcId ; drena est borné à sa région. Pour les périmètres
  // « global » / « pays » (admin, superviseur international, super_admin_apfc, représentant-pays),
  // on croise EXPLICITEMENT avec le pays consulté (region.pays) — cloisonnement par pays (consigne
  // client) : sans ce filtre, un périmètre global verrait les antennes de TOUS les pays, quel que
  // soit le sélecteur de la barre du haut.
  const estRoleAntenne = u.roleReel === "apfc_admin" || u.roleReel === "chef_antenne" || u.roleReel === "conseiller_pedagogique";
  const where = estRoleAntenne
    ? { id: u.portee.apfcId ?? "__aucune__" }
    : u.roleReel === "drena"
      ? { regionId: u.portee.regionId ?? "__aucune__" }
      : { region: { pays } };

  let lignes: {
    id: string;
    nom: string;
    region: string;
    cohortesActives: number;
    cohortesCloturees: number;
    apprenants: number;
    chefAntenne: boolean;
    conseillers: number;
    etablissementsCouverts: number;
  }[] = [];
  let erreur = false;
  // Document d'UNE antenne précise (portée apfc_admin/chef_antenne/conseiller_pedagogique, une
  // seule APFC dans le périmètre) : visuels propres à afficher en en-tête/pied officiels. `null`
  // pour un document agrégé multi-antennes (admin, DRENA, superviseur…) : voir en bas de fichier.
  let antenneEntete: ApfcEnTeteInfo | null = null;
  let antenneSignature: ApfcSignatureInfo | null = null;
  // Statistiques générales de l'ENSEMBLE des antennes du périmètre (même `where` que le tableau).
  let statsGenerales: StatsReseauApfc | null = null;
  // Bloc « Statistiques détaillées » (?apfc=<id>) — null si paramètre absent, hors périmètre ou inconnu.
  let detail: DetailApfc | null = null;

  try {
    const apfcs = await prisma.apfc.findMany({
      where,
      orderBy: { nom: "asc" },
      select: {
        id: true,
        nom: true,
        region: { select: { nom: true, pays: true } },
        logoUrl: true,
        cachetUrl: true,
        signatureUrl: true,
        chefAntenneNom: true,
        chefAntennePrenoms: true,
        cohortes: { select: { statut: true, _count: { select: { apprenants: true } } } },
        utilisateurs: { select: { nom: true, prenoms: true, roleActif: { select: { nomTechnique: true } } } },
        _count: { select: { couvertures: true } },
      },
    });

    lignes = apfcs.map((a) => ({
      id: a.id,
      nom: a.nom,
      region: a.region?.nom ?? "—",
      cohortesActives: a.cohortes.filter((c) => c.statut === "active").length,
      cohortesCloturees: a.cohortes.filter((c) => c.statut === "cloturee").length,
      apprenants: a.cohortes.reduce((s, c) => s + c._count.apprenants, 0),
      chefAntenne: a.utilisateurs.some((x) => x.roleActif.nomTechnique === "chef_antenne"),
      conseillers: a.utilisateurs.filter((x) => x.roleActif.nomTechnique === "conseiller_pedagogique").length,
      etablissementsCouverts: a._count.couvertures,
    }));

    if (estRoleAntenne && apfcs.length === 1) {
      const a = apfcs[0];
      const pays = await paysEffectifApfc(a.region?.pays ?? null);
      antenneEntete = { nom: a.nom, regionNom: a.region?.nom ?? null, pays, logoUrl: a.logoUrl };
      antenneSignature = {
        chefAntenneNom: a.chefAntenneNom,
        chefAntennePrenoms: a.chefAntennePrenoms,
        cachetUrl: a.cachetUrl,
        signatureUrl: a.signatureUrl,
      };
    }

    // Statistiques générales du réseau consulté — MÊME filtre `where` que le tableau :
    // le cloisonnement (pays consulté / région DRENA / antenne du périmètre) est inchangé.
    statsGenerales = await statsReseauApfc(where);

    // Bloc détaillé « ?apfc=<id> » — REVALIDATION fail-closed : l'id demandé doit figurer
    // parmi les antennes DÉJÀ filtrées par le périmètre (`apfcs`). Hors périmètre / pays
    // consulté ou inexistant → paramètre ignoré sans requêter quoi que ce soit.
    const cible = apfcParam ? apfcs.find((a) => a.id === apfcParam) : undefined;
    if (cible) {
      const [statsCible, sessions, localites, paysCible] = await Promise.all([
        statsReseauApfc({ id: cible.id }),
        dernieresSessionsApfc(cible.id),
        topLocalitesApfc(cible.id),
        paysEffectifApfc(cible.region?.pays ?? null),
      ]);
      // Chef d'antenne : nom de la fiche officielle en priorité, sinon compte utilisateur.
      const chefCompte = cible.utilisateurs.find((x) => x.roleActif.nomTechnique === "chef_antenne");
      const chefFiche = [cible.chefAntenneNom, cible.chefAntennePrenoms].filter(Boolean).join(" ").trim();
      const chefViaCompte = chefCompte ? [chefCompte.nom, chefCompte.prenoms].filter(Boolean).join(" ").trim() : "";
      detail = {
        id: cible.id,
        nom: cible.nom,
        region: cible.region?.nom ?? "—",
        pays: paysCible,
        chef: chefFiche || chefViaCompte || null,
        cohortesActives: cible.cohortes.filter((c) => c.statut === "active").length,
        cohortesCloturees: cible.cohortes.filter((c) => c.statut === "cloturee").length,
        apprenants: cible.cohortes.reduce((s, c) => s + c._count.apprenants, 0),
        sessions,
        stats: statsCible,
        topLocalites: localites,
      };
    }
  } catch (e) {
    console.error("[supervision-apfc] chargement :", e);
    erreur = true;
  }

  const kpis = {
    antennes: lignes.length,
    cohortesActives: lignes.reduce((s, l) => s + l.cohortesActives, 0),
    cohortesCloturees: lignes.reduce((s, l) => s + l.cohortesCloturees, 0),
    apprenants: lignes.reduce((s, l) => s + l.apprenants, 0),
    sansChefAntenne: lignes.filter((l) => !l.chefAntenne).length,
    etablissementsCouverts: lignes.reduce((s, l) => s + l.etablissementsCouverts, 0),
  };

  // Graphique des statistiques générales : top 10 des antennes par établissements couverts
  // (repli sur les apprenants inscrits si aucune couverture saisie) — masqué s'il n'y a
  // qu'une antenne dans le périmètre ou aucune donnée à comparer.
  const chart = (() => {
    if (lignes.length < 2) return null;
    const parCouverts = [...lignes].sort((a, b) => b.etablissementsCouverts - a.etablissementsCouverts).slice(0, 10);
    if ((parCouverts[0]?.etablissementsCouverts ?? 0) > 0) {
      return {
        titre: "Top 10 des antennes par établissements couverts",
        nomSerie: "Établissements couverts",
        data: parCouverts.filter((l) => l.etablissementsCouverts > 0).map((l) => ({ nom: l.nom, valeur: l.etablissementsCouverts })),
      };
    }
    const parApprenants = [...lignes].sort((a, b) => b.apprenants - a.apprenants).slice(0, 10);
    if ((parApprenants[0]?.apprenants ?? 0) > 0) {
      return {
        titre: "Top 10 des antennes par apprenants inscrits",
        nomSerie: "Apprenants",
        data: parApprenants.filter((l) => l.apprenants > 0).map((l) => ({ nom: l.nom, valeur: l.apprenants })),
      };
    }
    return null;
  })();

  // Document agrégé (multi-antennes) : en-tête générique du pays consulté, SANS logo/cachet/
  // signature d'une antenne particulière — on ne prête jamais les visuels d'UNE antenne à une
  // vue qui en couvre plusieurs.
  const paysAgrege = await paysEffectifApfc(null);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex justify-end print:hidden">
        <BoutonImprimerApfc />
      </div>

      <div className="apfc-feuille rounded-2xl border border-cream-200 bg-white p-6 shadow-soft sm:p-8">
        <style
          dangerouslySetInnerHTML={{
            __html: `@media print { @page { size: A4 portrait; margin: 12mm; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } .apfc-feuille { border: 0 !important; box-shadow: none !important; padding: 0 !important; } }`,
          }}
        />

        {antenneEntete ? (
          <EnTeteOfficielApfc
            apfc={antenneEntete}
            titre={T("Supervision APFC")}
            sousTitre="Vue d'ensemble : cohortes en cours et encadrement"
            terme={terme}
          />
        ) : (
          <EnTeteOfficielDoc
            etab={{ nom: T("Réseau national des antennes (APFC)"), pays: paysAgrege, ministere: null, sloganBulletin: null, anneeScolaire: null, emblemeUrl: null }}
            titre={T("Supervision APFC")}
            sousTitre="Vue d'ensemble du réseau des antennes : cohortes en cours et encadrement"
          />
        )}

        {erreur ? (
          <p className="text-sm text-ink-700/70">{T("Impossible de charger la supervision des APFC.")}</p>
        ) : (
          <>
            <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard libelle={T("Antennes (APFC)")} valeur={kpis.antennes} icone={<Network size={22} />} />
              <StatCard libelle="Cohortes actives" valeur={kpis.cohortesActives} icone={<Layers size={22} />} ton="gold" />
              <StatCard libelle="Sans chef d'antenne" valeur={kpis.sansChefAntenne} icone={<Radar size={22} />} />
              <StatCard libelle="Établissements couverts" valeur={kpis.etablissementsCouverts} icone={<Building2 size={22} />} ton="gold" />
            </div>

            {statsGenerales && lignes.length > 0 && (
              <section className="mb-6">
                <h2 className="mb-3 font-display text-base font-bold text-forest-900">Statistiques générales</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <BlocStat titre="Cohortes de formation continue">
                    <div className="grid grid-cols-3 gap-2">
                      <Tuile libelle="Actives" valeur={kpis.cohortesActives} />
                      <Tuile libelle="Clôturées" valeur={kpis.cohortesCloturees} />
                      <Tuile libelle="Apprenants inscrits" valeur={kpis.apprenants} />
                    </div>
                  </BlocStat>

                  <BlocStat titre="Encadrement">
                    <div className="grid grid-cols-3 gap-2">
                      <Tuile libelle="Chefs d'antenne nommés" valeur={kpis.antennes - kpis.sansChefAntenne} />
                      <Tuile libelle="Sans chef d'antenne" valeur={kpis.sansChefAntenne} />
                      <Tuile libelle={T("Personnel APFC")} valeur={statsGenerales.personnelTotal} />
                    </div>
                  </BlocStat>

                  <BlocStat titre="Couverture par catégorie pédagogique">
                    <TableRepartition
                      data={statsGenerales.couvertureParCategorie}
                      enteteLibelle="Catégorie pédagogique"
                      enteteNombre="Établissements"
                    />
                  </BlocStat>

                  <BlocStat titre="Personnel : disciplines les plus représentées">
                    <TableRepartition
                      data={statsGenerales.personnelParDiscipline.slice(0, 6)}
                      enteteLibelle="Discipline"
                      enteteNombre="Personnes"
                    />
                  </BlocStat>
                </div>

                <div className="mt-3">
                  <BlocStat titre="Inspection : visites des encadreurs d'antenne">
                    <TuilesInspection stats={statsGenerales.inspection} />
                  </BlocStat>
                </div>

                {chart && (
                  <div className="mt-3">
                    <BlocStat titre={chart.titre}>
                      <ChartTopAntennes data={chart.data} nomSerie={chart.nomSerie} />
                    </BlocStat>
                  </div>
                )}
              </section>
            )}

            <h2 className="mb-3 font-display text-base font-bold text-forest-900">Par antenne</h2>
            {lignes.length === 0 ? (
              <p className="text-sm text-ink-700/60">{T("Aucune APFC dans votre périmètre.")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-cream-200 text-left text-xs text-ink-700/65">
                      <th className="py-2.5 pr-3 font-semibold">Antenne</th>
                      <th className="px-2 py-2.5 font-semibold">Région</th>
                      <th className="px-2 py-2.5 text-right font-semibold">Cohortes actives</th>
                      <th className="px-2 py-2.5 text-right font-semibold">Clôturées</th>
                      <th className="px-2 py-2.5 text-right font-semibold">Apprenants</th>
                      <th className="px-2 py-2.5 text-right font-semibold">Étab. couverts</th>
                      <th className="px-2 py-2.5 text-right font-semibold">Encadrement</th>
                      <th className="px-2 py-2.5 text-right font-semibold print:hidden">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.map((l) => (
                      <tr key={l.id} className={`border-b border-cream-100 last:border-0 ${detail?.id === l.id ? "bg-forest-50/50" : ""}`}>
                        <td className="py-2.5 pr-3 font-medium text-forest-900">{l.nom}</td>
                        <td className="px-2 py-2.5 text-ink-700/70">{l.region}</td>
                        <td className="px-2 py-2.5 text-right text-ink-700/80">{l.cohortesActives}</td>
                        <td className="px-2 py-2.5 text-right text-ink-700/70">{l.cohortesCloturees}</td>
                        <td className="px-2 py-2.5 text-right font-semibold text-forest-800">{l.apprenants}</td>
                        <td className="px-2 py-2.5 text-right text-ink-700/70">{l.etablissementsCouverts}</td>
                        <td className="px-2 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {l.chefAntenne ? (
                              <Badge ton="succes">Chef d&apos;antenne</Badge>
                            ) : (
                              <Badge ton="attente">Sans chef</Badge>
                            )}
                            {l.conseillers > 0 && (
                              <span className="inline-flex items-center gap-1 text-xs text-ink-700/60">
                                <Users size={13} /> {l.conseillers}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-2.5 text-right print:hidden">
                          <Link
                            href={`?apfc=${l.id}#detail-apfc`}
                            className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-cream-200 bg-white px-2 py-1 text-xs font-semibold text-forest-700 transition hover:bg-forest-50"
                            aria-label={`Statistiques détaillées — ${l.nom}`}
                          >
                            <BarChart3 size={13} /> Statistiques
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {detail && (
              <section id="detail-apfc" className="mt-6 scroll-mt-24 rounded-2xl border border-forest-200 bg-forest-50/30 p-4 sm:p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h2 className="font-display text-base font-bold text-forest-900">
                    Statistiques détaillées — {detail.nom}
                  </h2>
                  <Link
                    href="/app/inspection/supervision-apfc"
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-cream-200 bg-white px-2 py-1 text-xs font-semibold text-ink-700/70 transition hover:bg-cream-100 print:hidden"
                    aria-label="Fermer les statistiques détaillées"
                  >
                    <X size={13} /> Fermer
                  </Link>
                </div>

                <dl className="mb-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  <div className="flex gap-2">
                    <dt className="font-semibold text-forest-900">Région :</dt>
                    <dd className="text-ink-700/80">{detail.region}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-semibold text-forest-900">Pays :</dt>
                    <dd className="text-ink-700/80">{detail.pays}</dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <dt className="font-semibold text-forest-900">Chef d&apos;antenne :</dt>
                    <dd>{detail.chef ? <span className="text-ink-700/80">{detail.chef}</span> : <Badge ton="attente">Sans chef</Badge>}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-semibold text-forest-900">Personnel :</dt>
                    <dd className="text-ink-700/80">
                      {detail.stats.personnelTotal} {detail.stats.personnelTotal > 1 ? "personnes" : "personne"}
                    </dd>
                  </div>
                </dl>

                <div className="grid gap-3 sm:grid-cols-2">
                  <BlocStat titre="Cohortes de formation continue">
                    <div className="mb-2 grid grid-cols-3 gap-2">
                      <Tuile libelle="Actives" valeur={detail.cohortesActives} />
                      <Tuile libelle="Clôturées" valeur={detail.cohortesCloturees} />
                      <Tuile libelle="Apprenants" valeur={detail.apprenants} />
                    </div>
                    {detail.sessions.length > 0 && (
                      <>
                        <p className="mb-1 text-[11px] font-semibold text-ink-700/60">Dernières sessions</p>
                        <table className="w-full border-collapse text-xs">
                          <tbody>
                            {detail.sessions.map((s) => (
                              <tr key={s.id} className="border-b border-cream-100 last:border-0">
                                <td className="py-1.5 pr-2 text-ink-700/80">{s.libelle}</td>
                                <td className="px-2 py-1.5">
                                  {s.statut === "active" ? <Badge ton="succes">Active</Badge> : <Badge ton="neutre">Clôturée</Badge>}
                                </td>
                                <td className="py-1.5 text-right font-semibold text-forest-800">
                                  {s.apprenants}{" "}
                                  <span className="font-normal text-ink-700/55">apprenant{s.apprenants > 1 ? "s" : ""}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}
                  </BlocStat>

                  <BlocStat titre="Personnel par discipline">
                    {detail.stats.personnelParDiscipline.length === 0 ? (
                      <p className="text-xs text-ink-700/55">Aucune discipline renseignée pour le personnel.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {detail.stats.personnelParDiscipline.map((d) => (
                          <Puce key={d.libelle} libelle={d.libelle} nombre={d.nombre} />
                        ))}
                      </div>
                    )}
                  </BlocStat>

                  <BlocStat titre="Couverture des établissements">
                    <div className="mb-2 grid grid-cols-2 gap-2">
                      <Tuile libelle="Établissements couverts" valeur={detail.stats.couvertureTotal} />
                    </div>
                    <TableRepartition
                      data={detail.stats.couvertureParCategorie}
                      enteteLibelle="Catégorie pédagogique"
                      enteteNombre="Établissements"
                    />
                    {detail.topLocalites.length > 0 && (
                      <div className="mt-2">
                        <p className="mb-1 text-[11px] font-semibold text-ink-700/60">Principales localités</p>
                        <div className="flex flex-wrap gap-1.5">
                          {detail.topLocalites.map((v) => (
                            <Puce key={v.libelle} libelle={v.libelle} nombre={v.nombre} />
                          ))}
                        </div>
                      </div>
                    )}
                  </BlocStat>

                  <BlocStat titre="Inspection : visites des encadreurs">
                    <TuilesInspection stats={detail.stats.inspection} compacte />
                  </BlocStat>
                </div>
              </section>
            )}

            {antenneSignature && <PiedSignatureApfc apfc={antenneSignature} terme={terme} />}
          </>
        )}
      </div>
    </div>
  );
}
