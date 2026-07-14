import { NextResponse } from "next/server";
import { corrigerReformulation } from "@/lib/ia/correction-reformulation";
import { limiteDebitOk } from "@/lib/ia/limite-debit";
import { contexteFormateur, parametresProductionValides } from "@/lib/sondage";

/**
 * Correction IA d'une reformulation de participant (atelier « Reformuler un message brut »).
 * RÉSERVÉ AUX FORMATEURS (admin ou e-mail listé dans ConfigSeminaire.formateurs) : la
 * correction est déclenchée depuis l'« espace formateur ». Garde-fous de coût : réservé au
 * formateur + limite de débit. La clé Claude reste exclusivement côté serveur.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as {
    seminaire?: unknown;
    activite?: unknown;
    messageBrut?: unknown;
    texteEleve?: unknown;
  };
  const seminaire = typeof b.seminaire === "string" ? b.seminaire : "";
  const activite = typeof b.activite === "string" ? b.activite : "";
  if (!parametresProductionValides(seminaire, activite)) {
    return NextResponse.json({ erreur: "Paramètres invalides." }, { status: 400 });
  }

  const { u, estFormateur } = await contexteFormateur(seminaire);
  if (!u) return NextResponse.json({ erreur: "Connexion requise." }, { status: 401 });
  if (!estFormateur) return NextResponse.json({ erreur: "Réservé au formateur." }, { status: 403 });

  if (!limiteDebitOk(`correction:${u.id}`, 20, 5 * 60_000)) {
    return NextResponse.json({ erreur: "Trop de corrections demandées. Patientez un instant." }, { status: 429 });
  }

  const messageBrut = typeof b.messageBrut === "string" ? b.messageBrut.slice(0, 600) : "";
  const texteEleve = typeof b.texteEleve === "string" ? b.texteEleve.slice(0, 3000) : "";
  if (!texteEleve.trim()) return NextResponse.json({ erreur: "Aucune production à corriger." }, { status: 400 });

  const { correction, source } = await corrigerReformulation(messageBrut, texteEleve);
  return NextResponse.json({ correction, source });
}
