import type { Metadata } from "next";
import Link from "next/link";
import { paysDetecte } from "@/lib/geo";
import { InscriptionForm } from "./inscription-form";

export const metadata: Metadata = { title: "Créer un compte" };

export default async function InscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ parrain?: string }>;
}) {
  // Pays supposé de l'utilisateur (géolocalisation) : drapeau + indicatif du champ Téléphone.
  const pays = await paysDetecte();
  // Code de parrainage éventuel (lien d'invitation) : transmis au formulaire pour rattachement.
  const parrain = (await searchParams).parrain?.trim() || null;
  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-forest-900">Créer un compte</h1>
      <p className="mt-2 text-sm text-ink-700/75">
        Quelques informations suffisent. Vous confirmerez votre adresse par e-mail.
      </p>

      {parrain && (
        <p className="mt-3 rounded-xl border border-forest-200 bg-forest-50/60 px-3 py-2 text-sm text-forest-800">
          🎁 Vous avez été invité(e) : votre parrain sera automatiquement associé à votre compte.
        </p>
      )}

      <div className="mt-6">
        <InscriptionForm pays={pays} parrain={parrain} />
      </div>

      <p className="mt-6 text-center text-sm text-ink-700/75">
        Vous avez déjà un compte ?{" "}
        <Link href="/connexion" className="font-semibold text-forest-700 hover:underline">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
