import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUtilisateur } from "@/lib/auth/session";
import { estFormateurDesigne } from "@/lib/manuel/formateurs";
import { ManuelViewer } from "./viewer";

export const metadata: Metadata = { title: "Manuel du formateur" };
export const dynamic = "force-dynamic";

export default async function ManuelPage() {
  const u = await requireUtilisateur();
  // Document du FORMATEUR (corrigés des évaluations inclus) : réservé à l'admin système
  // et aux formateurs désignés — vérifié aussi sur les routes word/apercu.
  if (!(await estFormateurDesigne(u))) redirect("/app/aide-formation/guides");
  return <ManuelViewer reference="EDUWEB-FORM-2026-01" version="2.0" />;
}
