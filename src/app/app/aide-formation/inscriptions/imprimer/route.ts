import { getUtilisateurCourant } from "@/lib/auth/session";
import { chargerListes, dateDuJour } from "../data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ETAB = "EdTeCh EduWeb — Centre de formation";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function GET(req: Request) {
  const u = await getUtilisateurCourant();
  if (!u || u.roleReel !== "admin") {
    return new Response("Accès réservé à l'administrateur.", { status: 403 });
  }
  const url = new URL(req.url);
  const slugs = (url.searchParams.get("cours") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (slugs.length === 0) return new Response("Aucun cours sélectionné.", { status: 400 });

  const listes = await chargerListes(slugs);
  const total = listes.reduce((s, c) => s + c.inscrits.length, 0);

  const sections = listes.map((c) => {
    const rows = c.inscrits.length
      ? c.inscrits.map((i, n) => `<tr><td class="c">${n + 1}</td><td><b>${esc(i.nom)}</b><br><span class="mail">${esc(i.email)}</span></td><td>${esc(i.role)}</td><td>${esc(i.source)}</td><td class="c">${esc(i.date)}</td><td class="c">${i.progression}%</td><td class="c">${esc(i.statut)}</td></tr>`).join("")
      : `<tr><td colspan="7" class="vide">Aucun inscrit à ce cours.</td></tr>`;
    return `<section class="bloc">
      <h2>${esc(c.titre)} <span class="cnt">${c.inscrits.length} inscrit${c.inscrits.length > 1 ? "s" : ""}</span></h2>
      <table>
        <thead><tr><th class="c">#</th><th>Nom et prénoms</th><th>Rôle</th><th>Source</th><th class="c">Inscrit le</th><th class="c">Prog.</th><th class="c">Statut</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>`;
  }).join("");

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Liste des inscrits — ${dateDuJour()}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:'Segoe UI',system-ui,Arial,sans-serif;color:#1a2b22;margin:0;padding:24px;background:#f4f6f4;font-size:13px}
  .feuille{max-width:900px;margin:0 auto;background:#fff;padding:28px 34px;box-shadow:0 1px 8px rgba(0,0,0,.08);border-radius:8px}
  .entete{text-align:center;border-bottom:3px double #14532d;padding-bottom:12px;margin-bottom:16px}
  .entete .org{font-size:18px;font-weight:800;color:#14532d;letter-spacing:.02em}
  .entete .sous{font-size:13px;color:#555;margin-top:2px}
  .entete .meta{font-size:12px;color:#7a8a80;margin-top:6px}
  .barre{display:flex;justify-content:space-between;gap:12px;margin:0 0 16px;flex-wrap:wrap}
  .barre button{font:inherit;font-weight:600;border:1px solid #14532d;background:#14532d;color:#fff;border-radius:999px;padding:8px 18px;cursor:pointer}
  .barre .info{font-size:12px;color:#555;align-self:center}
  h2{font-size:15px;color:#14532d;margin:18px 0 6px;border-left:4px solid #d4b24c;padding-left:8px}
  h2 .cnt{font-weight:normal;font-size:12px;color:#777}
  table{width:100%;border-collapse:collapse;margin-bottom:6px}
  th,td{border:1px solid #d8e2da;padding:5px 7px;text-align:left;vertical-align:top}
  th{background:#eaf3ec;color:#14532d;font-size:11px;text-transform:uppercase;letter-spacing:.03em}
  td.c,th.c{text-align:center}
  .mail{color:#7a8a80;font-size:11px}
  .vide{color:#999;font-style:italic;text-align:center}
  .bloc{break-inside:avoid}
  @media print{
    body{background:#fff;padding:0;font-size:11.5px}
    .feuille{box-shadow:none;border-radius:0;max-width:none;padding:0}
    .barre{display:none !important}
    @page{size:A4;margin:14mm}
  }
</style></head>
<body>
  <div class="feuille">
    <div class="barre">
      <button type="button" onclick="window.print()">Imprimer / Enregistrer en PDF</button>
      <span class="info">Astuce : dans la boîte d'impression, choisissez « Enregistrer en PDF ».</span>
    </div>
    <div class="entete">
      <div class="org">${ETAB}</div>
      <div class="sous">Liste officielle des inscrits aux formations</div>
      <div class="meta">Édité le ${dateDuJour()} — ${total} inscription${total > 1 ? "s" : ""} au total sur ${listes.length} cours</div>
    </div>
    ${sections || "<p class=\"vide\">Aucune donnée.</p>"}
  </div>
  <script>window.addEventListener('load',function(){setTimeout(function(){try{window.print()}catch(e){}},350)});</script>
</body></html>`;

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
