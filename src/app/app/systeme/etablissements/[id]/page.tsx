import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Trash2, Download, CalendarCog, CalendarX2, DoorOpen } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { filtreNiveauxVisibles } from "@/lib/etablissements/niveaux-visibles";
import { peutAdministrerEtablissement } from "@/lib/rbac/scope";
import { infosRegime } from "@/lib/vie-scolaire/regime";
import { PageHeader } from "@/components/app/ui";
import { FicheConsultation } from "./fiche-consultation";
import { AnchorNav } from "./anchor-nav";
import { EnregistrerTouteLaConfig } from "./enregistrer-tout";
import { ExportImport } from "./export-import";
import {
  Bloc,
  CategoriePedagogiqueBlock,
  PaysBlock,
  InfosBlock,
  ChefBlock,
  RapportBlock,
  DimensionnementBlock,
  ContraintesBlock,
} from "./config-blocks";
import { VolumesBlock } from "./volumes-block";
import { CompetencesBloc } from "./competences-bloc";
import { DocumentsUpload } from "./documents-upload";
import { ChampsForm } from "./champs-form";
import { NiveauxForm } from "./niveaux-form";
import { SallesBlock } from "./salles-block";
import { SallesRessourcesBlock } from "./salles-ressources-block";
import { BlocRepliable } from "./bloc-repliable";
import { VerrouConfig } from "./verrou-config";
import { AlerteConfiguration } from "./alerte-configuration";
import { EffectifsEnseignantsForm } from "./effectifs-enseignants";
import { supprimerChamp } from "./config-actions";
import { AjoutEnseignantForm, ImportCSVForm, GenererComptesEnseignantsForm } from "./enseignants/forms";
import { ViderEnseignants } from "./enseignants/delete-buttons";
import { ListeEnseignantsPaginee } from "./enseignants/liste-paginee";
import type { DisciplineLigne } from "./grille/grille-editor";
import { deriveCategoriePedagogique, estPrimaireOuPrescolaire } from "@/lib/referentiels/etablissement";

export const metadata: Metadata = { title: "Configuration de l'établissement" };
export const dynamic = "force-dynamic";

function nomComplet(p: { prenoms: string | null; nom: string | null; email: string }) {
  return [p.prenoms, p.nom].filter(Boolean).join(" ") || p.email;
}

/** Libellés français des types de champs personnalisés (enregistrement des enseignants). */
const LIBELLE_TYPE_CHAMP: Record<string, string> = {
  text: "Texte",
  date: "Date",
  number: "Nombre",
  email: "E-mail",
  tel: "Téléphone",
  select: "Liste",
};

async function charger(id: string) {
  try {
    const etablissement = await prisma.etablissement.findUnique({ where: { id } });
    if (!etablissement) return { statut: "introuvable" as const };
    const [regions, niveaux, disciplinesBrutes, configs, champs, config, grilles, enseignants, classes, effectifsEns, chef, salles] =
      await Promise.all([
        prisma.region.findMany({ orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
        // CLOISONNEMENT : national (hors niveaux masqués localement) + niveaux propres.
        prisma.niveau.findMany({ where: await filtreNiveauxVisibles(id), orderBy: { ordre: "asc" } }),
        // CLOISONNEMENT : le référentiel NATIONAL (etablissementId nul) + les disciplines propres
        // à CET établissement. Celles créées par une autre école ne sont jamais visibles ici.
        prisma.discipline.findMany({
          where: { OR: [{ etablissementId: null }, { etablissementId: id }] },
          orderBy: { nom: "asc" },
          // etablissementId : distingue les disciplines PROPRES (renommables ici) du référentiel
          // NATIONAL (partagé, renommage réservé à la configuration nationale).
          select: { id: true, nom: true, couleur: true, etablissementId: true },
        }),
        prisma.niveauEtablissement.findMany({ where: { etablissementId: id } }),
        prisma.champEnseignant.findMany({ where: { etablissementId: id }, orderBy: { ordre: "asc" } }),
        prisma.configuration.findUnique({ where: { id: "global" } }),
        // Grilles : surcharges de l'établissement + modèle national de SON pays.
        prisma.grilleHoraire.findMany({
          where: {
            OR: [
              { etablissementId: id },
              { etablissementId: null, pays: etablissement.pays ?? "Côte d'Ivoire" },
            ],
          },
        }),
        prisma.utilisateur.findMany({
          where: { etablissementId: id, roleActif: { nomTechnique: "enseignant" } },
          orderBy: { nom: "asc" },
          select: {
            id: true, prenoms: true, nom: true, email: true,
            competences: { select: { disciplineId: true } },
            niveauxIntervention: { select: { niveauId: true } },
          },
        }),
        prisma.classe.findMany({ where: { etablissementId: id }, orderBy: { nom: "asc" }, select: { id: true, nom: true, effectif: true, niveauId: true, salleAttribueeId: true } }),
        prisma.effectifEnseignant.findMany({ where: { etablissementId: id }, select: { disciplineId: true, cycle: true, nombre: true } }),
        // Chef d'établissement assigné à cet établissement : pré-remplit « Nom et prénoms » (nom du
        // compte) et, à défaut, le « Nom de l'établissement » depuis la structure qu'il a déclarée.
        prisma.utilisateur.findFirst({
          where: { etablissementId: id, roleActif: { nomTechnique: "chef_etablissement" } },
          select: {
            prenoms: true,
            nom: true,
            demandes: {
              where: { roleDemande: { nomTechnique: "chef_etablissement" } },
              orderBy: { creeLe: "desc" },
              take: 1,
              select: { structureDeclaree: true },
            },
          },
        }),
        prisma.salle.findMany({ where: { etablissementId: id }, orderBy: { nom: "asc" }, select: { id: true, nom: true, capacite: true, type: true } }),
      ]);
    // EXPRESSION LOCALE des disciplines : les renommages posés par le crayon du bloc effectifs
    // ({ disciplineId: libellé } sur l'établissement) s'appliquent à TOUTE la page — le
    // référentiel national, lui, n'est jamais modifié. Ré-trié sur le nom affiché.
    const renommages = new Map(
      Object.entries((etablissement.disciplinesRenommees as Record<string, unknown> | null) ?? {}).filter(
        (e): e is [string, string] => typeof e[1] === "string",
      ),
    );
    // `nomCanonique` (nom du référentiel) reste porté à côté du nom affiché : les détections
    // STRUCTURELLES (famille LV2 du bloc effectifs…) s'appuient sur lui, jamais sur
    // l'expression locale — librement modifiable, elle ne doit rien changer à la mécanique.
    const disciplines = disciplinesBrutes
      .map((d) => ({ ...d, nom: renommages.get(d.id) ?? d.nom, nomCanonique: d.nom }))
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
    // ORDRE D'AFFICHAGE DES NIVEAUX : choix PROPRE à l'établissement (NiveauEtablissement.ordre)
    // s'il existe, sinon ordre global du référentiel. Trié ICI, à la source, pour que tous les
    // blocs de la page (volumes, effectifs…) présentent la même séquence.
    const rangLocal = new Map(
      configs.filter((c) => c.ordre !== null).map((c) => [c.niveauId, c.ordre as number]),
    );
    // Nom d'affichage propre à l'établissement (NiveauEtablissement.nomAffiche) s'il existe.
    const nomLocal = new Map(
      configs.filter((c) => c.nomAffiche).map((c) => [c.niveauId, c.nomAffiche as string]),
    );
    const niveauxOrdonnes = [...niveaux]
      .sort((a, b) => {
        const ra = rangLocal.get(a.id);
        const rb = rangLocal.get(b.id);
        if (ra !== undefined && rb !== undefined) return ra - rb;
        // Un niveau ordonné localement passe devant ceux qui ne le sont pas encore (ex. niveau
        // ajouté après un réordonnancement) — ces derniers gardent leur ordre national entre eux.
        if (ra !== undefined) return -1;
        if (rb !== undefined) return 1;
        return a.ordre - b.ordre;
      })
      // Le nom affiché dans TOUTE la page de config devient le libellé local quand il existe ;
      // le nom canonique (`Niveau.nom`, partagé) n'est jamais modifié.
      .map((nv) => (nomLocal.has(nv.id) ? { ...nv, nom: nomLocal.get(nv.id) as string } : nv));
    return { statut: "ok" as const, etablissement, regions, niveaux: niveauxOrdonnes, disciplines, configs, champs, config, grilles, enseignants, classes, effectifsEns, chef, salles };
  } catch (e) {
    console.error("[config etab] DB indisponible :", e);
    return { statut: "erreur" as const };
  }
}

export default async function ConfigurationEtablissementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const u = await requireRole(["admin", "superviseur_international", "super_admin_etablissements", "representant_pays", "etablissements_admin", "chef_etablissement", "adjoint_chef_etablissement", "senec", "sedec"]);

  // Réseau catholique (SENEC national / SEDEC diocésain) : hub de CONSULTATION
  // en lecture seule (9 onglets) — jamais la console de configuration. Le périmètre
  // (pays / diocèse + établissement catholique) est appliqué dans le hub via le RBAC.
  if (u.roleActif === "senec" || u.roleActif === "sedec") {
    const brut = await searchParams;
    const sp = Object.fromEntries(
      Object.entries(brut).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
    ) as Record<string, string | undefined>;
    return <FicheConsultation id={id} portee={u.portee} roleActif={u.roleActif} sp={sp} />;
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

  const { etablissement: e, regions, niveaux, disciplines, configs, champs, config, grilles, enseignants, classes, effectifsEns, chef, salles } = data;
  // Salles nommées + classes qui leur sont affectées (pour le bloc « Désignation des salles »).
  const sallesInitiales = salles.map((s) => ({
    id: s.id,
    nom: s.nom,
    capacite: s.capacite,
    type: s.type as string,
    classeIds: classes.filter((c) => c.salleAttribueeId === s.id).map((c) => c.id),
  }));
  // Salles ressources : règles « discipline → type de salle spécialisée » + types de salles nommées.
  const typeSalleRegles = (Array.isArray(e.typeSalleParDiscipline) ? e.typeSalleParDiscipline : []) as {
    disciplineId: string;
    type: string;
  }[];
  const typesSallesDisponibles = [...new Set(sallesInitiales.map((s) => s.type))];
  // Verrou de configuration : seul l'admin système (roleReel « admin ») verrouille/déverrouille.
  const configVerrouillee = !!e.configVerrouillee;
  const estAdminSysteme = u.roleReel === "admin" && !u.apercuActif;
  const verrouilleeLe = e.configVerrouilleeLe
    ? new Date(e.configVerrouilleeLe).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
    : null;
  // Périmètre (refus par défaut) : global → tout ; rattaché → son établissement ; pays → établissements de son pays.
  if (!peutAdministrerEtablissement(u.portee, id, e.pays)) redirect("/app/systeme/etablissements");
  // NOM / Prénoms du chef : valeurs enregistrées (scindées), sinon le compte chef assigné.
  // Ancien « nomChef » combiné (prenomsChef absent) → réparti pour l'affichage : les mots de
  // tête en capitales forment le NOM, le reste les prénoms.
  const separerChef = (complet: string) => {
    const mots = complet.trim().split(/\s+/).filter(Boolean);
    const nom: string[] = [];
    let i = 0;
    while (i < mots.length && mots[i] === mots[i].toUpperCase() && /\p{Lu}/u.test(mots[i])) {
      nom.push(mots[i]);
      i++;
    }
    return nom.length ? { nom: nom.join(" "), prenoms: mots.slice(i).join(" ") } : { nom: complet.trim(), prenoms: "" };
  };
  let nomChefValeur = "";
  let prenomsChefValeur = "";
  if (e.nomChef || e.prenomsChef != null) {
    if (e.prenomsChef == null && e.nomChef) {
      const s = separerChef(e.nomChef);
      nomChefValeur = s.nom;
      prenomsChefValeur = s.prenoms;
    } else {
      nomChefValeur = e.nomChef ?? "";
      prenomsChefValeur = e.prenomsChef ?? "";
    }
  } else if (chef) {
    nomChefValeur = chef.nom ?? "";
    prenomsChefValeur = chef.prenoms ?? "";
  }
  // « Nom de l'établissement » : nom déjà enregistré, sinon la structure déclarée par le chef assigné.
  const structureDeclareeChef = chef?.demandes?.[0]?.structureDeclaree?.trim() ?? "";
  const nomEtabValeur = e.nom || structureDeclareeChef;
  // Effectifs enseignants : clé `${cycle}:${disciplineId}` → nombre.
  const effectifsMap: Record<string, number> = {};
  for (const ef of effectifsEns) effectifsMap[`${ef.cycle}:${ef.disciplineId}`] = ef.nombre;

  // Régime de notation : celui choisi par l'établissement, sinon celui de la Configuration générale.
  const regime = infosRegime(e.regimeNotation, e.nbSequences, config?.regimeNotation);
  const regimeApercu = regime.apercu;
  const annee = e.anneeScolaire ?? config?.anneeScolaireCourante ?? "";

  // Lignes de volumes horaires par niveau (séances).
  const etabMap = new Map<string, { seances: number[]; coef: number }>();
  const natMap = new Map<string, { seances: number[]; heures: number; coef: number; facultatif: boolean }>();
  const niveauxAvecOverride = new Set<string>();
  for (const g of grilles) {
    const cle = `${g.niveauId}:${g.disciplineId}`;
    if (g.etablissementId === id) {
      etabMap.set(cle, { seances: g.seancesMinutes, coef: g.coefficient });
      if (g.seancesMinutes.length > 0) niveauxAvecOverride.add(g.niveauId);
    } else {
      natMap.set(cle, { seances: g.seancesMinutes, heures: g.heuresHebdo, coef: g.coefficient, facultatif: g.facultatif });
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
        if (nat && (nat.seances.length > 0 || nat.heures > 0)) {
          return {
            disciplineId: d.id,
            nom: d.nom,
            couleur: d.couleur,
            coef: nat.coef,
            // Durées RÉELLES du modèle national si renseignées (TP sciences…) ; sinon repli
            // sur le volume hebdomadaire dérivé en séances de 55 minutes.
            seances: nat.seances.length > 0 ? nat.seances : Array.from({ length: Math.max(1, Math.round(nat.heures)) }, () => 55),
            facultatif: nat.facultatif,
          };
        }
        return null;
      })
      .filter((x): x is DisciplineLigne => x !== null);
    return { id: nv.id, nom: nv.nom, lignes };
  });
  // `masquee` : SYNCHRONISE la liste d'ajout du bloc « Volumes horaires » avec le tableau des
  // effectifs — une discipline retirée localement (ex. la variante nue « Allemand ») n'est plus
  // proposée à l'ajout, mais une ligne de grille EXISTANTE qui la référencerait reste affichée.
  const toutesDisciplines = disciplines.map((d) => ({
    id: d.id,
    nom: d.nom,
    couleur: d.couleur,
    masquee: e.disciplinesMasquees.includes(d.id),
  }));

  // Catégorie pédagogique : sélecteur en tête de page — dérivée du type tant que l'utilisateur
  // ne l'a pas choisie lui-même. Adapte les blocs « Effectifs enseignants », « Volumes horaires »
  // (ajout depuis la liste) et « Compétences » ci-dessous.
  const categoriePedagogique = e.categoriePedagogique ?? deriveCategoriePedagogique(e.type);
  const primaireOuPrescolaire = estPrimaireOuPrescolaire(categoriePedagogique);
  // Disciplines effectivement renseignées dans les grilles de l'établissement (toutes niveaux
  // confondus) — source des compétences enseignants au préscolaire/primaire (pas de spécialités).
  const disciplinesDesGrilles = new Set<string>();
  for (const nv of niveauxVolumes) for (const l of nv.lignes) disciplinesDesGrilles.add(l.disciplineId);

  // Lignes effectifs par niveau.
  const configMap = new Map(configs.map((c) => [c.niveauId, c]));
  const lignesNiveaux = niveaux.map((nv) => {
    const c = configMap.get(nv.id);
    return {
      niveauId: nv.id,
      nom: nv.nom,
      effectif: c?.effectif ?? 0,
      vacation: c?.vacation ?? "simple",
      nbClasses: c?.nbClasses ?? 0,
      // Effectif souhaité PAR CLASSE propre au niveau (second rang derrière la valeur globale).
      effectifClasse: c?.effectifSouhaiteClasse ?? null,
    };
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

      {/* Coordination : signale qu'un collègue a déjà commencé à configurer cet établissement,
          pour ne pas défaire son travail sans le savoir. N'interdit rien. */}
      <AlerteConfiguration etablissementId={id} utilisateurCourantId={u.id} />

      <AnchorNav />

      {/* Verrou de la configuration (admin système) : quand elle est terminée, la protéger. */}
      <VerrouConfig
        etablissementId={id}
        verrouillee={configVerrouillee}
        estAdminSysteme={estAdminSysteme}
        verrouilleeLe={verrouilleeLe}
      />

      {/* Configuration : entièrement en LECTURE SEULE quand elle est verrouillée (fieldset désactivé).
          La génération de l'emploi du temps (plus bas) reste hors du fieldset — donc toujours possible. */}
      <fieldset disabled={configVerrouillee} className="m-0 min-w-0 space-y-5 border-0 p-0 disabled:opacity-60">

      {/* 0. Catégorie pédagogique — EN TÊTE : adapte les blocs Effectifs enseignants, Volumes
          horaires (ajout depuis la liste) et Compétences ci-dessous. */}
      <Bloc
        id="categorie"
        essentiel
        titre="Catégorie pédagogique"
        sousTitre="Préscolaire et primaire : pas de distinction 1er/2nd cycle (maîtres polyvalents) — la console s'adapte automatiquement ci-dessous."
      >
        <CategoriePedagogiqueBlock etablissementId={id} categorie={categoriePedagogique} />
      </Bloc>

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

      {/* 2. Informations générales */}
      <Bloc id="infos" titre="Informations générales">
        <InfosBlock etablissementId={id} nom={nomEtabValeur} type={e.type} statut={e.statut} reseauConfessionnel={e.reseauConfessionnel ?? ""} diocese={e.diocese ?? ""} pays={e.pays ?? "Côte d'Ivoire"} code={e.code ?? ""} ville={e.ville ?? ""} regime={regime.regime} nbSequences={regime.regime === "sequence" ? regime.nbPeriodes : 6} />
      </Bloc>

      {/* 3. Chef & documents officiels */}
      <Bloc id="chef" titre="Chef d'établissement & documents officiels">
        <ChefBlock etablissementId={id} fonctionChef={e.fonctionChef ?? ""} nomChef={nomChefValeur} prenomsChef={prenomsChefValeur}>
          <DocumentsUpload etablissementId={id} pays={e.pays ?? "Côte d'Ivoire"} docs={{ embleme: e.emblemeUrl, logo: e.logoUrl, cachet: e.cachetUrl, signature: e.signatureUrl }} />
        </ChefBlock>
      </Bloc>

      {/* 4. Rapport d'établissement */}
      <Bloc id="rapport" titre="Rapport d'établissement" sousTitre="Définissez une fois pour toutes le plan et la présentation par défaut du rapport de fin de période.">
        <RapportBlock etablissementId={id} planRapport={e.planRapport ?? ""} presentationRapport={e.presentationRapport ?? "Accordéon"} />
      </Bloc>

      {/* 5. Champs enseignants */}
      <Bloc id="champs" essentiel titre="Champs requis pour l'enregistrement des enseignants" sousTitre="Ces champs s'afficheront aussi dans les grilles de supervision.">
        {champs.length > 0 && (
          <ul className="mb-5 divide-y divide-cream-100">
            {champs.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2.5 text-sm">
                <span>
                  <span className="font-medium text-forest-900">{c.etiquette}</span>
                  <span className="ml-2 text-xs text-ink-700/55">
                    {LIBELLE_TYPE_CHAMP[c.type] ?? c.type}
                    {c.requis ? " · requis" : ""}
                  </span>
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
      <Bloc id="effectifs" essentiel titre="Effectif d'élèves par niveau" sousTitre="Dimensionnement, horaires journaliers, puis effectif et vacation par niveau pour calculer les divisions.">
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
          <NiveauxForm etablissementId={id} lignes={lignesNiveaux} indexation={e.indexationClasses} effectifClasseGlobal={Math.max(1, e.effectifSouhaiteParClasse)} />
        </div>
        <Link href={`/app/systeme/etablissements/${id}/structure`} className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-gold-700 hover:underline">
          <DoorOpen size={15} /> Détail des salles & classes (capacité & type)
        </Link>
      </Bloc>

      {/* 6 bis. Désignation des salles et affectation aux classes pédagogiques */}
      {/* Bloc REPLIABLE : sur les grands établissements, toute la liste de salles se plie sous le
          titre (accordéon natif) pour gagner de la place — replié par défaut. */}
      <BlocRepliable
        id="salles"
        essentiel
        titre="Désignation des salles et affectation aux classes"
        sousTitre="Nommez vos salles physiques et affectez-les aux classes pédagogiques (en double vacation, une salle peut servir deux classes). Ces désignations personnalisées apparaîtront sur les emplois du temps."
        resume={`${sallesInitiales.length} salle(s)`}
      >
        {/* clé = jeu d'identifiants des salles : après un enregistrement qui crée/supprime des
            salles, la revalidation renvoie de nouveaux ids → le composant se re-monte avec l'état
            à jour (les salles nouvellement créées portent alors leur id, pas de doublon). */}
        <SallesBlock
          key={`salles-${sallesInitiales.map((s) => s.id).join("_")}`}
          etablissementId={id}
          sallesInitiales={sallesInitiales}
          classes={classes.map((c) => ({ id: c.id, nom: c.nom }))}
        />
      </BlocRepliable>

      {/* 6 bis. Salles ressources : disciplines nécessitant une salle spécialisée partagée. */}
      <Bloc
        id="salles-ressources"
        titre="Salles ressources (disciplines à salle spécialisée)"
        sousTitre="Indiquez les disciplines qui se déroulent dans une salle spécialisée partagée (laboratoire, salle info, atelier, plateau EPS). Le générateur y route ces cours, partagés par toutes les classes concernées, sans jamais deux classes au même créneau."
      >
        <SallesRessourcesBlock
          etablissementId={id}
          disciplines={disciplines
            .filter((d) => !e.disciplinesMasquees.includes(d.id))
            .map((d) => ({ id: d.id, nom: d.nom }))}
          reglesInitiales={typeSalleRegles}
          typesSallesDisponibles={typesSallesDisponibles}
        />
      </Bloc>

      {/* 6 ter. Contraintes supplémentaires (bloc à part entière, demandé par le client) */}
      <Bloc
        id="contraintes"
        essentiel
        titre="Contraintes supplémentaires"
        sousTitre="Contraintes optionnelles prises en compte par le générateur d'emplois du temps : double vacation conditionnelle, heures creuses, plages sans cours, plages d'EPS, enchaînement des disciplines et contraintes des enseignants."
      >
        <ContraintesBlock
          etablissementId={id}
          conditionsVacation={
            Array.isArray(e.conditionsVacation)
              ? (e.conditionsVacation as { libelle?: unknown; doubleVacation?: unknown }[])
                  .filter((c) => typeof c?.libelle === "string" && c.libelle)
                  .map((c) => ({ libelle: String(c.libelle), doubleVacation: Boolean(c.doubleVacation) }))
              : []
          }
          eps={{
            matinDebut: e.epsMatinDebut ?? "",
            matinFin: e.epsMatinFin ?? "",
            apresMidiDebut: e.epsApresMidiDebut ?? "",
            apresMidiFin: e.epsApresMidiFin ?? "",
          }}
          reposEnseignant={e.reposEnseignant}
          regrouperHeuresCreuses={e.regrouperHeuresCreuses}
          autoriserHeuresCreuses={e.autoriserHeuresCreuses}
          plagesSansCours={
            Array.isArray(e.plagesSansCours)
              ? (e.plagesSansCours as { jour?: unknown; moment?: unknown; niveauIds?: unknown }[])
                  .filter((p) => Number.isInteger(Number(p?.jour)) && typeof p?.moment === "string")
                  .map((p) => ({
                    jour: Number(p.jour),
                    moment: String(p.moment),
                    ...(Array.isArray(p.niveauIds) && p.niveauIds.length > 0
                      ? { niveauIds: (p.niveauIds as unknown[]).map(String) }
                      : {}),
                  }))
              : []
          }
          // Cibles possibles des plages sans cours : niveaux de l'établissement, dans SON ordre
          // d'affichage et avec SES noms locaux (déjà appliqués par charger()).
          niveaux={niveaux.map((n) => ({ id: n.id, nom: n.nom }))}
          doubleVacationMatin={e.doubleVacationMatin}
          epsDemiJourneeOpposee={e.epsDemiJourneeOpposee}
          salleFixeParClasse={e.salleFixeParClasse}
          interdireMemeDiscipline={e.interdireMemeDisciplineConsecutive}
          interdireLitteraires={e.interdireLitterairesConsecutifs}
          interdireScientifiques={e.interdireScientifiquesConsecutifs}
          eviterSeanceIsolee={e.eviterSeanceIsoleeEnseignant}
          limiterParDemiJournee={e.limiterDisciplineParDemiJournee}
          eviterFinJournee={e.eviterMemeDisciplineFinJournee}
        />
      </Bloc>

      {/* 6 bis. Volumes horaires — on définit d'abord la liste des disciplines (et leurs options)
          ici, AVANT de déclarer les effectifs enseignants qui s'appuient sur cette liste. */}
      <Bloc id="volumes" essentiel titre="Volumes horaires par niveau et par discipline" sousTitre="Définissez la durée d'une séance (en minutes) et le nombre de séances hebdomadaires. Le volume est calculé automatiquement.">
        <VolumesBlock
          etablissementId={id}
          niveaux={niveauxVolumes}
          toutesDisciplines={toutesDisciplines}
          // Préscolaire/primaire : pas de liste de spécialités partagées — création par saisie uniquement.
          ajoutDepuisListeDesactive={primaireOuPrescolaire}
        />
      </Bloc>

      {/* 7. Effectifs des enseignants — liste personnalisable par établissement */}
      <Bloc id="enseignants-effectifs" essentiel titre="Effectifs des enseignants par cycle et spécialité" sousTitre="Déclarez le nombre d'enseignants disponibles par spécialité (premier / second cycle). C'est l'intrant du solveur — pas besoin de comptes nominatifs pour générer.">
        <EffectifsEnseignantsForm
          etablissementId={id}
          // Particularités locales : les disciplines retirées par CET établissement sont masquées.
          // `propre` = discipline créée par CET établissement (renommable ici) vs référentiel national.
          disciplines={disciplines
            .filter((d) => !e.disciplinesMasquees.includes(d.id))
            .map((d) => ({ id: d.id, nom: d.nom, nomCanonique: d.nomCanonique, propre: d.etablissementId === id }))}
          valeurs={effectifsMap}
          volume1erCycle={e.volumeHoraire1erCycle}
          volume2ndCycle={e.volumeHoraire2ndCycle}
          // Préscolaire/primaire : sans objet (maîtres polyvalents) — grisé, ignoré par le solveur.
          desactive={primaireOuPrescolaire}
        />
        <div className="mt-6 border-t border-cream-200 pt-6">
          <p className="mb-3 text-sm font-semibold text-forest-900">Générer les comptes enseignants nominatifs</p>
          <GenererComptesEnseignantsForm etablissementId={id} />
        </div>
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
            <p className="mb-3 text-xs text-ink-700/60">
              Colonnes : prénoms ; nom ; email ; rôle ; disciplines — plusieurs disciplines
              s&apos;écrivent « discipline 1|discipline 2 » — ; niveaux : «&nbsp;1er cycle&nbsp;» ou
              «&nbsp;2nd cycle&nbsp;» (un enseignant du 2nd cycle peut enseigner dans les deux cycles).
            </p>
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
          <div className="border-t border-cream-200 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-forest-900">Absences des enseignants</p>
                <p className="text-xs text-ink-700/60">Saisie des autorisations d&apos;absence (journée / demi-journée) — alimente la heatmap du réseau catholique.</p>
              </div>
              <Link href={`/app/systeme/etablissements/${id}/absences`} className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 px-4 py-2 text-sm font-medium text-forest-800 hover:bg-forest-50">
                <CalendarX2 size={15} /> Gérer les absences
              </Link>
            </div>
          </div>
        </div>
      </Bloc>

      {/* 9. Compétences enseignants — liste interactive : recherche + attribution multi-disciplines */}
      <Bloc
        id="competences"
        essentiel
        titre="Compétences des enseignants"
        sousTitre={
          primaireOuPrescolaire
            ? "Attribuez une ou plusieurs disciplines à chaque enseignant (choix multiples) — au préscolaire/primaire, les disciplines proposées sont celles déjà renseignées dans « Volumes horaires par niveau et par discipline »."
            : "Attribuez une ou plusieurs disciplines à chaque enseignant (un clic pour attribuer ou retirer) — base de la répartition automatique."
        }
      >
        {enseignants.length === 0 ? (
          <p className="text-sm text-ink-700/60">Aucun enseignant enregistré dans le bloc « Utilisateurs ».</p>
        ) : (
          <CompetencesBloc
            etablissementId={id}
            enseignants={enseignants.map((e) => ({
              id: e.id,
              nom: nomComplet(e),
              disciplines: e.competences.map((c) => c.disciplineId),
              niveaux: e.niveauxIntervention.map((n) => n.niveauId),
            }))}
            disciplines={
              primaireOuPrescolaire
                ? disciplines.filter((d) => disciplinesDesGrilles.has(d.id) && !e.disciplinesMasquees.includes(d.id))
                : disciplines.filter((d) => !e.disciplinesMasquees.includes(d.id))
            }
            niveauxPremierCycle={niveaux.filter((n) => n.cycle === "college").map((n) => n.id)}
            niveauxSecondCycle={niveaux.filter((n) => n.cycle === "lycee").map((n) => n.id)}
            // Effectifs déclarés par cycle et spécialité : mis en regard des comptes dans le bilan.
            effectifsDeclares={effectifsEns.map((x) => ({ disciplineId: x.disciplineId, nombre: x.nombre }))}
          />
        )}
      </Bloc>

      {/* Enregistrement global : sauvegarde tous les blocs de paramétrage d'un coup. */}
      <div className="rounded-2xl border border-cream-200 bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-base font-bold text-forest-900">Enregistrer toute la configuration</p>
            <p className="mt-0.5 text-sm text-ink-700/60">
              Sauvegarde en une fois tous les blocs de paramétrage qui n&apos;auraient pas encore été enregistrés
              individuellement (les onglets Volumes horaires et Compétences se sauvegardent séparément).
            </p>
          </div>
          <EnregistrerTouteLaConfig />
        </div>
      </div>

      </fieldset>

      {/* Validation & génération — HORS du fieldset : reste possible même config verrouillée. */}
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
