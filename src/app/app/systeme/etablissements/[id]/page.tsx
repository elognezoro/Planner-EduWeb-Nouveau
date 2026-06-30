import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Table2, DoorOpen, CalendarCog, Settings2, FileBadge, Trash2 } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/app/ui";
import { ConfigForm, type ValeursConfig } from "./config-form";
import { NiveauxForm } from "./niveaux-form";
import { DocumentsUpload } from "./documents-upload";
import { ChampsForm } from "./champs-form";
import { supprimerChamp } from "./config-actions";

export const metadata: Metadata = { title: "Configuration de l'établissement" };
export const dynamic = "force-dynamic";

async function charger(id: string) {
  try {
    const etablissement = await prisma.etablissement.findUnique({
      where: { id },
      include: { region: true },
    });
    if (!etablissement) return { statut: "introuvable" as const };
    const [regions, niveaux, configs, champs, config, nbSalles] = await Promise.all([
      prisma.region.findMany({ orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
      prisma.niveau.findMany({ orderBy: { ordre: "asc" } }),
      prisma.niveauEtablissement.findMany({ where: { etablissementId: id } }),
      prisma.champEnseignant.findMany({ where: { etablissementId: id }, orderBy: { ordre: "asc" } }),
      prisma.configuration.findUnique({ where: { id: "global" } }),
      prisma.salle.count({ where: { etablissementId: id } }),
    ]);
    return { statut: "ok" as const, etablissement, regions, niveaux, configs, champs, config, nbSalles };
  } catch (e) {
    console.error("[config etab] DB indisponible :", e);
    return { statut: "erreur" as const };
  }
}

export default async function ConfigurationEtablissementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
        <Card>
          <p className="text-sm text-ink-700/70">Impossible de charger l'établissement.</p>
        </Card>
      </div>
    );
  }

  const { etablissement: e, regions, niveaux, configs, champs, config } = data;
  const regime = config?.regimeNotation === "semestre" ? "Semestre (2 semestres)" : "Trimestre (3 trimestres)";

  const valeurs: ValeursConfig = {
    nom: e.nom,
    type: e.type,
    statut: e.statut,
    code: e.code ?? "",
    ville: e.ville ?? "",
    regionId: e.regionId ?? "",
    pays: e.pays ?? "Côte d'Ivoire",
    sloganBulletin: e.sloganBulletin ?? "",
    ministere: e.ministere ?? "",
    anneeScolaire: e.anneeScolaire ?? config?.anneeScolaireCourante ?? "",
    fonctionChef: e.fonctionChef ?? "",
    nomChef: e.nomChef ?? "",
    planRapport: e.planRapport ?? "",
    presentationRapport: e.presentationRapport ?? "Accordéon",
    effectifSouhaiteParClasse: e.effectifSouhaiteParClasse,
    nbSallesDisponibles: e.nbSallesDisponibles,
    creneauxParJour: e.creneauxParJour,
    horaireDebutMatin: e.horaireDebutMatin ?? "",
    horairePauseMatinDebut: e.horairePauseMatinDebut ?? "",
    horairePauseMatinFin: e.horairePauseMatinFin ?? "",
    horairePauseMidiDebut: e.horairePauseMidiDebut ?? "",
    horaireRepriseApresMidi: e.horaireRepriseApresMidi ?? "",
    horaireFinJournee: e.horaireFinJournee ?? "",
  };

  const configMap = new Map(configs.map((c) => [c.niveauId, c]));
  const lignesNiveaux = niveaux.map((nv) => {
    const c = configMap.get(nv.id);
    return {
      niveauId: nv.id,
      nom: nv.nom,
      effectif: c?.effectif ?? 0,
      vacation: c?.vacation ?? "simple",
      nbClasses: c?.nbClasses ?? 0,
    };
  });

  return (
    <div className="mx-auto max-w-5xl space-y-7 pb-16">
      <Link
        href="/app/systeme/etablissements"
        className="inline-flex items-center gap-2 text-sm font-medium text-forest-700 hover:text-forest-900"
      >
        <ArrowLeft size={16} /> Tous les établissements
      </Link>

      <PageHeader
        titre="Configuration de l'établissement"
        description={`${e.nom} — renseignez les informations pour générer bulletins, documents et emplois du temps.`}
        action={
          <Link
            href={`/app/systeme/etablissements/${id}/emploi-du-temps`}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-gradient-to-br from-gold-300 to-gold-500 px-5 text-sm font-semibold text-forest-950 shadow-[var(--shadow-gold)] transition-transform hover:-translate-y-0.5"
          >
            <CalendarCog size={16} /> Générer l'emploi du temps
          </Link>
        }
      />

      {/* Liens rapides vers les sous-écrans */}
      <div className="flex flex-wrap gap-3">
        <Link href={`/app/systeme/etablissements/${id}/structure`} className="inline-flex items-center gap-2 rounded-full border border-forest-200 bg-white px-4 py-2 text-sm font-semibold text-forest-800 hover:bg-forest-50">
          <DoorOpen size={15} /> Salles & classes ({data.nbSalles} salle{data.nbSalles > 1 ? "s" : ""})
        </Link>
        <Link href={`/app/systeme/etablissements/${id}/grille`} className="inline-flex items-center gap-2 rounded-full border border-forest-200 bg-white px-4 py-2 text-sm font-semibold text-forest-800 hover:bg-forest-50">
          <Table2 size={15} /> Volumes horaires (grille)
        </Link>
      </div>

      {/* Aperçu en-tête du bulletin */}
      <Card className="bg-cream-50">
        <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-700/55">
          <FileBadge size={15} /> Aperçu en-tête du bulletin
        </p>
        <div className="rounded-xl border border-cream-200 bg-white px-6 py-4 text-center">
          <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-forest-900">
            {e.ministere || "Ministère de tutelle…"}
          </p>
          <p className="mt-2 font-display text-lg font-bold tracking-wide text-forest-900">
            BULLETIN DE NOTES
          </p>
          <p className="text-xs text-ink-700/70">{regime.split(" ")[0]}</p>
          <p className="mt-2 text-[0.7rem] text-ink-700/60">
            {(e.pays ? `RÉPUBLIQUE DE ${e.pays.toUpperCase()}` : "")}
            {e.sloganBulletin ? ` · ${e.sloganBulletin}` : ""}
          </p>
          <p className="text-[0.7rem] text-ink-700/60">
            {valeurs.anneeScolaire ? `Année scolaire ${valeurs.anneeScolaire}` : ""}
          </p>
        </div>
      </Card>

      {/* Étapes 1 & 2 — formulaire principal */}
      <ConfigForm etablissementId={id} valeurs={valeurs} regions={regions} regimeLibelle={regime} />

      {/* Documents officiels */}
      <Card>
        <h2 className="mb-4 font-display text-lg font-bold text-forest-900">Documents officiels</h2>
        <DocumentsUpload
          etablissementId={id}
          docs={{ embleme: e.emblemeUrl, logo: e.logoUrl, cachet: e.cachetUrl, signature: e.signatureUrl }}
        />
      </Card>

      {/* Champs personnalisés enseignants */}
      <Card>
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-forest-900">
          <Settings2 size={18} /> Champs requis pour l'enregistrement des enseignants
        </h2>
        <p className="mb-4 text-sm text-ink-700/65">
          Ces champs s'afficheront aussi dans les grilles de supervision.
        </p>
        {champs.length > 0 && (
          <ul className="mb-5 divide-y divide-cream-100">
            {champs.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2.5 text-sm">
                <span>
                  <span className="font-medium text-forest-900">{c.etiquette}</span>
                  <span className="ml-2 text-xs text-ink-700/55">
                    {c.type}
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
      </Card>

      {/* Étape 2 — Répartition par niveau */}
      <Card>
        <h2 className="mb-1 font-display text-lg font-bold text-forest-900">
          Effectif d'élèves par niveau & calcul des classes
        </h2>
        <p className="mb-4 text-sm text-ink-700/65">
          Saisissez l'effectif et la vacation par niveau, puis calculez les divisions (classes).
          Effectif souhaité par classe actuel : <strong>{e.effectifSouhaiteParClasse}</strong>{" "}
          (modifiable ci-dessus, pensez à enregistrer avant de calculer).
        </p>
        <NiveauxForm etablissementId={id} lignes={lignesNiveaux} />
      </Card>
    </div>
  );
}
