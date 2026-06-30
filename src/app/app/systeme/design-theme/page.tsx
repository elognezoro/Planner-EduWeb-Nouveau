import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, Card, Badge } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";

export const metadata: Metadata = { title: "Design & thème" };
export const dynamic = "force-dynamic";

const forest = [
  { c: "bg-forest-50", l: "50" },
  { c: "bg-forest-100", l: "100" },
  { c: "bg-forest-200", l: "200" },
  { c: "bg-forest-300", l: "300" },
  { c: "bg-forest-400", l: "400" },
  { c: "bg-forest-500", l: "500" },
  { c: "bg-forest-600", l: "600" },
  { c: "bg-forest-700", l: "700" },
  { c: "bg-forest-800", l: "800" },
  { c: "bg-forest-900", l: "900" },
  { c: "bg-forest-950", l: "950" },
];
const gold = [
  { c: "bg-gold-50", l: "50" },
  { c: "bg-gold-100", l: "100" },
  { c: "bg-gold-200", l: "200" },
  { c: "bg-gold-300", l: "300" },
  { c: "bg-gold-400", l: "400" },
  { c: "bg-gold-500", l: "500" },
  { c: "bg-gold-600", l: "600" },
  { c: "bg-gold-700", l: "700" },
  { c: "bg-gold-800", l: "800" },
  { c: "bg-gold-900", l: "900" },
];
const cream = [
  { c: "bg-cream-50", l: "50" },
  { c: "bg-cream-100", l: "100" },
  { c: "bg-cream-200", l: "200" },
  { c: "bg-cream-300", l: "300" },
];

function Nuancier({
  titre,
  teintes,
}: {
  titre: string;
  teintes: { c: string; l: string }[];
}) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-forest-900">{titre}</h3>
      <div className="flex flex-wrap gap-2">
        {teintes.map((t) => (
          <div key={t.c} className="text-center">
            <div className={`h-12 w-14 rounded-lg border border-cream-200 ${t.c}`} />
            <span className="mt-1 block text-[0.6rem] text-ink-700/60">{t.l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function DesignThemePage() {
  await requireRole(["admin", "etablissements_admin", "cafop_admin", "apfc_admin"]);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader
        titre="Design & thème"
        description="Identité visuelle de la plateforme. Cette charte sert de socle ; la personnalisation par établissement / structure sera introduite ultérieurement."
      />

      <Card className="flex flex-col items-start gap-6 bg-gradient-to-br from-forest-800 to-forest-950 sm:flex-row sm:items-center">
        <Logo tone="light" size={56} />
        <p className="text-sm leading-relaxed text-cream-200/85">
          Le blason combine le vert forêt (sérieux institutionnel) et l'or (excellence). Ces deux
          couleurs structurent toute l'interface.
        </p>
      </Card>

      <Card className="space-y-6">
        <h2 className="font-display text-lg font-bold text-forest-900">Palette</h2>
        <Nuancier titre="Vert forêt — couleur de marque" teintes={forest} />
        <Nuancier titre="Or — couleur d'accent" teintes={gold} />
        <Nuancier titre="Crème — fonds clairs" teintes={cream} />
      </Card>

      <Card className="space-y-4">
        <h2 className="font-display text-lg font-bold text-forest-900">Typographie</h2>
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-700/55">
            Titres — Playfair Display
          </p>
          <p className="font-display text-3xl font-bold text-forest-900">
            La gestion scolaire, centralisée.
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-700/55">Corps — Inter</p>
          <p className="text-base text-ink-800">
            Une interface unique, adaptée dynamiquement au rôle de chaque utilisateur connecté.
          </p>
        </div>
      </Card>

      <Card className="space-y-5">
        <h2 className="font-display text-lg font-bold text-forest-900">Composants</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" size="sm">
            Primaire
          </Button>
          <Button variant="gold" size="sm">
            Or
          </Button>
          <Button variant="outline" size="sm">
            Contour
          </Button>
          <Button variant="ghost" size="sm">
            Fantôme
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Neutre</Badge>
          <Badge ton="succes">Succès</Badge>
          <Badge ton="attente">En attente</Badge>
          <Badge ton="refus">Refus</Badge>
        </div>
      </Card>
    </div>
  );
}
