import { cn } from "@/lib/utils";

export function PageHeader({
  titre,
  description,
  action,
}: {
  titre: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-bold text-forest-900 sm:text-3xl">{titre}</h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm text-ink-700/70">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-cream-200 bg-white p-6 shadow-soft",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function StatCard({
  libelle,
  valeur,
  icone,
  ton = "forest",
}: {
  libelle: string;
  valeur: React.ReactNode;
  icone?: React.ReactNode;
  ton?: "forest" | "gold";
}) {
  return (
    <Card className="flex items-center gap-4">
      {icone && (
        <span
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
            ton === "gold" ? "bg-gold-100 text-gold-700" : "bg-forest-50 text-forest-700",
          )}
        >
          {icone}
        </span>
      )}
      <div>
        <p className="font-display text-2xl font-bold text-forest-900">{valeur}</p>
        <p className="text-xs text-ink-700/65">{libelle}</p>
      </div>
    </Card>
  );
}

export function Badge({
  children,
  ton = "neutre",
}: {
  children: React.ReactNode;
  ton?: "neutre" | "succes" | "attente" | "refus";
}) {
  const tons: Record<string, string> = {
    neutre: "bg-cream-200 text-forest-800",
    succes: "bg-forest-100 text-forest-800",
    attente: "bg-gold-100 text-gold-800",
    refus: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tons[ton],
      )}
    >
      {children}
    </span>
  );
}

/** Bloc « module à venir » pour les pages non encore développées (projet évolutif). */
export function AVenir({
  titre,
  phase,
  description,
}: {
  titre: string;
  phase?: number;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-cream-300 bg-cream-50 px-6 py-16 text-center">
      <span className="rounded-full bg-gold-100 px-3 py-1 text-xs font-semibold text-gold-800">
        {phase ? `Prévu en phase ${phase}` : "Bientôt disponible"}
      </span>
      <h2 className="mt-4 font-display text-xl font-bold text-forest-900">{titre}</h2>
      {description && (
        <p className="mt-2 max-w-md text-sm text-ink-700/70">{description}</p>
      )}
    </div>
  );
}
