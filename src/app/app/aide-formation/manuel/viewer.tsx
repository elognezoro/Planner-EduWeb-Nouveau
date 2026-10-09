"use client";

import { useRef } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Printer, ListTree, BookOpen } from "lucide-react";
import { PublierTitreMobile } from "@/components/app/mobile/publier-titre";
import { useEcranMobile } from "@/lib/mobile/appareil";

const APERCU = "/app/aide-formation/manuel/apercu";

export function ManuelViewer({ reference, version }: { reference: string; version: string }) {
  const cadre = useRef<HTMLIFrameElement>(null);
  // Téléphone : pas d'aperçu A4 imbriqué (document de 820 px lu dans ~325 px, double défilement,
  // impression d'iframe peu fiable sur iOS) — le manuel s'ouvre en plein écran dans un onglet.
  const mobile = useEcranMobile();

  function imprimer() {
    if (mobile) {
      window.open(APERCU, "_blank", "noopener");
      return;
    }
    const w = cadre.current?.contentWindow;
    if (w) {
      try { w.focus(); w.print(); return; } catch { /* repli ci-dessous */ }
    }
    // Repli : ouvrir l'aperçu dans un nouvel onglet (l'utilisateur imprime manuellement).
    window.open("/app/aide-formation/manuel/apercu", "_blank", "noopener");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {/* Cette page n'a pas de PageHeader : elle publie elle-même son titre vers l'en-tête mobile
          (ne rend rien, aucun effet sur ordinateur). */}
      <PublierTitreMobile titre="Manuel du formateur" />
      {/* Barre d'actions */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-cream-200 bg-white p-3 shadow-soft">
        <Link href="/app/aide-formation/guides" className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-white px-3.5 py-2 text-sm font-semibold text-forest-800 hover:bg-cream-100 mobile:hidden">
          <ArrowLeft className="h-4 w-4" /> Guides d&apos;utilisateurs
        </Link>
        <div className="min-w-0">
          <h1 className="font-display text-lg font-bold text-forest-900 mobile:text-base">Manuel du formateur — formation générale</h1>
          <p className="text-xs text-ink-700/55">{reference} · Version {version} · rôle par rôle, corrigés inclus · réservé aux formateurs désignés</p>
        </div>
        {/* Téléphone : Word et PDF côte à côte, sur toute la largeur, libellés courts. */}
        <div className="ml-auto flex flex-wrap gap-2 mobile:ml-0 mobile:grid mobile:w-full mobile:grid-cols-2">
          <a href="#doc" className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-white px-3.5 py-2 text-sm font-semibold text-forest-800 hover:bg-cream-100 mobile:hidden"><ListTree className="h-4 w-4" /> Aller au manuel</a>
          <a href="/app/aide-formation/manuel/word" className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-white px-3.5 py-2 text-sm font-semibold text-forest-800 hover:bg-cream-100 mobile:min-h-11 mobile:justify-center"><FileText className="h-4 w-4" /> <span><span className="mobile:hidden">Télécharger </span>Word (.docx)</span></a>
          <button type="button" onClick={imprimer} className="inline-flex items-center gap-1.5 rounded-full bg-forest-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-forest-800 mobile:min-h-11 mobile:justify-center"><Printer className="h-4 w-4" /> <span><span className="mobile:hidden">Télécharger </span>PDF</span></button>
        </div>
      </div>

      {/* Comment télécharger en PDF */}
      <div className="rounded-2xl border border-forest-200 bg-forest-50/40 p-4 text-sm text-ink-700/85">
        <h2 className="mb-2 font-display text-base font-bold text-forest-900">Comment télécharger le manuel au format PDF ?</h2>
        <ol className="list-decimal space-y-1 pl-5 mobile:hidden">
          <li>Cliquez sur <b>« Télécharger PDF »</b> en haut à droite (ou pressez <kbd className="rounded border border-cream-300 bg-white px-1">Ctrl</kbd> + <kbd className="rounded border border-cream-300 bg-white px-1">P</kbd> dans le document).</li>
          <li>Dans la boîte de dialogue d&apos;impression, choisissez la destination <b>« Enregistrer en PDF »</b>.</li>
          <li>Vérifiez que <b>l&apos;arrière-plan et les images</b> sont activés (« Plus de paramètres » → « Graphiques d&apos;arrière-plan »).</li>
          <li>Choisissez le format <b>A4</b> et lancez l&apos;enregistrement.</li>
        </ol>
        {/* Téléphone : pas de touche Ctrl ni de boîte d'impression de bureau — le chemin du système. */}
        <ol className="hidden list-decimal space-y-1 pl-5 mobile:block print:hidden">
          <li>Touchez <b>« PDF »</b> : le manuel s&apos;ouvre en plein écran dans un nouvel onglet.</li>
          <li>Ouvrez le menu de partage (iPhone) ou le menu <b>⋮</b> (Android), puis <b>« Imprimer »</b>.</li>
          <li>Choisissez <b>« Enregistrer en PDF »</b> (Android) ; sur iPhone, partagez l&apos;aperçu puis <b>« Enregistrer dans Fichiers »</b>.</li>
          <li>Gardez le format <b>A4</b>.</li>
        </ol>
        <p className="mt-2 text-xs italic text-ink-700/55">Le manuel est mis en page A4 conforme aux standards académiques. Il est <b>généré automatiquement</b> depuis les rôles réellement disponibles et se met à jour à chaque évolution de la plateforme.</p>
      </div>

      {/* Téléphone : lecture en plein écran au lieu de l'aperçu A4 imbriqué. Placé AVANT le bloc
          ordinateur, qui reste le dernier enfant du conteneur « space-y ». */}
      <div className="rounded-2xl border border-cream-200 bg-white p-4 shadow-soft lg:hidden print:hidden">
        <p className="text-sm text-ink-700/75">Le manuel est un document A4 : il se lit plus confortablement en plein écran, où vous pouvez zoomer.</p>
        <a href={APERCU} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-forest-800 px-5 text-sm font-semibold text-cream-50 active:bg-forest-700">
          <BookOpen className="h-4 w-4" /> Ouvrir le manuel
        </a>
      </div>

      {/* Document (aperçu autonome) — masqué à l'écran du téléphone (mobile:hidden) mais toujours
          monté : une iframe remontée au moment d'imprimer n'aurait pas le temps de charger le
          manuel, et l'impression depuis un téléphone doit rester identique à HEAD. */}
      <div id="doc" className="scroll-mt-20 overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-soft mobile:hidden">
        <iframe ref={cadre} src="/app/aide-formation/manuel/apercu" title="Manuel académique de formation" className="h-[82vh] w-full border-0 bg-white" />
      </div>
    </div>
  );
}
