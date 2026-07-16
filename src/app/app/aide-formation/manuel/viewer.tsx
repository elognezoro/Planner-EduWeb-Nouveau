"use client";

import { useRef } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Printer, ListTree } from "lucide-react";

export function ManuelViewer({ reference, version }: { reference: string; version: string }) {
  const cadre = useRef<HTMLIFrameElement>(null);

  function imprimer() {
    const w = cadre.current?.contentWindow;
    if (w) {
      try { w.focus(); w.print(); return; } catch { /* repli ci-dessous */ }
    }
    // Repli : ouvrir l'aperçu dans un nouvel onglet (l'utilisateur imprime manuellement).
    window.open("/app/aide-formation/manuel/apercu", "_blank", "noopener");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {/* Barre d'actions */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-cream-200 bg-white p-3 shadow-soft">
        <Link href="/app/aide-formation/guides" className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-white px-3.5 py-2 text-sm font-semibold text-forest-800 hover:bg-cream-100">
          <ArrowLeft className="h-4 w-4" /> Guides d&apos;utilisateurs
        </Link>
        <div className="min-w-0">
          <h1 className="font-display text-lg font-bold text-forest-900">Manuel du formateur — formation générale</h1>
          <p className="text-xs text-ink-700/55">{reference} · Version {version} · rôle par rôle, corrigés inclus · réservé aux formateurs désignés</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <a href="#doc" className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-white px-3.5 py-2 text-sm font-semibold text-forest-800 hover:bg-cream-100"><ListTree className="h-4 w-4" /> Aller au manuel</a>
          <a href="/app/aide-formation/manuel/word" className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-white px-3.5 py-2 text-sm font-semibold text-forest-800 hover:bg-cream-100"><FileText className="h-4 w-4" /> Télécharger Word (.docx)</a>
          <button type="button" onClick={imprimer} className="inline-flex items-center gap-1.5 rounded-full bg-forest-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-forest-800"><Printer className="h-4 w-4" /> Télécharger PDF</button>
        </div>
      </div>

      {/* Comment télécharger en PDF */}
      <div className="rounded-2xl border border-forest-200 bg-forest-50/40 p-4 text-sm text-ink-700/85">
        <h2 className="mb-2 font-display text-base font-bold text-forest-900">Comment télécharger le manuel au format PDF ?</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Cliquez sur <b>« Télécharger PDF »</b> en haut à droite (ou pressez <kbd className="rounded border border-cream-300 bg-white px-1">Ctrl</kbd> + <kbd className="rounded border border-cream-300 bg-white px-1">P</kbd> dans le document).</li>
          <li>Dans la boîte de dialogue d&apos;impression, choisissez la destination <b>« Enregistrer en PDF »</b>.</li>
          <li>Vérifiez que <b>l&apos;arrière-plan et les images</b> sont activés (« Plus de paramètres » → « Graphiques d&apos;arrière-plan »).</li>
          <li>Choisissez le format <b>A4</b> et lancez l&apos;enregistrement.</li>
        </ol>
        <p className="mt-2 text-xs italic text-ink-700/55">Le manuel est mis en page A4 conforme aux standards académiques. Il est <b>généré automatiquement</b> depuis les rôles réellement disponibles et se met à jour à chaque évolution de la plateforme.</p>
      </div>

      {/* Document (aperçu autonome) */}
      <div id="doc" className="scroll-mt-20 overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-soft">
        <iframe ref={cadre} src="/app/aide-formation/manuel/apercu" title="Manuel académique de formation" className="h-[82vh] w-full border-0 bg-white" />
      </div>
    </div>
  );
}
