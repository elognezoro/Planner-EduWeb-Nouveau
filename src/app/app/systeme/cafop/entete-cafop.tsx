"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { GraduationCap, RefreshCw, Plus, X, FileSpreadsheet, Upload, BarChart3, FileText, BookOpen, Download, Maximize2, Minimize2, MoreHorizontal } from "lucide-react";
import { creerStructure, importerCafopCSV, type EtatForm } from "@/lib/formation/actions";
import { FormAlert, SubmitButton } from "@/components/ui/form";
import { appliquerTerme } from "@/lib/cafop-terme";
import { FeuilleBas } from "@/components/app/mobile/feuille-bas";
import { PublierTitreMobile } from "@/components/app/mobile/publier-titre";

const BASE = "/app/systeme/cafop";
const champCls =
  "h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 mobile:h-11";
const initial: EtatForm = { ok: false };

export type OngletCafop = "gestion" | "enseignements" | "statistiques" | "rapports";

/** Modèle CSV d'import des CAFOP (délimiteur ; — colonnes en colonnes dans Excel FR). */
function telechargerModeleCsv() {
  const entete = ["nom", "code", "drena", "localite", "directeur", "telephone", "effectif", "pays"];
  const exemple = ["CAFOP d'Abidjan", "CAF-ABJ-002", "Abidjan", "Abidjan", "M. KOUASSI Jean", "+225 07 00 00 00 00", "300", "Côte d'Ivoire"];
  const csv = [entete.join(";"), exemple.join(";")].join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "modele-cafop.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function EnteteCafop({
  ongletActif,
  nbCentres,
  regions,
  terme = "CAFOP",
  lectureSeule = false,
  compactMobile = false,
}: {
  ongletActif: OngletCafop;
  nbCentres: number;
  regions: { id: string; nom: string }[];
  terme?: string;
  /** Rôle en lecture seule (adc/delc) : masque l'import et la création de CAFOP. */
  lectureSeule?: boolean;
  /** Pages d'UN centre : sur téléphone, cet en-tête global est masqué (le sous-en-tête du centre
   *  et l'en-tête mobile suffisent). Sans effet sur ordinateur et à l'impression. */
  compactMobile?: boolean;
}) {
  const router = useRouter();
  const [formOuvert, setFormOuvert] = useState(false);
  const [importOuvert, setImportOuvert] = useState(false);
  // Téléphone : outils secondaires (modèle, import, actualiser) regroupés dans une feuille « ⋯ ».
  const [outilsOuverts, setOutilsOuverts] = useState(false);
  const T = (s: string) => appliquerTerme(s, terme);

  const onglets: { cle: OngletCafop | string; libelle: string; court: string; href: string; dispo: boolean; Icone?: typeof BookOpen }[] = [
    { cle: "gestion", libelle: "Gestion", court: "Gestion", href: BASE, dispo: true },
    { cle: "enseignements", libelle: "Enseignements & Évaluation", court: "Enseignements", href: `${BASE}/enseignements`, dispo: true, Icone: BookOpen },
    { cle: "statistiques", libelle: "Statistiques", court: "Statistiques", href: `${BASE}/statistiques`, dispo: true, Icone: BarChart3 },
    { cle: "rapports", libelle: "Rapports", court: "Rapports", href: `${BASE}/rapports`, dispo: true, Icone: FileText },
  ];

  return (
    <div className={compactMobile ? "space-y-4 print:hidden masque-ecran-mobile" : "space-y-4 print:hidden"}>
      {/* Titre de l'en-tête mobile (les pages d'un centre publient le nom du centre). */}
      {!compactMobile && <PublierTitreMobile titre={T("Gestion des CAFOP")} />}
      {/* En-tête + onglets */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        {/* Téléphone : titre et description masqués à l'œil (déjà portés par l'en-tête mobile),
            toujours lus par les lecteurs d'écran. */}
        <div className="titre-page-ecran-mobile flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gold-500 text-white">
            <GraduationCap size={22} />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold text-forest-900">{T("Gestion des CAFOP")}</h1>
            <p className="mt-0.5 text-sm text-ink-700/70">
              {nbCentres.toLocaleString("fr-FR")} {T("CAFOP enregistrés — Centres d'Animation et de Formation Pédagogique")}
            </p>
          </div>
        </div>
        {/* Téléphone : onglets sur une ligne qui défile, libellés courts. */}
        <nav className="rangee-defilante-mobile flex flex-wrap gap-1.5 mobile:w-full">
          {onglets.map((o) => (
            <Link
              key={o.cle}
              href={o.href}
              aria-current={o.cle === ongletActif ? "page" : undefined}
              className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors mobile:h-11 mobile:px-4 ${
                o.cle === ongletActif ? "bg-gold-100 text-gold-800" : "border border-cream-300 text-ink-700/70 hover:bg-cream-100"
              }`}
            >
              {o.Icone && <o.Icone size={15} />}{" "}
              <span>
                <span className="mobile:hidden">{o.libelle}</span>
                <span className="hidden mobile:inline">{o.court}</span>
              </span>
            </Link>
          ))}
        </nav>
      </div>

      {/* Barre d'outils */}
      <div className={lectureSeule ? "flex flex-wrap items-center gap-2 mobile:hidden" : "flex flex-wrap items-center gap-2"}>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-cream-300 bg-white px-4 text-sm font-semibold text-ink-700/80 hover:bg-cream-100 mobile:hidden"
        >
          <RefreshCw size={15} /> Actualiser
        </button>
        {!lectureSeule && (
          <>
            <button
              type="button"
              onClick={telechargerModeleCsv}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-cream-300 bg-white px-4 text-sm font-semibold text-ink-700/80 hover:bg-cream-100 mobile:hidden"
            >
              <FileSpreadsheet size={15} /> Modèle CSV
            </button>
            <button
              type="button"
              onClick={() => setImportOuvert(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-cream-300 bg-white px-4 text-sm font-semibold text-ink-700/80 hover:bg-cream-100 mobile:hidden"
            >
              <Upload size={15} /> Importer CSV
            </button>
            <button
              type="button"
              onClick={() => setFormOuvert(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-gold-500 px-4 text-sm font-semibold text-white hover:bg-gold-600 mobile:h-11 mobile:flex-1 mobile:justify-center"
            >
              <Plus size={16} /> {T("Nouveau CAFOP")}
            </button>
            <div className="lg:hidden print:hidden">
              <button
                type="button"
                onClick={() => setOutilsOuverts(true)}
                aria-label="Autres outils : modèle CSV, import, actualiser"
                aria-haspopup="dialog"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-cream-300 bg-white text-forest-800 active:bg-cream-100"
              >
                <MoreHorizontal size={20} />
              </button>
              <FeuilleBas ouvert={outilsOuverts} onFermer={() => setOutilsOuverts(false)} titre="Outils">
                <div className="space-y-1 px-2 pb-2">
                  {[
                    { libelle: "Télécharger le modèle CSV", Icone: FileSpreadsheet, action: telechargerModeleCsv },
                    { libelle: "Importer un fichier CSV", Icone: Upload, action: () => setImportOuvert(true) },
                    { libelle: "Actualiser", Icone: RefreshCw, action: () => router.refresh() },
                  ].map(({ libelle, Icone, action }) => (
                    <button
                      key={libelle}
                      type="button"
                      onClick={() => {
                        setOutilsOuverts(false);
                        action();
                      }}
                      className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left font-semibold text-forest-900 active:bg-cream-100"
                    >
                      <Icone size={18} className="text-forest-700" /> {libelle}
                    </button>
                  ))}
                </div>
              </FeuilleBas>
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {formOuvert && (
          <NouveauCafopModal terme={terme} regions={regions} onFerme={() => setFormOuvert(false)} onCree={() => { setFormOuvert(false); router.refresh(); }} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {importOuvert && <ImporterCsvModal terme={terme} onFerme={() => setImportOuvert(false)} onImporte={() => { setImportOuvert(false); router.refresh(); }} />}
      </AnimatePresence>
    </div>
  );
}

function NouveauCafopModal({
  regions,
  onFerme,
  onCree,
  terme,
}: {
  regions: { id: string; nom: string }[];
  onFerme: () => void;
  onCree: () => void;
  terme: string;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const T = (s: string) => appliquerTerme(s, terme);
  const [f, setF] = useState({ nom: "", drena: "", localite: "", directeur: "", directeurTel: "", effectif: "", regionId: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  function creer() {
    if (!f.nom.trim()) {
      setMsg(T("Le nom du CAFOP est obligatoire."));
      return;
    }
    start(async () => {
      const r = await creerStructure("cafop", f.nom, {
        regionId: f.regionId || null,
        drena: f.drena,
        localite: f.localite,
        directeur: f.directeur,
        directeurTel: f.directeurTel,
        effectif: f.effectif ? Number(f.effectif) : 0,
      });
      if (r.ok) onCree();
      else setMsg(r.message ?? "Erreur.");
    });
  }

  return (
    <Modale titre={T("Nouveau CAFOP")} onFerme={() => !pending && onFerme()} large>
      <div className="space-y-3">
        {msg && <FormAlert ton="erreur">{msg}</FormAlert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-forest-900">{T("Nom du CAFOP")} *</span>
            <input value={f.nom} onChange={set("nom")} placeholder={T("Ex : CAFOP d'Abidjan")} className={champCls} />
          </label>
          <Champ label="DRENA"><input value={f.drena} onChange={set("drena")} placeholder="Ex : Abidjan" className={champCls} /></Champ>
          <Champ label="Localité"><input value={f.localite} onChange={set("localite")} placeholder="Ex : Abidjan" className={champCls} /></Champ>
          <Champ label="Directeur"><input value={f.directeur} onChange={set("directeur")} placeholder="Ex : M. KOUASSI Jean" className={champCls} /></Champ>
          <Champ label="Téléphone"><input value={f.directeurTel} onChange={set("directeurTel")} placeholder="+225 07 00 00 00 00" className={champCls} /></Champ>
          <Champ label="Effectif (élèves-maîtres)"><input value={f.effectif} onChange={set("effectif")} type="number" min={0} placeholder="0" className={champCls} /></Champ>
          <Champ label="Région (facultatif)">
            <select value={f.regionId} onChange={set("regionId")} className={champCls}>
              <option value="">—</option>
              {regions.map((r) => <option key={r.id} value={r.id}>{r.nom}</option>)}
            </select>
          </Champ>
        </div>
        <p className="text-xs text-ink-700/50">Le code du centre (ex. « CAF-ABJ-002 ») est généré automatiquement.</p>
        <div className="flex justify-end gap-2 pt-1">
          <BoutonAnnuler onClick={onFerme} disabled={pending} />
          <button type="button" onClick={creer} disabled={pending} className="inline-flex h-11 items-center gap-2 rounded-full bg-gold-500 px-6 text-sm font-semibold text-white hover:bg-gold-600 disabled:opacity-70">
            <Plus size={16} /> {T("Créer le CAFOP")}
          </button>
        </div>
      </div>
    </Modale>
  );
}

function ImporterCsvModal({ onFerme, onImporte, terme }: { onFerme: () => void; onImporte: () => void; terme: string }) {
  const [etat, action, pending] = useActionState(importerCafopCSV, initial);
  const notifie = useRef(false); // ne notifie qu'une fois, malgré les re-render pendant l'animation de sortie
  useEffect(() => {
    if (etat.ok && !notifie.current) {
      notifie.current = true;
      onImporte();
    }
  }, [etat.ok, onImporte]);

  return (
    <Modale titre={appliquerTerme("Importer des CAFOP (CSV)", terme)} onFerme={() => !pending && onFerme()} large>
      <form action={action} className="space-y-3">
        {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
        <p className="text-sm text-ink-700/70">
          Colonnes reconnues : <code className="text-xs">nom</code>, <code className="text-xs">code</code>,{" "}
          <code className="text-xs">drena</code>, <code className="text-xs">localite</code>,{" "}
          <code className="text-xs">directeur</code>, <code className="text-xs">telephone</code>,{" "}
          <code className="text-xs">effectif</code>, <code className="text-xs">pays</code>.{" "}
          {appliquerTerme("Un CAFOP existant (même nom) est mis à jour ; sinon il est créé.", terme)} Téléchargez le{" "}
          <strong>Modèle CSV</strong> pour l&apos;en-tête.
        </p>
        <textarea
          name="texte"
          rows={5}
          placeholder={"Collez le CSV ici…\nnom;drena;localite;directeur;telephone;effectif\nCAFOP de Séguéla;Séguéla;Séguéla;M. TRAORÉ;+225 07 12 34 56 78;180"}
          className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 mobile:text-base"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <input type="file" name="fichier" accept=".csv,text/csv,.txt" className="text-xs mobile:w-full mobile:text-sm" />
          <div className="flex gap-2 mobile:w-full mobile:justify-end">
            <BoutonAnnuler onClick={onFerme} disabled={pending} />
            <SubmitButton className="w-auto px-6"><Download size={15} /> Importer</SubmitButton>
          </div>
        </div>
      </form>
    </Modale>
  );
}

// ── Primitives partagées ──

export function Modale({
  titre,
  onFerme,
  large,
  xl,
  agrandissable = false,
  children,
}: {
  titre: string;
  onFerme: () => void;
  large?: boolean;
  xl?: boolean;
  /** Affiche un bouton pour agrandir la fenêtre à (presque) tout l'écran. */
  agrandissable?: boolean;
  children: React.ReactNode;
}) {
  const [agrandi, setAgrandi] = useState(false);
  const largeur = xl ? "w-[min(58rem,calc(100vw-2rem))]" : large ? "w-[min(36rem,calc(100vw-2rem))]" : "w-[min(30rem,calc(100vw-2rem))]";
  // Téléphone : la fenêtre devient une feuille ancrée en bas, bornée à la hauteur VISIBLE (dvh) —
  // 100vh dépassait la zone visible d'iOS et les boutons (Créer, Importer…) passaient sous la
  // barre du navigateur. Agrandie : plein écran.
  const dimensions = agrandi
    ? "h-[calc(100vh-1rem)] w-[calc(100vw-1rem)] max-h-none rounded-2xl mobile:h-dvh mobile:w-full mobile:rounded-none"
    : `${largeur} max-h-[calc(100vh-2rem)] rounded-3xl mobile:w-full mobile:max-h-[92dvh] mobile:rounded-b-none`;
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onFerme} className="fixed inset-0 z-50 bg-forest-950/40 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        role="dialog"
        aria-modal="true"
        className={`fixed left-1/2 top-1/2 z-50 flex -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden border border-cream-200 bg-white shadow-soft mobile:bottom-0 mobile:left-0 mobile:top-auto mobile:translate-x-0 mobile:translate-y-0 ${dimensions}`}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-cream-100 px-5 py-3.5 mobile:px-4 mobile:py-1.5">
          <h2 className="min-w-0 truncate font-display text-base font-bold text-forest-900">{titre}</h2>
          <div className="flex shrink-0 items-center gap-1">
            {agrandissable && (
              <button
                type="button"
                onClick={() => setAgrandi((v) => !v)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-700/50 hover:bg-cream-100 mobile:h-11 mobile:w-11"
                aria-label={agrandi ? "Réduire la fenêtre" : "Agrandir la fenêtre"}
                title={agrandi ? "Réduire" : "Agrandir (plein écran)"}
              >
                {agrandi ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
              </button>
            )}
            <button type="button" onClick={onFerme} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-700/50 hover:bg-cream-100 mobile:h-11 mobile:w-11" aria-label="Fermer">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 mobile:p-4 mobile:pb-[calc(1rem+var(--marge-sure-bas))]">{children}</div>
      </motion.div>
    </>
  );
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label>
      <span className="mb-1.5 block text-sm font-medium text-forest-900">{label}</span>
      {children}
    </label>
  );
}

function BoutonAnnuler({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="h-11 rounded-full border border-cream-300 px-5 text-sm font-medium text-ink-700/70 hover:bg-cream-100 disabled:opacity-60">
      Annuler
    </button>
  );
}
