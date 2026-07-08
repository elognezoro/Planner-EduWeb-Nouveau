import { redirect } from "next/navigation";

// La page « Statistiques CAFOP » a été intégrée comme onglet de la page CAFOP.
export const dynamic = "force-dynamic";

export default function StatistiquesCafopRedirect() {
  redirect("/app/systeme/cafop/statistiques");
}
