import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Trash2, Download, CalendarCog, DoorOpen, Users } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { infosRegime } from "@/lib/vie-scolaire/regime";
import { PageHeader } from "@/components/app/ui";
import { AnchorNav } from "./anchor-nav";
import { ExportImport } from "./export-import";
import { ApercuBulletin } from "./apercu-bulletin";
import {
  Bloc,
  PaysBlock,
  InfosBlock,
  ChefBlock,
  RapportBlock,
  DimensionnementBlock,
} from "./config-blocks";
import { VolumesBlock } from "./volumes-block";
import { DocumentsUpload } from "./documents-upload";
import { ChampsForm } from "./champs-form";
import { NiveauxForm } from "./niveaux-form";
import { EffectifsEnseignantsForm } from "./effectifs-enseignants";
import { supprimerChamp } from "./config-actions";
import { AjoutEnseignantForm, ImportCSVForm, GenererComptesEnseignantsForm } from "./enseignants/forms";
import { ViderEnseignants } from "./enseignants/delete-buttons";
import { ListeEnseignantsPaginee } from "./enseignants/liste-paginee";
import type { DisciplineLigne } from "./grille/grille-editor";

export const metadata: Metadata = { title: "Configuration de l'établissement" };
export const dynamic = "force-dynamic";

function nomComplet(p: { prenoms: string | null; nom: string | null; email: string }) {
  return [p.prenoms, p.nom].filter(Boolean).join(" ") || p.email;
}

async function charger(id: string) {
  try {
    const etablissement = await prisma.etablissement.findUnique({ where: { id } });
    if (!etablissement) return { statut: "introuvable" as const };
    const [regions, niveaux, disciplines, configs, champs, config, grilles, enseignants, classes, effectifsEns] =
      await Promise.all([
        prisma.region.findMany({ orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
        prisma.niveau.findMany({ orderBy: { ordre: "asc" } }),
        prisma.discipline.findMany({ orderBy: { nom: "asc" }, select: { id: true, nom: true, couleur: true } }),
        prisma.niveauEtablissement.findMany({ where: { etablissementId: id } }),
        prisma.champEnseignant.findMany({ where: { etablissementId: id }, orderBy: { ordre: "asc" } }),
        prisma.configuration.findUnique({ where: { id: "global" } }),
        prisma.grilleHoraire.findMany({ where: { OR: [{ etablissementId: id }, { etablissementId: null }] } }),
        prisma.utilisateur.findMany({
          where: { etablissementId: id, roleActif: { nomTechnique: "enseignant" } },
          orderBy: { nom: "asc" },
          select: {
            id: true, prenoms: true, nom: true, email: true,
            competences: { select: { disciplineId: true } },
            niveauxIntervention: { select: { niveauId: true } },
          },
        }),
        prisma.classe.findMany({ where: { etablissementId: id }, orderBy: { nom: "asc" }, select: { id: true, nom: true, effectif: true, niveauId: true } }),
        prisma.effectifEnseignant.findMany({ where: { etablissementId: id }, select: { disciplineId: true, cycle: true, nombre: true } }),
      ]);
    return { statut: "ok" as const, etablissement, regions, niveaux, disciplines, configs, champs, config, grilles, enseignants, classes, effectifsEns };
  } catch (e) {
    console.error("[config etab] DB indisponible :", e);
    return { statut: "erreur" as const };
  }
}

export default async function ConfigurationEtablissementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireRole(["admin", "etablissements_admin", "chef_etablissement"]);
  // Refusé par défaut : hors admin système, seul l'établissement de son périmètre est accessible.
  if (u.roleReel !== "admin" && u.portee.etablissementId !== id) {
    redirect("/app/systeme/etablissements");
  }

  const data = await charger(id);
  if (data.statut === "introuvable") redirect("/app/systeme/etablissements");
  if (data.statut !== "ok") {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader titre="Configuration de l'établissement" />
        <p className="text-sm text-ink-700/70">Impossible de charger l&apos;établissement.</p>
      </div>
    );
  }

  const { etablissement: e, regions, niveaux, disciplines, configs, champs, config, grilles, enseignants, effectifsEns } = data;
  // Effectifs enseignants : clé `${cycle}:${disciplineId}` → nombre.
  const effectifsMap: Record<string, number> = {};
  for (const ef of effectifsEns) effectifsMap[`${ef.cycle}:${ef.disciplineId}`] = ef.nombre;

  // Régime de notation : celui choisi par l'établissement, sinon celui de la Configuration générale.
  const regime = infosRegime(e.regimeNotation, e.nbSequences, config?.regimeNotation);
  const regimeApercu = regime.apercu;
  const annee = e.anneeScolaire ?? config?.anneeScolaireCourante ?? "";

  // Lignes de volumes horaires par niveau (séances).
  const etabMap = new Map<string, { seances: number[]; coef: number }>();
  const natMap = new Map<string, { heures: number; coef: number }>();
  const niveauxAvecOverride = new Set<string>();
  for (const g of grilles) {
    const cle = `${g.niveauId}:${g.disciplineId}`;
    if (g.etablissementId === id) {
      etabMap.set(cle, { seances: g.seancesMinutes, coef: g.coefficient });
      if (g.seancesMinutes.length > 0) niveauxAvecOverride.add(g.niveauId);
    } else {
      natMap.set(cle, { heures: g.heuresHebdo, coef: g.coefficient });
    }
  }
  // Si l'établissement a configuré sa propre grille pour un niveau, on n'affiche QUE ses
  // disciplines (pas de re-remplissage par le modèle national). Sinon, modèle national par défaut.
  const niveauxVolumes = niveaux.map((nv) => {
    const propre = niveauxAvecOverride.has(nv.id);
    const lignes = disciplines
      .map((d): DisciplineLigne | null => {
        const o = etabMap.get(`${nv.id}:${d.id}`);
        const nat = natMap.get(`${nv.id}:${d.id}`);
        if (propre) {
          if (o && o.seances.length > 0) {
            return { disciplineId: d.id, nom: d.nom, couleur: d.couleur, coef: o.coef, seances: o.seances };
          }
          return null;
        }
        if (nat && nat.heures > 0) {
          return {
            disciplineId: d.id,
            nom: d.nom,
            couleur: d.couleur,
            coef: nat.coef,
            seances: Array.from({ length: Math.max(1, Math.round(nat.heures)) }, () => 60),
          };
        }
        return null;
      })
      .filter((x): x is DisciplineLigne => x !== null);
    return { id: nv.id, nom: nv.nom, lignes };
  });
  const toutesDisciplines = disciplines.map((d) => ({ id: d.id, nom: d.nom, couleur: d.couleur }));

  // Lignes effectifs par niveau.
  const configMap = new Map(configs.map((c) => [c.niveauId, c]));
  const lignesNiveaux = niveaux.map((nv) => {
    const c = configMap.get(nv.id);
    return { niveauId: nv.id, nom: nv.nom, effectif: c?.effectif ?? 0, vacation: c?.vacation ?? "simple", nbClasses: c?.nbClasses ?? 0 };
  });

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-16">
      <Link href="/app/systeme/etablissements" className="inline-flex items-center gap-2 text-sm font-medium text-forest-700 hover:text-forest-900">
        <ArrowLeft size={16} /> Tous les établissements
      </Link>

      <PageHeader
        titre="Configuration de l'établissement"
        description="Renseignez les informations de votre établissement pour générer correctement bulletins, documents et statistiques."
        action={<ExportImport etablissementId={id} />}
      />

      <AnchorNav />

      {/* 1. Pays & en-tête */}
      <Bloc id="pays" titre="Pays, slogan national officiel & en-tête du bulletin">
        <PaysBlock
          etablissementId={id}
          pays={e.pays ?? "Côte d'Ivoire"}
          slogan={e.sloganBulletin ?? ""}
          ministere={e.ministere ?? ""}
          annee={annee}
          regionId={e.regionId ?? ""}
          regions={regions}
          regimeApercu={regimeApercu}
          emblemeUrl={e.emblemeUrl}
        />
      </Bloc>

      {/* Aperçu en-tête du bulletin (bloc autonome) */}
      <Bloc id="apercu" titre="Aperçu en-tête du bulletin" sousTitre="Ce bandeau s'imprime en haut de chaque bulletin et s'adapte au pays sélectionné.">
        <ApercuBulletin ministere={e.ministere ?? ""} regime={regimeApercu} pays={e.pays ?? "Côte d'Ivoire"} slogan={e.sloganBulletin ?? ""} annee={annee} emblemeUrl={e.emblemeUrl} />
      </Bloc>

      {/* 2. Informations générales */}
      <Bloc id="infos" titre="Informations générales">
        <InfosBlock etablissementId={id} nom={e.nom} type={e.type} statut={e.statut} code={e.code ?? ""} ville={e.ville ?? ""} regime={regime.regime} nbSequences={regime.regime === "sequence" ? regime.nbPeriodes : 6} />
      </Bloc>

      {/* 3. Chef & documents officiels */}
      <Bloc id="chef" titre="Chef d'établissement & documents officiels">
        <ChefBlock etablissementId={id} fonctionChef={e.fonctionChef ?? ""} nomChef={e.nomChef ?? ""}>
          <DocumentsUpload etablissementId={id} docs={{ embleme: e.emblemeUrl, logo: e.logoUrl, cachet: e.cachetUrl, signature: e.signatureUrl }} />
        </ChefBlock>
      </Bloc>

      {/* 4. Rapport d'établissement */}
      <Bloc id="rapport" titre="Rapport d'établissement" sousTitre="Définissez une fois pour toutes le plan et la présentation par défaut du rapport de fin de période.">
        <RapportBlock etablissementId={id} planRapport={e.planRapport ?? ""} presentationRapport={e.presentationRapport ?? "Accordéon"} />
      </Bloc>

      {/* 5. Champs enseignants */}
      <Bloc id="champs" titre="Champs requis pour l'enregistrement des enseignants" sousTitre="Ces champs s'afficheront aussi dans les grilles de supervision.">
        {champs.length > 0 && (
          <ul className="mb-5 divide-y divide-cream-100">
            {champs.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2.5 text-sm">
                <span>
                  <span className="font-medium text-forest-900">{c.etiquette}</span>
                  <span className="ml-2 text-xs text-ink-700/55">{c.type}{c.requis ? " · requis" : ""}</span>
                </span>
                <form action={supprimerChamp}>
                  <input type="hidden" name="champId" value={c.id} />
                  <button type="submit" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-700/50 hover:bg-red-50 hover:text-red-600" aria-label="Supprimer">
                    <Trash2 size={15} />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <ChampsForm etablissementId={id} />
      </Bloc>

      {/* 6. Effectifs par niveau */}
      <Bloc id="effectifs" titre="Effectif d'élèves par niveau" sousTitre="Dimensionnement, horaires journaliers, puis effectif et vacation par niveau pour calculer les divisions.">
        <DimensionnementBlock
          etablissementId={id}
          effectifSouhaite={e.effectifSouhaiteParClasse}
          nbSalles={e.nbSallesDisponibles}
          creneaux={e.creneauxParJour}
          horaires={{
            debutMatin: e.horaireDebutMatin ?? "",
            pauseMatinDebut: e.horairePauseMatinDebut ?? "",
            pauseMatinFin: e.horairePauseMatinFin ?? "",
            pauseMidiDebut: e.horairePauseMidiDebut ?? "",
            repriseApresMidi: e.horaireRepriseApresMidi ?? "",
            finJournee: e.horaireFinJournee ?? "",
          }}
        />
        <div className="mt-6 border-t border-cream-200 pt-6">
          <NiveauxForm etablissementId={id} lignes={lignesNiveaux} />
        </div>
        <Link href={`/app/systeme/etablissements/${id}/structure`} className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-gold-700 hover:underline">
          <DoorOpen size={15} /> Détail des salles & classes (capacité & type)
        </Link>
      </Bloc>

      {/* 6 bis. Effectifs des enseignants */}
      <Bloc id="enseignants-effectifs" titre="Effectifs des enseignants par cycle et discipline" sousTitre="Déclarez le nombre d'enseignants disponibles par discipline (collège / lycée). C'est l'intrant du solveur — pas besoin de comptes nominatifs pour générer.">
        <EffectifsEnseignantsForm etablissementId={id} disciplines={disciplines} valeurs={effectifsMap} />
        <div className="mt-6 border-t border-cream-200 pt-6">
          <p className="mb-3 text-sm font-semibold text-forest-900">Générer les comptes enseignants nominatifs</p>
          <GenererComptesEnseignantsForm etablissementId={id} />
        </div>
      </Bloc>

      {/* 7. Volumes horaires */}
      <Bloc id="volumes" titre="Volumes horaires par niveau et par discipline" sousTitre="Définissez la durée d'une séance (en minutes) et le nombre de séances hebdomadaires. Le volume est calculé automatiquement.">
        <VolumesBlock etablissementId={id} niveaux={niveauxVolumes} toutesDisciplines={toutesDisciplines} />
      </Bloc>

      {/* 8. Utilisateurs (enseignants) */}
      <Bloc id="utilisateurs" titre="Gestion des utilisateurs de l'établissement">
        <div className="space-y-5">
          <AjoutEnseignantForm etablissementId={id} />
          <div className="border-t border-cream-200 pt-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-forest-900">Importer une cohorte (CSV)</p>
              <Link href={`/app/systeme/etablissements/${id}/enseignants/modele`} className="inline-flex items-center gap-1.5 text-sm font-medium text-gold-700 hover:underline">
                <Download size={15} /> Télécharger le modèle
              </Link>
            </div>
            <ImportCSVForm etablissementId={id} />
          </div>
          <div className="border-t border-cream-200 pt-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-forest-900">Enseignants ({enseignants.length})</p>
              <ViderEnseignants etablissementId={id} nb={enseignants.length} />
            </div>
            <ListeEnseignantsPaginee
              etablissementId={id}
              enseignants={enseignants.map((ens) => ({ id: ens.id, nom: nomComplet(ens), email: ens.email }))}
            />
          </div>
        </div>
      </Bloc>

      {/* 9. Compétences enseignants — résumé compact + lien vers la page détaillée */}
      <Bloc id="competences" titre="Compétences des enseignants" sousTitre="Disciplines et niveaux d'intervention — pré-remplis à l'import CSV, base de la répartition automatique.">
        {enseignants.length === 0 ? (
          <p className="text-sm text-ink-700/60">Aucun enseignant enregistré dans le bloc « Utilisateurs ».</p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-4 text-sm text-ink-700/75">
              <span><strong className="text-forest-900">{enseignants.length}</strong> enseignant(s)</span>
              <span><strong className="text-forest-900">{enseignants.filter((e) => e.competences.length > 0).length}</strong> avec disciplines</span>
              <span><strong className="text-forest-900">{enseignants.filter((e) => e.niveauxIntervention.length > 0).length}</strong> avec niveaux</span>
            </div>
            <Link href={`/app/systeme/etablissements/${id}/enseignants`} className="inline-flex h-10 items-center gap-2 rounded-full border border-forest-200 bg-white px-4 text-sm font-semibold text-forest-800 hover:bg-forest-50">
              <Users size={15} /> Gérer les compétences en détail
            </Link>
          </div>
        )}
      </Bloc>

      {/* Validation & génération */}
      <div className="flex justify-end pt-2">
        <Link
          href={`/app/systeme/etablissements/${id}/emploi-du-temps`}
          className="inline-flex h-12 items-center gap-2 rounded-full bg-gradient-to-br from-gold-300 to-gold-500 px-8 text-sm font-semibold text-forest-950 shadow-[var(--shadow-gold)] transition-transform hover:-translate-y-0.5"
        >
          <CalendarCog size={18} /> Générer l&apos;emploi du temps
        </Link>
      </div>
    </div>
  );
}
