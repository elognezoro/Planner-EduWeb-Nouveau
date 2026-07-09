"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3, GraduationCap, Users, Award, CheckCircle2, Trophy, PieChart, MapPin,
  LayoutGrid, Layers, Activity, RefreshCw, TrendingUp, HeartHandshake, Download, Info,
} from "lucide-react";
import { appliquerTerme } from "@/lib/cafop-terme";
import { trouverPays, drapeauEmoji } from "@/lib/referentiels/pays";
import { ChartBarVertical } from "@/app/app/statistiques/etablissement/charts";
import { ChartAire, ChartBarGroupe } from "./charts-cafop";
import type { StatsCafop } from "./donnees";

const nb = (n: number) => n.toLocaleString("fr-FR");
const mentionDe = (m: number) => (m >= 16 ? "Très bien" : m >= 14 ? "Bien" : m >= 12 ? "Assez bien" : m >= 10 ? "Passable" : "Insuffisant");

const ANCRES = [
  { id: "cles", libelle: "Indicateurs clés" },
  { id: "genre", libelle: "Genre" },
  { id: "classements", libelle: "Classements" },
  { id: "mentions", libelle: "Mentions & pays" },
  { id: "repartition", libelle: "Répartition par CAFOP" },
  { id: "groupes", libelle: "Groupes-classes" },
  { id: "graphiques", libelle: "Activité & graphiques" },
];

export function VueStatistiquesCafop({ stats, terme, pays }: { stats: StatsCafop; terme: string; pays: string }) {
  const router = useRouter();
  const T = (s: string) => appliquerTerme(s, terme);
  const code = trouverPays(pays)?.code;
  const [centreSel, setCentreSel] = useState(stats.groupeClasse[0]?.centre ?? "");
  const groupes = useMemo(() => stats.groupeClasse.find((g) => g.centre === centreSel)?.groupes ?? [], [stats.groupeClasse, centreSel]);
  const mentionMax = Math.max(1, ...stats.mentions.map((m) => m.nb));

  const cles = [
    { libelle: T("Centres CAFOP"), valeur: nb(stats.nbCentres), Icone: GraduationCap, ton: "bg-gold-100 text-gold-700", tag: "Audit", tagTon: "bg-forest-100 text-forest-700" },
    { libelle: "Élèves-maîtres", valeur: nb(stats.totalEleves), Icone: Users, ton: "bg-blue-100 text-blue-700", tag: "Formation", tagTon: "bg-blue-100 text-blue-700" },
    { libelle: "Moyenne générale /20", valeur: stats.moyenneGenerale.toFixed(2).replace(".", ","), Icone: Award, ton: "bg-forest-100 text-forest-700", tag: mentionDe(stats.moyenneGenerale), tagTon: "bg-gold-100 text-gold-800" },
    { libelle: "Taux de réussite", valeur: `${stats.tauxReussite.toFixed(1).replace(".", ",")} %`, Icone: CheckCircle2, ton: "bg-purple-100 text-purple-700", tag: `${stats.tauxReussite.toFixed(0)} %`, tagTon: "bg-forest-100 text-forest-700" },
  ];

  return (
    <div id="stats-cafop-imprimable" className="space-y-6">
      <style>{`@media print{#stats-cafop-imprimable,#stats-cafop-imprimable *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}#stats-cafop-imprimable section{break-inside:avoid}#stats-cafop-imprimable .recharts-wrapper{max-width:100%}}`}</style>

      {/* Bandeau (sert aussi d'en-tête à la version imprimée / PDF) */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-gold-300 bg-gold-50/60 p-5 shadow-soft">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gold-500 text-white"><BarChart3 size={20} /></span>
          <div>
            <h2 className="font-display text-lg font-bold text-forest-900">{T("Statistiques CAFOP")}</h2>
            <p className="mt-0.5 text-sm text-ink-700/70">{T("Vue d'ensemble des performances et indicateurs des Centres d'Animation et de Formation Pédagogique.")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 items-center gap-2 rounded-full border border-cream-300 bg-white px-3 text-sm font-medium text-forest-900">
            {code ? drapeauEmoji(code) : "🏳️"} {pays}
          </span>
          <button type="button" onClick={() => window.print()} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-forest-600 bg-forest-600 px-4 text-sm font-semibold text-white hover:bg-forest-700 print:hidden">
            <Download size={15} /> Télécharger PDF
          </button>
          <button type="button" onClick={() => router.refresh()} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-cream-300 bg-white px-4 text-sm font-semibold text-ink-700/80 hover:bg-cream-100 print:hidden">
            <RefreshCw size={15} /> Actualiser
          </button>
        </div>
      </section>

      {/* ALLER À */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-cream-200 bg-white px-4 py-2.5 text-sm print:hidden">
        <span className="font-semibold text-ink-700/45">ALLER À</span>
        {ANCRES.map((a) => (
          <a key={a.id} href={`#${a.id}`} className="rounded-full border border-cream-300 px-3 py-0.5 font-medium text-forest-800 hover:bg-forest-50">{a.libelle}</a>
        ))}
      </div>

      {/* Indicateurs clés */}
      <div id="cles" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cles.map((k) => (
          <div key={k.libelle} className="rounded-2xl border border-cream-200 bg-white p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <span className={`flex h-10 w-10 items-center justify-center rounded-full ${k.ton}`}><k.Icone size={18} /></span>
              <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${k.tagTon}`}>{k.tag}</span>
            </div>
            <p className="mt-3 font-display text-3xl font-bold text-forest-900">{k.valeur}</p>
            <p className="text-sm text-ink-700/60">{k.libelle}</p>
          </div>
        ))}
      </div>
      <p className="-mt-2 flex items-start gap-1.5 px-1 text-xs leading-relaxed text-ink-700/55">
        <Info size={13} className="mt-0.5 shrink-0 text-ink-700/40" />
        <span>Ces quatre repères résument l&apos;essentiel : le nombre de {T("centres CAFOP")} pris en compte, l&apos;effectif total d&apos;élèves-maîtres, la moyenne générale (sur 20) et le taux de réussite. La pastille de couleur rappelle la mention correspondant à la moyenne.</span>
      </p>

      {/* Genre */}
      <Carte id="genre" titre="Statistiques par Genre" sousTitre="Répartition filles / garçons dans l'ensemble des CAFOP" Icone={Users}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <BlocGenre valeur={stats.genre.total} libelle="Total élèves-maîtres" ton="border-cream-200 bg-white" IconeTon="bg-forest-100 text-forest-700" />
          <BlocGenre valeur={stats.genre.filles} libelle="Filles" pct={stats.genre.pctFilles} ton="border-pink-200 bg-pink-50/60" IconeTon="bg-pink-100 text-pink-600" barre="bg-pink-500" />
          <BlocGenre valeur={stats.genre.garcons} libelle="Garçons" pct={stats.genre.pctGarcons} ton="border-blue-200 bg-blue-50/60" IconeTon="bg-blue-100 text-blue-600" barre="bg-blue-500" />
        </div>
        <div className="mt-3 flex h-2.5 overflow-hidden rounded-full">
          <div className="bg-pink-500" style={{ width: `${stats.genre.pctFilles}%` }} />
          <div className="bg-blue-500" style={{ width: `${stats.genre.pctGarcons}%` }} />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-xs text-ink-700/60">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-pink-500" /> Filles</span>
          <span className="inline-flex items-center gap-1">Garçons <span className="h-2 w-2 rounded-full bg-blue-500" /></span>
        </div>
        <Legende>La barre horizontale partage l&apos;effectif total en deux : la partie <strong className="font-semibold text-pink-600">rose</strong> représente les filles, la partie <strong className="font-semibold text-blue-600">bleue</strong> les garçons. Les deux parts additionnées font 100 %.</Legende>
      </Carte>

      {/* Classements */}
      <div id="classements" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Carte titre="Classement Académique" sousTitre={`Top ${T("CAFOP")} par moyenne générale`} Icone={Trophy}>
          <ol className="space-y-1.5">
            {stats.classementAcademique.map((r, i) => (
              <li key={r.nom} className="flex items-center justify-between gap-3 rounded-xl border border-cream-100 px-3 py-2.5">
                <span className="flex items-center gap-3">
                  <Rang i={i} />
                  <span>
                    <span className="block font-semibold text-forest-900">{r.nom}</span>
                    <span className="block text-xs text-ink-700/55">{r.drena} · {nb(r.effectif)} élèves</span>
                  </span>
                </span>
                <span className="shrink-0 font-display text-base font-bold text-forest-800">{r.moyenne.toFixed(2).replace(".", ",")}<span className="text-xs font-normal text-ink-700/50">/20</span></span>
              </li>
            ))}
          </ol>
          <Legende>Les {T("centres")} sont rangés du plus performant au moins performant selon leur moyenne générale sur 20. Le n° 1 affiche donc la meilleure moyenne. Sont indiqués sa DRENA de rattachement et son effectif.</Legende>
        </Carte>
        <Carte titre="Classement Genre Féminin" sousTitre={`Top ${T("CAFOP")} par taux de féminisation`} Icone={HeartHandshake} tonIcone="bg-pink-100 text-pink-600">
          <ol className="space-y-1.5">
            {stats.classementFeminin.map((r, i) => (
              <li key={r.nom} className="rounded-xl border border-cream-100 px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-3"><Rang i={i} /> <span className="font-semibold text-forest-900">{r.nom}</span></span>
                  <span className="shrink-0 font-display text-sm font-bold text-pink-600">{r.taux.toFixed(1).replace(".", ",")} %</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-cream-200">
                  <div className="h-full rounded-full bg-pink-500" style={{ width: `${r.taux}%` }} />
                </div>
              </li>
            ))}
          </ol>
          <Legende>Classement des {T("centres")} selon leur taux de féminisation (part de filles dans l&apos;effectif). Plus la barre rose est longue, plus la proportion de filles y est élevée.</Legende>
        </Carte>
      </div>

      {/* Mentions & Pays */}
      <div id="mentions" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Carte titre="Répartition par Mention" sousTitre="Distribution des notes" Icone={Award} tonIcone="bg-gold-100 text-gold-700">
          <div className="space-y-2.5">
            {stats.mentions.map((m) => (
              <div key={m.libelle}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-forest-900">{m.libelle}</span>
                  <span className="text-ink-700/60">{nb(m.nb)} ({m.pct.toFixed(1).replace(".", ",")}%)</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-cream-200">
                  <div className="h-full rounded-full bg-forest-500" style={{ width: `${(m.nb / mentionMax) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <Legende>Chaque ligne correspond à une mention (de « Très Bien » à « Insuffisant »). Le chiffre indique combien d&apos;élèves-maîtres l&apos;obtiennent et sa part en pourcentage ; la barre verte compare visuellement les mentions entre elles.</Legende>
        </Carte>
        <Carte titre="Répartition par Pays" sousTitre={`${T("CAFOP")} par pays`} Icone={MapPin} tonIcone="bg-blue-100 text-blue-700">
          {stats.parPays.length === 0 ? (
            <p className="text-sm text-ink-700/55">Aucune donnée.</p>
          ) : (
            <div className="space-y-2">
              {stats.parPays.map((p) => (
                <div key={p.pays} className="flex items-center justify-between gap-3 rounded-xl border border-gold-200 bg-gold-50/50 px-4 py-3">
                  <span className="inline-flex items-center gap-2 font-semibold text-forest-900">{code ? drapeauEmoji(code) : "🏳️"} {p.pays}</span>
                  <span className="flex items-center gap-2 text-sm">
                    <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-forest-800">{p.nbCentres} centres</span>
                    <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-gold-800">{nb(p.totalEleves)} élèves-maîtres</span>
                  </span>
                </div>
              ))}
            </div>
          )}
          <Legende>Pour chaque pays affiché, ce bloc récapitule le nombre de {T("centres CAFOP")} et l&apos;effectif total d&apos;élèves-maîtres correspondant.</Legende>
        </Carte>
      </div>

      {/* Répartition par CAFOP */}
      <Carte id="repartition" titre={`${T("Répartition par CAFOP")}`} sousTitre={`${T("CAFOP")} du pays par nombre d'élèves-maîtres`} Icone={LayoutGrid} tonIcone="bg-gold-100 text-gold-700">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {stats.centres.map((c) => (
            <div key={c.nom} className="rounded-2xl border border-cream-200 bg-white p-3 text-center shadow-sm">
              <p className="truncate text-xs font-semibold text-forest-900" title={c.nom}>{c.nom}</p>
              <p className="mt-1 font-display text-2xl font-bold text-gold-700">{nb(c.effectif)}</p>
              <p className="text-[0.7rem] text-ink-700/55">élèves-maîtres</p>
              <p className="mt-0.5 truncate text-[0.65rem] text-ink-700/45">DRENA {c.drena}</p>
            </div>
          ))}
        </div>
        <Legende>Chaque carte représente un {T("centre CAFOP")} : le grand chiffre en or est son effectif d&apos;élèves-maîtres, et la mention « DRENA » précise sa direction régionale de rattachement.</Legende>
      </Carte>

      {/* Groupes-classes */}
      <Carte id="groupes" titre="Statistiques par Groupe-Classe" sousTitre={`Performances détaillées par groupe-classe pour un ${T("CAFOP")}`} Icone={Layers}>
        <label className="block max-w-md">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-700/50">Sélectionner un {T("CAFOP")}</span>
          <select value={centreSel} onChange={(e) => setCentreSel(e.target.value)} className="h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200">
            {stats.groupeClasse.map((g) => <option key={g.centre} value={g.centre}>{g.centre}</option>)}
          </select>
        </label>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {groupes.map((g) => (
            <div key={g.nom} className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-forest-900">{g.nom}</span>
                <span className="rounded-full bg-forest-100 px-2 py-0.5 text-[0.65rem] font-semibold text-forest-800">{g.reussite} % réussite</span>
              </div>
              <p className="mt-1 font-display text-2xl font-bold text-forest-900">{g.moyenne.toFixed(2).replace(".", ",")}<span className="text-sm font-normal text-ink-700/50">/20</span></p>
              <p className="text-xs text-ink-700/55">{g.effectif} élèves-maîtres</p>
              <div className="mt-2 flex h-2 overflow-hidden rounded-full">
                <div className="bg-pink-500" style={{ width: `${(g.filles / g.effectif) * 100}%` }} />
                <div className="bg-blue-500" style={{ width: `${(g.garcons / g.effectif) * 100}%` }} />
              </div>
              <div className="mt-1 flex justify-between text-[0.7rem] text-ink-700/55">
                <span>{g.filles} filles</span>
                <span>{g.garcons} garçons</span>
              </div>
            </div>
          ))}
        </div>
        <Legende>Choisissez un {T("centre")} dans la liste ci-dessus : chaque carte détaille alors un groupe-classe — sa moyenne sur 20, son taux de réussite, et la répartition filles (rose) / garçons (bleu) de ses effectifs.</Legende>
      </Carte>

      {/* KPI secondaires */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiMini libelle="Progression moyenne" valeur={`${stats.progressionMoyenne} %`} Icone={TrendingUp} ton="bg-blue-100 text-blue-700" />
        <KpiMini libelle="Taux de participation" valeur={`${stats.tauxParticipation} %`} Icone={Activity} ton="bg-gold-100 text-gold-700" />
        <KpiMini libelle="Cohortes actives" valeur={nb(stats.cohortesActives)} Icone={Layers} ton="bg-purple-100 text-purple-700" />
      </div>
      <p className="-mt-2 flex items-start gap-1.5 px-1 text-xs leading-relaxed text-ink-700/55">
        <Info size={13} className="mt-0.5 shrink-0 text-ink-700/40" />
        <span>Trois repères complémentaires : la <strong className="font-semibold">progression moyenne</strong> (avancement moyen des programmes), le <strong className="font-semibold">taux de participation</strong> (ici une moyenne globale — le graphique « Taux de participation » plus bas en montre l&apos;évolution mois par mois) et le nombre de <strong className="font-semibold">cohortes actives</strong> (promotions en cours de formation).</span>
      </p>

      {/* Graphiques */}
      <div id="graphiques" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Carte titre="Effectifs par centre" sousTitre="Nombre d'élèves-maîtres" Icone={BarChart3}>
          <ChartBarVertical data={stats.effectifsParCentre} nomSerie="Élèves-maîtres" couleur="#246a48" />
          <Legende>Chaque barre verticale correspond à un {T("centre")} : plus la barre est haute, plus il compte d&apos;élèves-maîtres inscrits. Ce graphique permet de comparer d&apos;un coup d&apos;œil la taille des {T("centres")}.</Legende>
        </Carte>
        <Carte titre="Progression par promotion" sousTitre="Avancement (%)" Icone={TrendingUp} tonIcone="bg-gold-100 text-gold-700">
          <ChartBarVertical data={stats.progressionParPromotion} nomSerie="Progression (%)" couleur="#e3b536" />
          <Legende>Chaque barre représente une <strong className="font-semibold">promotion</strong>, désignée par ses années d&apos;entrée et de sortie (ex. « 2023-2026 »). Sa hauteur indique l&apos;<strong className="font-semibold">avancement du programme de formation</strong>, de 0 % (tout début) à 100 % (formation achevée). Les promotions les plus anciennes sont logiquement les plus avancées ; les plus récentes commencent à peine.</Legende>
        </Carte>
        <Carte titre="Taux de participation" sousTitre="Activité sur les plateformes" Icone={Activity}>
          <ChartAire data={stats.participationMensuelle} nomSerie="Participation (%)" />
          <Legende>La courbe suit, mois après mois (d&apos;octobre à mai), le taux moyen de participation des élèves-maîtres (présence et activité), exprimé en pourcentage. Une courbe qui monte traduit une participation en hausse.</Legende>
        </Carte>
        <Carte titre="Effectifs par cohorte" sousTitre="Répartition" Icone={PieChart} tonIcone="bg-blue-100 text-blue-700">
          <ChartBarGroupe data={stats.effectifsParCohorte} />
          <Legende>Pour chaque {T("centre")}, deux barres sont comparées : le nombre de <strong className="font-semibold text-forest-600">places ouvertes</strong> en promotion et l&apos;<strong className="font-semibold text-blue-600">effectif réel</strong> d&apos;élèves-maîtres. L&apos;écart entre les deux mesure le taux de remplissage.</Legende>
        </Carte>
      </div>
    </div>
  );
}

/** Note explicative « fine » sous un diagramme, pour que tout lecteur comprenne ce qu'il regarde. */
function Legende({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 flex items-start gap-1.5 border-t border-cream-100 pt-2.5 text-xs leading-relaxed text-ink-700/55">
      <Info size={13} className="mt-0.5 shrink-0 text-ink-700/40" />
      <span>{children}</span>
    </p>
  );
}

function Carte({ id, titre, sousTitre, Icone, tonIcone = "bg-gold-100 text-gold-700", children }: { id?: string; titre: string; sousTitre?: string; Icone: typeof BarChart3; tonIcone?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="rounded-2xl border border-cream-200 bg-white p-5 shadow-soft">
      <div className="mb-4 flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${tonIcone}`}><Icone size={17} /></span>
        <div>
          <h2 className="font-display text-base font-bold text-forest-900">{titre}</h2>
          {sousTitre && <p className="text-sm text-ink-700/60">{sousTitre}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function BlocGenre({ valeur, libelle, pct, ton, IconeTon, barre }: { valeur: number; libelle: string; pct?: number; ton: string; IconeTon: string; barre?: string }) {
  return (
    <div className={`rounded-2xl border p-4 text-center ${ton}`}>
      <span className={`mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full ${IconeTon}`}><Users size={17} /></span>
      <p className="font-display text-2xl font-bold text-forest-900">{valeur.toLocaleString("fr-FR")}</p>
      <p className="text-xs text-ink-700/60">{libelle}</p>
      {pct !== undefined && (
        <>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/70">
            <div className={`h-full rounded-full ${barre}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-[0.7rem] font-semibold text-ink-700/60">{pct.toFixed(1).replace(".", ",")}%</p>
        </>
      )}
    </div>
  );
}

function Rang({ i }: { i: number }) {
  const tons = ["bg-gold-400 text-white", "bg-cream-300 text-forest-800", "bg-amber-700/80 text-white", "bg-forest-100 text-forest-700"];
  return <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${tons[i] ?? tons[3]}`}>{i + 1}</span>;
}

function KpiMini({ libelle, valeur, Icone, ton }: { libelle: string; valeur: string; Icone: typeof BarChart3; ton: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-cream-200 bg-white p-5 shadow-soft">
      <div>
        <p className="text-sm text-ink-700/60">{libelle}</p>
        <p className="mt-1 font-display text-2xl font-bold text-forest-900">{valeur}</p>
      </div>
      <span className={`flex h-11 w-11 items-center justify-center rounded-full ${ton}`}><Icone size={20} /></span>
    </div>
  );
}
