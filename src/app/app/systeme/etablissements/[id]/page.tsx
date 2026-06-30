import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Trash2, Download, CalendarCog, DoorOpen } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
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
import { supprimerChamp } from "./config-actions";
import { AjoutEnseignantForm, ImportCSVForm } from "./enseignants/forms";
import { enregistrerCompetences } from "./enseignants/actions";
import { ViderEnseignants, SupprimerUtilisateur } from "./enseignants/delete-buttons";
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
    const [regions, niveaux, disciplines, configs, champs, config, grilles, enseignants] =
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
      ]);
    return { statut: "ok" as const, etablissement, regions, niveaux, disciplines, configs, champs, config, grilles, enseignants };
  } catch (e) {
    console.error("[config etab] DB indisponible :", e);
    return { statut: "erreur" as const };
  }
}

export default async function ConfigurationEtablissementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireRole(["admin", "etablissements_admin"]);
  if (u.roleReel === "etablissements_admin" && u.portee.etablissementId !== id) {
    redirect("/app/systeme/etablissements");
  }

  const data = await charger(id);
  if (data.statut === "introuvable") redirect("/app/systeme/etablissements");
  if (data.statut !== "ok") {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader titre="Configuration de l'établissement" />
        <p className="text-sm text-ink-700/70">Impossible de charger l'établissement.</p>
      </div>
    );
  }

  const { etablissement: e, regions, niveaux, disciplines, configs, champs, config, grilles, enseignants } = data;
  const regimeLibelle = config?.regimeNotation === "semestre" ? "Semestre (2 semestres)" : "Trimestre (3 trimestres)";
  const regimeApercu = config?.regimeNotation === "semestre" ? "Semestriel" : "Trimestriel";
  const annee = e.anneeScolaire ?? config?.anneeScolaireCourante ?? "";

  // Lignes de volumes horaires par niveau (séances).
  const etabMap = new Map<string, { seances: number[]; coef: number }>();
  const natMap = new Map<string, { heures: number; coef: number }>();
  for (const g of grilles) {
    const cle = `${g.niveauId}:${g.disciplineId}`;
    if (g.etablissementId === id) etabMap.set(cle, { seances: g.seancesMinutes, coef: g.coefficient });
    else natMap.set(cle, { heures: g.heuresHebdo, coef: g.coefficient });
  }
  const niveauxVolumes = niveaux.map((nv) => ({
    id: nv.id,
    nom: nv.nom,
    lignes: disciplines.map((d): DisciplineLigne => {
      const o = etabMap.get(`${nv.id}:${d.id}`);
      const nat = natMap.get(`${nv.id}:${d.id}`);
      let seances: number[];
      let coef: number;
      if (o && o.seances.length > 0) {
        seances = o.seances;
        coef = o.coef;
      } else if (nat && nat.heures > 0) {
        seances = Array.from({ length: Math.max(1, Math.round(nat.heures)) }, () => 60);
        coef = nat.coef;
      } else {
        seances = [];
        coef = o?.coef ?? nat?.coef ?? 1;
      }
      return { disciplineId: d.id, nom: d.nom, couleur: d.couleur, coef, seances };
    }),
  }));

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
        />
      </Bloc>

      {/* Aperçu en-tête du bulletin (bloc autonome) */}
      <Bloc id="apercu" titre="Aperçu en-tête du bulletin" sousTitre="Ce bandeau s'imprime en haut de chaque bulletin et s'adapte au pays sélectionné.">
        <ApercuBulletin ministere={e.ministere ?? ""} regime={regimeApercu} pays={e.pays ?? "Côte d'Ivoire"} slogan={e.sloganBulletin ?? ""} annee={annee} />
      </Bloc>

      {/* 2. Informations générales */}
      <Bloc id="infos" titre="Informations générales">
        <InfosBlock etablissementId={id} nom={e.nom} type={e.type} statut={e.statut} code={e.code ?? ""} ville={e.ville ?? ""} regimeLibelle={regimeLibelle} />
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
          <DoorOpen size={15} /> Détail des salles & classes
        </Link>
      </Bloc>

      {/* 7. Volumes horaires */}
      <Bloc id="volumes" titre="Volumes horaires par niveau et par discipline" sousTitre="Définissez la durée d'une séance (en minutes) et le nombre de séances hebdomadaires. Le volume est calculé automatiquement.">
        <VolumesBlock etablissementId={id} niveaux={niveauxVolumes} />
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
            {enseignants.length === 0 ? (
              <p className="text-sm text-ink-700/60">Aucun enseignant enregistré dans cet établissement.</p>
            ) : (
              <ul className="divide-y divide-cream-100">
                {enseignants.map((ens) => (
                  <li key={ens.id} className="flex items-center justify-between py-2 text-sm">
                    <span>
                      <span className="font-medium text-forest-900">{nomComplet(ens)}</span>
                      <span className="ml-2 text-xs text-ink-700/55">{ens.email}</span>
                    </span>
                    <SupprimerUtilisateur utilisateurId={ens.id} etablissementId={id} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Bloc>

      {/* 9. Compétences enseignants */}
      <Bloc id="competences" titre="Synthèse des compétences des enseignants" sousTitre="Disciplines et niveaux d'intervention de chaque enseignant — intrant clé du solveur. Pré-remplis à l'import CSV.">
        {enseignants.length === 0 ? (
          <p className="text-sm text-ink-700/60">Aucun enseignant enregistré dans le bloc « Gestion des utilisateurs ».</p>
        ) : (
          <ul className="space-y-4">
            {enseignants.map((ens) => {
              const acquis = new Set(ens.competences.map((c) => c.disciplineId));
              const nivAcquis = new Set(ens.niveauxIntervention.map((n) => n.niveauId));
              return (
                <li key={ens.id} className="rounded-2xl border border-cream-200 bg-cream-50 p-4">
                  <form action={enregistrerCompetences}>
                    <input type="hidden" name="etablissementId" value={id} />
                    <input type="hidden" name="enseignantId" value={ens.id} />
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="font-medium text-forest-900">{nomComplet(ens)}</p>
                      <button type="submit" className="inline-flex h-9 items-center rounded-full bg-forest-700 px-4 text-xs font-semibold text-cream-50 hover:bg-forest-600">
                        Enregistrer
                      </button>
                    </div>
                    <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-ink-700/50">Disciplines</p>
                    <div className="mb-3 flex flex-wrap gap-2">
                      {disciplines.map((d) => (
                        <label key={d.id} className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-white px-2.5 py-1 text-xs text-forest-800">
                          <input type="checkbox" name={`disc_${d.id}`} defaultChecked={acquis.has(d.id)} className="h-3.5 w-3.5" />
                          {d.nom}
                        </label>
                      ))}
                    </div>
                    <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-ink-700/50">Niveaux d'intervention</p>
                    <div className="flex flex-wrap gap-2">
                      {niveaux.map((n) => (
                        <label key={n.id} className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-white px-2.5 py-1 text-xs text-forest-800">
                          <input type="checkbox" name={`niveau_${n.id}`} defaultChecked={nivAcquis.has(n.id)} className="h-3.5 w-3.5" />
                          {n.nom}
                        </label>
                      ))}
                    </div>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </Bloc>

      {/* Validation & génération */}
      <div className="flex justify-end pt-2">
        <Link
          href={`/app/systeme/etablissements/${id}/emploi-du-temps`}
          className="inline-flex h-12 items-center gap-2 rounded-full bg-gradient-to-br from-gold-300 to-gold-500 px-8 text-sm font-semibold text-forest-950 shadow-[var(--shadow-gold)] transition-transform hover:-translate-y-0.5"
        >
          <CalendarCog size={18} /> Générer l'emploi du temps
        </Link>
      </div>
    </div>
  );
}
