import type { MetadataRoute } from "next";

/**
 * Manifeste d'application web (servi sur /manifest.webmanifest).
 *
 * Il rend EduWeb Planner INSTALLABLE : « Ajouter à l'écran d'accueil » pose une icône et
 * ouvre la plateforme en plein écran, sans barre de navigateur — l'impression d'une vraie
 * application. Il ne rend PAS l'application utilisable hors connexion : cela suppose un
 * service worker, chantier distinct.
 *
 * `start_url` pointe sur l'espace connecté : un utilisateur non connecté y est redirigé
 * vers /connexion par le proxy d'authentification, ce qui est le parcours attendu.
 * Aucune incidence sur l'affichage : ce fichier ne produit qu'un document JSON.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EduWeb Planner",
    short_name: "EduWeb",
    description:
      "Gestion et planification scolaire : emplois du temps, vie scolaire, notes et pilotage.",
    // Identité stable : sans « id », le système déduit l'identité de start_url, et
    // toute évolution de celle-ci ferait apparaître une seconde application installée.
    id: "/app",
    lang: "fr",
    dir: "ltr",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#fbfaf6",
    theme_color: "#154231",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icones/eduweb-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icones/eduweb-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icones/eduweb-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
