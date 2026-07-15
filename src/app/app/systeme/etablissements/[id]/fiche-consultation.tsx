import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Church, School, MapPin, Mail, Phone, UserRound, LayoutGrid, DoorOpen, GraduationCap, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { filtreEtablissements, type PorteeUtilisateur } from "@/lib/rbac";
import { PageHeader, Card, Badge } from "@/components/app/ui";
import { LIBELLE_TYPE } from "@/lib/referentiels/etablissement";

const LIBELLE_STATUT: Record<string, string> = {
  public: "Public",
  prive: "Privé",
  confessionnel: "Confessionnel",
  autre: "Autre",
};

/** Ligne d'information : libellé discret + valeur (ou tiret si absente). */
function Info({ libelle, valeur }: { libelle: string; valeur: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-ink-700/50">{libelle}</span>
      <span className="min-w-0 text-right text-sm font-medium text-forest-900">{valeur ?? "—"}</span>
    </div>
  );
}

/**
 * Fiche de CONSULTATION d'un établissement pour les rôles du réseau catholique
 * (SENEC national, SEDEC diocésain) — strictement en lecture seule, sans aucun
 * formulaire. Le périmètre est appliqué par la couche RBAC : l'établissement
 * n'est servi que s'il appartient au champ du rôle (pays/diocèse + catholique).
 */
export async function FicheConsultation({ id, portee }: { id: string; portee: PorteeUtilisateur }) {
  const e = await prisma.etablissement
    .findFirst({
      where: { id, AND: [filtreEtablissements(portee)] },
      include: { region: { select: { nom: true } }, _count: { select: { classes: true, salles: true } } },
    })
    .catch(() => null);
  if (!e) redirect("/app/systeme/etablissements");

  const [nbEnseignants, nbEleves] = await Promise.all([
    prisma.utilisateur.count({ where: { etablissementId: id, roleActif: { nomTechnique: "enseignant" } } }).catch(() => 0),
    prisma.utilisateur.count({ where: { etablissementId: id, roleActif: { nomTechnique: "eleve" } } }).catch(() => 0),
  ]);

  const chef = [e.prenomsChef, e.nomChef].filter(Boolean).join(" ").trim();
  const chiffres = [
    { icone: LayoutGrid, valeur: e._count.classes, libelle: "classe(s)" },
    { icone: DoorOpen, valeur: e._count.salles || e.nbSallesDisponibles, libelle: "salle(s)" },
    { icone: GraduationCap, valeur: nbEnseignants, libelle: "enseignant(s)" },
    { icone: Users, valeur: nbEleves, libelle: "élève(s)" },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader titre={e.nom} description="Fiche de l'établissement — réseau SEDEC (consultation, lecture seule)." />
      <Link
        href="/app/systeme/etablissements"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900"
      >
        <ArrowLeft size={15} /> Retour aux établissements
      </Link>

      {/* Badges d'identité */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{LIBELLE_TYPE[e.type] ?? e.type}</Badge>
        <Badge ton="succes">{LIBELLE_STATUT[e.statut] ?? e.statut}</Badge>
        {e.reseauConfessionnel && <Badge ton="attente">Réseau {e.reseauConfessionnel}</Badge>}
        {e.diocese && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-100 px-3 py-1 text-xs font-semibold text-forest-800">
            <Church size={13} /> {e.diocese}
          </span>
        )}
      </div>

      {/* Chiffres clés */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {chiffres.map((c) => (
          <Card key={c.libelle} className="flex items-center gap-3 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest-50 text-forest-600">
              <c.icone size={19} />
            </span>
            <span>
              <span className="block font-display text-xl font-bold text-forest-900">{c.valeur.toLocaleString("fr-FR")}</span>
              <span className="text-xs text-ink-700/60">{c.libelle}</span>
            </span>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Identité */}
        <Card>
          <h2 className="mb-2 inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
            <School size={17} className="text-forest-600" /> Identité
          </h2>
          <div className="divide-y divide-cream-200">
            <Info libelle="Code" valeur={e.code} />
            <Info libelle="Pays" valeur={e.pays} />
            <Info libelle="Région (DRENAET)" valeur={e.region?.nom} />
            <Info
              libelle="Localité"
              valeur={
                e.ville ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={12} className="shrink-0 text-ink-700/40" /> {e.ville}
                  </span>
                ) : null
              }
            />
            <Info libelle="Adresse" valeur={e.adresse} />
            <Info libelle="Année scolaire" valeur={e.anneeScolaire} />
          </div>
        </Card>

        {/* Contact & direction */}
        <Card>
          <h2 className="mb-2 inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
            <UserRound size={17} className="text-forest-600" /> Contact &amp; direction
          </h2>
          <div className="divide-y divide-cream-200">
            <Info libelle={e.fonctionChef || "Chef d'établissement"} valeur={chef || null} />
            <Info
              libelle="E-mail"
              valeur={
                e.email ? (
                  <span className="inline-flex items-center gap-1 break-all">
                    <Mail size={12} className="shrink-0 text-ink-700/40" /> {e.email}
                  </span>
                ) : null
              }
            />
            <Info
              libelle="Téléphone"
              valeur={
                e.telephone ? (
                  <span className="inline-flex items-center gap-1">
                    <Phone size={12} className="shrink-0 text-ink-700/40" /> {e.telephone}
                  </span>
                ) : null
              }
            />
            <Info libelle="Régime de vacation" valeur={e.regimeVacation === "double" ? "Double vacation" : "Vacation simple"} />
            <Info libelle="Effectif souhaité / classe" valeur={e.effectifSouhaiteParClasse} />
          </div>
        </Card>
      </div>

      <p className="text-xs text-ink-700/50">
        Consultation réservée au réseau catholique (SEDEC) : les informations sont fournies par l&apos;administration de
        l&apos;établissement et ne sont pas modifiables depuis ce rôle.
      </p>
    </div>
  );
}
