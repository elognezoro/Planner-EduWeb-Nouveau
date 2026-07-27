"use client";

import "leaflet/dist/leaflet.css";
import * as React from "react";
import type * as L from "leaflet";

/* ============================================================================
   Carte de géolocalisation des cars (OpenStreetMap via Leaflet, importé en npm
   et chargé dynamiquement côté client — pas de script CDN injecté). Un marqueur
   « bus » par car, étiqueté de son libellé ; recadrage automatique.
   ========================================================================== */

/** Centre par défaut (Abidjan) si aucune position connue. */
const FALLBACK: [number, number] = [5.3599, -4.0083];

export interface BusMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
}

function busIcon(leaflet: typeof import("leaflet"), label: string): L.DivIcon {
  return leaflet.divIcon({
    className: "",
    html:
      '<div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-6px)">' +
      '<div style="font-size:24px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))">🚌</div>' +
      `<div style="background:#13402f;color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:6px;white-space:nowrap;margin-top:1px;box-shadow:0 1px 2px rgba(0,0,0,.3)">${esc(label)}</div>` +
      "</div>",
    iconSize: [40, 44],
    iconAnchor: [20, 38],
  });
}

export function BusMap({
  markers,
  center,
  height = 400,
}: {
  markers: BusMarker[];
  center?: { lat: number; lng: number } | null;
  height?: number;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<L.Map | null>(null);
  const leafletRef = React.useRef<typeof import("leaflet") | null>(null);
  const markerMap = React.useRef<Map<string, L.Marker>>(new Map());
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const leaflet = await import("leaflet");
      if (cancelled || !ref.current || mapRef.current) return;
      const start: [number, number] = center ? [center.lat, center.lng] : FALLBACK;
      const map = leaflet.map(ref.current, { zoomControl: true }).setView(start, 13);
      leaflet
        .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "© OpenStreetMap",
        })
        .addTo(map);
      mapRef.current = map;
      leafletRef.current = leaflet;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      markerMap.current.clear();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      leafletRef.current = null;
    };
    // Initialisation unique.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Synchronise les marqueurs avec la liste des cars.
  React.useEffect(() => {
    const map = mapRef.current;
    const leaflet = leafletRef.current;
    if (!ready || !map || !leaflet) return;
    const seen = new Set<string>();
    for (const m of markers) {
      seen.add(m.id);
      const existing = markerMap.current.get(m.id);
      if (existing) {
        existing.setLatLng([m.lat, m.lng]);
      } else {
        const mk = leaflet
          .marker([m.lat, m.lng], { icon: busIcon(leaflet, m.label) })
          .addTo(map)
          .bindTooltip(esc(m.label), { direction: "top", offset: [0, -38] });
        markerMap.current.set(m.id, mk);
      }
    }
    for (const [id, mk] of markerMap.current) {
      if (!seen.has(id)) {
        mk.remove();
        markerMap.current.delete(id);
      }
    }
    if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], 15);
    } else if (markers.length > 1) {
      map.fitBounds(
        markers.map((m) => [m.lat, m.lng] as [number, number]),
        { padding: [40, 40], maxZoom: 16 },
      );
    }
  }, [ready, markers]);

  return (
    <div
      ref={ref}
      style={{ height, width: "100%", borderRadius: 12, overflow: "hidden" }}
      className="border border-cream-300 bg-cream-100"
    />
  );
}
