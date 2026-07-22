import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUtilisateur } from "@/lib/auth/session";
import { estEncadreurPedagogique, lireSpecialites } from "@/lib/inspection/specialites";
import { PageHeader, Card } from "@/components/app/ui";
import { ProfilForm } from "./profil-form";
import { MotDePasseForm } from "./mot-de-passe-form";
import { SpecialitesForm } from "./specialites-form";

export const metadata: Metadata = { title: "Mon Profil" };
export const dynamic = "force-dynamic";

export default async function MonProfilPage() {
  const u = await requireUtilisateur();
  // Pays de l'utilisateur (détecté à l'inscription, modifiable ici) + spécialités d'encadrement.
  const compte = await prisma.utilisateur.findUnique({
    where: { id: u.id },
    select: { pays: true, specialites: true },
  });

  // Bloc « Ma spécialité » — UNIQUEMENT pour les rôles d'encadrement pédagogique
  // (inspecteur, conseiller pédagogique) : disciplines SIMPLES du référentiel
  // (les couples « X / Y » sont exclus), choix multiples.
  const encadreur = estEncadreurPedagogique(u.roleReel);
  let disciplinesSimples: string[] = [];
  if (encadreur) {
    const disciplines = await prisma.discipline.findMany({
      orderBy: { nom: "asc" },
      select: { nom: true },
    });
    disciplinesSimples = disciplines.map((d) => d.nom).filter((n) => !n.includes("/"));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        titre="Mon Profil"
        description="Gérez vos informations personnelles et vos préférences d'affichage."
      />
      <Card>
        <ProfilForm
          valeurs={{
            prenoms: u.prenoms ?? "",
            nom: u.nom ?? "",
            telephone: u.telephone ?? "",
            pays: compte?.pays ?? "",
            langue: u.langue,
            email: u.email,
          }}
        />
      </Card>
      {encadreur && (
        <Card>
          <h2 className="font-display text-lg font-bold text-forest-900">
            Ma spécialité (encadrement pédagogique)
          </h2>
          <p className="mb-5 mt-1 text-sm text-ink-700/70">
            Sélectionnez votre ou vos disciplines de spécialité — elles ciblent les enseignants
            proposés lors de la planification de vos visites de classe et de suivi.
          </p>
          <SpecialitesForm
            disciplines={disciplinesSimples}
            specialites={lireSpecialites(compte?.specialites)}
          />
        </Card>
      )}
      <Card>
        <h2 className="font-display text-lg font-bold text-forest-900">Sécurité</h2>
        <p className="mb-5 mt-1 text-sm text-ink-700/70">
          Modifiez votre mot de passe. Choisissez-en un que vous seul connaissez.
        </p>
        <MotDePasseForm />
      </Card>
    </div>
  );
}
