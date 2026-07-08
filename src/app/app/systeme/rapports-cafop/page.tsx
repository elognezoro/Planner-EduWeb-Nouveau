import { redirect } from "next/navigation";

// La page « Rapports CAFOP » a été intégrée comme onglet de la page CAFOP.
export const dynamic = "force-dynamic";

export default function RapportsCafopRedirect() {
  redirect("/app/systeme/cafop/rapports");
}
