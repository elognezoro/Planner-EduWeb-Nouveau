import { cn } from "@/lib/utils";
import { PublierTitreMobile } from "@/components/app/mobile/publier-titre";
import { TexteRepliableMobile } from "@/components/app/texte-repliable-mobile";

export function PageHeader({
  titre,
  description,
  action,
  className,
  titreMobile,
  titreVisibleMobile = false,
}: {
  titre: string;
  description?: string;
  action?: React.ReactNode;
  /** Classes supplémentaires (ex. « masque-ecran-mobile » quand la page a son propre en-tête mobile). */
  className?: string;
  /** Titre de l'en-tête MOBILE, s'il doit différer du titre de la page (ex. « Accueil »). */
  titreMobile?: string;
  /** Téléphone : garde le <h1> VISIBLE (en plus petit) sous l'en-tête de la coquille, qui tronque
   *  les titres longs sur une ligne (titre de cours, de sujet de forum, de page wiki…). À associer
   *  de préférence à un « titreMobile » court. Sans effet sur ordinateur ni à l'impression. */
  titreVisibleMobile?: boolean;
}) {
  return (
    <div className={cn("mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mobile:mb-4", className)}>
      {/* Publie le titre vers l'en-tête mobile — ne rend rien, aucun effet sur ordinateur. */}
      <PublierTitreMobile titre={titreMobile ?? titre} />
      <div>
        {/* Sur téléphone, le titre est déjà porté par l'en-tête de la coquille : on l'y masque
            VISUELLEMENT pour ne pas l'afficher deux fois, tout en le laissant aux lecteurs
            d'écran (le <h1> reste le titre de la page). Inchangé sur ordinateur.
            Exception « titreVisibleMobile » : titre long, lu en entier sur téléphone. */}
        <h1
          className={
            titreVisibleMobile
              ? "font-display text-2xl font-bold text-forest-900 sm:text-3xl mobile:text-xl mobile:leading-snug mobile:[overflow-wrap:anywhere]"
              : "titre-page-ecran-mobile font-display text-2xl font-bold text-forest-900 sm:text-3xl"
          }
        >
          {titre}
        </h1>
        {/* Téléphone : description limitée à 3 lignes, « Lire la suite » si elle dépasse. */}
        {description && (
          <TexteRepliableMobile className="mt-1.5 max-w-2xl text-sm text-ink-700/70 mobile:[overflow-wrap:anywhere]">{description}</TexteRepliableMobile>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** L'appelant impose-t-il son propre padding (p-0, px-4, py-14, sm:p-8, mobile:p-2…) ? */
const PADDING_IMPOSE = /(^|[\s:])p[xytblrse]?-/;
/** … ou son propre arrondi (rounded-2xl, rounded-none, mobile:rounded-xl…) ? */
const ARRONDI_IMPOSE = /(^|[\s:])rounded(-|\s|$)/;

export function Card({
  className,
  children,
  id,
}: {
  className?: string;
  children: React.ReactNode;
  /** Ancre HTML (cible de défilement, ex. « demande-<id> » sur la page Approbations). */
  id?: string;
}) {
  return (
    <div
      id={id}
      className={cn(
        "rounded-3xl border border-cream-200 bg-white p-6 shadow-soft",
        // Téléphone : marges internes de 16 px (au lieu de 24) et arrondi resserré — 16 px de
        // largeur utile en plus pour chaque tableau, liste ou graphique. Uniquement quand
        // l'appelant n'impose pas les siens : tailwind-merge ne départage pas « mobile:p-4 » et
        // un « p-0 » / « py-14 » passé en className (listes divide-y, états vides…).
        !(className && PADDING_IMPOSE.test(className)) && "mobile:p-4",
        !(className && ARRONDI_IMPOSE.test(className)) && "mobile:rounded-2xl",
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
  className,
}: {
  libelle: string;
  valeur: React.ReactNode;
  icone?: React.ReactNode;
  ton?: "forest" | "gold";
  /** Classes supplémentaires de la carte (ex. « mobile:col-span-2 » pour une tuile pleine largeur). */
  className?: string;
}) {
  // Téléphone : tuile compacte, qui s'adapte à la LARGEUR DE SA COLONNE (la carte est un
  // conteneur de requêtes, « mobile:@container ») :
  //  - colonne large (grille à 1 colonne, tablette) : icône à gauche, chiffre et libellé à droite ;
  //  - colonne étroite (grille de 2 ou 3 sur téléphone) : le texte passe SOUS l'icône ;
  //  - colonne très étroite (3 par rangée) : l'icône s'efface, chiffre et libellé seuls.
  // Ordinateur et impression : rendu inchangé (toutes ces classes sont « mobile: »).
  return (
    <Card
      className={cn(
        "flex items-center gap-4",
        "mobile:@container mobile:flex-wrap mobile:content-start mobile:gap-x-3 mobile:gap-y-2 mobile:rounded-2xl mobile:p-4",
        className,
      )}
    >
      {icone && (
        <span
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
            "mobile:h-9 mobile:w-9 mobile:rounded-xl mobile:@max-[6.5rem]:hidden",
            ton === "gold" ? "bg-gold-100 text-gold-700" : "bg-forest-50 text-forest-700",
          )}
        >
          {icone}
        </span>
      )}
      <div className="mobile:min-w-0 mobile:flex-1 mobile:@max-[12rem]:basis-full">
        <p className="font-display text-2xl font-bold text-forest-900 mobile:text-xl mobile:leading-tight mobile:[overflow-wrap:anywhere]">{valeur}</p>
        <p className="text-xs text-ink-700/65 mobile:mt-0.5 mobile:leading-snug">{libelle}</p>
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
