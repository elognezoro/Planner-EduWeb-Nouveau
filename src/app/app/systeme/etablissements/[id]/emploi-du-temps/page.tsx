import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/app/ui";
import { GenerationButton } from "./generation-button";
import { GrilleInteractive } from "./grille-interactive";
import { BoutonEnvoyerEdt } from "./bouton-envoyer-edt";
import { VolumesHebdo } from "@/components/app/emplois-du-temps/volumes-hebdo";
import { EnTeteOfficielEdt } from "@/components/app/emplois-du-temps/en-tete-officiel-edt";
import { BilanServiceEnseignant } from "@/components/app/emplois-du-temps/bilan-service-enseignant";
import { BoutonImprimerEdt } from "@/components/app/emplois-du-temps/bouton-imprimer";
import { DemiJourneesLibres, DemiJourneesLibresEnseignant } from "@/components/app/emplois-du-temps/demi-journees-libres";
import { creneauxHoraires, bandesPause, minutesParPeriode, periodesMatinApresMidi } from "@/lib/emploi-du-temps/horaires";

export const metadata: Metadata = { title: "Emploi du temps" };
export const dynamic = "force-dynamic";

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
const BASE = (id: string) => `/app/systeme/etablissements/${id}/emploi-du-temps`;

export default async function EmploiDuTempsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ vue?: string; cible?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const u = await requireRole(["admin", "etablissements_admin", "chef_etablissement", "adjoint_chef_etablissement"]);
  if (u.roleReel !== "admin" && u.portee.etablissementId !== id) {
    redirect("/app/systeme/etablissements");
  }

  const etab = await prisma.etablissement.findUnique({ where: { id } });
  if (!etab) redirect("/app/systeme/etablissements");

  const [creneaux, classes, disciplines, nbSalles, effSum] = await Promise.all([
    prisma.creneau.findMany({ where: { etablissementId: id }, orderBy: [{ jour: "asc" }, { periode: "asc" }] }),
    prisma.classe.findMany({ where: { etablissementId: id }, orderBy: { nom: "asc" }, select: { id: true, nom: true, niveau: { select: { id: true, nom: true, cycle: true } } } }),
    prisma.discipline.findMany({ select: { id: true, couleur: true } }),
    prisma.salle.count({ where: { etablissementId: id } }),
    prisma.effectifEnseignant.aggregate({ where: { etablissementId: id }, _sum: { nombre: true } }),
  ]);
  const nbProfs = effSum._sum.nombre ?? 0;

  const couleurDisc = new Map(disciplines.map((d) => [d.id, d.couleur]));
  const couleursRecord: Record<string, string | null> = Object.fromEntries(disciplines.map((d) => [d.id, d.couleur]));
  const creneauxPlain = creneaux.map((c) => ({
    id: c.id, classeId: c.classeId, classeNom: c.classeNom, disciplineId: c.disciplineId,
    disciplineNom: c.disciplineNom, enseignantId: c.enseignantId, enseignantNom: c.enseignantNom,
    salleNom: c.salleNom, jour: c.jour, periode: c.periode, duree: c.duree,
  }));

  // Options de vue
  const vue = sp.vue === "enseignant" || sp.vue === "salle" ? sp.vue : "classe";
  const enseignants = [...new Map(creneaux.map((c) => [c.enseignantId, c.enseignantNom])).entries()].map(([v, l]) => ({ v, l })).sort((a, b) => a.l.localeCompare(b.l));
  const salles = [...new Set(creneaux.map((c) => c.salleNom))].sort().map((v) => ({ v, l: v }));
  const optionsCible = vue === "classe" ? classes.map((c) => ({ v: c.id, l: c.nom })) : vue === "enseignant" ? enseignants : salles;
  const cible = sp.cible && optionsCible.some((o) => o.v === sp.cible) ? sp.cible : optionsCible[0]?.v ?? "";

  // Créneaux filtrés selon la vue
  const filtres = creneaux.filter((c) =>
    vue === "classe" ? c.classeId === cible : vue === "enseignant" ? c.enseignantId === cible : c.salleNom === cible,
  );
  const parCle = new Map(filtres.map((c) => [`${c.jour}:${c.periode}`, c]));
  const couvert = new Set<string>();
  for (const c of filtres) for (let d = 1; d < c.duree; d++) couvert.add(`${c.jour}:${c.periode + d}`);

  const periodes = Array.from({ length: Math.max(1, etab.creneauxParJour) }, (_, i) => i);
  const horaires = creneauxHoraires(etab);
  const bandes = bandesPause(etab);
  const minutes = minutesParPeriode(etab);

  function contenu(c: (typeof creneaux)[number]) {
    if (vue === "classe") return { t1: c.disciplineNom, t2: c.salleNom, t3: c.enseignantNom, did: c.disciplineId };
    if (vue === "enseignant") return { t1: c.classeNom, t2: c.disciplineNom, t3: c.salleNom, did: c.disciplineId };
    return { t1: c.classeNom, t2: c.disciplineNom, t3: c.enseignantNom, did: c.disciplineId };
  }

  const cibleLibelle = optionsCible.find((o) => o.v === cible)?.l ?? "";
  const sousTitreImpression =
    vue === "classe" ? `Classe ${cibleLibelle}` : vue === "enseignant" ? `Enseignant : ${cibleLibelle}` : `Salle : ${cibleLibelle}`;

  // ── Bilan de service (vue enseignant) : heures dues, charge effective, et comparaison aux
  // collègues de la MÊME discipline et du MÊME cycle (le plus / le moins chargé). ──
  const cycleParClasse = new Map(classes.map((c) => [c.id, c.niveau.cycle]));
  const statsEns = new Map<string, { total: number; comps: Map<string, { nom: string; cycle: string }> }>();
  for (const c of creneaux) {
    const cyc = cycleParClasse.get(c.classeId) ?? "?";
    const st = statsEns.get(c.enseignantId) ?? { total: 0, comps: new Map() };
    st.total += c.duree;
    st.comps.set(`${c.disciplineId}:${cyc}`, { nom: c.disciplineNom, cycle: cyc });
    statsEns.set(c.enseignantId, st);
  }
  // Charges totales des enseignants regroupées par (discipline, cycle) — pour min / max des pairs.
  const chargesParGroupe = new Map<string, number[]>();
  for (const st of statsEns.values()) {
    for (const k of st.comps.keys()) {
      const arr = chargesParGroupe.get(k) ?? [];
      arr.push(st.total);
      chargesParGroupe.set(k, arr);
    }
  }
  const stMoi = vue === "enseignant" ? statsEns.get(cible) : undefined;
  const bilanEnseignant = stMoi
    ? {
        // Un enseignant intervenant au 2nd cycle relève du volume 2nd cycle, sinon du 1er cycle.
        heuresDues: [...stMoi.comps.values()].some((c) => c.cycle === "lycee")
          ? etab.volumeHoraire2ndCycle
          : etab.volumeHoraire1erCycle,
        chargeEffective: stMoi.total,
        competences: [...stMoi.comps.entries()].map(([k, meta]) => {
          const g = chargesParGroupe.get(k) ?? [stMoi.total];
          return { discipline: meta.nom, cycle: meta.cycle, nbEnseignants: g.length, max: Math.max(...g), min: Math.min(...g) };
        }),
      }
    : null;

  // ── Demi-journées SANS COURS (vue classe/élève) : au niveau, au cycle, à l'établissement. ──
  // Une demi-journée (jour, matin|après-midi) est « libre » pour un périmètre si AUCUNE classe de
  // ce périmètre n'y a de cours.
  const CYCLE_LABEL: Record<string, string> = { college: "collège", lycee: "lycée", primaire: "primaire", prescolaire: "préscolaire" };
  const classeCourante = classes.find((c) => c.id === cible);
  const Nper = Math.max(1, etab.creneauxParJour);
  const decoupeMA = periodesMatinApresMidi(etab);
  const moitiePer = Math.ceil(Nper / 2);
  const matinSet = new Set(decoupeMA?.matin ?? Array.from({ length: moitiePer }, (_, i) => i));
  const apmSet = new Set(decoupeMA?.apresMidi ?? Array.from({ length: Nper - moitiePer }, (_, i) => moitiePer + i));
  const demiOccupees = new Map<string, Set<string>>(); // classeId → { "jour:moment" }
  for (const c of creneaux) {
    for (let d = 0; d < c.duree; d++) {
      const per = c.periode + d;
      const moment = matinSet.has(per) ? 0 : apmSet.has(per) ? 1 : -1;
      if (moment < 0) continue;
      let s = demiOccupees.get(c.classeId);
      if (!s) {
        s = new Set();
        demiOccupees.set(c.classeId, s);
      }
      s.add(`${c.jour}:${moment}`);
    }
  }
  const demiLibresPour = (pred: (c: (typeof classes)[number]) => boolean): { jour: number; moment: 0 | 1 }[] => {
    const ids = classes.filter(pred).map((c) => c.id);
    const res: { jour: number; moment: 0 | 1 }[] = [];
    for (let jour = 0; jour < JOURS.length; jour++) {
      for (const moment of [0, 1] as const) {
        const occupe = ids.some((cid) => demiOccupees.get(cid)?.has(`${jour}:${moment}`));
        if (!occupe) res.push({ jour, moment });
      }
    }
    return res;
  };
  const demiLibres =
    vue === "classe" && classeCourante
      ? {
          niveau: demiLibresPour((c) => c.niveau.id === classeCourante.niveau.id),
          cycle: demiLibresPour((c) => c.niveau.cycle === classeCourante.niveau.cycle),
          etab: demiLibresPour(() => true),
          niveauNom: classeCourante.niveau.nom,
          cycleLabel: CYCLE_LABEL[classeCourante.niveau.cycle] ?? classeCourante.niveau.cycle,
        }
      : null;

  // ── Demi-journées SANS COURS (vue enseignant) : par spécialité (discipline × cycle), par cycle,
  // et pour tout l'établissement. Une demi-journée est « libre » pour un groupe d'enseignants si
  // aucun d'eux n'y a de cours. (cycleParClasse est déjà calculé plus haut pour le bilan.) ──
  const occEns = new Map<string, Set<string>>(); // enseignantId → { "jour:moment" }
  const compEns = new Map<string, Map<string, { nom: string; cycle: string }>>(); // ensId → "discId:cycle" → info
  const cyclesEns = new Map<string, Set<string>>(); // ensId → cycles enseignés
  for (const c of creneaux) {
    const cyc = cycleParClasse.get(c.classeId) ?? "?";
    for (let d = 0; d < c.duree; d++) {
      const per = c.periode + d;
      const moment = matinSet.has(per) ? 0 : apmSet.has(per) ? 1 : -1;
      if (moment < 0) continue;
      let s = occEns.get(c.enseignantId);
      if (!s) {
        s = new Set();
        occEns.set(c.enseignantId, s);
      }
      s.add(`${c.jour}:${moment}`);
    }
    let m = compEns.get(c.enseignantId);
    if (!m) {
      m = new Map();
      compEns.set(c.enseignantId, m);
    }
    m.set(`${c.disciplineId}:${cyc}`, { nom: c.disciplineNom, cycle: cyc });
    let cy = cyclesEns.get(c.enseignantId);
    if (!cy) {
      cy = new Set();
      cyclesEns.set(c.enseignantId, cy);
    }
    cy.add(cyc);
  }
  // Index inverses : enseignants par groupe (spécialité, cycle).
  const ensParComp = new Map<string, string[]>();
  for (const [ensId, m] of compEns) for (const k of m.keys()) (ensParComp.get(k) ?? ensParComp.set(k, []).get(k)!).push(ensId);
  const ensParCycle = new Map<string, string[]>();
  for (const [ensId, cy] of cyclesEns) for (const c of cy) (ensParCycle.get(c) ?? ensParCycle.set(c, []).get(c)!).push(ensId);
  const demiLibresEns = (ids: string[]): { jour: number; moment: 0 | 1 }[] => {
    const res: { jour: number; moment: 0 | 1 }[] = [];
    for (let jour = 0; jour < JOURS.length; jour++) {
      for (const moment of [0, 1] as const) {
        const occupe = ids.some((eid) => occEns.get(eid)?.has(`${jour}:${moment}`));
        if (!occupe) res.push({ jour, moment });
      }
    }
    return res;
  };
  const demiLibresEnseignant =
    vue === "enseignant" && cible && compEns.has(cible)
      ? {
          specialites: [...compEns.get(cible)!.entries()].map(([k, meta]) => ({
            label: `${meta.nom} · ${CYCLE_LABEL[meta.cycle] ?? meta.cycle}`,
            liste: demiLibresEns(ensParComp.get(k) ?? []),
          })),
          cycles: [...(cyclesEns.get(cible) ?? [])].map((cyc) => ({
            label: `Tout le ${CYCLE_LABEL[cyc] ?? cyc}`,
            liste: demiLibresEns(ensParCycle.get(cyc) ?? []),
          })),
          etab: demiLibresEns([...occEns.keys()]),
        }
      : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 print:space-y-2">
      <Link href={`/app/systeme/etablissements/${id}`} className="inline-flex items-center gap-2 text-sm font-medium text-forest-700 hover:text-forest-900 print:hidden">
        <ArrowLeft size={16} /> Configuration de l&apos;établissement
      </Link>

      <div className="print:hidden">
        <PageHeader
          titre="Emploi du temps"
          description={`${etab.nom} — génération par solveur de contraintes. Journée : ${etab.horaireDebutMatin ?? "?"}–${etab.horaireFinJournee ?? "?"}, ${etab.creneauxParJour} créneaux/jour.`}
        />
      </div>

      <Card className="print:hidden">
        <div className="mb-4 flex flex-wrap items-center gap-4 text-sm text-ink-700/70">
          <span>{classes.length} classe(s)</span>
          <span>·</span>
          <span>{Math.max(nbSalles, etab.nbSallesDisponibles)} salle(s) disponible(s)</span>
          <span>·</span>
          <span>{nbProfs} enseignant(s) déclaré(s)</span>
          <span>·</span>
          <span>{creneaux.length} créneau(x) généré(s)</span>
        </div>
        <GenerationButton etablissementId={id} />
        <p className="mt-3 text-xs text-ink-700/55">
          La génération utilise les <strong>effectifs d&apos;enseignants</strong> déclarés par cycle et
          discipline (bloc « Effectifs des enseignants » de la configuration) — aucun compte
          nominatif requis.
        </p>
      </Card>

      {creneaux.length === 0 ? (
        <Card className="flex flex-col items-center py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-50 text-forest-500">
            <CalendarDays size={26} />
          </span>
          <p className="mt-4 text-sm text-ink-700/65">
            Aucun emploi du temps généré pour le moment. Lancez la génération ci-dessus.
          </p>
        </Card>
      ) : (
        <Card>
          {/* En-tête officiel de l'établissement — visible uniquement à l'impression (PDF). */}
          <EnTeteOfficielEdt
            etab={{
              nom: etab.nom,
              pays: etab.pays,
              ministere: etab.ministere,
              sloganBulletin: etab.sloganBulletin,
              anneeScolaire: etab.anneeScolaire,
              emblemeUrl: etab.emblemeUrl,
            }}
            sousTitre={sousTitreImpression}
          />
          {/* Sélecteur de vue */}
          <form method="get" action={BASE(id)} className="mb-5 flex flex-wrap items-end gap-3 print:hidden">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-forest-900">Vue</label>
              <select name="vue" defaultValue={vue} className="h-10 rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200">
                <option value="classe">Par classe</option>
                <option value="enseignant">Par enseignant</option>
                <option value="salle">Par salle</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-forest-900">
                {vue === "classe" ? "Classe" : vue === "enseignant" ? "Enseignant" : "Salle"}
              </label>
              <select name="cible" defaultValue={cible} className="h-10 min-w-[12rem] rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200">
                {optionsCible.map((o) => (
                  <option key={o.v} value={o.v}>{o.l}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="h-10 rounded-full bg-forest-800 px-5 text-sm font-semibold text-cream-50 hover:bg-forest-700">Afficher</button>
          </form>

          {/* Impression PDF (en-tête officiel inclus) et envoi aux concernés. */}
          <div className="mb-5 flex flex-wrap items-center gap-3 print:hidden">
            <BoutonImprimerEdt />
            {vue === "classe" && cible && (
              <BoutonEnvoyerEdt etablissementId={id} classeId={cible} classeNom={cibleLibelle} />
            )}
          </div>

          {vue === "classe" ? (
            <>
              <GrilleInteractive
                classeId={cible}
                creneaux={creneauxPlain}
                creneauxParJour={etab.creneauxParJour}
                jours={JOURS}
                couleurs={couleursRecord}
                horaires={horaires ?? undefined}
                bandes={bandes ?? undefined}
              />
              {/* Volumes hebdomadaires de la classe : par discipline + total. */}
              <VolumesHebdo creneaux={filtres} minutes={minutes} />
              {/* Demi-journées sans cours : niveau, cycle, établissement. */}
              {demiLibres && (
                <DemiJourneesLibres
                  niveauNom={demiLibres.niveauNom}
                  cycleLabel={demiLibres.cycleLabel}
                  parNiveau={demiLibres.niveau}
                  parCycle={demiLibres.cycle}
                  parEtablissement={demiLibres.etab}
                />
              )}
            </>
          ) : (
            <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border border-cream-200 bg-cream-50 px-2 py-2 text-xs font-semibold text-ink-700/60">Horaire</th>
                    {JOURS.map((j) => (
                      <th key={j} className="border border-cream-200 bg-cream-50 px-2 py-2 text-xs font-semibold text-forest-800">{j}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {periodes.map((per) => (
                    <Fragment key={per}>
                      <tr>
                        <td className="whitespace-nowrap border border-cream-200 bg-cream-50 px-2 py-2 text-center text-[0.7rem] font-medium text-ink-700/60">
                          {horaires?.[per] ? (
                            <span className="leading-tight">
                              {horaires[per].debut}
                              <span className="block text-ink-700/40">{horaires[per].fin}</span>
                            </span>
                          ) : (
                            `P${per + 1}`
                          )}
                        </td>
                        {JOURS.map((_, jour) => {
                          const k = `${jour}:${per}`;
                          if (couvert.has(k)) return null;
                          const c = parCle.get(k);
                          if (!c) return <td key={jour} className="border border-cream-100" />;
                          const ct = contenu(c);
                          const couleur = couleurDisc.get(ct.did) ?? "#154231";
                          return (
                            <td key={jour} rowSpan={c.duree} className="relative border border-cream-200 p-1.5 align-top">
                              <div aria-hidden className="pointer-events-none absolute inset-1.5 rounded-lg" style={{ backgroundColor: `${couleur}1a`, borderLeft: `3px solid ${couleur}` }} />
                              <div className="relative px-2 py-1.5">
                                <p className="text-xs font-semibold text-forest-900">{ct.t1}</p>
                                <p className="text-[0.65rem] text-ink-700/70">{ct.t2}</p>
                                <p className="text-[0.65rem] text-ink-700/55">{ct.t3}</p>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                      {/* Bandes de pause : RÉCRÉATION / PAUSE DÉJEUNER (aucun cours ne les traverse). */}
                      {bandes
                        ?.filter((b) => b.apresPeriode === per)
                        .map((b) => (
                          <tr key={`pause-${per}-${b.libelle}`}>
                            <td colSpan={JOURS.length + 1} className="border border-cream-200 bg-gold-100/80 p-0">
                              <p className="py-1.5 text-center text-[0.7rem] font-bold uppercase tracking-[0.4em] text-gold-800">
                                {b.libelle}
                              </p>
                            </td>
                          </tr>
                        ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            {vue === "enseignant" && bilanEnseignant && (
              <BilanServiceEnseignant
                nom={cibleLibelle}
                heuresDues={bilanEnseignant.heuresDues}
                chargeEffective={bilanEnseignant.chargeEffective}
                competences={bilanEnseignant.competences}
              />
            )}
            {/* Demi-journées sans cours : spécialité, cycle, établissement. */}
            {demiLibresEnseignant && (
              <DemiJourneesLibresEnseignant
                specialites={demiLibresEnseignant.specialites}
                cycles={demiLibresEnseignant.cycles}
                etablissement={demiLibresEnseignant.etab}
              />
            )}
            </>
          )}
        </Card>
      )}
    </div>
  );
}
