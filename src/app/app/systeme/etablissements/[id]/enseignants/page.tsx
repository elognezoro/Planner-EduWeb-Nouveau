import { redirect } from "next/navigation";

// La gestion des enseignants (ajout, import CSV, compétences) est désormais intégrée
// à la console de configuration, dans les blocs « Utilisateurs » et « Compétences ».
export default async function EnseignantsRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/app/systeme/etablissements/${id}#utilisateurs`);
}
