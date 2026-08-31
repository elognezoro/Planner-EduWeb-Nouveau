import type { Metadata } from "next";
import Link from "next/link";
import { paysDetecte } from "@/lib/geo";
import { avecRetour, cheminRetourSur } from "@/lib/auth/retour";
import { InscriptionForm } from "./inscription-form";

export const metadata: Metadata = { title: "Créer un compte" };

export default async function InscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ parrain?: string; retour?: string }>;
}) {
  // Pays supposé de l'utilisateur (géolocalisation) : drapeau + indicatif du champ Téléphone.
  const pays = await paysDetecte();
  const params = await searchParams;
  // Code de parrainage éventuel (lien d'invitation) : transmis au formulaire pour rattachement.
  // Garde de type : un paramètre répété (?parrain=a&parrain=b) arrive en tableau — ignoré.
  const parrain = typeof params.parrain === "string" ? params.parrain.trim() || null : null;
  // Page à retrouver après inscription puis connexion (ex. invitation à une formation) —
  // validée (anti open-redirect), transmise au formulaire puis au lien de confirmation.
  const retour = cheminRetourSur(params.retour);
  // Inscription venant d'un LIEN DE FORMATION : parcours simplifié (pays seul, sans rôle ni
  // établissement, sans validation d'admin). Détecté à partir du fil de retour.
  const modeFormation = Boolean(retour && retour.startsWith("/invitation/cours/"));
  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-forest-900">
        {modeFormation ? "Rejoindre la formation" : "Créer un compte"}
      </h1>
      <p className="mt-2 text-sm text-ink-700/75">
        {modeFormation
          ? "Créez votre compte en quelques secondes pour accéder à la formation. Vous confirmerez votre adresse par e-mail."
          : "Quelques informations suffisent. Vous confirmerez votre adresse par e-mail."}
      </p>

      {parrain && (
        <p className="mt-3 rounded-xl border border-forest-200 bg-forest-50/60 px-3 py-2 text-sm text-forest-800">
          🎁 Vous avez été invité(e) : votre parrain sera automatiquement associé à votre compte.
        </p>
      )}

      <div className="mt-6">
        <InscriptionForm pays={pays} parrain={parrain} retour={retour} modeFormation={modeFormation} />
      </div>

      <p className="mt-6 text-center text-sm text-ink-700/75">
        Vous avez déjà un compte ?{" "}
        <Link
          href={avecRetour("/connexion", retour)}
          className="font-semibold text-forest-700 hover:underline"
        >
          Se connecter
        </Link>
      </p>
    </div>
  );
}
