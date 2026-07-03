import type { Metadata } from "next";
import Link from "next/link";
import { Users, UserCheck, UserX, Clock, ShieldCheck, Percent, MessageSquareWarning, BadgeCheck } from "lucide-react";
import Image from "next/image";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { trouverPays, drapeauUrl } from "@/lib/referentiels/pays";
import { resoudreEtablissement } from "@/lib/vie-scolaire/contexte";
import { PageHeader, Card } from "@/components/app/ui";
import { SelecteurEtablissement } from "@/components/app/selecteur-etablissement";
import { BAREME_DEFAUT, conduiteSur20, creneauxSeance, JOURS_SEMAINE, SEUIL_ALERTE_SMS, type BaremeConduite, type StatutAppel } from "./lib";
import { BoutonExporter, BoutonImprimer, FiltresRegistre, RegistreTable, type LigneEleve } from "./registre-client";

export const metadata: Metadata = { title: "Registre d'appel" };
export const dynamic = "force-dynamic";

const BASE = "/app/vie-scolaire/registre-appel";

function nomAffiche(p: { prenoms: string | null; nom: string | null; email: string }) {
  return [p.nom, p.prenoms].filter(Boolean).join(" ") || p.email;
}
function aujourdhui() {
  return new Date().toISOString().slice(0, 10);
}

interface KpiBilan {
  libelle: string;
  valeur: string;
  icone: React.ReactNode;
  accent?: "vert" | "rouge" | "or" | "neutre";
}

export default async function RegistreAppelPage({
  searchParams,
}: {
  searchParams: Promise<{ etab?: string; classe?: string; date?: string; discipline?: string; heure?: string; q?: string }>;
}) {
  const u = await requireRole(["admin", "chef_etablissement", "educateur", "enseignant"]);
  const sp = await searchParams;

  // Résolution des classes accessibles selon le rôle (périmètre refusé par défaut).
  let classes: { id: string; nom: string }[] = [];
  let etablissements: { id: string; nom: string }[] = [];
  let etabId: string | null = null;
  let adminSansEtab = false;
  let erreur = false;

  try {
    if (u.roleReel === "enseignant") {
      classes = await prisma.classe.findMany({
        where: { affectations: { some: { enseignantId: u.id } } },
        orderBy: { nom: "asc" },
        select: { id: true, nom: true },
      });
    } else if (u.roleReel === "chef_etablissement" || u.roleReel === "educateur") {
      etabId = u.portee.etablissementId;
      if (etabId) {
        classes = await prisma.classe.findMany({
          where: { etablissementId: etabId },
          orderBy: { nom: "asc" },
          select: { id: true, nom: true },
        });
      }
    } else {
      const ctx = await resoudreEtablissement(u, sp.etab);
      etablissements = ctx.etablissements;
      etabId = ctx.etabId;
      if (!etabId) adminSansEtab = true;
      else {
        classes = await prisma.classe.findMany({
          where: { etablissementId: etabId },
          orderBy: { nom: "asc" },
          select: { id: true, nom: true },
        });
      }
    }
  } catch (e) {
    console.error("[registre] DB indisponible :", e);
    erreur = true;
  }

  if (adminSansEtab) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader titre="Registre d'appel" description="Choisissez un établissement pour saisir les présences." />
        <SelecteurEtablissement basePath={BASE} etablissements={etablissements} etabId={null} />
      </div>
    );
  }

  const classeSel = classes.find((c) => c.id === sp.classe) ?? classes[0] ?? null;
  const dateSel = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : aujourdhui();
  const disciplineSel = sp.discipline?.trim() || null;
  const q = sp.q?.trim() || null;

  // Données de la séance sélectionnée.
  let disciplines: { id: string; nom: string }[] = [];
  let heures: string[] = [];
  let heureSel: string | null = null;
  let lignes: LigneEleve[] = [];
  let effectif = 0;
  let bilan: KpiBilan[] = [];
  let enTete: { republique: string; slogan: string; ministere: string; annee: string; embleme: string | null; paysNom: string } | null = null;
  let bareme: BaremeConduite = BAREME_DEFAUT;
  let etabIdClasse: string | null = null;
  let peutModifierBareme = false;
  let heatmap: { slots: string[]; rangees: { jour: string; cellules: (number | null)[] }[] } | null = null;

  if (!erreur && classeSel) {
    try {
      const dateObj = new Date(`${dateSel}T00:00:00.000Z`);
      const [classe, config, anneeActive, listeDisciplines] = await Promise.all([
        prisma.classe.findUnique({
          where: { id: classeSel.id },
          include: {
            etablissement: {
              select: {
                nom: true, pays: true, sloganBulletin: true, ministere: true, anneeScolaire: true, emblemeUrl: true,
                horaireDebutMatin: true, horairePauseMidiDebut: true, horaireRepriseApresMidi: true, horaireFinJournee: true,
                conduiteAbsenceNj: true, conduiteRetardNj: true, conduiteObservation: true, conduiteEncouragement: true,
              },
            },
          },
        }),
        prisma.configuration.findUnique({ where: { id: "global" }, select: { anneeScolaireCourante: true } }),
        prisma.anneeScolaire.findFirst({ where: { active: true }, select: { libelle: true } }),
        prisma.discipline.findMany({ orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
      ]);
      disciplines = listeDisciplines;

      const etab = classe?.etablissement ?? null;
      etabIdClasse = classe?.etablissementId ?? null;
      if (etab) {
        bareme = {
          absenceNj: etab.conduiteAbsenceNj,
          retardNj: etab.conduiteRetardNj,
          observation: etab.conduiteObservation,
          encouragement: etab.conduiteEncouragement,
        };
      }
      // Le barème n'est ajustable que par le chef / gestionnaire de CET établissement (ou l'admin).
      peutModifierBareme =
        u.roleReel === "admin" ||
        ((u.roleReel === "chef_etablissement" || u.roleReel === "etablissements_admin") &&
          u.portee.etablissementId === etabIdClasse);
      const annee =
        config?.anneeScolaireCourante ?? anneeActive?.libelle ?? etab?.anneeScolaire ?? "";
      // Bloc officiel adapté au PAYS de l'établissement : intitulé de l'État (République,
      // Royaume…), devise nationale et emblème (emblème téléversé, sinon drapeau national).
      const paysNom = etab?.pays ?? "Côte d'Ivoire";
      const infoPays = trouverPays(paysNom);
      enTete = {
        republique: (infoPays?.intitule ?? paysNom).toUpperCase(),
        slogan: infoPays?.devise || etab?.sloganBulletin || "",
        ministere: (etab?.ministere || infoPays?.ministere || "Ministère de l'Éducation Nationale").toUpperCase(),
        annee,
        embleme: etab?.emblemeUrl ?? (infoPays ? drapeauUrl(infoPays.code, 80) : null),
        paysNom,
      };

      // Créneaux de séance : horaires de l'établissement + valeurs déjà utilisées.
      const dejaUtilisees = await prisma.appel.findMany({
        where: { classeId: classeSel.id, heureSeance: { not: null } },
        select: { heureSeance: true },
        distinct: ["heureSeance"],
      });
      heures = [...new Set([...creneauxSeance(etab ?? {}), ...dejaUtilisees.map((a) => a.heureSeance!)])];
      heureSel = sp.heure && heures.includes(sp.heure) ? sp.heure : (heures[0] ?? null);

      const [inscriptions, appel, cumulBruts, appelsHeatmap, evenementsBruts] = await Promise.all([
        prisma.inscription.findMany({
          where: { classeId: classeSel.id },
          include: {
            eleve: {
              select: { id: true, prenoms: true, nom: true, email: true, sexe: true, matricule: true, dateNaissance: true },
            },
          },
        }),
        prisma.appel.findFirst({
          where: { classeId: classeSel.id, date: dateObj, disciplineId: disciplineSel, heureSeance: heureSel },
          include: { presences: true },
        }),
        prisma.presence.findMany({
          where: { appel: { classeId: classeSel.id } },
          select: { eleveId: true, statut: true, justifie: true },
        }),
        prisma.appel.findMany({
          where: { classeId: classeSel.id, heureSeance: { not: null } },
          select: { date: true, heureSeance: true, presences: { select: { statut: true } } },
        }),
        prisma.evenementAppel.groupBy({
          by: ["eleveId", "type"],
          where: { classeId: classeSel.id },
          _count: { _all: true },
        }),
      ]);

      // Événements (encouragements / observations) par élève — entrent dans la conduite.
      const evenementsPar = new Map<string, { obs: number; enc: number }>();
      for (const ev of evenementsBruts) {
        const e = evenementsPar.get(ev.eleveId) ?? { obs: 0, enc: 0 };
        if (ev.type === "observation") e.obs += ev._count._all;
        else if (ev.type === "encouragement") e.enc += ev._count._all;
        evenementsPar.set(ev.eleveId, e);
      }

      // Cumuls d'assiduité par élève (toute la classe, toutes séances confondues).
      const cumuls = new Map<string, { a: number; r: number; aNj: number; rNj: number }>();
      for (const p of cumulBruts) {
        const c = cumuls.get(p.eleveId) ?? { a: 0, r: 0, aNj: 0, rNj: 0 };
        if (p.statut === "absent") {
          c.a += 1;
          if (!p.justifie) c.aNj += 1;
        } else if (p.statut === "retard") {
          c.r += 1;
          if (!p.justifie) c.rNj += 1;
        }
        cumuls.set(p.eleveId, c);
      }
      const duJour = new Map(appel?.presences.map((p) => [p.eleveId, p]) ?? []);

      const toutes: LigneEleve[] = inscriptions
        .map((i) => {
          const p = duJour.get(i.eleve.id);
          const c = cumuls.get(i.eleve.id) ?? { a: 0, r: 0, aNj: 0, rNj: 0 };
          const ev = evenementsPar.get(i.eleve.id) ?? { obs: 0, enc: 0 };
          return {
            eleveId: i.eleve.id,
            nom: nomAffiche(i.eleve),
            sousTexte: i.eleve.matricule ?? i.eleve.email,
            sexe: i.eleve.sexe,
            dateNaissance: i.eleve.dateNaissance
              ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(i.eleve.dateNaissance)
              : null,
            statut: (p?.statut ?? "present") as StatutAppel,
            motif: p?.motif ?? "",
            cumulA: c.a,
            cumulR: c.r,
            aJustifier: c.aNj + c.rNj,
            conduite: conduiteSur20(c.aNj, c.rNj, ev.obs, ev.enc, bareme),
            alerte: c.aNj >= SEUIL_ALERTE_SMS,
          };
        })
        .sort((a, b) => a.nom.localeCompare(b.nom));

      effectif = toutes.length;
      const nb = (s: StatutAppel) => toutes.filter((l) => l.statut === s).length;
      const absents = nb("absent");
      const tauxPresence = effectif > 0 ? Math.round(((effectif - absents) / effectif) * 100) : 100;
      const enAlerte = toutes.filter((l) => l.alerte).length;
      bilan = [
        { libelle: "Effectif total", valeur: String(effectif), icone: <Users size={18} />, accent: "neutre" },
        { libelle: "Présents (P)", valeur: String(nb("present")), icone: <UserCheck size={18} />, accent: "vert" },
        { libelle: "Absents (A)", valeur: String(absents), icone: <UserX size={18} />, accent: "rouge" },
        { libelle: "Retards (R)", valeur: String(nb("retard")), icone: <Clock size={18} />, accent: "or" },
        { libelle: "Excusés (E)", valeur: String(nb("excuse")), icone: <ShieldCheck size={18} />, accent: "neutre" },
        { libelle: "Non justifiées (cumul)", valeur: String(toutes.reduce((s, l) => s + l.aJustifier, 0)), icone: <BadgeCheck size={18} />, accent: "or" },
        { libelle: "Taux de présence", valeur: `${tauxPresence}%`, icone: <Percent size={18} />, accent: "vert" },
        { libelle: "Alertes SMS", valeur: String(enAlerte), icone: <MessageSquareWarning size={18} />, accent: enAlerte > 0 ? "rouge" : "neutre" },
      ];

      // Recherche rapide : filtre d'affichage (nom, prénoms, matricule, e-mail).
      lignes = q
        ? toutes.filter((l) =>
            `${l.nom} ${l.sousTexte}`.toLowerCase().includes(q.toLowerCase()),
          )
        : toutes;

      // Heatmap : taux de présence moyen par jour de semaine × créneau.
      const agg = new Map<string, { present: number; total: number }>();
      for (const a of appelsHeatmap) {
        const jourIdx = (a.date.getUTCDay() + 6) % 7; // 0 = lundi … 6 = dimanche
        if (jourIdx > 5 || a.presences.length === 0) continue;
        const cle = `${jourIdx}|${a.heureSeance}`;
        const cell = agg.get(cle) ?? { present: 0, total: 0 };
        cell.present += a.presences.filter((p) => p.statut !== "absent").length;
        cell.total += a.presences.length;
        agg.set(cle, cell);
      }
      if (agg.size > 0) {
        const slotsUtilises = heures.filter((h) => [...agg.keys()].some((k) => k.endsWith(`|${h}`)));
        const joursUtilises = [...new Set([...agg.keys()].map((k) => Number(k.split("|")[0])))].sort();
        heatmap = {
          slots: slotsUtilises.map((s) => s.split(" - ")[0]),
          rangees: joursUtilises.map((j) => ({
            jour: JOURS_SEMAINE[j],
            cellules: slotsUtilises.map((s) => {
              const cell = agg.get(`${j}|${s}`);
              return cell ? Math.round((cell.present / cell.total) * 100) : null;
            }),
          })),
        };
      }
    } catch (e) {
      console.error("[registre] chargement saisie :", e);
      erreur = true;
    }
  }

  const accents: Record<string, string> = {
    vert: "text-forest-700",
    rouge: "text-red-600",
    or: "text-gold-700",
    neutre: "text-forest-900",
  };
  const couleurTaux = (pct: number) =>
    pct >= 95 ? "bg-forest-800 text-cream-50" :
    pct >= 90 ? "bg-forest-600 text-cream-50" :
    pct >= 80 ? "bg-forest-400 text-white" :
    pct >= 70 ? "bg-gold-300 text-forest-900" : "bg-red-300 text-red-950";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        titre="Registre d'appel"
        description="Enregistrement des présences, absences et retards."
        action={
          classeSel ? (
            <div className="flex items-center gap-2 print:hidden">
              <BoutonImprimer />
              <BoutonExporter classeId={classeSel.id} date={dateSel} disciplineId={disciplineSel} heureSeance={heureSel} />
            </div>
          ) : undefined
        }
      />

      {u.roleReel === "admin" && etabId && (
        <div className="print:hidden">
          <SelecteurEtablissement basePath={BASE} etablissements={etablissements} etabId={etabId} />
        </div>
      )}

      {erreur ? (
        <Card>
          <p className="text-sm text-ink-700/70">Impossible de charger les données. Vérifiez la connexion à la base de données.</p>
        </Card>
      ) : classes.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-700/70">
            {u.roleReel === "enseignant"
              ? "Vous n'êtes affecté à aucune classe pour le moment."
              : "Aucune classe disponible. Créez des classes dans Système → Établissements."}
          </p>
        </Card>
      ) : (
        <>
          {/* Navigation rapide */}
          <Card className="p-4 print:hidden">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold uppercase tracking-wide text-ink-700/50">Aller à</span>
              {[["#bilan", "Bilan de l'appel"], ["#liste", "Liste des élèves"], ["#heatmap", "Heatmap de présence"]].map(([href, l]) => (
                <Link key={href} href={href} className="rounded-full border border-cream-300 px-3 py-1.5 font-medium text-forest-800 hover:bg-forest-50">
                  {l}
                </Link>
              ))}
            </div>
          </Card>

          {/* En-tête officiel — adapté au pays de l'établissement */}
          {enTete && (
            <Card className="relative py-5">
              <div className="flex items-center justify-center gap-5">
                {enTete.embleme && (
                  <Image
                    src={enTete.embleme}
                    alt={`Emblème — ${enTete.paysNom}`}
                    width={64}
                    height={44}
                    unoptimized
                    priority
                    className="h-11 w-16 shrink-0 object-contain"
                  />
                )}
                <div className="text-center">
                  <p className="font-display text-base font-bold tracking-wide text-forest-900">{enTete.republique}</p>
                  {enTete.slogan && <p className="mt-0.5 text-xs italic text-ink-700/60">{enTete.slogan}</p>}
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-forest-800">{enTete.ministere}</p>
                </div>
              </div>
              {enTete.annee && (
                <p className="absolute right-5 top-4 text-xs text-ink-700/60">
                  Année scolaire : <span className="font-semibold text-forest-900">{enTete.annee}</span>
                </p>
              )}
              {/* Ligne de séance — visible uniquement sur la version imprimée */}
              {classeSel && (
                <p className="mt-3 hidden border-t border-cream-200 pt-2 text-center text-xs text-ink-700/70 print:block">
                  Registre d'appel — {classeSel.nom} · Séance du {dateSel}
                  {heureSel ? ` · ${heureSel}` : ""}
                </p>
              )}
            </Card>
          )}

          {/* Filtres de séance */}
          <div className="print:hidden">
          <FiltresRegistre
            basePath={BASE}
            etabParam={u.roleReel === "admin" ? etabId : null}
            classes={classes}
            disciplines={disciplines}
            heures={heures}
            valeurs={{ classe: classeSel?.id ?? "", discipline: disciplineSel ?? "", heure: heureSel ?? "", date: dateSel, q: q ?? "" }}
          />
          </div>

          {/* Bilan de l'appel */}
          {classeSel && (
            <div id="bilan" className="scroll-mt-24">
            <Card>
              <h2 className="mb-4 font-display text-lg font-bold text-forest-900">Bilan de l'appel</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                {bilan.map((k) => (
                  <div key={k.libelle} className="rounded-2xl border border-cream-200 bg-cream-50/50 p-3 text-center">
                    <span className={`mx-auto flex h-8 w-8 items-center justify-center ${accents[k.accent ?? "neutre"]}`}>{k.icone}</span>
                    <p className={`font-display text-xl font-bold ${accents[k.accent ?? "neutre"]}`}>{k.valeur}</p>
                    <p className="mt-0.5 text-[0.65rem] leading-tight text-ink-700/60">{k.libelle}</p>
                  </div>
                ))}
              </div>
            </Card>
            </div>
          )}

          {/* Liste des élèves (tableau interactif) */}
          {classeSel && (
            <div id="liste" className="scroll-mt-24">
              <RegistreTable
                classeId={classeSel.id}
                classeNom={classeSel.nom}
                date={dateSel}
                disciplineId={disciplineSel}
                heureSeance={heureSel}
                eleves={lignes}
                seuil={SEUIL_ALERTE_SMS}
                filtreActif={Boolean(q)}
                bareme={bareme}
                etablissementId={etabIdClasse}
                peutModifierBareme={peutModifierBareme}
              />
            </div>
          )}

          {/* Heatmap de présence */}
          {classeSel && (
            <div id="heatmap" className="scroll-mt-24 print:hidden">
            <Card>
              <h2 className="font-display text-lg font-bold text-forest-900">Heatmap de présence</h2>
              <p className="mb-4 mt-1 text-xs text-ink-700/60">Taux de présence par jour et créneau (toutes les séances enregistrées de {classeSel.nom}).</p>
              {!heatmap ? (
                <p className="text-sm text-ink-700/55">
                  Aucune séance horodatée pour l'instant : enregistrez des appels avec une « heure de la séance » pour alimenter la heatmap.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="border-separate border-spacing-1 text-xs">
                    <thead>
                      <tr>
                        <th className="pr-2" />
                        {heatmap.slots.map((s) => (
                          <th key={s} className="px-1 pb-1 text-center font-medium text-ink-700/60">{s}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {heatmap.rangees.map((r) => (
                        <tr key={r.jour}>
                          <td className="pr-2 font-medium text-ink-700/70">{r.jour}</td>
                          {r.cellules.map((c, i) => (
                            <td key={i}>
                              <div
                                className={`flex h-9 w-12 items-center justify-center rounded-lg font-semibold ${c === null ? "bg-cream-100 text-ink-700/30" : couleurTaux(c)}`}
                              >
                                {c === null ? "—" : `${c}`}
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
