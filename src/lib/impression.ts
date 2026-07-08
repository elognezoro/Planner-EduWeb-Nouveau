// Impression d'un document HTML autonome dans une iframe cachée (même origine) : aucune fenêtre
// pop-up (jamais bloquée), seul le contenu de l'iframe s'imprime. Le nettoyage est piloté par le
// cycle d'impression (afterprint + focus fenêtre), jamais par un délai fixe qui viderait l'aperçu
// sur Safari/Firefox ; un filet de sécurité retire l'iframe après 60 s si rien ne se déclenche.
export function imprimerDocument(html: string): void {
  if (typeof window === "undefined") return;
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;left:-9999px;top:0;width:0;height:0;border:0;";
  iframe.srcdoc = html;

  let nettoye = false;
  const nettoyer = () => {
    if (nettoye) return;
    nettoye = true;
    window.removeEventListener("focus", nettoyer);
    window.clearTimeout(secours);
    iframe.remove();
  };
  const secours = window.setTimeout(nettoyer, 60000);

  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) {
      nettoyer();
      return;
    }
    win.onafterprint = nettoyer;
    window.addEventListener("focus", nettoyer, { once: true });
    win.focus();
    win.print();
  };

  document.body.appendChild(iframe);
}
