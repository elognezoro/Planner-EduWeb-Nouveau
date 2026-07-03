import type { Metadata } from "next";
import Link from "next/link";
import { paysDetecte } from "@/lib/geo";
import { InscriptionForm } from "./inscription-form";

export const metadata: Metadata = { title: "Créer un compte" };

export default async function InscriptionPage() {
  // Pays supposé de l'utilisateur (géolocalisation) : drapeau + indicatif du champ Téléphone.
  const pays = await paysDetecte();
  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-forest-900">Créer un compte</h1>
      <p className="mt-2 text-sm text-ink-700/75">
        Quelques informations suffisent. Vous confirmerez votre adresse par e-mail.
      </p>

      <div className="mt-6">
        <InscriptionForm pays={pays} />
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
