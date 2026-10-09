"use client";

import { useId, useRef, useState, useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight, Coffee, DoorOpen, User, Users } from "lucide-react";

/**
 * EMPLOI DU TEMPS — VUE « JOUR » POUR TÉLÉPHONE.
 *
 * La grille de la semaine (5 à 6 colonnes × 8 à 11 périodes) n'est pas lisible sous 500 px. Ici :
 * des puces de jour (le jour courant par défaut, avec le nombre de cours), puis la journée en
 * cartes chronologiques — heure de début et de fin, discipline (liseré de sa couleur), enseignant
 * / classe et salle selon la vue, groupes simultanés regroupés, pauses et temps libres avec leurs
 * heures, repère « En cours ». On change de jour d'un glissement du doigt sur la liste.
 *
 * Composant d'écran mobile : l'appelant le monte dans un conteneur « lg:hidden print:hidden »
 * FRÈRE de sa grille, et masque la grille par « mobile:hidden » (écran seulement) — l'ordinateur
 * et l'IMPRESSION gardent la grille de la semaine, inchangée.
 */

export interface SeanceJour {
  id: string;
  jour: number;
  periode: number;
  duree: number;
  disciplineId: string;
  disciplineNom: string;
  enseignantNom: string;
  salleNom: string;
  classeNom?: string;
}

/** Ce que la carte affiche en second : la classe consulte ses enseignants ; l'enseignant, ses classes… */
export type VueEdt = "classe" | "enseignant" | "salle";

const sabonnerRien = () => () => {};
/** Minute du jour d'un horaire « 07h15 » / « 7:15 » (null si illisible). */
function minutes(h: string | undefined): number | null {
  const m = h?.match(/(\d{1,2})\s*[h:]\s*(\d{2})/i);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
/** Heure courante en minutes, relue chaque minute (côté client seulement). */
function sabonnerMinute(rappel: () => void) {
  const t = window.setInterval(rappel, 60_000);
  return () => window.clearInterval(t);
}
const maintenant = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};
/** Page agrandie à deux doigts ? (relu à chaque changement d'échelle de la vue visible). */
function sabonnerZoom(rappel: () => void) {
  const vv = window.visualViewport;
  vv?.addEventListener("resize", rappel);
  return () => vv?.removeEventListener("resize", rappel);
}
const estZoome = () => (window.visualViewport?.scale ?? 1) > 1.01;

type Element =
  | { t: "cours"; p: number; fin: number; groupe: SeanceJour[] }
  | { t: "libre"; de: number; a: number }
  | { t: "pause"; apres: number; libelle: string };

export function EdtJourMobile({
  seances,
  jours,
  horaires,
  bandes,
  couleurs,
  vue = "classe",
  creneauxParJour,
}: {
  seances: SeanceJour[];
  jours: string[];
  horaires?: { debut: string; fin: string }[];
  bandes?: { apresPeriode: number; libelle: string }[];
  couleurs: Record<string, string | null>;
  vue?: VueEdt;
  creneauxParJour: number;
}) {
  const idPanneau = useId();
  // Jour courant (lundi = 0) lu côté client SEULEMENT : le serveur ne connaît pas la date de
  // l'appareil — pas d'écart d'hydratation, le premier jour s'affiche le temps d'un rendu.
  const aujourdHui = useSyncExternalStore(
    sabonnerRien,
    () => {
      const j = new Date().getDay() - 1;
      return j >= 0 && j < jours.length ? j : null;
    },
    () => null,
  );
  const minuteCourante = useSyncExternalStore(sabonnerMinute, maintenant, () => null);
  // Instantané serveur à false : aucun écart d'hydratation.
  const zoome = useSyncExternalStore(sabonnerZoom, estZoome, () => false);
  const [choisi, setChoisi] = useState<number | null>(null);
  const jour = choisi ?? aujourdHui ?? 0;
  const debutGlisse = useRef<{ x: number; y: number } | null>(null);

  const nbParJour = jours.map((_, j) => new Set(seances.filter((s) => s.jour === j).map((s) => s.periode)).size);
  const changer = (delta: number) => setChoisi(Math.min(jours.length - 1, Math.max(0, jour + delta)));
  const heure = (p: number, cote: "debut" | "fin") => horaires?.[p]?.[cote] ?? (cote === "debut" ? `P${p + 1}` : "");

  // ── Déroulé de la journée : cours, temps libres (périodes vides fusionnées), pauses ──
  const duJour = seances.filter((s) => s.jour === jour).sort((a, b) => a.periode - b.periode);
  const N = Math.max(1, creneauxParJour, ...duJour.map((s) => s.periode + s.duree));
  const premier = duJour.length ? duJour[0].periode : 0;
  const dernier = duJour.length ? Math.max(...duJour.map((s) => s.periode + s.duree - 1)) : -1;
  const deroule: Element[] = [];
  let libreDepuis: number | null = null;
  const fermerLibre = (jusqua: number) => {
    if (libreDepuis !== null) deroule.push({ t: "libre", de: libreDepuis, a: jusqua });
    libreDepuis = null;
  };
  const pausesApres = (p: number) => (bandes ?? []).filter((b) => b.apresPeriode === p && p >= premier && p < dernier);
  for (let p = 0; p < N; p++) {
    const debutant = duJour.filter((s) => s.periode === p);
    if (debutant.length) {
      fermerLibre(p - 1);
      // Bloc de cours : tous les groupes qui démarrent ICI, plus ceux qui démarrent PENDANT le
      // bloc (groupes de durées décalées) — aucune séance ne peut disparaître de la liste.
      const groupe = [...debutant];
      let fin = p + Math.max(...debutant.map((g) => g.duree)) - 1;
      for (let q = p + 1; q <= fin; q++) {
        for (const s of duJour.filter((x) => x.periode === q)) {
          groupe.push(s);
          fin = Math.max(fin, s.periode + s.duree - 1);
        }
      }
      deroule.push({ t: "cours", p, fin, groupe });
      for (let q = p; q < fin; q++) for (const b of pausesApres(q)) deroule.push({ t: "pause", apres: b.apresPeriode, libelle: b.libelle });
      p = fin;
    } else if (p >= premier && p <= dernier && libreDepuis === null) {
      libreDepuis = p;
    }
    const pauses = pausesApres(p);
    if (pauses.length) fermerLibre(p);
    for (const b of pauses) deroule.push({ t: "pause", apres: b.apresPeriode, libelle: b.libelle });
  }

  const estEnCours = (el: Extract<Element, { t: "cours" }>) => {
    if (aujourdHui !== jour || minuteCourante === null) return false;
    const d = minutes(horaires?.[el.p]?.debut);
    const f = minutes(horaires?.[el.fin]?.fin);
    return d !== null && f !== null && minuteCourante >= d && minuteCourante < f;
  };

  return (
    <div>
      {/* Puces de jour : toujours sur la largeur disponible (5 ou 6 colonnes égales). */}
      <div
        role="tablist"
        aria-label="Jour de la semaine"
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${jours.length}, minmax(0, 1fr))` }}
      >
        {jours.map((libelle, j) => {
          const actif = j === jour;
          return (
            <button
              key={libelle}
              type="button"
              role="tab"
              aria-selected={actif}
              aria-controls={idPanneau}
              aria-label={`${libelle}, ${nbParJour[j]} cours${aujourdHui === j ? ", aujourd'hui" : ""}`}
              onClick={() => setChoisi(j)}
              className={`relative flex min-h-14 min-w-0 flex-col items-center justify-center rounded-2xl px-1 py-1.5 transition-colors ${
                actif ? "bg-forest-800 text-cream-50" : "bg-white text-forest-900 ring-1 ring-inset ring-cream-200 active:bg-cream-100"
              }`}
            >
              <span className="text-sm font-bold">{libelle.slice(0, 3)}</span>
              <span className={`text-xs tabular-nums ${actif ? "text-gold-300" : "text-ink-700/70"}`}>{nbParJour[j]}</span>
              {aujourdHui === j && <span aria-hidden className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-gold-400" />}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => changer(-1)}
          disabled={jour === 0}
          aria-label="Jour précédent"
          className="flex h-11 w-11 items-center justify-center rounded-full text-forest-800 active:bg-cream-100 disabled:opacity-30"
        >
          <ChevronLeft size={22} />
        </button>
        <h3 className="font-display text-lg font-bold text-forest-900" aria-live="polite">
          {jours[jour]}
          {aujourdHui === jour && <span className="ml-2 rounded-full bg-gold-100 px-2 py-0.5 align-middle text-xs font-semibold text-gold-800">Aujourd&apos;hui</span>}
        </h3>
        <button
          type="button"
          onClick={() => changer(1)}
          disabled={jour === jours.length - 1}
          aria-label="Jour suivant"
          className="flex h-11 w-11 items-center justify-center rounded-full text-forest-800 active:bg-cream-100 disabled:opacity-30"
        >
          <ChevronRight size={22} />
        </button>
      </div>

      {/* Panneau du jour : le glissement horizontal change de jour ; le défilement vertical et le
          zoom à deux doigts restent libres (un geste à plusieurs doigts n'est jamais un glissement).
          Page agrandie : le doigt déplace la vue dans tous les sens et ne change plus de jour.
          e.touches compte tous les doigts posés, même hors du panneau (second doigt d'un pincement). */}
      <div
        id={idPanneau}
        role="tabpanel"
        style={{ touchAction: zoome ? "pan-x pan-y pinch-zoom" : "pan-y pinch-zoom" }}
        onTouchStart={(e) => (debutGlisse.current = e.touches.length === 1 && !estZoome() ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null)}
        onTouchMove={(e) => {
          if (e.touches.length > 1) debutGlisse.current = null;
        }}
        onTouchEnd={(e) => {
          const d = debutGlisse.current;
          debutGlisse.current = null;
          if (!d) return;
          const dx = e.changedTouches[0].clientX - d.x;
          const dy = e.changedTouches[0].clientY - d.y;
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) changer(dx < 0 ? 1 : -1);
        }}
      >
        {duJour.length === 0 ? (
          <p className="mt-3 rounded-3xl bg-cream-50 px-4 py-10 text-center text-sm text-ink-700/70 ring-1 ring-inset ring-cream-200">
            Aucun cours ce jour.
          </p>
        ) : (
          <ol className="mt-3 space-y-2.5">
            {deroule.map((el, i) => {
              if (el.t === "pause") {
                const de = horaires?.[el.apres]?.fin;
                const a = horaires?.[el.apres + 1]?.debut;
                return (
                  <li key={`pause-${i}`} className="flex items-center gap-2 py-1 text-xs font-bold uppercase tracking-[0.15em] text-gold-800">
                    <Coffee aria-hidden size={14} className="shrink-0" />
                    <span>{el.libelle}</span>
                    {de && a && <span className="font-semibold normal-case tracking-normal tabular-nums">{de} – {a}</span>}
                    <span aria-hidden className="h-px flex-1 bg-gold-200" />
                  </li>
                );
              }
              if (el.t === "libre") {
                return (
                  <li key={`libre-${i}`} className="flex items-center gap-3 rounded-2xl border border-dashed border-cream-300 px-3 py-2 text-xs text-ink-700/70">
                    <span className="shrink-0 tabular-nums">
                      {heure(el.de, "debut")}
                      {horaires?.[el.a]?.fin ? ` – ${horaires[el.a].fin}` : ""}
                    </span>
                    Libre
                  </li>
                );
              }
              const enCours = estEnCours(el);
              return (
                <li key={`cours-${el.p}`} className="flex gap-3">
                  <div className="w-[4.25rem] shrink-0 pt-2.5 text-right tabular-nums">
                    <p className="text-sm font-bold text-forest-900">{heure(el.p, "debut")}</p>
                    <p className="text-xs text-ink-700/70">{heure(el.fin, "fin")}</p>
                  </div>
                  <div className={`min-w-0 flex-1 space-y-2 rounded-2xl bg-white p-3 shadow-soft ring-inset ${enCours ? "ring-2 ring-gold-400" : "ring-1 ring-cream-200"}`}>
                    {(enCours || el.groupe.length > 1) && (
                      <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                        {enCours && <span className="rounded-full bg-gold-400 px-2 py-0.5 text-forest-950">En cours</span>}
                        {el.groupe.length > 1 && <span className="text-gold-800">{el.groupe.length} groupes simultanés</span>}
                      </p>
                    )}
                    {el.groupe.map((g) => (
                      <div key={g.id} className="border-l-4 pl-2.5" style={{ borderColor: couleurs[g.disciplineId] ?? "#154231" }}>
                        <p className="font-semibold leading-snug text-forest-900 wrap-break-word">{g.disciplineNom}</p>
                        <p className="mt-0.5 flex items-start gap-1.5 text-sm text-ink-700/80">
                          {vue === "enseignant" ? <Users aria-hidden size={15} className="mt-0.5 shrink-0" /> : <User aria-hidden size={15} className="mt-0.5 shrink-0" />}
                          <span className="min-w-0 wrap-break-word">
                            {vue === "enseignant" ? g.classeNom ?? "" : vue === "salle" ? [g.classeNom, g.enseignantNom].filter(Boolean).join(" · ") : g.enseignantNom}
                          </span>
                        </p>
                        {vue !== "salle" && (
                          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-700/80">
                            <DoorOpen aria-hidden size={15} className="shrink-0" />
                            {g.salleNom}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
