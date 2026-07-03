import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import { NotebookPen, Send, FileEdit, KeyRound, BookOpen } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { resoudreEtablissement } from "@/lib/vie-scolaire/contexte";
import { PageHeader, Card } from "@/components/app/ui";
import { KpiCard } from "@/components/app/kpi-card";
import { SelecteurEtablissement } from "@/components/app/selecteur-etablissement";
import { paysConsulte } from "@/lib/pays-consulte";
import {
  BoutonNouvelleSeance,
  ListeSeances,
  LigneDemandeAcces,
  type Catalogues,
  type SeanceLigne,
  type DemandeAccesLigne,
} from "./cahier-client";
import type { SousTitre } from "./actions";

export const metadata: Metadata = { title: "Cahier de texte" };
export const dynamic = "force-dynamic";

const BASE = "/app/vie-scolaire/cahier-texte";
const ROLES_EDITEURS = ["admin", "chef_etablissement", "enseignant"] as const;

function nomComplet(p: { prenoms: string | null; nom: string | null; email: string }) {
  return [p.prenoms, p.nom].filter(Boolean).join(" ") || p.email;
}
function dateFr(d: Date) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(d);
}

/** Déduplique une liste {id, nom} par id, triée par nom (classes, disciplines, enseignants). */
function dedupParId(liste: { id: string; nom: string }[]) {
  const vues = new Map<string, { id: string; nom: string }>();
  for (const d of liste) if (!vues.has(d.id)) vues.set(d.id, d);
  return [...vues.values()].sort((a, b) => a.nom.localeCompare(b.nom));
}

export default async function CahierTextePage({
  searchParams,
}: {
  searchParams: Promise<{ etab?: string }>;
}) {
  const u = await requireRole(["admin", "chef_etablissement", "enseignant", "parent", "eleve"]);
  const sp = await searchParams;

  const estEditeur = (ROLES_EDITEURS as readonly string[]).includes(u.roleReel);
  const canEdit = estEditeur && !u.apercuActif;

  // Contexte affiché dans le badge d'en-tête (pays consulté · année scolaire).
  const [pays, store] = await Promise.all([paysConsulte(), cookies()]);
  let annee = store.get("eduweb_annee")?.value ?? "";

  // Résolution des classes accessibles, rôle par rôle (périmètre : refusé par défaut).
  let classes: { id: string; nom: string }[] = [];
  let etablissements: { id: string; nom: string }[] = [];
  let etabId: string | null = null;
  let adminSansEtab = false;
  let erreur = false;

  try {
    if (!annee) {
      annee = (await prisma.anneeScolaire.findFirst({ where: { active: true } }))?.libelle ?? "";
    }
    if (u.roleReel === "enseignant") {
      classes = await prisma.classe.findMany({
        where: { affectations: { some: { enseignantId: u.id } } },
        orderBy: { nom: "asc" },
        select: { id: true, nom: true },
      });
    } else if (u.roleReel === "chef_etablissement") {
      etabId = u.portee.etablissementId;
      if (etabId) {
        classes = await prisma.classe.findMany({
          where: { etablissementId: etabId },
          orderBy: { nom: "asc" },
          select: { id: true, nom: true },
        });
      }
    } else if (u.roleReel === "eleve") {
      const insc = await prisma.inscription.findMany({
        where: { eleveId: u.id },
        orderBy: { creeLe: "desc" },
        include: { classe: { select: { id: true, nom: true } } },
      });
      classes = dedupParId(insc.map((i) => i.classe));
    } else if (u.roleReel === "parent") {
      const liens = await prisma.lienParentEleve.findMany({
        where: { parentId: u.id },
        select: { eleveId: true },
      });
      const eleveIds = liens.map((l) => l.eleveId);
      const insc =
        eleveIds.length > 0
          ? await prisma.inscription.findMany({
              where: { eleveId: { in: eleveIds } },
              include: { classe: { select: { id: true, nom: true } } },
            })
          : [];
      classes = dedupParId(insc.map((i) => i.classe));
    } else {
      // admin
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
    console.error("[cahier-texte] DB indisponible :", e);
    erreur = true;
  }

  const badgeContexte = (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-50 px-3 py-1.5 text-xs font-semibold text-forest-800">
      <BookOpen size={13} /> {pays}
      {annee ? ` · ${annee.replace("-", " — ")}` : ""}
    </span>
  );

  if (adminSansEtab) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader
          titre="Cahier de texte"
          description="Choisissez un établissement pour consulter ou consigner les séances."
          action={badgeContexte}
        />
        <SelecteurEtablissement basePath={BASE} etablissements={etablissements} etabId={null} />
      </div>
    );
  }

  const classeIds = classes.map((c) => c.id);
  const nomClasse = new Map(classes.map((c) => [c.id, c.nom]));

  // Séances visibles : toutes pour les éditeurs, uniquement publiées pour parents / élèves.
  const whereSeances: Prisma.CahierTexteWhereInput = { classeId: { in: classeIds } };
  if (!estEditeur) whereSeances.statut = "publie";

  let kpi = { total: 0, publiees: 0, brouillons: 0, demandes: 0 };
  let seances: SeanceLigne[] = [];
  let demandes: DemandeAccesLigne[] = [];
  let catalogues: Catalogues = {
    enseignants: [],
    classes,
    disciplines: [],
    estEnseignant: u.roleReel === "enseignant",
  };

  // Demandes d'accès traitables par cet éditeur (mêmes règles que l'action serveur).
  const whereDemandes: Prisma.DemandeAccesCahierWhereInput | null = !canEdit
    ? null
    : u.roleReel === "enseignant"
      ? { statut: "en_attente", cahier: { saisiParId: u.id } }
      : { statut: "en_attente", cahier: { classe: etabId ? { etablissementId: etabId } : { id: { in: classeIds } } } };

  if (!erreur && classeIds.length > 0) {
    try {
      const [total, publiees, brouillons, nbDemandes, brutes, demandesBrutes] = await Promise.all([
        prisma.cahierTexte.count({ where: whereSeances }),
        prisma.cahierTexte.count({ where: { classeId: { in: classeIds }, statut: "publie" } }),
        estEditeur ? prisma.cahierTexte.count({ where: { classeId: { in: classeIds }, statut: "brouillon" } }) : 0,
        whereDemandes ? prisma.demandeAccesCahier.count({ where: whereDemandes }) : 0,
        prisma.cahierTexte.findMany({
          where: whereSeances,
          orderBy: [{ date: "desc" }, { creeLe: "desc" }],
          take: 30,
          include: {
            discipline: { select: { id: true, nom: true } },
            saisiPar: { select: { id: true, prenoms: true, nom: true, email: true } },
            classe: { select: { etablissementId: true } },
          },
        }),
        whereDemandes
          ? prisma.demandeAccesCahier.findMany({
              where: whereDemandes,
              orderBy: { creeLe: "asc" },
              take: 20,
              include: {
                demandeur: {
                  select: { prenoms: true, nom: true, email: true, roleActif: { select: { libelle: true } } },
                },
                cahier: { select: { titre: true, contenu: true, classe: { select: { nom: true } } } },
              },
            })
          : Promise.resolve([]),
      ]);

      kpi = { total, publiees, brouillons, demandes: nbDemandes };
      seances = brutes.map((e) => {
        const sousTitres = (Array.isArray(e.sousTitres) ? e.sousTitres : []) as unknown as SousTitre[];
        const apprentissage = (Array.isArray(e.activitesApprentissage) ? e.activitesApprentissage : []) as string[];
        const evaluation = (Array.isArray(e.activitesEvaluation) ? e.activitesEvaluation : []) as string[];
        return {
          id: e.id,
          titre: e.titre ?? e.contenu.slice(0, 80),
          classeId: e.classeId,
          classeNom: nomClasse.get(e.classeId) ?? "—",
          disciplineId: e.discipline.id,
          disciplineNom: e.discipline.nom,
          enseignantId: e.enseignantId,
          auteur: nomComplet(e.saisiPar),
          date: e.date.toISOString().slice(0, 10),
          dateAffichee: dateFr(e.date),
          statut: e.statut,
          heureDebut: e.heureDebut,
          dureeMin: e.dureeMin,
          typeActivite: e.typeActivite,
          amorce: e.amorce ?? "",
          resume: e.contenu,
          sousTitres,
          activitesApprentissage: apprentissage,
          activitesEvaluation: evaluation,
          prochaineSeance: e.prochaineSeanceLe ? e.prochaineSeanceLe.toISOString().slice(0, 10) : "",
          objectifsDefinis: Boolean(e.amorce) || apprentissage.length > 0,
          devoirsAssignes: evaluation.length > 0 || Boolean(e.travailAFaire),
          peutModifier:
            canEdit &&
            (u.roleReel === "admin" ||
              (u.roleReel === "chef_etablissement" && e.classe.etablissementId === u.portee.etablissementId) ||
              (u.roleReel === "enseignant" && e.saisiPar.id === u.id)),
        };
      });
      demandes = demandesBrutes.map((d) => ({
        id: d.id,
        demandeur: `${d.demandeur.roleActif.libelle} — ${nomComplet(d.demandeur)}`,
        seance: `${d.cahier.titre ?? d.cahier.contenu.slice(0, 60)} (${d.cahier.classe.nom})`,
      }));

      // Catalogues de la modale « Nouvelle séance ».
      if (canEdit) {
        if (u.roleReel === "enseignant") {
          const affs = await prisma.affectationEnseignant.findMany({
            where: { enseignantId: u.id },
            include: { discipline: { select: { id: true, nom: true } } },
          });
          catalogues.disciplines = dedupParId(affs.map((a) => a.discipline));
        } else {
          const affs = await prisma.affectationEnseignant.findMany({
            where: { classeId: { in: classeIds } },
            include: {
              discipline: { select: { id: true, nom: true } },
              enseignant: { select: { id: true, prenoms: true, nom: true, email: true } },
            },
          });
          catalogues.disciplines = dedupParId(affs.map((a) => a.discipline));
          catalogues.enseignants = dedupParId(
            affs.map((a) => ({ id: a.enseignant.id, nom: nomComplet(a.enseignant) })),
          );
          if (catalogues.disciplines.length === 0) {
            catalogues.disciplines = await prisma.discipline.findMany({
              orderBy: { nom: "asc" },
              select: { id: true, nom: true },
            });
          }
          if (catalogues.enseignants.length === 0 && etabId) {
            const profs = await prisma.utilisateur.findMany({
              where: { etablissementId: etabId, roleActif: { nomTechnique: "enseignant" } },
              orderBy: { nom: "asc" },
              take: 200,
              select: { id: true, prenoms: true, nom: true, email: true },
            });
            catalogues.enseignants = profs.map((p) => ({ id: p.id, nom: nomComplet(p) }));
          }
        }
      }
    } catch (e) {
      console.error("[cahier-texte] chargement :", e);
      erreur = true;
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        titre="Cahier de texte"
        description="Consignez les séances : objectifs, contenu, devoirs et ressources."
        action={
          <div className="flex flex-wrap items-center gap-3">
            {badgeContexte}
            {canEdit && classes.length > 0 && <BoutonNouvelleSeance catalogues={catalogues} />}
          </div>
        }
      />

      {u.roleReel === "admin" && etabId && (
        <SelecteurEtablissement basePath={BASE} etablissements={etablissements} etabId={etabId} />
      )}

      {erreur ? (
        <Card>
          <p className="text-sm text-ink-700/70">
            Impossible de charger les données. Vérifiez la connexion à la base de données.
          </p>
        </Card>
      ) : classes.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-700/70">
            {u.roleReel === "enseignant"
              ? "Vous n'êtes affecté à aucune classe pour le moment."
              : u.roleReel === "eleve"
                ? "Vous n'êtes inscrit dans aucune classe pour le moment."
                : u.roleReel === "parent"
                  ? "Aucune classe à afficher : vos enfants ne sont rattachés à aucune classe."
                  : "Aucune classe disponible. Créez des classes dans Système → Établissements."}
          </p>
        </Card>
      ) : (
        <>
          {/* Compteurs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard index={0} libelle="Séances saisies" valeur={kpi.total} icone={<NotebookPen size={22} />} href="#seances" />
            <KpiCard index={1} libelle="Publiées" valeur={kpi.publiees} ton="forest" icone={<Send size={22} />} href="#seances" />
            <KpiCard index={2} libelle="Brouillons" valeur={kpi.brouillons} ton={kpi.brouillons > 0 ? "gold" : "cream"} icone={<FileEdit size={22} />} href="#seances" />
            <KpiCard index={3} libelle="Demandes d'accès" valeur={kpi.demandes} ton={kpi.demandes > 0 ? "red" : "cream"} icone={<KeyRound size={22} />} href="#demandes" />
          </div>

          {/* ALLER À : navigation rapide */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-700/45">Aller à</span>
            <Link href="#seances" className="rounded-full border border-cream-300 bg-white px-4 py-1.5 text-sm font-medium text-forest-800 hover:border-gold-300">
              Séances
            </Link>
            {canEdit && (
              <Link href="#demandes" className="rounded-full border border-cream-300 bg-white px-4 py-1.5 text-sm font-medium text-forest-800 hover:border-gold-300">
                Demandes d&apos;accès
              </Link>
            )}
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
            {/* Séances */}
            <section id="seances" className="scroll-mt-24">
              <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-forest-900">
                <NotebookPen size={18} /> Séances
              </h2>
              {seances.length === 0 ? (
                <Card>
                  <p className="text-sm text-ink-700/65">
                    Aucune séance consignée pour le moment.
                    {canEdit && " Cliquez sur « Nouvelle séance » pour commencer."}
                  </p>
                </Card>
              ) : (
                <ListeSeances seances={seances} catalogues={catalogues} />
              )}
            </section>

            {/* Demandes d'accès (éditeurs) */}
            {canEdit && (
              <section id="demandes" className="scroll-mt-24">
                <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-forest-900">
                  <KeyRound size={18} /> Demandes d&apos;accès
                </h2>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-700/45">À valider</p>
                {demandes.length === 0 ? (
                  <Card>
                    <p className="text-sm text-ink-700/65">Aucune demande d&apos;accès en attente.</p>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {demandes.map((d) => (
                      <LigneDemandeAcces key={d.id} demande={d} />
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
}
