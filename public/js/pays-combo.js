/*
 * Composant réutilisable : transforme tout <input data-satfield="pays"> en liste
 * déroulante de recherche des pays de l'ONU, avec drapeau en couleur.
 * Autonome (CSS injecté, aucune dépendance). Données : /data/pays-onu.json.
 * S'inclut via <script src="/js/pays-combo.js" defer></script>.
 */
(function () {
  "use strict";
  var URL_JSON = "/data/pays-onu.json";
  var flagUrl = function (code) { return "https://flagcdn.com/w40/" + code + ".png"; };
  var pays = null;

  var CSS = [
    ".pays-combo{position:relative;width:100%}",
    ".pays-combo .pays-input{width:100%}",
    ".pays-combo .pays-input.has-flag{padding-left:44px}",
    ".pays-combo .pays-flag{position:absolute;left:12px;top:50%;transform:translateY(-50%);width:24px;height:auto;border:1px solid rgba(0,0,0,.12);border-radius:2px;z-index:2;pointer-events:none}",
    ".pays-drop{position:absolute;left:0;right:0;top:calc(100% + 4px);max-height:280px;overflow-y:auto;background:#fff;border:1px solid #d8e2da;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.14);z-index:60;padding:4px}",
    ".pays-opt{display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;border:0;background:none;font-family:inherit;font-size:15px;color:#1a2a22;cursor:pointer;text-align:left;border-radius:7px}",
    ".pays-opt:hover,.pays-opt.actif{background:#eef4ef}",
    ".pays-opt img{width:24px;height:auto;border:1px solid rgba(0,0,0,.12);border-radius:2px;flex:none}",
    ".pays-opt span{min-width:0;flex:1}",
    ".pays-info{padding:10px 12px;font-size:15px;color:#7a8a80}",
  ].join("\n");

  function injecterCss() {
    if (document.getElementById("pays-combo-css")) return;
    var s = document.createElement("style");
    s.id = "pays-combo-css";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function norm(s) {
    return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function upgrade(input) {
    if (input.dataset.paysCombo) return;
    input.dataset.paysCombo = "1";
    input.setAttribute("autocomplete", "off");
    input.setAttribute("role", "combobox");

    var wrap = document.createElement("div");
    wrap.className = "pays-combo";
    input.parentNode.insertBefore(wrap, input);

    var flag = document.createElement("img");
    flag.className = "pays-flag";
    flag.alt = "";
    flag.hidden = true;
    wrap.appendChild(flag);

    input.classList.add("pays-input");
    wrap.appendChild(input);

    var drop = document.createElement("div");
    drop.className = "pays-drop";
    drop.hidden = true;
    wrap.appendChild(drop);

    if (!input.placeholder) input.placeholder = "Rechercher un pays…";

    var items = [], idx = -1;

    function poserDrapeau(p) {
      if (p) { flag.src = flagUrl(p.code); flag.hidden = false; input.classList.add("has-flag"); }
      else { flag.hidden = true; input.classList.remove("has-flag"); }
    }
    function choisir(p) { input.value = p.nom; poserDrapeau(p); fermer(); }
    function fermer() { drop.hidden = true; idx = -1; }
    function maj() {
      var opts = drop.querySelectorAll(".pays-opt");
      opts.forEach(function (o, i) { o.classList.toggle("actif", i === idx); });
      if (opts[idx]) opts[idx].scrollIntoView({ block: "nearest" });
    }
    function rendre() {
      if (!pays) { drop.innerHTML = '<div class="pays-info">Chargement des pays…</div>'; drop.hidden = false; return; }
      var q = norm(input.value);
      items = (q ? pays.filter(function (p) { return norm(p.nom).indexOf(q) !== -1; }) : pays).slice(0, 60);
      drop.innerHTML = items.length
        ? items.map(function (p, i) {
            return '<button type="button" class="pays-opt" data-i="' + i + '"><img src="' + flagUrl(p.code) + '" alt="" loading="lazy"><span>' + esc(p.nom) + "</span></button>";
          }).join("")
        : '<div class="pays-info">Aucun pays trouvé.</div>';
      idx = -1;
      drop.hidden = false;
    }

    input.addEventListener("focus", rendre);
    input.addEventListener("input", function () { poserDrapeau(null); rendre(); });
    input.addEventListener("keydown", function (e) {
      if (drop.hidden) { if (e.key === "ArrowDown") { rendre(); } return; }
      if (e.key === "ArrowDown") { e.preventDefault(); idx = Math.min(idx + 1, items.length - 1); maj(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); idx = Math.max(idx - 1, 0); maj(); }
      else if (e.key === "Enter") { if (idx >= 0 && items[idx]) { e.preventDefault(); choisir(items[idx]); } }
      else if (e.key === "Escape") { fermer(); }
    });
    // mousedown (avant blur) pour capter le clic sur une option.
    drop.addEventListener("mousedown", function (e) {
      var b = e.target.closest(".pays-opt");
      if (!b) return;
      e.preventDefault();
      var i = parseInt(b.getAttribute("data-i"), 10);
      if (items[i]) choisir(items[i]);
    });
    document.addEventListener("click", function (e) { if (!wrap.contains(e.target)) fermer(); });
  }

  function init() {
    var champs = document.querySelectorAll('input[data-satfield="pays"]');
    if (!champs.length) return;
    injecterCss();
    fetch(URL_JSON).then(function (r) { return r.ok ? r.json() : []; }).then(function (d) { pays = d || []; }).catch(function () { pays = []; });
    champs.forEach(upgrade);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
