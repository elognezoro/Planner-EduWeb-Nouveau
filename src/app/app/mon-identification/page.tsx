import type { Metadata } from "next";
import * as Icons from "lucide-react";
import { requireUtilisateur } from "@/lib/auth/session";
import { PageHeader, Card, Badge } from "@/components/app/ui";
import { ROLES } from "@/lib/rbac";
import { paysConsulte } from "@/lib/pays-consulte";
import { libelleCafop } from "@/lib/cafop-terme-serveur";
import { appliquerTerme } from "@/lib/cafop-terme";

export const metadata: Metadata = { title: "Mon Identification" };
export const dynamic = "force-dynamic";

const libelleStatutCompte: Record<string, string> = {
  en_attente_verification: "En attente de confirmation e-mail",
  actif: "Actif",
  suspendu: "Suspendu",
};

const libellePortee: Record<string, string> = {
  global: "National (global)",
  etablissement: "Établissement",
  cafop: "CAFOP",
  apfc: "APFC",
  antenne: "Antenne pédagogique",
  region: "Région / zone",
  personnel: "Personnel",
};

function Ligne({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-cream-200 py-3.5 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-ink-700/60">{label}</span>
      <span className="text-sm font-medium text-forest-900">{children}</span>
    </div>
  );
}

export default async function MonIdentificationPage() {
  const u = await requireUtilisateur();
  const def = ROLES[u.roleActif];
  const terme = await libelleCafop(await paysConsulte());
  const T = (s: string) => appliquerTerme(s, terme);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        titre="Mon Identification"
        description="Récapitulatif de votre compte et de votre statut sur la plateforme."
      />

      <div className="grid gap-6">
        <Card>
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-700/55">
            <Icons.IdCard size={16} /> Compte
          </div>
          <Ligne label="Nom complet">{u.nomComplet}</Ligne>
          <Ligne label="Adresse e-mail">{u.email}</Ligne>
          <Ligne label="Statut du compte">
            <Badge ton={u.statutCompte === "actif" ? "succes" : "attente"}>
              {libelleStatutCompte[u.statutCompte] ?? u.statutCompte}
            </Badge>
          </Ligne>
        </Card>

        <Card>
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-700/55">
            <Icons.ShieldCheck size={16} /> Rôle & périmètre
          </div>
          <Ligne label="Rôle actif">{T(u.libelleRoleActif)}</Ligne>
          <Ligne label="Type de périmètre">{T(libellePortee[def.portee])}</Ligne>
          <Ligne label="Description du rôle">
            <span className="font-normal text-ink-700/75">{T(def.description)}</span>
          </Ligne>
        </Card>

        {u.demandeEnAttente && (
          <Card className="border-gold-300/70 bg-gold-50">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gold-800">
              <Icons.Clock4 size={16} /> Demande de rôle en cours
            </div>
            <Ligne label="Rôle demandé">{u.demandeEnAttente.libelleRoleDemande}</Ligne>
            {u.demandeEnAttente.structureDeclaree && (
              <Ligne label="Structure déclarée">
                {u.demandeEnAttente.structureDeclaree}
              </Ligne>
            )}
            <Ligne label="Statut">
              <Badge ton="attente">En attente de validation</Badge>
            </Ligne>
            <p className="mt-4 text-sm leading-relaxed text-gold-900/80">
              {u.accesRestreint
                ? "Tant que votre demande n'est pas approuvée par un administrateur, votre accès est limité à Mon Identification et Mon Profil."
                : "Votre accès actuel reste inchangé pendant l'examen de cette demande. À l'approbation, votre rôle et son périmètre seront mis à jour."}
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
