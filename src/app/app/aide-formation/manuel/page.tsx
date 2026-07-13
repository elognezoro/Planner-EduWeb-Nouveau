import type { Metadata } from "next";
import { requireUtilisateur } from "@/lib/auth/session";
import { ManuelViewer } from "./viewer";

export const metadata: Metadata = { title: "Support de formation académique" };
export const dynamic = "force-dynamic";

export default async function ManuelPage() {
  await requireUtilisateur();
  return <ManuelViewer reference="EDUWEB-FORM-2026-01" version="1.0" />;
}
