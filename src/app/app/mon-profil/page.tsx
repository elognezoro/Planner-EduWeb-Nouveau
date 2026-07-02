import type { Metadata } from "next";
import { requireUtilisateur } from "@/lib/auth/session";
import { PageHeader, Card } from "@/components/app/ui";
import { ProfilForm } from "./profil-form";
import { MotDePasseForm } from "./mot-de-passe-form";

export const metadata: Metadata = { title: "Mon Profil" };
export const dynamic = "force-dynamic";

export default async function MonProfilPage() {
  const u = await requireUtilisateur();

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
            langue: u.langue,
            email: u.email,
          }}
        />
      </Card>
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
