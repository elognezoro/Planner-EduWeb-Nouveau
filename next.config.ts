import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.public.blob.vercel-storage.com",
      },
    ],
  },
  experimental: {
    serverActions: {
      // Téléversement des documents officiels (armoiries, logo, cachet, signature) :
      // la limite par défaut de 1 Mo est trop basse pour de vraies images. 4,5 Mo est
      // aussi le plafond des fonctions Vercel — les fichiers sont contrôlés à 4 Mo
      // côté client ET côté serveur avec un message clair.
      bodySizeLimit: "4.5mb",
    },
  },
};

export default nextConfig;
