import type { Metadata } from "next";
import { FileSpreadsheet, KeyRound } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, Card } from "@/components/app/ui";
import { Convertisseur } from "./converter";
import { GenerateurComptes } from "./generateur";

export const metadata: Metadata = { title: "Convertisseur CSV" };
export const dynamic = "force-dynamic";

export default async function ConvertisseurCsvPage() {
  await requireRole(["admin"]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titre="Convertisseur CSV"
        description="Déposez une liste (Word ou Excel) et obtenez un fichier CSV prêt à l'emploi : format d'import Moodle, ou comptes EduWeb avec mots de passe générés et champs de sortie configurables."
      />
      <Card>
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-forest-900">
            <FileSpreadsheet size={20} /> Liste (Word / Excel) → CSV Moodle
          </h2>
        </div>
        <p className="mb-5 text-base leading-relaxed text-ink-700/70">
          Le fichier peut contenir les <strong>NOM et Prénoms dans une seule colonne</strong> ou dans
          <strong> deux colonnes séparées</strong>. En sortie : les <strong>NOM en MAJUSCULES</strong>, les
          <strong> Prénoms avec une majuscule initiale</strong> par composante, et les colonnes Moodle
          (<code className="text-sm">username, password, firstname, lastname, email, course1, role1, cohort1</code>)
          — que vous complétez et étendez ci-dessous. Renseignez notamment le
          <strong> nom de l&apos;établissement</strong>, la <strong>classe pédagogique</strong>{" "}
          et l&apos;<strong>année scolaire</strong>.
        </p>
        <Convertisseur />
      </Card>

      <Card>
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-forest-900">
            <KeyRound size={20} /> Liste (Word / Excel) → CSV comptes EduWeb
          </h2>
        </div>
        <p className="mb-5 text-base leading-relaxed text-ink-700/70">
          Génère un fichier CSV avec des <strong>champs de sortie configurables</strong> :
          <code className="text-sm"> prénoms, nom, email, mot de passe, rôle, disciplines, niveaux</code> —
          plus vos colonnes personnalisées. Les <strong>mots de passe</strong>{" "}
          respectent les critères du formulaire de création de compte (10&nbsp;caractères maximum),
          plusieurs <strong>disciplines</strong>{" "}
          s&apos;écrivent «&nbsp;discipline&nbsp;1|discipline&nbsp;2&nbsp;», et les{" "}
          <strong>niveaux</strong>{" "}
          valent «&nbsp;1er cycle&nbsp;» ou «&nbsp;2nd cycle&nbsp;» (un enseignant du 2nd cycle peut
          enseigner dans les deux cycles). Le fichier obtenu est directement importable dans la
          console «&nbsp;Enseignants&nbsp;» d&apos;un établissement.
        </p>
        <GenerateurComptes />
      </Card>
    </div>
  );
}
