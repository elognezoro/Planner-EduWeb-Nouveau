import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { filtreEtablissements, type PorteeUtilisateur } from "@/lib/rbac";
import { PageHeader } from "@/components/app/ui";
import {
  OngletApercu, OngletCahier, OngletConfiguration, OngletEDT, OngletEleves, OngletNotes,
  OngletPersonnel, OngletRapport, OngletRegistre, OngletStats, type EtabConsult,
} from "./consultation-sections";

const ONGLETS = [
  { id: "apercu", libelle: "Aperçu" },
  { id: "configuration", libelle: "Configuration" },
  { id: "eleves", libelle: "Élèves" },
  { id: "personnel", libelle: "Personnel" },
  { id: "cahier-texte", libelle: "Cahier de texte" },
  { id: "registre-appel", libelle: "Registre d'appel" },
  { id: "notes", libelle: "Notes & bulletins" },
  { id: "emplois-du-temps", libelle: "Emplois du temps" },
  { id: "stats", libelle: "Statistiques" },
  { id: "rapport", libelle: "Rapport" },
] as const;
type OngletId = (typeof ONGLETS)[number]["id"];

/**
 * Hub de CONSULTATION d'un établissement pour le réseau catholique (SENEC/SEDEC) :
 * neuf onglets en LECTURE SEULE (aperçu, configuration, élèves, personnel, cahier
 * de texte, registre d'appel, notes & bulletins, statistiques, rapport).
 * Le périmètre est appliqué ICI, une seule fois, par la couche RBAC : l'établissement
 * n'est servi que s'il est catholique ET dans le pays (SENEC) / diocèse (SEDEC).
 * Seul le SEDEC télécharge le rapport d'établissement en Word (le SENEC télécharge
 * les rapports de SEDEC depuis la page « Statistiques du réseau »).
 */
export async function FicheConsultation({
  id,
  portee,
  roleActif,
  sp,
}: {
  id: string;
  portee: PorteeUtilisateur;
  roleActif: "senec" | "sedec";
  sp: Record<string, string | undefined>;
}) {
  // Panne base ≠ hors-périmètre : on n'assimile pas une erreur Prisma à un refus d'accès.
  let e: EtabConsult | null;
  try {
    e = (await prisma.etablissement.findFirst({
      where: { id, AND: [filtreEtablissements(portee)] },
      include: { region: { select: { nom: true } }, _count: { select: { classes: true, salles: true } } },
    })) as EtabConsult | null;
  } catch (err) {
    console.error("[fiche consultation] DB indisponible :", err);
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader titre="Consultation de l'établissement" />
        <p className="text-sm text-ink-700/70">
          Impossible de charger l&apos;établissement. Vérifiez la connexion à la base de données puis réessayez.
        </p>
      </div>
    );
  }
  if (!e) redirect("/app/systeme/etablissements");

  const onglet: OngletId = (ONGLETS.find((o) => o.id === sp.onglet)?.id ?? "apercu") as OngletId;
  const classeId = sp.classe;
  const eleveId = sp.eleve;
  const ficheId = sp.fiche;
  const edtMode = sp.edt;
  const enseignantId = sp.ens;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        titre={e.nom}
        description={`${e.diocese ?? "Réseau SEDEC"} — consultation en lecture seule.`}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/app/systeme/etablissements"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900"
        >
          <ArrowLeft size={15} /> Retour aux établissements
        </Link>
        <Link
          href="/app/systeme/etablissements/reseau"
          className="text-sm font-medium text-forest-700 hover:underline"
        >
          Statistiques du réseau →
        </Link>
      </div>

      {/* Barre d'onglets (liens — tout est rendu côté serveur) */}
      <nav aria-label="Sections de consultation" className="flex flex-wrap gap-1.5 rounded-2xl border border-cream-200 bg-cream-50/60 p-1.5">
        {ONGLETS.map((o) => (
          <Link
            key={o.id}
            href={`/app/systeme/etablissements/${e.id}${o.id === "apercu" ? "" : `?onglet=${o.id}`}`}
            aria-current={onglet === o.id ? "page" : undefined}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              onglet === o.id ? "bg-forest-800 text-cream-50" : "text-forest-800 hover:bg-forest-50"
            }`}
          >
            {o.libelle}
          </Link>
        ))}
      </nav>

      {onglet === "apercu" && <OngletApercu e={e} />}
      {onglet === "configuration" && <OngletConfiguration e={e} />}
      {onglet === "eleves" && <OngletEleves e={e} classeId={classeId} />}
      {onglet === "personnel" && <OngletPersonnel e={e} ficheId={ficheId} />}
      {onglet === "cahier-texte" && <OngletCahier e={e} classeId={classeId} />}
      {onglet === "registre-appel" && <OngletRegistre e={e} classeId={classeId} />}
      {onglet === "notes" && <OngletNotes e={e} classeId={classeId} eleveId={eleveId} />}
      {onglet === "emplois-du-temps" && <OngletEDT e={e} mode={edtMode} classeId={classeId} enseignantId={enseignantId} />}
      {onglet === "stats" && <OngletStats e={e} />}
      {onglet === "rapport" && <OngletRapport e={e} peutTelechargerWord={roleActif === "sedec"} />}

      <p className="text-xs text-ink-700/50">
        Consultation réservée au réseau catholique (SENEC/SEDEC) : les données sont fournies par l&apos;administration de
        l&apos;établissement et ne sont pas modifiables depuis ce rôle.
      </p>
    </div>
  );
}
