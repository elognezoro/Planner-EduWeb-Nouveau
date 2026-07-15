"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  CalendarRange,
  Clock4,
  Filter,
  Loader2,
  MessageSquareReply,
  Search,
  Send,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { Card, Badge } from "@/components/app/ui";
import { RowActions } from "./row-actions";
import { EchangeDemande, type EchangeVue } from "./echange-demande";
import { envoyerMessageGroupe } from "./actions";

export type ItemDemande = {
  id: string;
  nomComplet: string;
  email: string;
  paysNom: string | null;
  paysDrapeau: string | null;
  roleLibelle: string;
  structureDeclaree: string | null;
  dateFr: string;
  creeLeISO: string;
  derniereActiviteISO: string;
  dernierMessageDe: "demandeur" | "habilite" | "aucun";
  libellePortee?: string;
  rechercheEtablissement: boolean;
  options: { id: string; nom: string }[];
  suggestion: { id: string; nom: string; score: number } | null;
  /** Périmètre pré-rempli (pays déjà déclaré par le demandeur) — modifiable. */
  defautPerimetre: { id: string; nom: string } | null;
  echanges: EchangeVue[];
};

const champ =
  "h-11 rounded-full border border-cream-300 bg-white px-4 text-sm text-forest-900 outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";
const champSelect = `${champ} pr-8`;

type Tri = "recentes" | "anciennes" | "activite";
type Etat = "" | "aucun" | "attente" | "repondu";

export function ApprobationsBoard({ items }: { items: ItemDemande[] }) {
  const router = useRouter();
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [texte, setTexte] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, start] = useTransition();

  // ---- Filtres ----
  const [q, setQ] = useState("");
  const [pays, setPays] = useState("");
  const [role, setRole] = useState("");
  const [etat, setEtat] = useState<Etat>("");
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [tri, setTri] = useState<Tri>("recentes");

  const paysDispo = useMemo(
    () => [...new Set(items.map((i) => i.paysNom).filter((p): p is string => Boolean(p)))].sort((a, b) => a.localeCompare(b, "fr")),
    [items],
  );
  const rolesDispo = useMemo(
    () => [...new Set(items.map((i) => i.roleLibelle))].sort((a, b) => a.localeCompare(b, "fr")),
    [items],
  );

  const itemsFiltres = useMemo(() => {
    const s = q.trim().toLowerCase();
    const res = items.filter((i) => {
      if (s && !`${i.nomComplet} ${i.email} ${i.structureDeclaree ?? ""}`.toLowerCase().includes(s)) return false;
      if (pays && i.paysNom !== pays) return false;
      if (role && i.roleLibelle !== role) return false;
      if (etat === "aucun" && i.dernierMessageDe !== "aucun") return false;
      if (etat === "attente" && i.dernierMessageDe !== "habilite") return false;
      if (etat === "repondu" && i.dernierMessageDe !== "demandeur") return false;
      const jour = i.creeLeISO.slice(0, 10);
      if (du && jour < du) return false;
      if (au && jour > au) return false;
      return true;
    });
    if (tri === "recentes") res.sort((a, b) => b.creeLeISO.localeCompare(a.creeLeISO));
    else if (tri === "anciennes") res.sort((a, b) => a.creeLeISO.localeCompare(b.creeLeISO));
    else res.sort((a, b) => b.derniereActiviteISO.localeCompare(a.derniereActiviteISO));
    return res;
  }, [items, q, pays, role, etat, du, au, tri]);

  const filtreActif = Boolean(q || pays || role || etat || du || au);
  const reinitialiser = () => {
    setQ("");
    setPays("");
    setRole("");
    setEtat("");
    setDu("");
    setAu("");
    setTri("recentes");
  };

  // ---- Sélection (portée aux résultats filtrés) ----
  const idsFiltres = useMemo(() => itemsFiltres.map((i) => i.id), [itemsFiltres]);
  const toutSelectionne = idsFiltres.length > 0 && idsFiltres.every((id) => selection.has(id));
  const basculer = (id: string) =>
    setSelection((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toutBasculer = () =>
    setSelection((s) => {
      const n = new Set(s);
      if (idsFiltres.every((id) => n.has(id))) idsFiltres.forEach((id) => n.delete(id));
      else idsFiltres.forEach((id) => n.add(id));
      return n;
    });

  const envoyerGroupe = () => {
    const t = texte.trim();
    if (!t || selection.size === 0 || envoi) return;
    setErreur(null);
    start(async () => {
      const r = await envoyerMessageGroupe([...selection], t);
      if (r.ok) {
        setTexte("");
        setSelection(new Set());
        router.refresh();
      } else setErreur(r.message ?? "Envoi impossible.");
    });
  };

  return (
    <div className="space-y-4">
      {/* Barre de filtres */}
      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-ink-700/55">
            <SlidersHorizontal size={14} /> Filtres
          </span>
          <span className="text-xs text-ink-700/55">
            {itemsFiltres.length} demande{itemsFiltres.length > 1 ? "s" : ""}
            {filtreActif ? ` sur ${items.length}` : ""}
          </span>
        </div>

        {/* Recherche par nom / e-mail / structure */}
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-700/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher par nom, e-mail ou structure…"
            aria-label="Rechercher une demande"
            className={`${champ} w-full pl-10 pr-9`}
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Effacer la recherche"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-700/45 hover:bg-cream-100 hover:text-ink-700/70"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Listes : pays, rôle, état de l'échange, tri */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select value={pays} onChange={(e) => setPays(e.target.value)} className={champSelect} aria-label="Filtrer par pays">
            <option value="">Tous les pays</option>
            {paysDispo.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select value={role} onChange={(e) => setRole(e.target.value)} className={champSelect} aria-label="Filtrer par rôle">
            <option value="">Tous les rôles</option>
            {rolesDispo.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select value={etat} onChange={(e) => setEtat(e.target.value as Etat)} className={champSelect} aria-label="Filtrer par état de l'échange">
            <option value="">Tous les échanges</option>
            <option value="aucun">Sans échange</option>
            <option value="repondu">Réponse du demandeur reçue</option>
            <option value="attente">En attente du demandeur</option>
          </select>
          <select value={tri} onChange={(e) => setTri(e.target.value as Tri)} className={champSelect} aria-label="Trier">
            <option value="recentes">Demandes les plus récentes</option>
            <option value="anciennes">Demandes les plus anciennes</option>
            <option value="activite">Dernière activité d&apos;échange</option>
          </select>
        </div>

        {/* Période (date de demande) + réinitialisation */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2 rounded-full border border-cream-300 bg-white px-3 text-sm text-forest-900">
            <CalendarRange size={15} className="shrink-0 text-ink-700/40" />
            <input
              type="date"
              value={du}
              max={au || undefined}
              onChange={(e) => setDu(e.target.value)}
              aria-label="Demandes à partir du"
              className="h-11 min-w-0 flex-1 bg-transparent outline-none"
            />
            <span className="shrink-0 text-ink-700/40">→</span>
            <input
              type="date"
              value={au}
              min={du || undefined}
              onChange={(e) => setAu(e.target.value)}
              aria-label="Demandes jusqu'au"
              className="h-11 min-w-0 flex-1 bg-transparent outline-none"
            />
          </div>
          {filtreActif && (
            <button
              type="button"
              onClick={reinitialiser}
              className="inline-flex h-9 shrink-0 items-center gap-1 self-start rounded-full border border-cream-300 px-3 text-xs font-medium text-ink-700/60 hover:bg-red-50 hover:text-red-600 sm:self-auto"
            >
              <X size={13} /> Réinitialiser
            </button>
          )}
        </div>
      </Card>

      {/* Barre de sélection / message groupé */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cream-200 bg-cream-50/60 px-4 py-2.5">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-forest-800">
          <input
            type="checkbox"
            checked={toutSelectionne}
            onChange={toutBasculer}
            disabled={idsFiltres.length === 0}
            className="h-4 w-4 rounded border-cream-300"
          />
          {selection.size > 0 ? `${selection.size} sélectionnée(s)` : "Tout sélectionner"}
        </label>
        {selection.size > 0 && (
          <button type="button" onClick={() => setSelection(new Set())} className="inline-flex items-center gap-1 text-xs font-medium text-ink-700/60 hover:text-ink-800">
            <X size={14} /> Effacer la sélection
          </button>
        )}
      </div>

      {selection.size > 0 && (
        <Card className="space-y-3 border-forest-200 bg-forest-50/50">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-forest-900">
            <Users size={16} /> Message groupé à {selection.size} demandeur(s)
          </p>
          <textarea
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            rows={3}
            placeholder="Votre message (par ex. précisions demandées avant validation)…"
            className="w-full resize-none rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
          />
          {erreur && <p className="text-xs font-medium text-amber-700">{erreur}</p>}
          <div className="flex items-center justify-between gap-2">
            <p className="text-[0.65rem] text-ink-700/45">Chaque demandeur reçoit le message par e-mail ; copie à l&apos;administration.</p>
            <button
              type="button"
              onClick={envoyerGroupe}
              disabled={envoi || !texte.trim()}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-forest-800 px-5 text-sm font-semibold text-cream-50 hover:bg-forest-700 disabled:opacity-50"
            >
              {envoi ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              Envoyer à {selection.size}
            </button>
          </div>
        </Card>
      )}

      {/* Cartes de demandes */}
      {itemsFiltres.length === 0 ? (
        <Card className="flex flex-col items-center py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cream-100 text-ink-700/50">
            <Filter size={22} />
          </span>
          <p className="mt-3 text-sm text-ink-700/70">Aucune demande ne correspond aux filtres.</p>
          <button type="button" onClick={reinitialiser} className="mt-2 text-xs font-semibold text-forest-700 hover:underline">
            Réinitialiser les filtres
          </button>
        </Card>
      ) : (
        <div className="space-y-4">
          {itemsFiltres.map((d) => (
            <Card key={d.id} className={`flex flex-col gap-4 ${selection.has(d.id) ? "ring-1 ring-forest-300" : ""}`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-3">
                  <input
                    type="checkbox"
                    checked={selection.has(d.id)}
                    onChange={() => basculer(d.id)}
                    aria-label={`Sélectionner ${d.nomComplet}`}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-cream-300"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {d.paysNom && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-cream-200 bg-cream-50 px-2 py-0.5 text-xs font-medium text-ink-700/80" title={`Pays : ${d.paysNom}`}>
                          {d.paysDrapeau && (
                            <Image src={d.paysDrapeau} alt="" width={20} height={14} className="h-3.5 w-5 rounded-[3px] object-cover" unoptimized />
                          )}
                          {d.paysNom}
                        </span>
                      )}
                      <p className="font-semibold text-forest-900">{d.nomComplet}</p>
                      <Badge ton="attente">{d.roleLibelle}</Badge>
                      {d.dernierMessageDe === "demandeur" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-forest-100 px-2 py-0.5 text-[0.65rem] font-semibold text-forest-700" title="Le demandeur a répondu — en attente de votre décision">
                          <MessageSquareReply size={11} /> Réponse reçue
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm text-ink-700/65">{d.email}</p>
                    {d.structureDeclaree && (
                      <p className="mt-1 text-sm text-ink-700/65">
                        Structure déclarée : <span className="font-medium">{d.structureDeclaree}</span>
                      </p>
                    )}
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-700/50">
                      <Clock4 size={13} /> Demande du {d.dateFr}
                    </p>
                  </div>
                </div>
                <RowActions
                  demandeId={d.id}
                  libellePortee={d.libellePortee}
                  rechercheEtablissement={d.rechercheEtablissement}
                  options={d.options}
                  suggestion={d.suggestion}
                  defautPerimetre={d.defautPerimetre}
                />
              </div>

              <EchangeDemande demandeId={d.id} echanges={d.echanges} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
