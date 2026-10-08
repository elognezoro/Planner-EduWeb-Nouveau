import Link from "next/link";
import { ChevronRight, School } from "lucide-react";
import { IconeLucide } from "@/components/app/icone-lucide";
import type { DonneesAccueilMobile, Raccourci } from "@/lib/mobile/raccourcis";

/**
 * ACCUEIL MOBILE — en tête du tableau de bord, sur téléphone et tablette uniquement.
 *
 * Deux dispositions, d'après la maquette validée et la charte EduWeb (forêt, or, crème) :
 * - « equipe » (personnel) : salutation + avatar, une carte principale, une grille d'outils ;
 * - « famille » (parents, élèves) : bannière de l'établissement, puis une liste d'outils.
 *
 * Masqué au-dessus du seuil mobile (`lg:hidden`) et à l'impression : l'ordinateur garde son
 * tableau de bord, inchangé. Les blocs que cet accueil remplace sont masqués SUR TÉLÉPHONE
 * seulement (classe `masque-ecran-mobile`). Les images sont paresseuses : masquées sur
 * ordinateur, elles n'y sont jamais téléchargées.
 */

/** Teintes des tuiles, en rotation — toutes tirées de la charte EduWeb, avec un contour pour rester lisibles en plein soleil. */
const TONS_TUILE = [
  { fond: "bg-forest-50 ring-forest-100", pastille: "bg-white text-forest-700" },
  { fond: "bg-gold-50 ring-gold-100", pastille: "bg-white text-gold-700" },
  { fond: "bg-cream-100 ring-cream-200", pastille: "bg-white text-forest-800" },
  { fond: "bg-white ring-cream-200", pastille: "bg-forest-50 text-forest-700" },
];
const TONS_ROND = ["bg-forest-50 text-forest-700", "bg-gold-50 text-gold-700", "bg-cream-100 text-forest-800"];

/** Compteur (ex. demandes à traiter) : visuel court, phrase complète pour les lecteurs d'écran. */
function Pastille({ n }: { n?: number }) {
  if (!n) return null;
  return (
    <span className="shrink-0 rounded-full bg-gold-400 px-2 py-0.5 text-xs font-bold text-forest-950 tabular-nums">
      <span aria-hidden>{n > 99 ? "99+" : n}</span>
      <span className="sr-only">, {n} à traiter</span>
    </span>
  );
}

function initiales(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter(Boolean);
  return ((mots[0]?.[0] ?? "") + (mots.length > 1 ? mots[mots.length - 1][0] : "")).toUpperCase() || "·";
}

export interface ContexteAccueil {
  /** Prénom affiché dans la salutation. */
  prenom: string;
  /** Nom complet (initiales de l'avatar). */
  nomComplet: string;
  photoUrl: string | null;
  /** Fonction affichée sous la salutation (ex. « Proviseur », « Enseignant »). */
  fonction: string;
  /** `slogan` : devise OFFICIELLE (celle du pays prime) — aucune devise inventée. */
  etablissement: { nom: string; ville: string | null; logoUrl: string | null; slogan: string | null } | null;
}

export function AccueilMobile({ accueil, contexte }: { accueil: DonneesAccueilMobile; contexte: ContexteAccueil }) {
  return (
    <section aria-labelledby="accueil-mobile-titre" className="space-y-5 lg:hidden print:hidden">
      {accueil.disposition === "famille" ? <Famille accueil={accueil} contexte={contexte} /> : <Equipe accueil={accueil} contexte={contexte} />}
    </section>
  );
}

function Equipe({ accueil, contexte }: { accueil: DonneesAccueilMobile; contexte: ContexteAccueil }) {
  const p = accueil.principal;
  // Tablette : 3 colonnes quand le nombre de tuiles s'y prête (jamais de case orpheline).
  const colonnes = accueil.autres.length % 3 === 0 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2";
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 id="accueil-mobile-titre" className="font-display text-[1.7rem] font-bold leading-tight text-forest-900">
            Bonjour,{" "}
            <span className="block wrap-break-word">{contexte.prenom}</span>
          </h1>
          <p className="mt-1.5 text-sm text-ink-700/75">
            {contexte.fonction}
            {contexte.etablissement && <span className="line-clamp-2 block wrap-break-word">{contexte.etablissement.nom}</span>}
          </p>
        </div>
        <Avatar contexte={contexte} />
      </div>

      {p && (
        <Link
          href={p.href}
          className="relative flex items-center gap-4 overflow-hidden rounded-3xl bg-gradient-to-br from-forest-700 via-forest-800 to-forest-900 p-5 pr-6 text-cream-50 shadow-soft transition-transform active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100"
        >
          <span aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-gold-400/15 blur-2xl" />
          <span className="relative min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="min-w-0 font-display text-xl font-bold wrap-break-word hyphens-auto">{p.libelle}</span>
              <Pastille n={p.badge} />
            </span>
            {p.sousTitre && <span className="mt-1 block text-sm text-cream-100/90">{p.sousTitre}</span>}
          </span>
          <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cream-50/10 text-gold-300">
            <IconeLucide nom={p.icone} size={30} strokeWidth={1.75} />
          </span>
          <ChevronRight aria-hidden size={18} className="absolute bottom-3 right-3 text-cream-50/60" />
        </Link>
      )}

      {accueil.autres.length > 0 && (
        <div>
          <h2 className="sr-only">Vos outils</h2>
          <ul role="list" className={`grid gap-3 ${colonnes}`}>
            {accueil.autres.map((r, i) => (
              <li key={r.id}>
                <Tuile r={r} ton={TONS_TUILE[i % TONS_TUILE.length]} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function Tuile({ r, ton }: { r: Raccourci; ton: (typeof TONS_TUILE)[number] }) {
  return (
    <Link
      href={r.href}
      className={`relative flex h-full min-h-[8.75rem] flex-col justify-between gap-3 rounded-3xl p-4 ring-1 ring-inset transition-transform active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 ${ton.fond}`}
    >
      <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${ton.pastille}`}>
        <IconeLucide nom={r.icone} size={22} />
      </span>
      {/* Chevron dans le coin : la colonne de texte garde toute la largeur de la tuile. */}
      <ChevronRight aria-hidden size={16} className="absolute right-3 top-4 text-ink-700/40" />
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <span className="min-w-0 text-[1.0625rem] font-semibold leading-snug text-forest-900 wrap-break-word hyphens-auto">{r.libelle}</span>
          <Pastille n={r.badge} />
        </span>
        {r.sousTitre && <span className="mt-0.5 block text-xs leading-snug text-ink-700/80 wrap-break-word hyphens-auto">{r.sousTitre}</span>}
      </span>
    </Link>
  );
}

function Famille({ accueil, contexte }: { accueil: DonneesAccueilMobile; contexte: ContexteAccueil }) {
  const e = contexte.etablissement;
  return (
    <>
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-forest-800 via-forest-900 to-forest-950 p-5 text-cream-50 shadow-soft">
        <span aria-hidden className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-gold-400/15 blur-2xl" />
        <span aria-hidden className="pointer-events-none absolute -bottom-20 -left-10 h-44 w-44 rounded-full bg-forest-400/20 blur-2xl" />
        <div className="relative flex items-center gap-3">
          {e?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo téléversé ; paresseux : jamais chargé sur ordinateur, où l'accueil mobile est masqué
            <img src={e.logoUrl} alt="" loading="lazy" decoding="async" className="h-12 w-12 shrink-0 rounded-2xl bg-white object-contain p-1" />
          ) : (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cream-50/10 text-gold-300">
              <School aria-hidden size={24} />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-300">Bonjour, {contexte.prenom}</p>
            <h1 id="accueil-mobile-titre" className="font-display text-lg font-bold leading-snug wrap-break-word">
              {e?.nom ?? "Mon espace"}
            </h1>
          </div>
        </div>
        {e?.slogan ? (
          <>
            <p className="relative mt-6 font-display text-[1.6rem] font-bold leading-tight wrap-break-word">{e.slogan}</p>
            <span aria-hidden className="relative mt-3 block h-1 w-12 rounded-full bg-gold-400" />
          </>
        ) : (
          e?.ville && <p className="relative mt-4 text-sm text-cream-100/90">{e.ville}</p>
        )}
      </div>

      {accueil.autres.length > 0 && (
        <div>
          <h2 className="sr-only">Vos outils</h2>
          <ul role="list" className="space-y-3">
            {accueil.autres.map((r, i) => (
              <li key={r.id}>
                <Link
                  href={r.href}
                  className="flex min-h-[4.75rem] items-center gap-4 rounded-3xl border border-cream-200 bg-white p-4 shadow-soft transition-colors active:bg-cream-50"
                >
                  <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${TONS_ROND[i % TONS_ROND.length]}`}>
                    <IconeLucide nom={r.icone} size={24} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="min-w-0 font-semibold text-forest-900 wrap-break-word">{r.libelle}</span>
                      <Pastille n={r.badge} />
                    </span>
                    {r.sousTitre && <span className="mt-0.5 block text-sm text-ink-700/80">{r.sousTitre}</span>}
                  </span>
                  <ChevronRight aria-hidden size={18} className="shrink-0 text-ink-700/40" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

/** Avatar cliquable : ouvre « Mon profil » (cible tactile de 64 px). */
function Avatar({ contexte }: { contexte: ContexteAccueil }) {
  return (
    <Link href="/app/mon-profil" aria-label="Mon profil" className="shrink-0 rounded-full">
      {contexte.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- photo de profil téléversée ; paresseuse : jamais chargée sur ordinateur
        <img src={contexte.photoUrl} alt="" loading="lazy" decoding="async" className="h-16 w-16 rounded-full object-cover ring-4 ring-forest-50" />
      ) : (
        <span aria-hidden className="flex h-16 w-16 items-center justify-center rounded-full bg-forest-100 font-display text-lg font-bold text-forest-800">
          {initiales(contexte.nomComplet)}
        </span>
      )}
    </Link>
  );
}
